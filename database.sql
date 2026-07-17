-- Photography Studio Booking System Database
-- Run this in phpMyAdmin or MySQL CLI

CREATE DATABASE IF NOT EXISTS studio_booking;
USE studio_booking;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) DEFAULT NULL,
    role ENUM('admin', 'staff', 'client') NOT NULL DEFAULT 'client',
    status ENUM('active', 'inactive', 'pending') NOT NULL DEFAULT 'active',
    notes TEXT DEFAULT NULL,
    avatar VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Services offered
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 60,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Time slots
CREATE TABLE IF NOT EXISTS time_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slot_label VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    staff_id INT DEFAULT NULL,
    service_id INT NOT NULL,
    service_ids VARCHAR(255) DEFAULT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    notes TEXT,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    downpayment_amount DECIMAL(10,2) DEFAULT 0.00,
    proof_of_payment VARCHAR(255) DEFAULT NULL,
    google_drive_link VARCHAR(1024) DEFAULT NULL,
    payment_status ENUM('unpaid', 'pending', 'paid') DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    INDEX idx_booking_date (booking_date),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ========================================
-- SEED DATA
-- ========================================

-- Default admin (password: Admin@123)
INSERT INTO users (full_name, email, password, role) VALUES
('Studio Admin', 'admin@studio.com', '$2b$10$Y74oXpL98yvgjLvi4XpW5OMTHRJHWYmqRCYt6hlSeiz.b5tk9JyAa', 'admin');

-- Default staff members (password: Staff@123)
INSERT INTO users (full_name, email, password, phone, role) VALUES
('Maria Santos', 'maria@studio.com', '$2b$10$WXTj/HcvE7B13SqoEgrNGek2Dmj6wr8Kv2emnSwxJRflzGEQ2qYIS', '09171234567', 'staff'),
('Carlos Rivera', 'carlos@studio.com', '$2b$10$WXTj/HcvE7B13SqoEgrNGek2Dmj6wr8Kv2emnSwxJRflzGEQ2qYIS', '09179876543', 'staff');

-- Default client (password: Client@123)
INSERT INTO users (full_name, email, password, phone, role) VALUES
('Juan Dela Cruz', 'juan@gmail.com', '$2b$10$372KsaJrmaGKRphl8eDNEukSZIh2134t/BZaU/UFihkxVfcJstHF2', '09181112233', 'client');

-- Services
INSERT INTO services (name, description, duration_minutes, price) VALUES
('Portrait Session', 'Professional individual or couple portrait photography in our studio.', 60, 2500.00),
('Family Portrait', 'Capture your family moments with a full professional session.', 90, 4000.00),
('Wedding Pre-nup', 'Pre-nuptial photoshoot with creative direction and styling.', 180, 12000.00),
('Product Photography', 'High-quality product shots for e-commerce and marketing.', 120, 5000.00),
('Event Coverage', 'Full event photography coverage with edited deliverables.', 240, 15000.00),
('Passport / ID Photo', 'Quick professional ID and passport photos.', 15, 150.00);

-- Time Slots (10 AM to 7 PM)
INSERT INTO time_slots (slot_label, start_time, end_time) VALUES
('10:00 AM - 11:00 AM', '10:00:00', '11:00:00'),
('11:00 AM - 12:00 PM', '11:00:00', '12:00:00'),
('12:00 PM - 1:00 PM', '12:00:00', '13:00:00'),
('1:00 PM - 2:00 PM', '13:00:00', '14:00:00'),
('2:00 PM - 3:00 PM', '14:00:00', '15:00:00'),
('3:00 PM - 4:00 PM', '15:00:00', '16:00:00'),
('4:00 PM - 5:00 PM', '16:00:00', '17:00:00'),
('5:00 PM - 6:00 PM', '17:00:00', '18:00:00'),
('6:00 PM - 7:00 PM', '18:00:00', '19:00:00');

-- Studio Settings
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NULL
) ENGINE=InnoDB;

INSERT INTO settings (setting_key, setting_value) VALUES
('studioName', 'SnailShutter'),
('studioEmail', 'snailshutterstudio@gmail.com'),
('studioPhone', '+63 912 345 6789'),
('studioAddress', 'EJR Business Center 2, Poblacion, Alaminos City, Pangasinan, Philippines'),
('emailNotifications', 'all'),
('bookingReminders', '24'),
('maintenanceMode', 'normal'),
('themeColor', 'green'),
('timeZone', 'UTC+8'),
('gcashQr', '/assets/images/gcash_qr.png'),
('studioHours', 'Mon – Sat, 9:00 AM – 6:00 PM'),
('studioMapEmbed', 'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d958.1126989311325!2d119.9756506!3d16.1456869!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3393dd09643fcad5%3A0x24a5ac354149095!2sSnailshutter%20Alaminos%20Photography%20Studio!5e0!3m2!1sen!2sph!4v1782822704080!5m2!1sen!2sph'),
('studioDirectionsLink', 'https://www.google.com/maps/dir/?api=1&destination=Snailshutter+Alaminos+Photography+Studio');

