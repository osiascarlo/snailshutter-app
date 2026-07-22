const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');
const { notifyDate, notifyAdminBooking } = require('./availability_sse');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'assets/uploads/proofs';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + (req.session.user_id || 'guest') + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|gif/i;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp, gif) are allowed for proof of payment'));
    }
});
const FALLBACK_BOOKINGS = [
    {
        id: 1,
        client_id: 3,
        staff_id: 2,
        service_id: 1,
        service_ids: "1",
        booking_date: "2026-07-18",
        start_time: "10:00:00",
        end_time: "11:00:00",
        status: "confirmed",
        notes: "Portrait session in studio",
        total_price: 1500.00,
        downpayment_amount: 150.00,
        payment_status: "paid",
        client_name: "Client User",
        staff_name: "Staff User",
        service_name: "Portrait Session",
        created_at: new Date()
    },
    {
        id: 2,
        client_id: 3,
        staff_id: null,
        service_id: 2,
        service_ids: "2,3",
        booking_date: "2026-07-25",
        start_time: "13:00:00",
        end_time: "18:00:00",
        status: "pending",
        notes: "Wedding Coverage + Product Photography",
        total_price: 17000.00,
        downpayment_amount: 1700.00,
        payment_status: "pending",
        client_name: "Client User",
        staff_name: null,
        service_name: "Wedding Coverage, Product Photography",
        created_at: new Date()
    }
];

/**
 * GET /api/bookings
 */
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.session.user_id;
    const userRole = req.session.user_role;

    try {
        let query;
        let params = [];

        if (userRole === 'client') {
            query = `
                SELECT b.*, s.name as service_name, st.full_name as staff_name 
                FROM bookings b 
                JOIN services s ON b.service_id = s.id 
                LEFT JOIN users st ON b.staff_id = st.id 
                WHERE b.client_id = ? 
                ORDER BY b.booking_date DESC, b.start_time DESC
            `;
            params = [userId];
        } else if (userRole === 'staff') {
            query = `
                SELECT b.*, s.name as service_name, c.full_name as client_name, st.full_name as staff_name 
                FROM bookings b 
                JOIN services s ON b.service_id = s.id 
                JOIN users c ON b.client_id = c.id 
                LEFT JOIN users st ON b.staff_id = st.id 
                ORDER BY b.booking_date DESC, b.start_time DESC
            `;
            params = [];
        } else { // admin
            query = `
                SELECT b.*, s.name as service_name, c.full_name as client_name, st.full_name as staff_name 
                FROM bookings b 
                JOIN services s ON b.service_id = s.id 
                JOIN users c ON b.client_id = c.id 
                LEFT JOIN users st ON b.staff_id = st.id 
                ORDER BY b.booking_date DESC, b.start_time DESC
            `;
        }

        const [bookings] = await pool.execute(query, params);

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

        res.json({ success: true, data: bookings });

    } catch (error) {
        console.warn('DB unavailable, serving fallback bookings:', error.code || error.message);
        const servicesRouter = require('./services_node');
        const fallbackServices = servicesRouter.FALLBACK_SERVICES || [];

        let list = FALLBACK_BOOKINGS.map(b => ({ ...b }));
        if (userRole === 'client') {
            list = list.filter(b => b.client_id === userId);
        }

        // Map booking service names for fallback bookings
        list.forEach(b => {
            const idsStr = b.service_ids || b.service_id.toString();
            const ids = idsStr.split(',').map(idStr => parseInt(idStr.trim()));
            const matching = fallbackServices.filter(s => ids.includes(s.id));
            if (matching.length > 0) {
                b.service_name = matching.map(s => s.name).join(', ');
            }
        });

        res.json({ success: true, data: list });
    }
});

// Helper functions for time conversion and comparison
function formatTimeStr(timeVal) {
    if (!timeVal) return '00:00:00';
    if (timeVal instanceof Date) {
        const h = String(timeVal.getHours()).padStart(2, '0');
        const m = String(timeVal.getMinutes()).padStart(2, '0');
        const s = String(timeVal.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
    if (typeof timeVal === 'object') {
        const h = String(timeVal.hours ?? timeVal.hour ?? 0).padStart(2, '0');
        const m = String(timeVal.minutes ?? timeVal.minute ?? 0).padStart(2, '0');
        const s = String(timeVal.seconds ?? timeVal.second ?? 0).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
    let timeStr = String(timeVal);
    
    // Check if it's a full Date string (e.g. "Wed Jul 22 2026...")
    if (timeStr.includes(' ') || (timeStr.includes('-') && !timeStr.includes(':'))) {
        const parsedDate = new Date(timeStr);
        if (!isNaN(parsedDate.getTime())) {
            const h = String(parsedDate.getHours()).padStart(2, '0');
            const m = String(parsedDate.getMinutes()).padStart(2, '0');
            const s = String(parsedDate.getSeconds()).padStart(2, '0');
            return `${h}:${m}:${s}`;
        }
    }

    const parts = timeStr.split(':');
    const h = String(parseInt(parts[0]) || 0).padStart(2, '0');
    const m = String(parseInt(parts[1]) || 0).padStart(2, '0');
    const s = String(parseInt(parts[2]) || 0).split('.')[0].padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function timeToMinutes(timeVal) {
    if (!timeVal) return 0;
    if (timeVal instanceof Date) {
        return timeVal.getHours() * 60 + timeVal.getMinutes();
    }
    if (typeof timeVal === 'object') {
        const h = parseInt(timeVal.hours ?? timeVal.hour ?? 0) || 0;
        const m = parseInt(timeVal.minutes ?? timeVal.minute ?? 0) || 0;
        return h * 60 + m;
    }
    const timeStr = String(timeVal);
    // If it is a full Date string format
    if (timeStr.includes(' ') || (timeStr.includes('-') && !timeStr.includes(':'))) {
        const parsedDate = new Date(timeStr);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate.getHours() * 60 + parsedDate.getMinutes();
        }
    }
    const parts = timeStr.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
}

function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function formatTime12Hour(mins) {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * GET /api/bookings/time-slots
 */
router.get('/time-slots', authMiddleware, async (req, res) => {
    const { date, service_id, service_ids } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, error: 'Missing date' });
    }

    try {
        // Parse service IDs
        const ids = [];
        if (service_ids && service_ids !== 'undefined' && service_ids !== 'null') {
            String(service_ids).split(',').forEach(id => {
                const parsed = parseInt(id.trim());
                if (!isNaN(parsed)) ids.push(parsed);
            });
        } else if (service_id && service_id !== 'undefined' && service_id !== 'null') {
            const parsed = parseInt(service_id);
            if (!isNaN(parsed)) ids.push(parsed);
        }

        let totalDuration = 60; // Default to 60 minutes
        if (ids.length > 0) {
            try {
                const placeholders = ids.map(() => '?').join(',');
                const [dbServices] = await pool.query(
                    `SELECT duration_minutes FROM services WHERE id IN (${placeholders})`,
                    ids
                );
                if (dbServices && dbServices.length > 0) {
                    totalDuration = dbServices.reduce((sum, s) => sum + (parseInt(s.duration_minutes) || 60), 0);
                }
            } catch (err) {
                console.error('Error fetching service durations:', err);
                totalDuration = 60;
            }
        }

        let slots = [];
        try {
            const [dbSlots] = await pool.execute('SELECT * FROM time_slots WHERE is_active = 1 ORDER BY start_time');
            slots = dbSlots || [];
        } catch (err) {
            console.error('Error fetching time_slots from DB:', err);
        }

        // Fallback default slots if time_slots table is empty or errored
        if (slots.length === 0) {
            slots = [
                { id: 10, start_time: '10:00:00', end_time: '11:00:00', is_active: 1 },
                { id: 11, start_time: '11:00:00', end_time: '12:00:00', is_active: 1 },
                { id: 12, start_time: '12:00:00', end_time: '13:00:00', is_active: 1 },
                { id: 13, start_time: '13:00:00', end_time: '14:00:00', is_active: 1 },
                { id: 14, start_time: '14:00:00', end_time: '15:00:00', is_active: 1 },
                { id: 15, start_time: '15:00:00', end_time: '16:00:00', is_active: 1 },
                { id: 16, start_time: '16:00:00', end_time: '17:00:00', is_active: 1 },
                { id: 17, start_time: '17:00:00', end_time: '18:00:00', is_active: 1 },
                { id: 18, start_time: '18:00:00', end_time: '19:00:00', is_active: 1 }
            ];
        }

        let bookings = [];
        try {
            const [dbBookings] = await pool.execute(
                "SELECT start_time, end_time FROM bookings WHERE booking_date = ? AND status != 'cancelled'",
                [date]
            );
            bookings = dbBookings || [];
        } catch (err) {
            console.error('Error fetching bookings for date:', err);
        }

        // Normalize TIME values to HH:MM:SS strings to support driver variations
        slots.forEach(s => {
            s.start_time = formatTimeStr(s.start_time);
            s.end_time = formatTimeStr(s.end_time);
        });

        bookings.forEach(b => {
            b.start_time = formatTimeStr(b.start_time);
            b.end_time = formatTimeStr(b.end_time);
        });

        // Find the absolute closing time from active slots (fallback to 7:00 PM)
        let maxEndTimeStr = '19:00:00';
        if (slots.length > 0) {
            maxEndTimeStr = slots.reduce((max, s) => (s.end_time > max ? s.end_time : max), '19:00:00');
        }
        const closingMins = timeToMinutes(maxEndTimeStr);

        let bookedSlots = [];
        const adjustedSlots = [];

        slots.forEach(slot => {
            const startMins = timeToMinutes(slot.start_time);
            const endMins = startMins + totalDuration;
            
            const adjustedSlot = {
                id: slot.id,
                start_time: slot.start_time,
                end_time: minutesToTime(endMins),
                slot_label: `${formatTime12Hour(startMins)} - ${formatTime12Hour(endMins)}`,
                is_active: slot.is_active
            };
            adjustedSlots.push(adjustedSlot);

            // 1. Exceeds closing time check
            if (endMins > closingMins) {
                bookedSlots.push(slot.start_time);
                return;
            }

            // 2. Overlap check with other bookings
            for (let b of bookings) {
                const bStart = timeToMinutes(b.start_time);
                const bEnd = timeToMinutes(b.end_time);
                
                if (startMins < bEnd && endMins > bStart) {
                    bookedSlots.push(slot.start_time);
                    break;
                }
            }
        });

        res.json({
            success: true,
            available_slots: adjustedSlots,
            booked_slots: bookedSlots
        });
    } catch (error) {
        console.error('Fetch Time Slots Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error: ' + error.message });
    }
});

/**
 * POST /api/bookings
 * Created with conflict detection
 */
router.post('/', authMiddleware, (req, res, next) => {
    upload.single('proof')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
}, async (req, res) => {
    const serviceId = parseInt(req.body.serviceId);
    const { bookingDate, startTime, endTime, notes } = req.body;
    const totalPrice = parseFloat(req.body.totalPrice) || 0;
    const userId = req.session.user_id;
    const serviceIds = req.body.serviceIds || serviceId.toString();

    if (!serviceId || !bookingDate || !startTime || !endTime) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'Proof of payment is required' });
    }

    const proofPath = `/assets/uploads/proofs/${req.file.filename}`;
    const downpaymentAmount = totalPrice * 0.1;

    try {
        // Conflict Detection
        const [conflicts] = await pool.execute(
            `SELECT id FROM bookings 
             WHERE booking_date = ? AND status != 'cancelled' 
             AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND end_time <= ?))`,
            [bookingDate, endTime, startTime, endTime, startTime, startTime, endTime]
        );

        if (conflicts.length > 0) {
            return res.status(409).json({ success: false, error: 'Time slot already booked. Please choose another time.' });
        }

        let result;
        try {
            [result] = await pool.execute(
                `INSERT INTO bookings (client_id, service_id, service_ids, booking_date, start_time, end_time, status, notes, total_price, downpayment_amount, proof_of_payment, payment_status, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'pending', NOW())`,
                [userId, serviceId, serviceIds, bookingDate, startTime, endTime, notes || null, totalPrice, downpaymentAmount, proofPath]
            );
        } catch (dbErr) {
            if (dbErr.message && dbErr.message.includes("Unknown column 'service_ids'")) {
                console.warn('service_ids column not found in database. Inserting with legacy service_id column only.');
                [result] = await pool.execute(
                    `INSERT INTO bookings (client_id, service_id, booking_date, start_time, end_time, status, notes, total_price, downpayment_amount, proof_of_payment, payment_status, created_at) 
                     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 'pending', NOW())`,
                    [userId, serviceId, bookingDate, startTime, endTime, notes || null, totalPrice, downpaymentAmount, proofPath]
                );
            } else {
                throw dbErr;
            }
        }

        // Notify all SSE clients watching this date
        notifyDate(bookingDate).catch(err => console.error('[SSE notify] POST error:', err));

        // Get readable service names for notifications
        let serviceNames = 'Session';
        try {
            const ids = serviceIds.split(',').map(idStr => parseInt(idStr.trim()));
            let services = [];
            try {
                const [rows] = await pool.execute('SELECT id, name FROM services');
                services = rows;
            } catch (_) {
                const servicesRouter = require('./services_node');
                services = servicesRouter.FALLBACK_SERVICES || [];
            }
            const matching = services.filter(s => ids.includes(s.id));
            if (matching.length > 0) {
                serviceNames = matching.map(s => s.name).join(', ');
            }
        } catch (_) {}

        notifyAdminBooking({
            id: result.insertId,
            service_name: serviceNames,
            client_name: req.session.user_name || 'Client User',
            booking_date: bookingDate,
            start_time: startTime,
            end_time: endTime
        });

        res.json({ success: true, message: 'Booking created successfully', bookingId: result.insertId });

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || (error.message && error.message.includes('connect'))) {
            console.warn('DB unavailable, creating fallback booking in-memory:', error.message);
            const newId = FALLBACK_BOOKINGS.length > 0 ? Math.max(...FALLBACK_BOOKINGS.map(b => b.id)) + 1 : 1;
            
            // Resolve fallback service names
            let serviceNames = 'Session';
            try {
                const ids = serviceIds.split(',').map(idStr => parseInt(idStr.trim()));
                const servicesRouter = require('./services_node');
                const fallbackServices = servicesRouter.FALLBACK_SERVICES || [];
                const matching = fallbackServices.filter(s => ids.includes(s.id));
                if (matching.length > 0) {
                    serviceNames = matching.map(s => s.name).join(', ');
                }
            } catch (_) {}

            const newBooking = {
                id: newId,
                client_id: userId,
                staff_id: null,
                service_id: serviceId,
                service_ids: serviceIds,
                booking_date: bookingDate,
                start_time: startTime,
                end_time: endTime,
                status: 'pending',
                notes: notes || null,
                total_price: totalPrice,
                downpayment_amount: downpaymentAmount,
                payment_status: 'pending',
                proof_of_payment: proofPath,
                client_name: req.session.user_name || 'Client User',
                staff_name: null,
                service_name: serviceNames,
                created_at: new Date()
            };
            FALLBACK_BOOKINGS.push(newBooking);
            return res.json({ success: true, message: 'Booking created successfully (In-Memory Fallback Mode)', bookingId: newId });
        }
        console.error('Create Booking Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/bookings
 */
router.put('/', authMiddleware, async (req, res) => {
    const action = req.body.action ? req.body.action.trim() : null;
    const { bookingId, status, staffId } = req.body;
    const userId = req.session.user_id;
    const userRole = req.session.user_role;

    if (!bookingId) {
        return res.status(400).json({ success: false, error: 'Missing booking ID' });
    }

    try {
        if (action === 'cancel') {
            if (userRole === 'client') {
                await pool.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ? AND client_id = ?", [bookingId, userId]);
            } else {
                await pool.execute("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
            }
        } else if (action === 'confirm' && userRole !== 'client') {
            await pool.execute("UPDATE bookings SET status = 'confirmed', payment_status = 'paid' WHERE id = ?", [bookingId]);
            
            // Get booking and client info for email
            const [info] = await pool.execute(`
                SELECT b.*, s.name as service_name, u.email, u.full_name 
                FROM bookings b 
                JOIN services s ON b.service_id = s.id 
                JOIN users u ON b.client_id = u.id 
                WHERE b.id = ?
            `, [bookingId]);

            if (info.length > 0) {
                const b = info[0];
                const confirmHtml = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-top: 5px solid #2e7d32;">
                        <h2 style="color: #2e7d32;">Booking Confirmed!</h2>
                        <p>Hi <strong>${b.full_name}</strong>,</p>
                        <p>Great news! Your booking for <strong>${b.service_name}</strong> has been confirmed.</p>
                        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(b.booking_date).toLocaleDateString()}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> ${b.start_time}</p>
                        </div>
                        <p>We look forward to seeing you at the studio!</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #999;">If you need to make changes, please contact us or visit your dashboard.</p>
                    </div>
                `;
                // Send email asynchronously without blocking the response
                sendEmail(b.email, 'Booking Confirmed - SnailShutter Studio', confirmHtml)
                    .then(res => console.log(`Email sent to ${b.email}:`, res.messageId))
                    .catch(err => console.error(`Email failed to ${b.email}:`, err));
            }
        } else if (action === 'status_update' && userRole !== 'client') {
            let finalStatus = status;
            if (typeof status === 'object' && status !== null && status.status) {
                finalStatus = status.status;
            }
            if (!finalStatus) return res.status(400).json({ success: false, error: 'Missing status' });
            await pool.execute('UPDATE bookings SET status = ? WHERE id = ?', [finalStatus, bookingId]);
        } else if (action === 'assign_staff' && userRole === 'admin') {
            if (!staffId) return res.status(400).json({ success: false, error: 'Missing staff ID' });

            // Check for staff conflict
            const [bookingInfo] = await pool.execute('SELECT booking_date, start_time, end_time FROM bookings WHERE id = ?', [bookingId]);
            if (bookingInfo.length > 0) {
                const { booking_date, start_time, end_time } = bookingInfo[0];
                const [staffConflicts] = await pool.execute(
                    `SELECT id FROM bookings 
                     WHERE staff_id = ? AND booking_date = ? AND id != ? AND status != 'cancelled'
                     AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND end_time <= ?))`,
                    [staffId, booking_date, bookingId, end_time, start_time, end_time, start_time, start_time, end_time]
                );

                if (staffConflicts.length > 0) {
                    return res.status(409).json({ success: false, error: 'Photographer has a conflicting session.' });
                }
            }

            await pool.execute('UPDATE bookings SET staff_id = ? WHERE id = ?', [staffId, bookingId]);
        } else if (action === 'complete' && userRole !== 'client') {
            await pool.execute("UPDATE bookings SET status = 'completed' WHERE id = ?", [bookingId]);
        } else if (action === 'uncomplete' && userRole !== 'client') {
            await pool.execute("UPDATE bookings SET status = 'confirmed' WHERE id = ?", [bookingId]);
        } else {
            return res.status(400).json({ success: false, error: 'Invalid action or insufficient permissions' });
        }

        res.json({ success: true, message: 'Booking updated successfully' });

        // Notify SSE clients watching the affected date (fire-and-forget)
        try {
            const [bRow] = await pool.execute('SELECT booking_date FROM bookings WHERE id = ?', [bookingId]);
            if (bRow.length > 0) {
                notifyDate(bRow[0].booking_date).catch(err => console.error('[SSE notify] PUT error:', err));
            }
        } catch (_) {}

    } catch (error) {
        if (error.code === 'ECONNREFUSED' || (error.message && error.message.includes('connect'))) {
            console.warn('DB unavailable, updating fallback booking in-memory:', error.message);
            const b = FALLBACK_BOOKINGS.find(item => item.id == bookingId);
            if (b) {
                if (action === 'cancel') {
                    b.status = 'cancelled';
                } else if (action === 'confirm' && userRole !== 'client') {
                    b.status = 'confirmed';
                    b.payment_status = 'paid';
                } else if (action === 'status_update' && userRole !== 'client') {
                    let finalStatus = status;
                    if (typeof status === 'object' && status !== null && status.status) {
                        finalStatus = status.status;
                    }
                    if (finalStatus) b.status = finalStatus;
                } else if (action === 'assign_staff' && userRole === 'admin') {
                    if (staffId) {
                        b.staff_id = staffId;
                        b.staff_name = staffId == 2 ? 'Staff User' : `Staff ${staffId}`;
                    }
                } else if (action === 'complete' && userRole !== 'client') {
                    b.status = 'completed';
                } else if (action === 'uncomplete' && userRole !== 'client') {
                    b.status = 'confirmed';
                }
                return res.json({ success: true, message: 'Booking updated successfully (In-Memory Fallback Mode)' });
            } else {
                return res.status(404).json({ success: false, error: 'Booking not found in-memory' });
            }
        }
        console.error('Update Booking Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * GET /api/bookings/payment-settings
 */
router.get('/payment-settings', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT setting_value FROM settings WHERE setting_key = "gcashQr"');
        const gcashQr = rows[0]?.setting_value || '/assets/images/gcash_qr.png';
        res.json({ success: true, gcashQr });
    } catch (error) {
        console.error('Fetch payment settings error:', error);
        res.json({ success: false, gcashQr: '/assets/images/gcash_qr.png' });
    }
});

router.FALLBACK_BOOKINGS = FALLBACK_BOOKINGS;
module.exports = router;
