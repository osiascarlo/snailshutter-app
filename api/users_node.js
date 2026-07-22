const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

/**
 * GET /api/users
 * Admin Only
 */
router.get('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const [users] = await pool.execute(`
            SELECT 
                u.id, 
                u.full_name, 
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
            ORDER BY u.role, u.full_name
        `);
        res.json({ success: true, users: users });
    } catch (error) {
        console.error('Fetch Users Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

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

    try {
        // Check if email already exists
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const full_name = `${first_name} ${last_name}`.trim();
        const userStatus = status || 'active';

        // Insert new user
        await pool.execute(
            'INSERT INTO users (full_name, email, password, phone, role, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [full_name, email, hashedPassword, phone || null, role, userStatus, notes || null]
        );

        res.json({ success: true, message: 'User created successfully' });
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
        const [staff] = await pool.execute("SELECT id, full_name, email, phone FROM users WHERE role = 'staff' ORDER BY full_name");
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

        if (first_name !== undefined && last_name !== undefined) {
            fields.push('full_name = ?');
            values.push(`${first_name} ${last_name}`.trim());
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
            fields.push('phone = ?');
            values.push(phone);
        }
        if (notes !== undefined) {
            fields.push('notes = ?');
            values.push(notes);
        }
        if (password !== undefined && password !== '') {
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
            'SELECT id, full_name, email, phone, role, avatar, created_at FROM users WHERE id = ?',
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
    let { full_name, email, phone } = req.body;

    // Strip HTML tags from user-supplied name to prevent stored XSS
    if (full_name) full_name = full_name.replace(/<[^>]*>/g, '').trim();

    if (!full_name || !email) {
        return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    try {
        await pool.execute(
            'UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?',
            [full_name, email, phone, req.session.user_id]
        );
        
        // Update session name if changed
        req.session.user_name = full_name;
        
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

    // Password requirement check: at least 8 characters, a capital letter, a number, and a special character
    const isLengthValid = new_password.length >= 8;
    const isCapitalValid = /[A-Z]/.test(new_password);
    const isNumberValid = /[0-9]/.test(new_password);
    const isSpecialValid = /[!@#$%^&*(),.?":{}|<>]/.test(new_password);

    if (!isLengthValid || !isCapitalValid || !isNumberValid || !isSpecialValid) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 8 characters, include a capital letter, a number, and a special character.'
        });
    }

    try {
        // Verify current password
        const [users] = await pool.execute('SELECT password FROM users WHERE id = ?', [req.session.user_id]);
        const isMatch = await bcrypt.compare(current_password, users[0].password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Current password is incorrect' });
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
