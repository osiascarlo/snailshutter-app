const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../utils/mailer');
const { logSystemEvent } = require('../utils/logger');

/**
 * GET /api/users
 * Admin Only
 */
router.get('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT 
                u.id, 
                u.first_name,
                u.last_name,
                CONCAT(u.first_name, ' ', u.last_name) AS full_name, 
                u.email, 
                u.phone, 
                u.role, 
                u.status, 
                u.notes, 
                u.created_at,
                COUNT(DISTINCT b.id) AS booking_count
            FROM users u
            LEFT JOIN bookings b ON (u.id = b.client_id OR u.id = b.staff_id)
            GROUP BY u.id
            ORDER BY u.role, u.first_name, u.last_name
        `);
        res.json({ success: true, users: users });
    } catch (error) {
        console.error('Fetch Users Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Helper to validate password complexity: at least 8 characters, 1 uppercase, 1 number, 1 special character
function isStrongPassword(pwd) {
    if (!pwd || typeof pwd !== 'string') return false;
    const isLengthValid = pwd.length >= 8;
    const isCapitalValid = /[A-Z]/.test(pwd);
    const isNumberValid = /[0-9]/.test(pwd);
    const isSpecialValid = /[^a-zA-Z0-9]/.test(pwd);
    return isLengthValid && isCapitalValid && isNumberValid && isSpecialValid;
}

/**
 * POST /api/users
 * Admin Only - Create a new user
 */
router.post('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    let { first_name, last_name, email, password, role, status, phone, notes } = req.body;

    // Strip HTML tags from user-supplied names to prevent stored XSS
    if (first_name) first_name = first_name.replace(/<[^>]*>/g, '').trim();
    if (last_name) last_name = last_name.replace(/<[^>]*>/g, '').trim();

    if (!first_name || !last_name || !email || !password || !role) {
        return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const cleanPhone = phone ? String(phone).trim() : '';
    if (!cleanPhone || !/^\d{11}$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, error: 'Phone number must be exactly 11 digits (e.g. 09171234567).' });
    }

    if (!isStrongPassword(password)) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters, include a capital letter, a number, and a special character.'
        });
    }

    try {
        const full_name = `${first_name} ${last_name}`.trim();

        // Check if email, phone, or full name already exists
        if (email) {
            const [existingEmail] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
            if (existingEmail.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this email address already exists.' });
            }
        }

        if (phone && String(phone).trim()) {
            const [existingPhone] = await pool.execute('SELECT id FROM users WHERE phone = ?', [String(phone).trim()]);
            if (existingPhone.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this phone number already exists.' });
            }
        }

        if (first_name && last_name) {
            const [existingName] = await pool.execute("SELECT id FROM users WHERE LOWER(CONCAT(first_name, ' ', last_name)) = LOWER(?)", [`${first_name} ${last_name}`.trim()]);
            if (existingName.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this full name already exists.' });
            }
        }
        const userStatus = status || 'active';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        await pool.execute(
            'INSERT INTO users (first_name, last_name, email, password, phone, role, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [first_name, last_name, email, hashedPassword, phone || null, role, userStatus, notes || null]
        );

        // Determine login URL
        const baseUrl = process.env.APP_URL || (req.headers && req.headers.host ? `${req.protocol || 'http'}://${req.headers.host}` : 'https://snailshutter-app.onrender.com');
        const loginUrl = `${baseUrl}/auth/login.html`;
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

        const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #2e7d32;">
                    <h1 style="color: #2e7d32; margin: 0; font-size: 24px; font-weight: 700;">SnailShutter Studio</h1>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Photography Studio Management</p>
                </div>
                
                <div style="padding: 25px 0;">
                    <h2 style="color: #1e293b; font-size: 20px; margin-top: 0;">Welcome, ${first_name}!</h2>
                    <p style="color: #475569; font-size: 15px; line-height: 1.6;">
                        An account has been created for you at <strong>SnailShutter Studio</strong> by the administrator. Below are your account credentials to log in:
                    </p>
                    
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px 22px; margin: 22px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 600; width: 130px;">Full Name:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${first_name} ${last_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">Email:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">Password:</td>
                                <td style="padding: 8px 0; color: #2e7d32; font-size: 15px; font-weight: 700; font-family: monospace; letter-spacing: 0.5px; background: #e8f5e9; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">Role:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${roleLabel}</td>
                            </tr>
                            ${phone ? `
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px; font-weight: 600;">Phone Number:</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${phone}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${loginUrl}" 
                           style="background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.25);">
                           Log In to Your Account
                        </a>
                    </div>

                    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-top: 20px;">
                        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                            <strong>Security Tip:</strong> For your protection, we recommend logging in and changing your password in your profile settings.
                        </p>
                    </div>
                </div>

                <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
                    <p style="margin: 0 0 5px 0;">&copy; ${new Date().getFullYear()} SnailShutter Studio. All rights reserved.</p>
                    <p style="margin: 0;">This is an automated message, please do not reply directly to this email.</p>
                </div>
            </div>
        `;

        const emailText = `Hello ${first_name},\n\nAn account has been created for you at SnailShutter Studio by the administrator.\n\nHere are your account credentials:\nFull Name: ${first_name} ${last_name}\nEmail: ${email}\nPassword: ${password}\nRole: ${roleLabel}\n${phone ? `Phone Number: ${phone}\n` : ''}\nLogin here: ${loginUrl}\n\nFor security, we recommend changing your password after logging in.\n\nBest regards,\nSnailShutter Studio`;

        // Send credentials email
        try {
            await sendEmail(email, 'Your SnailShutter Studio Account Details', emailHtml, emailText);
            console.log(`✅ Account details email sent to ${email}`);
        } catch (mailErr) {
            console.error('⚠️ Failed to send account details email:', mailErr.message || mailErr);
        }

        logSystemEvent({
            req,
            action: 'USER_CREATED',
            module: 'Users',
            details: `Admin created new ${roleLabel} account for ${first_name} ${last_name} (${email}).`,
            status: 'success'
        });

        res.json({ 
            success: true, 
            message: 'User created successfully! Account details have been sent to their email.' 
        });
    } catch (error) {
        console.error('Create User Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * GET /api/users/staff
 * Admin Only
 */
router.get('/staff', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const [staff] = await pool.execute("SELECT id, first_name, last_name, CONCAT(first_name, ' ', last_name) as full_name, email, phone FROM users WHERE role = 'staff' ORDER BY first_name, last_name");
        res.json({ success: true, staff: staff });
    } catch (error) {
        console.error('Fetch Staff Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/users/update_role
 * Admin Only
 */
router.post('/update_role', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    const { user_id, first_name, last_name, email, role, status, phone, notes, password } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'Missing user ID' });
    }

    if (user_id == req.session.user_id) {
        if (role && role !== 'admin') {
            return res.status(400).json({ success: false, error: 'Cannot change your own role' });
        }
        if (status && status !== 'active') {
            return res.status(400).json({ success: false, error: 'Cannot deactivate yourself' });
        }
    }

    try {
        const fields = [];
        const values = [];

        if (first_name !== undefined) {
            fields.push('first_name = ?');
            values.push(first_name.trim());
        }
        if (last_name !== undefined) {
            fields.push('last_name = ?');
            values.push(last_name.trim());
        }
        if (email !== undefined) {
            fields.push('email = ?');
            values.push(email);
        }
        if (role !== undefined) {
            fields.push('role = ?');
            values.push(role);
        }
        if (status !== undefined) {
            fields.push('status = ?');
            values.push(status);
        }
        if (phone !== undefined) {
            const cleanPhone = String(phone).trim();
            if (!cleanPhone || !/^\d{11}$/.test(cleanPhone)) {
                return res.status(400).json({ success: false, error: 'Phone number must be exactly 11 digits (e.g. 09171234567).' });
            }
            fields.push('phone = ?');
            values.push(cleanPhone);
        }
        if (notes !== undefined) {
            fields.push('notes = ?');
            values.push(notes);
        }
        if (password !== undefined && password !== '') {
            if (!isStrongPassword(password)) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 8 characters, include a capital letter, a number, and a special character.'
                });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            fields.push('password = ?');
            values.push(hashedPassword);
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        values.push(user_id);
        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        await pool.execute(query, values);

        const isDeactivation = status === 'inactive';
        const isActivation = status === 'active';
        let actionCode = 'USER_UPDATED';
        let logStatus = 'info';
        if (isDeactivation) {
            actionCode = 'USER_DEACTIVATED';
            logStatus = 'warning';
        } else if (isActivation) {
            actionCode = 'USER_ACTIVATED';
            logStatus = 'success';
        }

        logSystemEvent({
            req,
            action: actionCode,
            module: 'Users',
            details: isDeactivation
                ? `User account #${user_id} was deactivated by Administrator.`
                : (isActivation ? `User account #${user_id} was activated by Administrator.` : `User account #${user_id} details updated by Administrator.`),
            status: logStatus
        });

        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        console.error('Update User Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/users/delete
 * Admin Only
 */
router.post('/delete', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'Missing user ID' });
    }

    if (user_id == req.session.user_id) {
        return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    }

    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [user_id]);

        logSystemEvent({
            req,
            action: 'USER_DELETED',
            module: 'Users',
            details: `User account #${user_id} was permanently deleted by Administrator.`,
            status: 'danger'
        });

        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete User Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * GET /api/users/profile
 * Returns the current user's profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.execute(
            "SELECT id, first_name, last_name, CONCAT(first_name, ' ', last_name) as full_name, email, phone, role, avatar, created_at FROM users WHERE id = ?",
            [req.session.user_id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Fetch Profile Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/users/profile
 * Updates current user's general info
 */
router.post('/profile', authMiddleware, async (req, res) => {
    let { full_name, first_name, last_name, email, phone } = req.body;

    if (!first_name || !last_name) {
        if (full_name) {
            const parts = full_name.trim().split(/\s+/);
            first_name = parts[0] || '';
            last_name = parts.slice(1).join(' ') || 'User';
        }
    }

    // Strip HTML tags from user-supplied name to prevent stored XSS
    if (first_name) first_name = first_name.replace(/<[^>]*>/g, '').trim();
    if (last_name) last_name = last_name.replace(/<[^>]*>/g, '').trim();
    const cleanFullName = `${first_name} ${last_name}`.trim();

    if (!first_name || !last_name || !email) {
        return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    try {
        await pool.execute(
            'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ?',
            [first_name, last_name, email, phone, req.session.user_id]
        );

        // Update session name if changed
        req.session.user_name = cleanFullName;
        req.session.first_name = first_name;
        req.session.last_name = last_name;

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/users/password
 * Updates current user's password
 */
router.post('/password', authMiddleware, async (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
    }

    if (current_password === new_password) {
        return res.status(400).json({ success: false, error: 'New password cannot be the same as your current password.' });
    }

    // Password requirement check: at least 8 characters, a capital letter, a number, and a special character
    const isLengthValid = new_password.length >= 8;
    const isCapitalValid = /[A-Z]/.test(new_password);
    const isNumberValid = /[0-9]/.test(new_password);
    const isSpecialValid = /[!@#$%^&*(),.?":{}|_+\-=\[\]\\\/]/.test(new_password);

    if (!isLengthValid || !isCapitalValid || !isNumberValid || !isSpecialValid) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters, include a capital letter, a number, and a special character.'
        });
    }

    try {
        // Verify current password
        const [users] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.session.user_id]);
        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const isMatch = await bcrypt.compare(current_password, users[0].password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }

        const isSamePassword = await bcrypt.compare(new_password, users[0].password);
        if (isSamePassword) {
            return res.status(400).json({ success: false, error: 'New password cannot be the same as your current password.' });
        }

        // Hash and save new password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.user_id]);

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Update Password Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/users/avatar
 * Uploads user avatar
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'assets/uploads/avatars';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + req.session.user_id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp) are allowed'));
    }
});

router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const avatarPath = `/assets/uploads/avatars/${req.file.filename}`;

    try {
        await pool.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatarPath, req.session.user_id]);
        res.json({ success: true, avatar: avatarPath, message: 'Avatar uploaded successfully' });
    } catch (error) {
        console.error('Avatar Upload Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
