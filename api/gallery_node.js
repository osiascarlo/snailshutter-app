const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendEmail } = require('../utils/mailer');

// ── Auth middleware (simple admin check) ──────────────────────────────────
function requireAdmin(req, res, next) {
    if (req.session && req.session.user_role === 'admin') return next();
    if (!req.session || !req.session.user_id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    next();
}

// ── GET /api/gallery — list all bookings with their Google Drive links ─────
router.get('/', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT b.id, b.client_id, b.staff_id, b.service_ids, b.service_id, b.booking_date, b.start_time, b.google_drive_link,
                   c.full_name as client_name, c.email as client_email, s.name as service_name
            FROM bookings b
            JOIN users c ON b.client_id = c.id
            JOIN services s ON b.service_id = s.id
            ORDER BY b.booking_date DESC, b.start_time DESC
        `;
        const [bookings] = await pool.execute(query);

        // Fetch all services to resolve multi-service names if service_ids is present
        let services = [];
        try {
            const [rows] = await pool.execute('SELECT id, name FROM services');
            services = rows;
        } catch (e) {
            // Ignore
        }

        bookings.forEach(b => {
            const idsStr = b.service_ids || b.service_id.toString();
            const ids = idsStr.split(',').map(idStr => parseInt(idStr.trim()));
            const matching = services.filter(s => ids.includes(s.id));
            if (matching.length > 0) {
                b.service_name = matching.map(s => s.name).join(', ');
            }
        });

        res.json({ success: true, data: bookings });
    } catch (err) {
        console.error('Gallery list error:', err);
        res.status(500).json({ success: false, error: 'Failed to list gallery bookings' });
    }
});

// ── POST /api/gallery/:bookingId — save or update Google Drive Link ────────
router.post('/:bookingId', requireAdmin, async (req, res) => {
    const { bookingId } = req.params;
    const { googleDriveLink } = req.body;

    try {
        // 1. Get the current booking details including client info and old link
        const [oldBookings] = await pool.execute(
            `SELECT b.google_drive_link, c.email, c.full_name, s.name as service_name, b.booking_date 
             FROM bookings b 
             JOIN users c ON b.client_id = c.id 
             JOIN services s ON b.service_id = s.id 
             WHERE b.id = ?`,
            [bookingId]
        );

        if (oldBookings.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }

        const booking = oldBookings[0];
        const oldLink = booking.google_drive_link;

        // 2. Update the Google Drive Link in the database
        await pool.execute(
            'UPDATE bookings SET google_drive_link = ? WHERE id = ?',
            [googleDriveLink || null, bookingId]
        );

        // 3. Send email if a new link is uploaded or the link is changed to a non-empty value
        const linkAddedOrChanged = googleDriveLink && googleDriveLink.trim() !== '' && googleDriveLink !== oldLink;

        if (linkAddedOrChanged) {
            const clientEmail = booking.email;
            const clientName = booking.full_name;
            const serviceName = booking.service_name;
            const bookingDate = new Date(booking.booking_date).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const subject = 'Your Photos from SnailShutter Studio are Ready! 📷';
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #10b981; margin: 0; font-size: 24px;">SnailShutter Studio</h1>
                        <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">Capturing your beautiful moments</p>
                    </div>
                    <h2 style="color: #1f2937; margin-top: 0;">Hello, ${clientName}!</h2>
                    <p style="font-size: 16px; line-height: 1.5; color: #4b5563;">
                        Great news! Your photos from your session <strong>${serviceName}</strong> on <strong>${bookingDate}</strong> are now ready.
                    </p>
                    <p style="font-size: 16px; line-height: 1.5; color: #4b5563;">
                        You can view, share, and download them directly from Google Drive:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${googleDriveLink}" target="_blank" style="background-color: #10b981; color: white; padding: 12px 24px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
                            View Photos on Google Drive
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #9ca3af; margin-top: 40px; border-top: 1px solid #f3f4f6; padding-top: 20px; text-align: center;">
                        Please note: You can also access this link at any time from your booking history on our platform.
                    </p>
                </div>
            `;

            try {
                await sendEmail(clientEmail, subject, html);
                console.log(`Email notification sent successfully to ${clientEmail}`);
            } catch (emailErr) {
                console.error('Failed to send gallery email notification:', emailErr.message);
                // Return success but indicate email failed
                return res.json({ 
                    success: true, 
                    message: 'Google Drive link saved, but failed to send email notification to client.',
                    emailError: emailErr.message 
                });
            }
        }

        res.json({ success: true, message: 'Google Drive link saved successfully and client notified.' });
    } catch (err) {
        console.error('Save Google Drive Link error:', err);
        res.status(500).json({ success: false, error: 'Failed to save Google Drive link' });
    }
});

module.exports = router;
