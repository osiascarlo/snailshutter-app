const nodemailer = require('nodemailer');
require('dotenv').config();

const port = parseInt(process.env.MAIL_PORT, 10) || 465;

const transporter = nodemailer.createTransport({
    pool: true,                    // Reuse SMTP connections for fast dispatch
    maxConnections: 5,             // Max parallel connections
    maxMessages: 100,              // Max messages per connection
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: port,
    secure: port === 465,          // true for port 465 (SSL direct encryption - instant socket connect)
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    tls: {
        rejectUnauthorized: false  // allow self-signed certs / avoid ECONNRESET
    },
    connectionTimeout: 8000,       // 8s max connection timeout
    greetingTimeout: 5000,         // 5s greeting timeout
    socketTimeout: 10000           // 10s socket inactivity timeout
});

// Verify SMTP connection on startup (non-blocking)
transporter.verify((error) => {
    if (error) {
        console.error('⚠️  SMTP connection failed:', error.message);
        console.error('   Check MAIL_USER and MAIL_PASS in .env');
    } else {
        console.log('✅ SMTP server connection verified — ready to send mail');
    }
});

/**
 * Send an email
 * @param {string} to Receiver email
 * @param {string} subject Email subject
 * @param {string} html HTML content
 * @param {string} [text] Optional plain text alternative
 */
const sendEmail = async (to, subject, html, text = '') => {
    try {
        // Generate plain text alternative if not supplied to pass spam/greylisting filters instantly
        const plainText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

        const mailOptions = {
            from: `"${process.env.MAIL_FROM_NAME || 'SnailShutter'}" <${process.env.MAIL_USER}>`,
            to,
            subject,
            text: plainText,
            html,
            priority: 'high',
            headers: {
                'X-Priority': '1 (Highest)',
                'X-MSMail-Priority': 'High',
                'Importance': 'High'
            }
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent to %s: %s', to, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Send Email Error:', error);

        // Provide a clear user-facing message
        let userMessage = 'Failed to send email. Please try again later.';
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            userMessage = 'Could not connect to SMTP server. Check MAIL_HOST and MAIL_PORT in .env';
        } else if (error.responseCode === 535 || (error.message && error.message.includes('Invalid login'))) {
            userMessage = 'SMTP authentication failed. Check MAIL_USER and MAIL_PASS in .env (use a Gmail App Password).';
        }

        throw new Error(userMessage);
    }
};

module.exports = { sendEmail };

