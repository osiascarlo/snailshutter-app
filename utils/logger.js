const pool = require('../config/db');

/**
 * Extract clean client IP address supporting Cloud / Render proxy headers
 */
function getClientIp(req) {
    if (!req) return '127.0.0.1';
    const forwarded = req.headers && req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

/**
 * Log a system event into the system_logs table asynchronously without blocking requests
 * 
 * @param {Object} options
 * @param {Object} [options.req] - Express request object (used to extract IP, user session if not given)
 * @param {number|null} [options.userId] - User ID
 * @param {string|null} [options.userName] - User Name
 * @param {string|null} [options.userRole] - User Role ('admin', 'staff', 'client', 'system')
 * @param {string} options.action - Action code (e.g. 'LOGIN', 'BOOKING_CREATED', 'STATUS_CHANGED')
 * @param {string} options.module - Functional module ('Authentication', 'Bookings', 'Users', 'Photo Deliveries', 'Settings', 'Security', 'Services')
 * @param {string} options.details - Human-readable explanation of the action
 * @param {string} [options.status] - 'success', 'warning', 'danger', 'info'
 * @param {string} [options.ipAddress] - Custom IP if req is not provided
 */
async function logSystemEvent(options = {}) {
    const {
        req = null,
        action,
        module,
        details = '',
        status = 'success'
    } = options;

    if (!action || !module) {
        console.warn('[Logger] Skipping logSystemEvent: action and module are required');
        return;
    }

    // Resolve Actor
    let userId = options.userId !== undefined ? options.userId : null;
    let userName = options.userName || null;
    let userRole = options.userRole || null;

    if (req && req.session) {
        if (userId === null && req.session.user_id) userId = req.session.user_id;
        if (!userName && req.session.user_name) userName = req.session.user_name;
        if (!userRole && req.session.user_role) userRole = req.session.user_role;
    }

    if (!userName) {
        userName = userRole === 'system' ? 'System Automator' : (userId ? `User #${userId}` : 'Guest / Visitor');
    }
    if (!userRole) {
        userRole = userId ? 'client' : 'system';
    }

    // Resolve IP
    const ipAddress = options.ipAddress || getClientIp(req);

    // Asynchronous non-blocking insert
    setImmediate(async () => {
        try {
            await pool.execute(`
                INSERT INTO system_logs (user_id, user_name, user_role, action, module, details, ip_address, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, userName, userRole, action, module, details, ipAddress, status]);
        } catch (err) {
            // Never throw from logging — only log warning
            console.warn('[Logger] Failed to write system log:', err.message);
        }
    });
}

module.exports = {
    logSystemEvent,
    getClientIp
};
