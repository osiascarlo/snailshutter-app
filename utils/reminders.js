const pool = require('../config/db');
const { sendEmail } = require('./mailer');

// In-memory fallback settings cache
let FALLBACK_SETTINGS = {
    studioName: 'SnailShutter',
    studioEmail: 'snailshutterstudio@gmail.com',
    studioPhone: '+63 912 345 6789',
    studioAddress: 'EJR Business Center 2, Poblacion, Alaminos City, Pangasinan, Philippines',
    emailNotifications: 'all',
    bookingReminders: '24',
    maintenanceMode: 'normal',
    timeZone: 'Asia/Manila',
    gcashQr: '/assets/images/gcash_qr.png',
    studioHours: 'Mon – Sat, 9:00 AM – 6:00 PM',
    studioMapEmbed: 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d958.1126989311325!2d119.9756506!3d16.1456869!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3393dd09643fcad5%3A0x24a5ac354149095!2sSnailshutter%20Alaminos%20Photography%20Studio!5e0!3m2!1sen!2sph!4v1782822704080!5m2!1sen!2sph',
    studioDirectionsLink: 'https://www.google.com/maps/dir/?api=1&destination=Snailshutter+Alaminos+Photography+Studio'
};

// Set to track sent reminder booking IDs (in case DB column doesn't exist)
const sentRemindersCache = new Set();

/**
 * Fetch all current studio settings from DB
 */
async function getAllSettings() {
    try {
        const [rows] = await pool.execute('SELECT * FROM settings');
        const settings = { ...FALLBACK_SETTINGS };
        rows.forEach(r => {
            if (r.setting_key && r.setting_value !== undefined) {
                settings[r.setting_key] = r.setting_value;
            }
        });
        return settings;
    } catch (err) {
        console.warn('⚠️ [Settings] DB read failed, using cached settings:', err.message);
        return FALLBACK_SETTINGS;
    }
}

/**
 * Check if studio is in Maintenance Mode
 */
async function isMaintenanceModeActive() {
    const settings = await getAllSettings();
    return settings.maintenanceMode === 'maintenance';
}

/**
 * Check whether an email notification of a given priority should be sent.
 * @param {'critical'|'important'|'general'|'reminder'} priority 
 */
async function shouldSendEmailNotification(priority = 'important') {
    const settings = await getAllSettings();
    const mode = settings.emailNotifications || 'all';

    if (mode === 'none') {
        // Suppress non-critical automated emails
        return priority === 'critical';
    }

    if (mode === 'important') {
        return priority === 'critical' || priority === 'important';
    }

    // mode === 'all'
    return true;
}

/**
 * Process and dispatch booking reminders based on bookingReminders setting (24, 48, or 72 hours).
 */
async function processBookingReminders() {
    try {
        const settings = await getAllSettings();
        const reminderHours = parseInt(settings.bookingReminders, 10) || 24;
        const emailMode = settings.emailNotifications || 'all';

        console.log(`⏰ [Booking Reminders] Running check... Window: ${reminderHours}h | Email Notifications: ${emailMode}`);

        if (emailMode === 'none') {
            console.log('ℹ️ [Booking Reminders] Skipped: Email notifications disabled in settings ("none").');
            return { success: true, processed: 0, sent: 0, reason: 'Email notifications disabled' };
        }

        // Target window: bookings occurring between NOW and NOW + reminderHours
        const now = new Date();
        const targetEndTime = new Date(now.getTime() + (reminderHours * 60 * 60 * 1000));

        const nowStr = now.toISOString().slice(0, 10);
        const targetStr = targetEndTime.toISOString().slice(0, 10);

        let bookings = [];
        try {
            const [rows] = await pool.execute(`
                SELECT 
                    b.id, b.booking_date, b.start_time, b.end_time, b.status,
                    s.name as service_name,
                    u.email, CONCAT(u.first_name, ' ', u.last_name) as client_name
                FROM bookings b
                JOIN services s ON b.service_id = s.id
                JOIN users u ON b.client_id = u.id
                WHERE b.status = 'confirmed'
                  AND b.booking_date >= ? AND b.booking_date <= ?
            `, [nowStr, targetStr]);
            bookings = rows;
        } catch (dbErr) {
            console.warn('⚠️ [Booking Reminders] Could not query DB bookings:', dbErr.message);
            return { success: false, error: dbErr.message };
        }

        let sentCount = 0;
        let skippedCount = 0;

        for (const b of bookings) {
            if (sentRemindersCache.has(b.id)) {
                skippedCount++;
                continue;
            }

            // Calculate precise booking datetime
            const bookingDateTimeStr = `${b.booking_date.toString().slice(0, 10)}T${b.start_time}`;
            const bookingDateObj = new Date(bookingDateTimeStr);
            const diffHours = (bookingDateObj.getTime() - now.getTime()) / (1000 * 60 * 60);

            // Send if booking falls within hours window (e.g. within 24h, 48h, 72h)
            if (diffHours >= 0 && diffHours <= reminderHours + 2) {
                console.log(`✉️ Sending ${reminderHours}h reminder to ${b.email} for booking #${b.id} (${b.service_name})`);

                const reminderHtml = `
                    <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-top: 5px solid #16a34a; border-radius: 8px;">
                        <h2 style="color: #16a34a; margin-top: 0;">⏰ Upcoming Session Reminder</h2>
                        <p>Hi <strong>${b.client_name}</strong>,</p>
                        <p>This is a friendly reminder from <strong>${settings.studioName}</strong> that your photography session is coming up in approximately <strong>${reminderHours} hours</strong>!</p>
                        
                        <div style="background: #f8fafc; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0; border-radius: 4px;">
                            <p style="margin: 4px 0;"><strong>Service:</strong> ${b.service_name}</p>
                            <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(b.booking_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin: 4px 0;"><strong>Time:</strong> ${b.start_time}</p>
                            <p style="margin: 4px 0;"><strong>Studio Address:</strong> ${settings.studioAddress}</p>
                        </div>
                        
                        <p>Please arrive 10 minutes prior to your scheduled time. If you need assistance or directions, reply to this email or call us at <strong>${settings.studioPhone}</strong>.</p>
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                        <p style="font-size: 12px; color: #64748b; margin: 0;">SnailShutter Studio Management System</p>
                    </div>
                `;

                try {
                    await sendEmail(b.email, `Upcoming Booking Reminder - ${settings.studioName}`, reminderHtml);
                    sentRemindersCache.add(b.id);
                    sentCount++;
                } catch (sendErr) {
                    console.error(`❌ Failed to send reminder email to ${b.email}:`, sendErr.message);
                }
            } else {
                skippedCount++;
            }
        }

        console.log(`✅ [Booking Reminders] Processed ${bookings.length} bookings: Sent ${sentCount}, Skipped ${skippedCount}`);
        return {
            success: true,
            totalConfirmedInWindow: bookings.length,
            sent: sentCount,
            skipped: skippedCount,
            reminderHours,
            emailMode
        };

    } catch (err) {
        console.error('❌ [Booking Reminders] Error during processing:', err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    getAllSettings,
    isMaintenanceModeActive,
    shouldSendEmailNotification,
    processBookingReminders,
    FALLBACK_SETTINGS
};
