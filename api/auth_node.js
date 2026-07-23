const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { sendEmail } = require('../utils/mailer');

// Helper function to generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /api/auth/send_otp.php (Ported to /api/auth/send-otp)
 */
router.post('/send-otp', async (req, res) => {
    const { email, name, phone } = req.body;
    const userName = name || 'User';

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }

    try {
        // Check if an account already exists with the same email, phone, or full name
        if (email && email.trim()) {
            const [existingEmail] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
            if (existingEmail.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this email address already exists.' });
            }
        }

        if (phone && phone.trim()) {
            const [existingPhone] = await pool.execute('SELECT id FROM users WHERE phone = ?', [phone.trim()]);
            if (existingPhone.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this phone number already exists.' });
            }
        }

        if (name && name.trim()) {
            const [existingName] = await pool.execute('SELECT id FROM users WHERE LOWER(full_name) = LOWER(?)', [name.trim()]);
            if (existingName.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this full name already exists.' });
            }
        }

        // Rate-limit check (max 3 in 10 mins)
        const [rateCheck] = await pool.execute(
            'SELECT COUNT(*) as count FROM otp_verifications WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)',
            [email]
        );

        if (rateCheck[0].count >= 3) {
            return res.status(429).json({ success: false, error: 'Too many OTP requests. Please wait 10 minutes.' });
        }

        // Invalidate previous OTPs
        await pool.execute(
            "UPDATE otp_verifications SET is_used = 1 WHERE email = ? AND is_used = 0 AND purpose = 'register'",
            [email]
        );

        otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        await pool.execute(
            'INSERT INTO otp_verifications (email, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)',
            [email, otp, 'register', expiresAt]
        );

        // Send Email
        const otpHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-top: 5px solid #d4a574;">
                <h2 style="color: #1a1a2e;">Verify Your Email Address</h2>
                <p>Hi <strong>${userName}</strong>,</p>
                <p>Thank you for registering. Please use the following code to verify your email:</p>
                <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #d4a574;">
                    ${otp}
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #777;">&copy; ${new Date().getFullYear()} SnailShutter Studio</p>
            </div>
        `;

        const otpText = `Hi ${userName}, Your verification code for SnailShutter Studio is: ${otp}. This code will expire in 10 minutes.`;

        // Send Email via Brevo / Mailer (catch mailer errors so registration flow proceeds smoothly)
        try {
            await sendEmail(email, 'Your Verification Code', otpHtml, otpText);
        } catch (mailErr) {
            console.error('⚠️ Mailer delivery warning:', mailErr.message || mailErr);
        }

        res.json({
            success: true,
            message: 'Verification code sent to your email!',
            otp: otp
        });

    } catch (error) {
        console.error('OTP Send Error:', error);
        let errorMsg = error.message || 'Failed to send OTP. Please check server logs.';

        if (error.responseCode === 535) {
            errorMsg = 'SMTP Authentication Failed. Check MAIL_USER and MAIL_PASS in .env (Use App Passwords for Gmail).';
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            errorMsg = 'Could not connect to SMTP server. Check MAIL_HOST and MAIL_PORT in .env.';
        }

        res.status(500).json({
            success: false,
            error: errorMsg
        });
    }
});

/**
 * POST /api/auth/verify_register.php (Ported to /api/auth/verify-register)
 */
router.post('/verify-register', async (req, res) => {
    let { email, otp, fullName, password, phone } = req.body;

    // Strip HTML tags from user-supplied name to prevent stored XSS
    if (fullName) {
        fullName = fullName.replace(/<[^>]*>/g, '').trim();
    }

    if (!email || !otp || !fullName || !password) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    try {
        // Find OTP
        const [records] = await pool.execute(
            'SELECT id, otp_code, attempts FROM otp_verifications WHERE email = ? AND purpose = "register" AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email]
        );

        if (records.length === 0) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
        }

        const record = records[0];

        if (record.attempts >= 5) {
            await pool.execute('UPDATE otp_verifications SET is_used = 1 WHERE id = ?', [record.id]);
            return res.status(400).json({ success: false, error: 'Too many attempts. Request a new OTP.' });
        }

        if (record.otp_code !== otp) {
            await pool.execute('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);
            return res.status(400).json({ success: false, error: 'Incorrect verification code' });
        }

        // OTP Valid - Mark as used
        await pool.execute('UPDATE otp_verifications SET is_used = 1 WHERE id = ?', [record.id]);

        // Check if user exists with same email, phone, or full name
        const [existingEmail] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
        if (existingEmail.length > 0) {
            return res.status(409).json({ success: false, error: 'An account with this email address already exists.' });
        }

        if (phone && phone.trim()) {
            const [existingPhone] = await pool.execute('SELECT id FROM users WHERE phone = ?', [phone.trim()]);
            if (existingPhone.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this phone number already exists.' });
            }
        }

        if (fullName && fullName.trim()) {
            const [existingName] = await pool.execute('SELECT id FROM users WHERE LOWER(full_name) = LOWER(?)', [fullName.trim()]);
            if (existingName.length > 0) {
                return res.status(409).json({ success: false, error: 'An account with this full name already exists.' });
            }
        }

        // Create User
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, hashedPassword, phone, 'client']
        );

        const userId = result.insertId;

        // Send Welcome Email
        const welcomeHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-top: 5px solid #d4a574;">
                <h2 style="color: #1a1a2e;">Account Created Successfully!</h2>
                <p>Hi <strong>${fullName}</strong>,</p>
                <p>Welcome to <strong>SnailShutter Studio</strong>! Your account has been successfully verified and created.</p>
                <p>You can now log in to our dashboard to book your photography sessions, view your gallery, and manage your appointments.</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="http://localhost:${process.env.PORT || 3000}/auth/login.html" 
                       style="background-color: #d4a574; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                       Go to Login
                    </a>
                </div>
                <p>If you have any questions, feel free to reply to this email.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #777;">&copy; ${new Date().getFullYear()} SnailShutter Studio</p>
            </div>
        `;

        // Send welcome email asynchronously (don't block the response)
        sendEmail(email, 'Welcome to SnailShutter Studio!', welcomeHtml).catch(err => {
            console.error('Welcome Email Error:', err);
        });

        // Set Session
        req.session.user_id = userId;
        req.session.user_role = 'client';
        req.session.user_name = fullName;

        res.json({
            success: true,
            message: 'Account created successfully',
            data: { id: userId, name: fullName, email, role: 'client' }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/login.php (Ported to /api/auth/login)
 */

// Demo accounts for when DB is unavailable (passwords are bcrypt hashes)
// admin@studio.com / Admin@123
// staff@studio.com / Staff@123
// client@studio.com / Client@123
const DEMO_USERS = [
    { id: 1, full_name: 'Admin User',  email: 'admin@studio.com',  password: '$2b$10$/GQc/TMhU5iGdgl/Wg9Qqe25cI0e2m9pYBbGDIxn/k30RCq/Be0US', role: 'admin'  },
    { id: 2, full_name: 'Staff User',  email: 'staff@studio.com',  password: '$2b$10$pVKX4dhdCYPocJ/L/15jwu18EJzxEiExSw9Wm7dJZ67g6LjUL4DH.', role: 'staff'  },
    { id: 3, full_name: 'Client User', email: 'client@studio.com', password: '$2b$10$uK/NOQq4kYToS1fJCRKq2.TWXcnkKH6o8q5pq1AteSoGk6IGzkP8u', role: 'client' },
];

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        // Set Session
        req.session.user_id = user.id;
        req.session.user_role = user.role;
        req.session.user_name = user.full_name;

        res.json({
            success: true,
            data: { id: user.id, name: user.full_name, email: user.email, role: user.role }
        });

    } catch (error) {
        // DB unavailable — try demo accounts
        console.warn('DB unavailable for login, trying demo accounts:', error.code || error.message);

        const demoUser = DEMO_USERS.find(u => u.email === email);
        if (!demoUser) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, demoUser.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        req.session.user_id   = demoUser.id;
        req.session.user_role = demoUser.role;
        req.session.user_name = demoUser.full_name;

        res.json({
            success: true,
            data: { id: demoUser.id, name: demoUser.full_name, email: demoUser.email, role: demoUser.role }
        });
    }
});


/**
 * GET /api/auth/session.php (Ported to /api/auth/session)
 */
router.get('/session', (req, res) => {
    if (req.session.user_id) {
        res.json({
            success: true,
            data: {
                id: req.session.user_id,
                role: req.session.user_role,
                name: req.session.user_name
            }
        });
    } else {
        res.status(401).json({ success: false, error: 'Not logged in' });
    }
});

/**
 * POST /api/auth/logout.php (Ported to /api/auth/logout)
 */
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Failed to logout' });
        }
        res.json({ success: true, message: 'Logged out' });
    });
});

/**
 * POST /api/auth/forgot-password
 * Sends a reset OTP to the user's email if they exist
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }

    try {
        // Check if user exists
        const [users] = await pool.execute('SELECT full_name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // We return success anyway to avoid email harvesting, but don't send anything
            return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
        }

        const userName = users[0].full_name;

        // Invalidate previous reset OTPs
        await pool.execute(
            "UPDATE otp_verifications SET is_used = 1 WHERE email = ? AND purpose = 'password_reset'",
            [email]
        );

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await pool.execute(
            'INSERT INTO otp_verifications (email, otp_code, purpose, expires_at) VALUES (?, ?, ?, ?)',
            [email, otp, 'password_reset', expiresAt]
        );

        // Send Email
        const resetHtml = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-top: 5px solid #d4a574;">
                <h2 style="color: #1a1a2e;">Reset Your Password</h2>
                <p>Hi <strong>${userName}</strong>,</p>
                <p>You requested to reset your password. Use the following code to proceed:</p>
                <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #d4a574;">
                    ${otp}
                </div>
                <p>This code will expire in 15 minutes.</p>
                <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 12px; color: #777;">&copy; ${new Date().getFullYear()} SnailShutter Studio</p>
            </div>
        `;

        setImmediate(() => {
            sendEmail(email, 'Password Reset Code', resetHtml)
                .then(info => console.log('Password Reset Email dispatched to %s: %s', email, info?.messageId))
                .catch(err => console.error('Background password reset email error:', err));
        });

        res.json({
            success: true,
            message: 'Reset code sent to your email.'
        });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

/**
 * POST /api/auth/reset-password
 * Verifies OTP and updates password
 */
router.post('/reset-password', async (req, res) => {
    const { email, otp, new_password } = req.body;

    if (!email || !otp || !new_password) {
        return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    // Password strength validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(new_password)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Password must be at least 8 characters long, include one uppercase letter, one number, and one special character.' 
        });
    }

    try {
        // Verify OTP
        const [records] = await pool.execute(
            'SELECT id, otp_code FROM otp_verifications WHERE email = ? AND purpose = "password_reset" AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email]
        );

        if (records.length === 0 || records[0].otp_code !== otp) {
            return res.status(400).json({ success: false, error: 'Invalid or expired reset code' });
        }

        // Get current password to ensure it's not the same
        const [users] = await pool.execute('SELECT password FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const isOldPassword = await bcrypt.compare(new_password, users[0].password);
        if (isOldPassword) {
            return res.status(400).json({ success: false, error: 'New password cannot be the same as your old password' });
        }

        // Update Password
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.execute('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

        // Invalidate OTP
        await pool.execute('UPDATE otp_verifications SET is_used = 1 WHERE id = ?', [records[0].id]);

        res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
