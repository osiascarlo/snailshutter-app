const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'snailshutter_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for localhost HTTP
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Serve static files with no-cache headers
app.use(express.static(path.join(__dirname, '.'), {
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Root redirect to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve favicon to prevent 404 console errors
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets/images/logo.png'));
});

// Import Routes
const authRoutes = require('./api/auth_node');
const bookingRoutes = require('./api/bookings_node');
const userRoutes = require('./api/users_node');
const serviceRoutes = require('./api/services_node');
const calendarRoutes = require('./api/calendar_node');
const adminRoutes = require('./api/admin_node');
const galleryRoutes = require('./api/gallery_node');
const availabilityRouter = require('./api/availability_sse');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/availability', availabilityRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

const pool = require('./config/db');

// Automatically check and migrate database schema on server startup (handles remote cloud databases like Render)
async function checkAndMigrateDatabase() {
  try {
    console.log('🔄 Checking database schema compatibility...');
    const [columns] = await pool.execute("SHOW COLUMNS FROM users");
    const colNames = columns.map(c => c.Field);

    if (!colNames.includes('first_name')) {
      console.log('⚡ Running migration on database: adding first_name...');
      await pool.execute('ALTER TABLE users ADD COLUMN first_name VARCHAR(50) NOT NULL DEFAULT "" AFTER id');
    }

    if (!colNames.includes('last_name')) {
      console.log('⚡ Running migration on database: adding last_name...');
      await pool.execute('ALTER TABLE users ADD COLUMN last_name VARCHAR(50) NOT NULL DEFAULT "" AFTER first_name');
    }

    if (colNames.includes('full_name')) {
      console.log('⚡ Migrating existing user full_name data to first_name and last_name...');
      const [users] = await pool.execute('SELECT id, full_name, first_name, last_name FROM users');
      for (const u of users) {
        if (u.full_name && (!u.first_name || u.first_name === '')) {
          const parts = u.full_name.trim().split(/\s+/);
          const first = parts[0] || 'User';
          const last = parts.slice(1).join(' ') || 'User';
          await pool.execute('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?', [first, last, u.id]);
          console.log(`Updated user ID ${u.id}: "${u.full_name}" -> "${first}" / "${last}"`);
        }
      }
      console.log('⚡ Dropping deprecated full_name column from users table...');
      await pool.execute('ALTER TABLE users DROP COLUMN full_name');
      console.log('✅ Database migration completed successfully on cloud server!');
    } else {
      console.log('✅ Database schema is up-to-date (first_name and last_name columns exist).');
    }
  } catch (error) {
    console.error('⚠️ Database check/migration warning:', error.message);
  }
}

// Check DB schema and start server
checkAndMigrateDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 SnailShutter Node.js Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`\n📋 Access the application:`);
    console.log(`   • Main page: http://localhost:${PORT}`);
    console.log(`   • Login: http://localhost:${PORT}/auth/login.html`);
    console.log(`\n⚠️  Press Ctrl+C to stop server\n`);
  });
});
