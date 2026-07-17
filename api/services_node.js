const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure disk storage for service images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'assets/uploads/services';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) return cb(null, true);
        cb(new Error('Only images (jpg, png, webp) are allowed'));
    }
});

// Middleware wrapper for handling upload errors
const uploadServiceImage = (req, res, next) => {
    upload.single('image')(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, error: err.message });
        }
        next();
    });
};

const FALLBACK_SERVICES = [
    { id: 1, name: 'Portrait Session', description: 'Professional portrait photography for individuals, couples, and families. Includes studio setup, lighting, and post-processing.', duration_minutes: 60, price: 1500.00, category: 'Portrait', is_active: 1 },
    { id: 2, name: 'Wedding Coverage', description: 'Full-day wedding photography coverage capturing every precious moment from preparation to reception.', duration_minutes: 480, price: 15000.00, category: 'Wedding', is_active: 1 },
    { id: 3, name: 'Event Photography', description: 'Complete event coverage for corporate events, birthdays, and celebrations. Includes same-day previews.', duration_minutes: 240, price: 5000.00, category: 'Event', is_active: 1 },
    { id: 4, name: 'Product Photography', description: 'High-quality product photography for e-commerce, catalogues, and marketing materials with white or custom backgrounds.', duration_minutes: 120, price: 2000.00, category: 'Commercial', is_active: 1 },
    { id: 5, name: 'Real Estate Photography', description: 'Professional interior and exterior photography for property listings, designed to showcase spaces at their best.', duration_minutes: 180, price: 3000.00, category: 'Commercial', is_active: 1 },
    { id: 6, name: 'Fashion & Editorial', description: 'Creative fashion photography for portfolios, lookbooks, and editorial spreads. Includes styling consultation.', duration_minutes: 180, price: 4500.00, category: 'Fashion', is_active: 1 }
];

/**
 * GET /api/services
 */
router.get('/', async (req, res) => {
    try {
        let query = 'SELECT * FROM services WHERE is_active = 1 ORDER BY price ASC';
        if (req.query.all === 'true' && req.session && req.session.user_role === 'admin') {
            query = 'SELECT * FROM services ORDER BY price ASC';
        }
        const [services] = await pool.execute(query);
        res.json({ success: true, data: services });
    } catch (error) {
        console.warn('DB unavailable, serving fallback services:', error.code || error.message);
        let fallback = FALLBACK_SERVICES;
        if (!(req.query.all === 'true' && req.session && req.session.user_role === 'admin')) {
            fallback = FALLBACK_SERVICES.filter(s => s.is_active === 1);
        }
        res.json({ success: true, data: fallback });
    }
});

/**
 * POST /api/services
 */
router.post('/', authMiddleware, roleMiddleware(['admin']), uploadServiceImage, async (req, res) => {
    const { name, description, duration_minutes, price, category } = req.body;
    if (!name || isNaN(price) || isNaN(duration_minutes)) {
        return res.status(400).json({ success: false, error: 'Missing or invalid fields' });
    }
    
    let imageUrl = null;
    if (req.file) {
        imageUrl = `/assets/uploads/services/${req.file.filename}`;
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO services (name, description, duration_minutes, price, category, image_url, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [name, description, parseInt(duration_minutes), parseFloat(price), category || null, imageUrl]
        );
        res.json({ success: true, message: 'Service created successfully', id: result.insertId });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ success: false, error: 'Failed to create service' });
    }
});

/**
 * PUT /api/services/:id
 */
router.put('/:id', authMiddleware, roleMiddleware(['admin']), uploadServiceImage, async (req, res) => {
    const { id } = req.params;
    const { name, description, duration_minutes, price, category, is_active } = req.body;
    
    try {
        const [existing] = await pool.execute('SELECT * FROM services WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Service not found' });
        }

        const fields = [];
        const params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (duration_minutes !== undefined) { fields.push('duration_minutes = ?'); params.push(parseInt(duration_minutes)); }
        if (price !== undefined) { fields.push('price = ?'); params.push(parseFloat(price)); }
        if (category !== undefined) { fields.push('category = ?'); params.push(category); }
        if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active === 'true' || is_active === '1' || is_active === 1 || is_active === true ? 1 : 0); }

        if (req.file) {
            const imageUrl = `/assets/uploads/services/${req.file.filename}`;
            fields.push('image_url = ?');
            params.push(imageUrl);
            
            // Delete old image if it is an uploaded file
            if (existing[0].image_url && existing[0].image_url.startsWith('/assets/uploads/services/')) {
                const oldPath = path.join(__dirname, '..', existing[0].image_url);
                fs.access(oldPath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        fs.unlink(oldPath, (unlinkErr) => {
                            if (unlinkErr) console.error('Error deleting old service image:', unlinkErr);
                        });
                    }
                });
            }
        }

        if (fields.length === 0) {
            return res.json({ success: true, message: 'No fields updated' });
        }

        params.push(id);
        const query = `UPDATE services SET ${fields.join(', ')} WHERE id = ?`;
        await pool.execute(query, params);
        
        res.json({ success: true, message: 'Service updated successfully' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, error: 'Failed to update service' });
    }
});

router.FALLBACK_SERVICES = FALLBACK_SERVICES;
module.exports = router;
