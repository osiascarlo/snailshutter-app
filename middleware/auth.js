/**
 * Authentication Middleware for Node.js
 */
const authMiddleware = (req, res, next) => {
    if (req.session && req.session.user_id) {
        next();
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
