-- Run this in phpMyAdmin or MySQL CLI to add OTP support
-- Add this to your existing studio_booking database

USE studio_booking;

CREATE TABLE IF NOT EXISTS otp_verifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(255)     NOT NULL,
    otp_code    CHAR(6)          NOT NULL,
    purpose     ENUM('register','password_reset') NOT NULL DEFAULT 'register',
    is_used     TINYINT(1)       NOT NULL DEFAULT 0,
    attempts    TINYINT(1)       NOT NULL DEFAULT 0,
    expires_at  DATETIME         NOT NULL,
    created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_otp (email, otp_code),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
