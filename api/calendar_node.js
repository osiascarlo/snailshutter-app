const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/calendar
 */
router.get('/', authMiddleware, async (req, res) => {
    const action = req.query.action;
    const userId = req.session.user_id;
    const userRole = req.session.user_role;

    if (action === 'get_month') {
        const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
        const year = parseInt(req.query.year) || new Date().getFullYear();

        // Calculate start and end date of the month
        const sd = `${year}-${month.toString().padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const ed = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

        try {
            let sql = "SELECT b.*, u.full_name as client_name, s.name as service_name FROM bookings b JOIN users u ON b.client_id=u.id JOIN services s ON b.service_id=s.id WHERE b.booking_date BETWEEN ? AND ?";
            let params = [sd, ed];

            if (userRole === 'staff') {
                sql += " AND b.staff_id=?";
                params.push(userId);
            } else if (userRole === 'client') {
                sql += " AND b.client_id=?";
                params.push(userId);
            }

            sql += " ORDER BY b.booking_date, b.start_time";

            const [bookings] = await pool.execute(sql, params);

            // Fetch all services to resolve multi-service names
            let services = [];
            try {
                const [rows] = await pool.execute('SELECT id, name FROM services');
                services = rows;
            } catch (e) {
                const servicesRouter = require('./services_node');
                services = servicesRouter.FALLBACK_SERVICES || [];
            }

            // Map booking service names based on service_ids
            bookings.forEach(b => {
                const idsStr = b.service_ids || b.service_id.toString();
                const ids = idsStr.split(',').map(idStr => parseInt(idStr.trim()));
                const matching = services.filter(s => ids.includes(s.id));
                if (matching.length > 0) {
                    b.service_name = matching.map(s => s.name).join(', ');
                }
            });

            res.json({ success: true, bookings: bookings });

        } catch (error) {
            if (error.code === 'ECONNREFUSED' || (error.message && error.message.includes('connect'))) {
                console.warn('DB unavailable, serving fallback calendar bookings:', error.message);
                const bookingsRouter = require('./bookings_node');
                const servicesRouter = require('./services_node');
                const fallbackBookings = bookingsRouter.FALLBACK_BOOKINGS || [];
                const fallbackServices = servicesRouter.FALLBACK_SERVICES || [];

                let list = fallbackBookings.filter(b => {
                    return b.booking_date >= sd && b.booking_date <= ed;
                }).map(b => ({ ...b }));

                if (userRole === 'staff') {
                    list = list.filter(b => b.staff_id === userId);
                } else if (userRole === 'client') {
                    list = list.filter(b => b.client_id === userId);
                }

                // Map service names for fallback bookings
                list.forEach(b => {
                    const idsStr = b.service_ids || b.service_id.toString();
                    const ids = idsStr.split(',').map(idStr => parseInt(idStr.trim()));
                    const matching = fallbackServices.filter(s => ids.includes(s.id));
                    if (matching.length > 0) {
                        b.service_name = matching.map(s => s.name).join(', ');
                    }
                });

                return res.json({ success: true, bookings: list });
            }
            console.error('Fetch Calendar Error:', error);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    } else {
        res.status(400).json({ success: false, message: 'Invalid action' });
    }
});

module.exports = router;
