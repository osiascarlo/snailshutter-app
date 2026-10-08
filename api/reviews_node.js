const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { logSystemEvent } = require('../utils/logger');

/**
 * POST /api/reviews
 * Submit or update a review & feedback for a completed booking
 * Requires client authentication
 */
router.post('/', authMiddleware, async (req, res) => {
    try {
        const clientId = req.session.user_id;
        const { booking_id, rating, comment = '', tags = '' } = req.body;

        if (!booking_id) {
            return res.status(400).json({ success: false, error: 'Booking ID is required.' });
        }

        const numericRating = parseInt(rating, 10);
        if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({ success: false, error: 'Rating must be an integer between 1 and 5 stars.' });
        }

        // Verify booking exists, belongs to client, and is COMPLETED
        const [bookings] = await pool.execute(`
            SELECT b.id, b.client_id, b.service_id, b.status, s.name as service_name
            FROM bookings b
            JOIN services s ON b.service_id = s.id
            WHERE b.id = ?
        `, [booking_id]);

        if (bookings.length === 0) {
            return res.status(404).json({ success: false, error: 'Booking not found.' });
        }

        const booking = bookings[0];

        // Ensure booking belongs to this client (or admin override)
        if (booking.client_id !== clientId && req.session.user_role !== 'admin') {
            return res.status(403).json({ success: false, error: 'You are not authorized to review this booking.' });
        }

        // Strictly verify that the booking is COMPLETED
        if (booking.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Reviews and feedback can only be submitted for completed photography sessions.'
            });
        }

        const cleanComment = (comment || '').trim();
        const cleanTags = (Array.isArray(tags) ? tags.join(', ') : (tags || '')).trim();

        // Upsert review (1 review per completed booking)
        await pool.execute(`
            INSERT INTO reviews (booking_id, client_id, service_id, rating, comment, tags, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                rating = VALUES(rating), 
                comment = VALUES(comment), 
                tags = VALUES(tags), 
                updated_at = NOW()
        `, [booking.id, clientId, booking.service_id, numericRating, cleanComment, cleanTags]);

        // Audit log
        try {
            logSystemEvent(
                req,
                'REVIEW_SUBMITTED',
                'Reviews',
                `Client rated booking #${booking.id} (${booking.service_name}) with ${numericRating} stars: "${cleanComment.substring(0, 60)}${cleanComment.length > 60 ? '...' : ''}"`
            );
        } catch (logErr) {
            console.warn('Review audit log warning:', logErr.message);
        }

        return res.json({
            success: true,
            message: 'Thank you for your feedback! Your review has been saved.',
            data: {
                booking_id: booking.id,
                service_id: booking.service_id,
                rating: numericRating,
                comment: cleanComment,
                tags: cleanTags
            }
        });
    } catch (err) {
        console.error('Error submitting review:', err);
        return res.status(500).json({ success: false, error: 'Failed to submit review. Please try again.' });
    }
});

/**
 * GET /api/reviews/my
 * Fetch all reviews left by the currently logged-in client
 */
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const clientId = req.session.user_id;
        const [reviews] = await pool.execute(`
            SELECT r.*, s.name as service_name, b.booking_date, b.start_time
            FROM reviews r
            JOIN bookings b ON r.booking_id = b.id
            JOIN services s ON r.service_id = s.id
            WHERE r.client_id = ?
            ORDER BY r.created_at DESC
        `, [clientId]);

        return res.json({ success: true, reviews });
    } catch (err) {
        console.error('Error fetching client reviews:', err);
        return res.status(500).json({ success: false, error: 'Failed to load your reviews.' });
    }
});

/**
 * GET /api/reviews/booking/:bookingId
 * Get the review for a specific booking
 */
router.get('/booking/:bookingId', async (req, res) => {
    try {
        const bookingId = parseInt(req.params.bookingId, 10);
        if (isNaN(bookingId)) {
            return res.status(400).json({ success: false, error: 'Invalid booking ID.' });
        }

        const [reviews] = await pool.execute(`
            SELECT r.*, s.name as service_name, CONCAT(u.first_name, ' ', u.last_name) as client_name
            FROM reviews r
            JOIN services s ON r.service_id = s.id
            JOIN users u ON r.client_id = u.id
            WHERE r.booking_id = ?
        `, [bookingId]);

        if (reviews.length === 0) {
            return res.json({ success: true, review: null });
        }

        return res.json({ success: true, review: reviews[0] });
    } catch (err) {
        console.error('Error fetching booking review:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch review.' });
    }
});

/**
 * GET /api/reviews/stats
 * Studio-wide and per-service rating statistics (Social Proof)
 */
router.get('/stats', async (req, res) => {
    try {
        const [serviceStats] = await pool.execute(`
            SELECT 
                service_id, 
                COUNT(*) as total_reviews, 
                ROUND(AVG(rating), 1) as avg_rating
            FROM reviews
            WHERE is_public = 1
            GROUP BY service_id
        `);

        const [overallStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_reviews, 
                ROUND(AVG(rating), 1) as avg_rating
            FROM reviews
            WHERE is_public = 1
        `);

        const statsMap = {};
        for (const row of serviceStats) {
            statsMap[row.service_id] = {
                total_reviews: parseInt(row.total_reviews, 10),
                avg_rating: parseFloat(row.avg_rating) || 5.0
            };
        }

        return res.json({
            success: true,
            overall: {
                total_reviews: parseInt(overallStats[0]?.total_reviews || 0, 10),
                avg_rating: parseFloat(overallStats[0]?.avg_rating || 5.0)
            },
            services: statsMap
        });
    } catch (err) {
        console.error('Error fetching review stats:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch review stats.' });
    }
});

/**
 * GET /api/reviews/service/:serviceId
 * Get public reviews and ratings for a particular package/service
 */
router.get('/service/:serviceId', async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId, 10);
        if (isNaN(serviceId)) {
            return res.status(400).json({ success: false, error: 'Invalid service ID.' });
        }

        const [reviews] = await pool.execute(`
            SELECT 
                r.id, r.rating, r.comment, r.tags, r.created_at,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as client_name,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as reviewer_name
            FROM reviews r
            JOIN users u ON r.client_id = u.id
            WHERE r.service_id = ? AND r.is_public = 1
            ORDER BY r.created_at DESC
            LIMIT 50
        `, [serviceId]);

        const [agg] = await pool.execute(`
            SELECT 
                COUNT(*) as total_reviews, 
                ROUND(AVG(rating), 1) as avg_rating
            FROM reviews
            WHERE service_id = ? AND is_public = 1
        `, [serviceId]);

        return res.json({
            success: true,
            total_reviews: parseInt(agg[0]?.total_reviews || 0, 10),
            avg_rating: parseFloat(agg[0]?.avg_rating || 5.0),
            reviews
        });
    } catch (err) {
        console.error('Error fetching service reviews:', err);
        return res.status(500).json({ success: false, error: 'Failed to load service reviews.' });
    }
});

/**
 * GET /api/reviews
 * List recent reviews for public testimonials or admin dashboard
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const [reviews] = await pool.execute(`
            SELECT 
                r.id, r.booking_id, r.rating, r.comment, r.tags, r.created_at,
                s.name as service_name, s.id as service_id,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as client_name,
                TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) as reviewer_name
            FROM reviews r
            JOIN services s ON r.service_id = s.id
            JOIN users u ON r.client_id = u.id
            WHERE r.is_public = 1
            ORDER BY r.created_at DESC
            LIMIT ?
        `, [limit]);

        return res.json({ success: true, reviews });
    } catch (err) {
        console.error('Error fetching reviews:', err);
        return res.status(500).json({ success: false, error: 'Failed to load reviews.' });
    }
});

/**
 * DELETE /api/reviews/:id
 * Delete a review (client can delete their own review, admin can delete any)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id, 10);
        if (isNaN(reviewId)) {
            return res.status(400).json({ success: false, error: 'Invalid review ID.' });
        }

        const [reviews] = await pool.execute('SELECT * FROM reviews WHERE id = ?', [reviewId]);
        if (reviews.length === 0) {
            return res.status(404).json({ success: false, error: 'Review not found.' });
        }

        const review = reviews[0];
        if (review.client_id !== req.session.user_id && req.session.user_role !== 'admin') {
            return res.status(403).json({ success: false, error: 'You are not authorized to delete this review.' });
        }

        await pool.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);

        return res.json({ success: true, message: 'Review deleted successfully.' });
    } catch (err) {
        console.error('Error deleting review:', err);
        return res.status(500).json({ success: false, error: 'Failed to delete review.' });
    }
});

module.exports = router;
