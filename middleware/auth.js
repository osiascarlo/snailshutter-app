const pool = require('../config/db');

/**
 * Authentication Middleware for Node.js
 */
const authMiddleware = async (req, res, next) => {
    if (req.session && req.session.user_id) {
        try {
            const [users] = await pool.execute('SELECT id, status FROM users WHERE id = ?', [req.session.user_id]);
            if (users.length === 0 || (users[0].status && users[0].status !== 'active')) {
                req.session.destroy(() => {});
                return res.status(403).json({
                    success: false,
                    deactivated: true,
                    error: 'Your account has been deactivated. Please contact the administrator for assistance.'
                });
            }
            next();
        } catch (err) {
            console.error('authMiddleware status check error:', err);
            // Fallback if DB is unavailable
            if (req.session.status && req.session.status !== 'active') {
                req.session.destroy(() => {});
                return res.status(403).json({
                    success: false,
                    deactivated: true,
                    error: 'Your account has been deactivated. Please contact the administrator for assistance.'
                });
            }
            next();
        }
    } else {
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
};

/**
 * Role-based Authorization Middleware
 */
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (req.session && allowedRoles.includes(req.session.user_role)) {
            next();
        } else {
            res.status(403).json({ success: false, error: 'Forbidden' });
        }
    };
};

module.exports = { authMiddleware, roleMiddleware };
