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

const pool = require('./config/db');

// Core migration logic that can be triggered on startup or on-demand via HTTP
async function runDatabaseMigration() {
  const logs = [];
  try {
    logs.push('Checking database schema compatibility...');
    const [columns] = await pool.execute("SHOW COLUMNS FROM users");
    const colNames = columns.map(c => c.Field.toLowerCase());
    logs.push(`Current columns: ${colNames.join(', ')}`);

    if (!colNames.includes('first_name')) {
      logs.push('Running migration on database: adding first_name...');
      await pool.execute('ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL AFTER id');
      logs.push('Added first_name column successfully.');
    }

    if (!colNames.includes('last_name')) {
      logs.push('Running migration on database: adding last_name...');
      await pool.execute('ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name');
      logs.push('Added last_name column successfully.');
    }

    // Check columns again after addition
    const [newCols] = await pool.execute("SHOW COLUMNS FROM users");
    const newColNames = newCols.map(c => c.Field.toLowerCase());

    if (newColNames.includes('full_name')) {
      logs.push('Migrating existing user full_name data to first_name and last_name...');
      const [users] = await pool.execute('SELECT id, full_name, first_name, last_name FROM users');
      for (const u of users) {
        if (u.full_name && (!u.first_name || u.first_name === '')) {
          const parts = (u.full_name || '').trim().split(/\s+/);
          const first = parts[0] || 'User';
          const last = parts.slice(1).join(' ') || 'User';
          await pool.execute('UPDATE users SET first_name = ?, last_name = ? WHERE id = ?', [first, last, u.id]);
          logs.push(`Updated user ID ${u.id}: "${u.full_name}" -> "${first}" / "${last}"`);
        }
      }
      logs.push('Setting first_name and last_name default NOT NULL values...');
      await pool.execute("ALTER TABLE users MODIFY COLUMN first_name VARCHAR(100) NOT NULL DEFAULT 'User'");
      await pool.execute("ALTER TABLE users MODIFY COLUMN last_name VARCHAR(100) NOT NULL DEFAULT 'User'");
      
      logs.push('Dropping deprecated full_name column from users table...');
      await pool.execute('ALTER TABLE users DROP COLUMN full_name');
      logs.push('Database migration completed successfully on cloud server!');
    } else {
      logs.push('Database schema is already up-to-date (first_name and last_name columns exist).');
    }
    return { success: true, logs };
  } catch (error) {
    logs.push(`Migration Error: ${error.message}`);
    console.error('Database check/migration failure:', error);
    return { success: false, error: error.message, stack: error.stack, logs };
  }
}

// On-demand migration endpoint to trigger or inspect schema upgrades directly in production
app.get('/api/migrate-db-now', async (req, res) => {
  const result = await runDatabaseMigration();
  res.status(result.success ? 200 : 500).json(result);
});

// Diagnostic endpoint to check current schema columns
app.get('/api/check-db-schema', async (req, res) => {
  try {
    const [columns] = await pool.execute("SHOW COLUMNS FROM users");
    res.json({ success: true, columns: columns.map(c => c.Field) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Diagnostic endpoint to test email sending live from Render and view exact SMTP/API error responses
app.get('/api/test-email', async (req, res) => {
  const targetEmail = req.query.to || 'banceleste@gmail.com';
  const { sendEmail } = require('./utils/mailer');
  
  const envStatus = {
    MAIL_HOST: process.env.MAIL_HOST || 'not set (using default smtp.gmail.com)',
    MAIL_PORT: process.env.MAIL_PORT || 'not set (using default 465 or 587)',
    MAIL_USER: process.env.MAIL_USER ? `${process.env.MAIL_USER.substring(0, 3)}***@***` : '⚠️ MISSING / NOT SET in Render Environment',
    MAIL_PASS_SET: !(!process.env.MAIL_PASS || process.env.MAIL_PASS.trim() === ''),
    BREVO_API_KEY_SET: !(!process.env.BREVO_API_KEY || process.env.BREVO_API_KEY.trim() === ''),
    RESEND_API_KEY_SET: !(!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.trim() === '')
  };

  try {
    console.log(`Diagnostic testing email dispatch to ${targetEmail}...`);
    const result = await sendEmail(
      targetEmail,
      'SnailShutter Diagnostic Test Email',
      '<h2>Hello from SnailShutter Cloud Diagnostic Server!</h2><p>If you received this email, your cloud mailer is working perfectly!</p>',
      'Hello from SnailShutter Cloud Diagnostic Server! If you received this, mailer works!'
    );
    return res.json({ 
      success: result.success !== false, 
      targetEmail, 
      deliveryResult: result, 
      envStatus,
      explanation: result.success === false ? "The SMTP server rejected or timed out the connection from this IP/account." : "Email dispatched successfully!" 
    });
  } catch (err) {
    console.error('Diagnostic email delivery failure:', err);
    return res.status(500).json({
      success: false,
      targetEmail,
      error: err.message,
      stack: err.stack,
      envStatus
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Check DB schema and start server
runDatabaseMigration().then((res) => {
  if (!res.success) {
    console.error('⚠️ Startup database migration warning:', res.error);
  } else {
    console.log('✅ Startup database schema check passed:', res.logs[res.logs.length - 1]);
  }
  app.listen(PORT, () => {
    console.log(`\n🚀 SnailShutter Node.js Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`\n📋 Access the application:`);
    console.log(`   • Main page: http://localhost:${PORT}`);
    console.log(`   • Login: http://localhost:${PORT}/auth/login.html`);
    console.log(`\n⚠️  Press Ctrl+C to stop server\n`);
  });
});
