# How to Run the Converted Frontend

## Option 1: Full PHP Environment (Recommended)

### Install XAMPP (Easiest Method)
1. Download XAMPP from https://www.apachefriends.org/
2. Install XAMPP (includes Apache, PHP, MySQL)
3. Start Apache and MySQL from XAMPP Control Panel
4. Copy the project folder to `C:/xampp/htdocs/`
5. Open browser: `http://localhost/ACTIVITIES/CAPSTONE2/`

### Manual PHP Installation
1. Install PHP from https://www.php.net/downloads.php
2. Add PHP to your system PATH
3. Open terminal in project directory
4. Run: `php -S localhost:8000`
5. Open browser: `http://localhost:8000`

## Option 2: Node.js Server (Static Files Only)

### Quick Start
1. Make sure Node.js is installed (you have v24.13.1)
2. Open terminal in project directory
3. Run: `node server.js`
4. Open browser: `http://localhost:3000`

### Limitations
- ✅ Static HTML/CSS/JS files work
- ❌ API endpoints won't work (require PHP)
- ✅ Can test UI and navigation
- ❌ Cannot test login, booking, or dynamic features

## Option 3: Docker (Advanced)

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  web:
    image: php:8.1-apache
    ports:
      - "8080:80"
    volumes:
      - .:/var/www/html
```

Run: `docker-compose up`

## Testing the Application

### 1. Test Static Files
Open `http://localhost:3000/test-api.html` (Node.js server)
- Tests basic JavaScript functionality
- Shows API endpoint structure

### 2. Test Full Application
Open `http://localhost:8000` (PHP server)
- Complete functionality
- Login/registration works
- Booking system operational
- All dashboards functional

## Database Setup

### Using XAMPP
1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Create database: `lenscraft_studio`
3. Import `database.sql` from project root
4. Update `config/database.php` with your credentials

### Manual Setup
1. Create MySQL database
2. Import `database.sql`
3. Configure database connection in `config/database.php`

## Troubleshooting

### "PHP not recognized" Error
- Install PHP or XAMPP
- Add PHP to system PATH
- Restart terminal

### "Database connection failed"
- Check MySQL is running
- Verify database credentials
- Ensure database exists

### "API endpoints not working"
- Must use PHP server (not Node.js)
- Check `.htaccess` if using Apache
- Verify CORS headers

### Port already in use
- Change port: `php -S localhost:8080`
- Or: `node server.js` (uses port 3000)

## File Permissions (Linux/Mac)
```bash
chmod -R 755 /path/to/project
chmod -R 777 /path/to/project/api
```

## Development Workflow

1. **Development**: Use Node.js server for UI testing
2. **Integration**: Use PHP server for full testing
3. **Production**: Deploy to Apache/Nginx with PHP

## Quick Start Commands

```bash
# Option 1: PHP Server (Full functionality)
php -S localhost:8000

# Option 2: Node.js Server (Static only)
node server.js

# Option 3: Test API endpoints
open http://localhost:3000/test-api.html
```

Choose the option that best fits your needs. For full functionality, **Option 1 (PHP server)** is recommended.
