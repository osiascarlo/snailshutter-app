const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

/**
 * GET /api/admin/analytics
 * Returns aggregated data for the analytics dashboard
 */
router.get('/analytics', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        // 1. Total Revenue (Confirmed & Completed)
        const [revenueResult] = await pool.execute(`
            SELECT SUM(b.total_price) as total_revenue
            FROM bookings b
            WHERE b.status IN ('confirmed', 'completed')
        `);
        const totalRevenue = revenueResult[0].total_revenue || 0;

        // 2. Bookings by Status (Ensure all categories exist)
        const [statusRows] = await pool.execute(`
            SELECT status, COUNT(*) as count
            FROM bookings
            GROUP BY status
        `);
        
        const allStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        const statusCounts = allStatuses.map(s => ({
            status: s,
            count: statusRows.find(row => row.status === s)?.count || 0
        }));

        // 3. Monthly Trends (Last 6 Months, padded)
        const [trendsRows] = await pool.execute(`
            SELECT 
                DATE_FORMAT(booking_date, '%Y-%m') as month,
                COUNT(*) as count
            FROM bookings
            WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month
            ORDER BY month ASC
        `);

        // Pad trends for last 6 months
        const trends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
            const existing = trendsRows.find(t => t.month === monthStr);
            trends.push({
                month: monthStr,
                count: existing ? existing.count : 0
            });
        }

        // 4. Top Services (Most Booked)
        const [servicesResult] = await pool.execute(`
            SELECT s.name, COUNT(b.id) as count
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            GROUP BY s.id
            ORDER BY count DESC
            LIMIT 5
        `);

        // 5. Staff Performance
        const [staffResult] = await pool.execute(`
            SELECT u.full_name as name, COUNT(b.id) as count
            FROM bookings b
            JOIN users u ON b.staff_id = u.id
            WHERE b.status = 'completed'
            GROUP BY u.id
            ORDER BY count DESC
        `);

        // 6. Recent Revenue (Today)
        const [todayRevenue] = await pool.execute(`
            SELECT SUM(b.total_price) as total
            FROM bookings b
            WHERE b.status IN ('confirmed', 'completed') AND DATE(b.created_at) = CURDATE()
        `);

        res.json({
            success: true,
            data: {
                totalRevenue,
                todayRevenue: todayRevenue[0].total || 0,
                statusCounts,
                trends,
                topServices: servicesResult,
                staffPerformance: staffResult
            }
        });

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || (error.message && error.message.includes('connect'))) {
            console.warn('DB unavailable, serving fallback analytics');
            const bookingsRouter = require('./bookings_node');
            const fallbackBookings = bookingsRouter.FALLBACK_BOOKINGS || [];

            // 1. Total Revenue
            const totalRevenue = fallbackBookings
                .filter(b => ['confirmed', 'completed'].includes(b.status))
                .reduce((sum, b) => sum + Number(b.total_price), 0);

            // 2. Bookings by Status
            const allStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
            const statusCounts = allStatuses.map(s => ({
                status: s,
                count: fallbackBookings.filter(b => b.status === s).length
            }));

            // 3. Trends (Last 6 Months)
            const trends = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthStr = d.toISOString().slice(0, 7);
                const count = fallbackBookings.filter(b => {
                    const bMonth = new Date(b.booking_date).toISOString().slice(0, 7);
                    return bMonth === monthStr;
                }).length;
                trends.push({ month: monthStr, count });
            }

            // 4. Top Services
            const topServices = [
                { name: 'Portrait Session', count: 12 },
                { name: 'Wedding Coverage', count: 8 },
                { name: 'Event Photography', count: 5 }
            ];

            // 5. Staff Performance
            const staffPerformance = [
                { name: 'Staff User', count: 4 }
            ];

            return res.json({
                success: true,
                data: {
                    totalRevenue,
                    todayRevenue: 0,
                    statusCounts,
                    trends,
                    topServices,
                    staffPerformance
                }
            });
        }
        console.error('Analytics Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Settings Management Routes
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const settingsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'assets/uploads/settings';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'gcash-qr-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const settingsUpload = multer({
    storage: settingsStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/i;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp) are allowed for GCash QR code'));
    }
});

router.get('/settings/public', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM settings');
        const settings = {};
        const publicKeys = [
            'studioName', 'studioEmail', 'studioPhone', 'studioAddress',
            'studioHours', 'studioMapEmbed', 'studioDirectionsLink', 'gcashQr'
        ];
        rows.forEach(r => {
            if (publicKeys.includes(r.setting_key)) {
                settings[r.setting_key] = r.setting_value;
            }
        });
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Get Public Settings Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.get('/settings', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM settings');
        const settings = {};
        rows.forEach(r => {
            settings[r.setting_key] = r.setting_value;
        });
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Get Settings Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.post('/settings', authMiddleware, roleMiddleware(['admin']), (req, res, next) => {
    console.log('[POST /settings] Request received. Parsing multipart/form-data via multer...');
    settingsUpload.single('gcashQr')(req, res, function (err) {
        console.log('[POST /settings] Multer finished parsing. Error:', err || 'none');
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
}, async (req, res) => {
    console.log('[POST /settings] Main handler started. Body:', req.body, 'File:', req.file);
    try {
        const keys = [
            'studioName', 'studioEmail', 'studioPhone', 'studioAddress', 
            'emailNotifications', 'bookingReminders', 'maintenanceMode', 
            'themeColor', 'timeZone',
            'studioHours', 'studioMapEmbed', 'studioDirectionsLink'
        ];

        for (const key of keys) {
            if (req.body[key] !== undefined) {
                console.log(`[POST /settings] Saving DB setting: ${key} = "${req.body[key]}"`);
                await pool.execute(
                    'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                    [key, req.body[key], req.body[key]]
                );
            }
        }

        if (req.file) {
            const gcashQrPath = `/assets/uploads/settings/${req.file.filename}`;
            console.log('[POST /settings] Saving DB setting: gcashQr =', gcashQrPath);
            await pool.execute(
                'INSERT INTO settings (setting_key, setting_value) VALUES ("gcashQr", ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [gcashQrPath, gcashQrPath]
            );
        }

        console.log('[POST /settings] All settings saved successfully. Sending JSON response.');
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (error) {
        console.error('[POST /settings] Save Settings Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
