const { getClientIp } = require('./logger');

/**
 * Login Security & Brute Force Prevention Manager
 * 
 * Features:
 * - Tracks consecutive failed login attempts by normalized email and client IP.
 * - Enforces temporary lockout (cooldown) after 3 consecutive failed password attempts.
 * - Prevents automated credential stuffing and brute force attacks.
 * - Automatically expires old records and cleans up in-memory cache.
 */

const MAX_FAILED_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 60; // 60 seconds cooldown after 3 consecutive failures
const ATTEMPT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes idle expiry

// In-memory store: email -> { attempts, lockedUntil, lastAttempt, firstAttempt }
const emailAttempts = new Map();

// In-memory store: ip -> { attempts, lockedUntil, lastAttempt }
const ipAttempts = new Map();

/**
 * Helper to normalize email addresses
 */
function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
}

/**
 * Check if an email or IP address is currently locked out
 * 
 * @param {string} email 
 * @param {Object} [req] Express request object
 * @returns {{ isLocked: boolean, retryAfter: number, attempts: number, reason?: string }}
 */
function checkLockout(email, req = null) {
    const normEmail = normalizeEmail(email);
    const clientIp = getClientIp(req);
    const now = Date.now();

    // 1. Check Email Lockout (per-account lockout)
    if (normEmail && emailAttempts.has(normEmail)) {
        const record = emailAttempts.get(normEmail);
        if (record.lockedUntil && record.lockedUntil > now) {
            const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
            return {
                isLocked: true,
                retryAfter: Math.max(1, retryAfter),
                attempts: record.attempts,
                reason: 'email'
            };
        } else if (record.lockedUntil && record.lockedUntil <= now) {
            // Lockout period has elapsed: clear the lock state
            record.lockedUntil = 0;
            record.attempts = 0;
        }
    }

    return { isLocked: false, retryAfter: 0, attempts: 0 };
}

/**
 * Record a failed login attempt for an email and IP
 * 
 * @param {string} email 
 * @param {Object} [req] Express request object
 * @returns {{ isLocked: boolean, retryAfter: number, attempts: number, attemptsLeft: number, suggestForgotPassword: boolean }}
 */
function recordFailedAttempt(email, req = null) {
    const normEmail = normalizeEmail(email);
    const clientIp = getClientIp(req);
    const now = Date.now();

    let attempts = 1;
    let lockedUntil = 0;
    let retryAfter = 0;
    let isLocked = false;

    // Track by email
    if (normEmail) {
        if (emailAttempts.has(normEmail)) {
            const record = emailAttempts.get(normEmail);
            // If previous attempts were over 15 minutes ago, reset
            if (now - record.lastAttempt > ATTEMPT_EXPIRY_MS) {
                record.attempts = 1;
                record.firstAttempt = now;
            } else {
                record.attempts += 1;
            }
            record.lastAttempt = now;

            if (record.attempts >= MAX_FAILED_ATTEMPTS) {
                record.lockedUntil = now + (COOLDOWN_SECONDS * 1000);
                isLocked = true;
                lockedUntil = record.lockedUntil;
                retryAfter = COOLDOWN_SECONDS;
            }

            attempts = record.attempts;
        } else {
            emailAttempts.set(normEmail, {
                attempts: 1,
                lockedUntil: 0,
                lastAttempt: now,
                firstAttempt: now
            });
            attempts = 1;
        }
    }

    // Track by IP as well (locks IP after 10 failed attempts across all emails)
    if (clientIp) {
        if (ipAttempts.has(clientIp)) {
            const ipRecord = ipAttempts.get(clientIp);
            if (now - ipRecord.lastAttempt > ATTEMPT_EXPIRY_MS) {
                ipRecord.attempts = 1;
            } else {
                ipRecord.attempts += 1;
            }
            ipRecord.lastAttempt = now;

            if (ipRecord.attempts >= 10) {
                ipRecord.lockedUntil = now + (COOLDOWN_SECONDS * 1000);
                isLocked = true;
                retryAfter = Math.max(retryAfter, COOLDOWN_SECONDS);
            }
        } else {
            ipAttempts.set(clientIp, {
                attempts: 1,
                lockedUntil: 0,
                lastAttempt: now
            });
        }
    }

    const attemptsLeft = Math.max(0, MAX_FAILED_ATTEMPTS - attempts);
    const suggestForgotPassword = attempts >= MAX_FAILED_ATTEMPTS;

    return {
        isLocked,
        retryAfter,
        attempts,
        attemptsLeft,
        suggestForgotPassword
    };
}

/**
 * Record a successful login to reset failed attempts
 * 
 * @param {string} email 
 * @param {Object} [req] Express request object
 */
function recordSuccessfulLogin(email, req = null) {
    const normEmail = normalizeEmail(email);
    const clientIp = getClientIp(req);

    if (normEmail && emailAttempts.has(normEmail)) {
        emailAttempts.delete(normEmail);
    }

    if (clientIp && ipAttempts.has(clientIp)) {
        ipAttempts.delete(clientIp);
    }
}

/**
 * Reset lockout state specifically when password is reset successfully
 * 
 * @param {string} email 
 */
function resetLockout(email) {
    const normEmail = normalizeEmail(email);
    if (normEmail && emailAttempts.has(normEmail)) {
        emailAttempts.delete(normEmail);
    }
}

/**
 * Cleanup expired entries every 10 minutes to prevent memory leaks
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of emailAttempts.entries()) {
        if (now - value.lastAttempt > ATTEMPT_EXPIRY_MS && (!value.lockedUntil || value.lockedUntil <= now)) {
            emailAttempts.delete(key);
        }
    }
    for (const [key, value] of ipAttempts.entries()) {
        if (now - value.lastAttempt > ATTEMPT_EXPIRY_MS && (!value.lockedUntil || value.lockedUntil <= now)) {
            ipAttempts.delete(key);
        }
    }
}, 10 * 60 * 1000);

module.exports = {
    MAX_FAILED_ATTEMPTS,
    COOLDOWN_SECONDS,
    checkLockout,
    recordFailedAttempt,
    recordSuccessfulLogin,
    resetLockout
};
