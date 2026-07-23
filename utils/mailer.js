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

// Verify SMTP connection on startup if credentials exist
if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    transporter.verify((error) => {
        if (error) {
            console.error('⚠️  SMTP connection failed:', error.message);
            console.error('   Check MAIL_USER and MAIL_PASS in .env');
        } else {
            console.log('✅ SMTP server connection verified — ready to send mail');
        }
    });
}

/**
 * Send email using Resend API (Instant 1-second delivery)
 */
const sendWithResend = async (to, subject, html, plainText) => {
    const resendKey = process.env.RESEND_API_KEY.trim();
    const fromAddress = process.env.MAIL_FROM || 'SnailShutter Studio <onboarding@resend.dev>';

    console.log('📧 Attempting Resend API delivery to:', to);

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
            from: fromAddress,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: html,
            text: plainText
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const errorDetails = data.message || data.error?.message || JSON.stringify(data);
        console.error('❌ Resend API Error (%d):', response.status, errorDetails);
        throw new Error(`Resend API HTTP ${response.status}: ${errorDetails}`);
    }

    console.log('🚀 Resend API email delivered to %s: %s', to, data.id);
    return { success: true, messageId: data.id };
};

/**
 * Send an email (Uses Resend API if RESEND_API_KEY is set, otherwise Nodemailer SMTP)
 * @param {string} to Receiver email
 * @param {string} subject Email subject
 * @param {string} html HTML content
 * @param {string} [text] Optional plain text alternative
 */
const sendEmail = async (to, subject, html, text = '') => {
    const plainText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. If RESEND_API_KEY is set in environment, use Resend for instant delivery
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
        try {
            return await sendWithResend(to, subject, html, plainText);
        } catch (resendError) {
            console.error('⚠️ Resend API failed, falling back to SMTP:', resendError.message);
        }
    }

    // 2. Fallback to Nodemailer SMTP
    try {
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
        console.log('Email sent via SMTP to %s: %s', to, info.messageId);
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

