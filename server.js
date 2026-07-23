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

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 SnailShutter Node.js Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`\n📋 Access the application:`);
  console.log(`   • Main page: http://localhost:${PORT}`);
  console.log(`   • Login: http://localhost:${PORT}/auth/login.html`);
  console.log(`\n⚠️  Press Ctrl+C to stop server\n`);
});
