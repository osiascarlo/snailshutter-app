const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * In-memory registry: dateString -> Set of SSE response objects
 * e.g. { '2026-06-25': Set { res1, res2 }, ... }
 */
const dateClients = new Map();
const adminClients = new Set();

/**
 * Register a response object under a given date.
 */
function addClient(date, res) {
    if (!dateClients.has(date)) {
        dateClients.set(date, new Set());
    }
    dateClients.get(date).add(res);
}

/**
 * Remove a response object from the registry.
 */
function removeClient(date, res) {
    if (dateClients.has(date)) {
        dateClients.get(date).delete(res);
        if (dateClients.get(date).size === 0) {
            dateClients.delete(date);
        }
    }
}

/**
 * Fetch current slot availability for a date and push it to all
 * SSE clients watching that date.
 * Called externally by bookings_node.js after any booking change.
 */
async function notifyDate(date) {
    if (!dateClients.has(date) || dateClients.get(date).size === 0) {
        return; // nobody is watching — skip DB query
    }

    try {
        const payload = await buildSlotPayload(date);
        const data = JSON.stringify(payload);
        for (const res of dateClients.get(date)) {
            res.write(`data: ${data}\n\n`);
        }
    } catch (err) {
        console.error('[SSE] notifyDate error for', date, err);
    }
}

/**
 * Query the DB and build the slot availability payload for one date.
 */
async function buildSlotPayload(date) {
    const [slots] = await pool.execute(
        'SELECT * FROM time_slots WHERE is_active = 1 ORDER BY start_time'
    );
    const [bookings] = await pool.query(
        "SELECT start_time, end_time FROM bookings WHERE booking_date = ? AND status != ?",
        [date, 'cancelled']
    );

    const bookedSlots = [];
    slots.forEach(slot => {
        const slotStart = new Date(`1970-01-01T${slot.start_time}Z`);
        const slotEnd   = new Date(`1970-01-01T${slot.end_time}Z`);

        for (const b of bookings) {
            const bStart = new Date(`1970-01-01T${b.start_time}Z`);
            const bEnd   = new Date(`1970-01-01T${b.end_time}Z`);
            if (
                (slotStart >= bStart && slotStart < bEnd) ||
                (slotEnd > bStart && slotEnd <= bEnd) ||
                (slotStart <= bStart && slotEnd >= bEnd)
            ) {
                bookedSlots.push(slot.start_time);
                break;
            }
        }
    });

    return {
        date,
        timestamp: new Date().toISOString(),
        available_slots: slots,
        booked_slots: bookedSlots
    };
}

/* ------------------------------------------------------------------ *
 *  GET /api/availability/stream?date=YYYY-MM-DD                       *
 *  Opens an SSE connection for the given date.                        *
 *  No authMiddleware — public so guests can see live availability.    *
 * ------------------------------------------------------------------ */
router.get('/stream', async (req, res) => {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: 'Missing or invalid date (YYYY-MM-DD)' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering if behind proxy
    res.flushHeaders();

    // Register this client
    addClient(date, res);
    console.log(`[SSE] Client connected for date=${date}  (${dateClients.get(date).size} watching)`);

    // Send initial slot data immediately
    try {
        const payload = await buildSlotPayload(date);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
        console.error('[SSE] Initial payload error:', err);
    }

    // Heartbeat every 30 s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    // Clean up when the client disconnects
    req.on('close', () => {
        clearInterval(heartbeat);
        removeClient(date, res);
        const remaining = dateClients.has(date) ? dateClients.get(date).size : 0;
        console.log(`[SSE] Client disconnected for date=${date}  (${remaining} watching)`);
    });
});

/* ------------------------------------------------------------------ *
 *  GET /api/availability/slots?date=YYYY-MM-DD                        *
 *  Plain JSON endpoint — used by calendar for per-day booking counts. *
 * ------------------------------------------------------------------ */
router.get('/slots', async (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ success: false, error: 'Missing date' });
    }
    try {
        const payload = await buildSlotPayload(date);
        res.json({ success: true, ...payload });
    } catch (err) {
        console.error('[SSE] /slots error:', err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/* ------------------------------------------------------------------ *
 *  GET /api/availability/admin-stream                               *
 *  Opens an SSE connection for authenticated admin users.           *
 * ------------------------------------------------------------------ */
router.get('/admin-stream', (req, res) => {
    if (!req.session || (req.session.user_role !== 'admin' && req.session.user_role !== 'staff')) {
        return res.status(403).json({ success: false, error: 'Unauthorized. Admin or Staff role required.' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Register this admin client
    adminClients.add(res);
    console.log(`[SSE] Admin client connected. (${adminClients.size} admins online)`);

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        adminClients.delete(res);
        console.log(`[SSE] Admin client disconnected. (${adminClients.size} admins online)`);
    });
});

/**
 * Pushes details of a new booking to all connected admin clients.
 */
function notifyAdminBooking(booking) {
    if (adminClients.size === 0) {
        return; // No admins online
    }

    try {
        const payload = JSON.stringify({
            type: 'new_booking',
            booking: {
                id: booking.id,
                client_name: booking.client_name,
                service_name: booking.service_name,
                booking_date: booking.booking_date,
                start_time: booking.start_time,
                end_time: booking.end_time,
                created_at: new Date().toISOString()
            }
        });

        for (const res of adminClients) {
            res.write(`data: ${payload}\n\n`);
        }
    } catch (err) {
        console.error('[SSE] notifyAdminBooking error:', err);
    }
}

module.exports = router;
module.exports.notifyDate = notifyDate;
module.exports.notifyAdminBooking = notifyAdminBooking;

