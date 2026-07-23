const nodemailer = require('nodemailer');
require('dotenv').config();

const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.MAIL_PORT, 10) || (mailHost.includes('brevo') || mailHost.includes('sendinblue') ? 587 : 465);

const transporter = nodemailer.createTransport({
    pool: true,                    // Reuse SMTP connections for fast dispatch
    maxConnections: 5,             // Max parallel connections
    maxMessages: 100,              // Max messages per connection
    host: mailHost,
    port: port,
    secure: port === 465,          // true for port 465 (SSL)
    family: 4,                     // Force IPv4 to prevent ENETUNREACH IPv6 warnings on Render
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    tls: {
        rejectUnauthorized: false  // avoid ECONNRESET
    },
    connectionTimeout: 10000,      // 10s max connection timeout
    greetingTimeout: 5000,         // 5s greeting timeout
    socketTimeout: 15000           // 15s socket inactivity timeout
});

// Verify SMTP connection on startup only if API key is not set and SMTP credentials exist
if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY && process.env.MAIL_USER && process.env.MAIL_PASS) {
    transporter.verify((error) => {
        if (error) {
            console.error('⚠️  SMTP connection warning:', error.message);
        } else {
            console.log(`✅ Mailer connected via SMTP (${mailHost}:${port}) — ready to send mail`);
        }
    });
}

/**
 * Send email using Brevo REST API (Instant 1-second delivery to ANY email address)
 */
const sendWithBrevo = async (to, subject, html, plainText) => {
    const brevoKey = process.env.BREVO_API_KEY.trim();
    // Brevo API requires sender email to be the email registered/verified in your Brevo account
    const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.MAIL_USER || 'johncarloosias123@gmail.com';
    const senderName = process.env.MAIL_FROM_NAME || 'SnailShutter Studio';

    console.log('📧 Sending via Brevo API to:', to, 'from sender:', senderEmail);

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'api-key': brevoKey
        },
        body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject: subject,
            htmlContent: html,
            textContent: plainText
        })
    });

    const data = await response.json();

    if (!response.ok) {
        const errorDetails = data.message || data.code || JSON.stringify(data);
        console.error('❌ Brevo API Error (%d):', response.status, errorDetails);
        throw new Error(`Brevo API HTTP ${response.status}: ${errorDetails}`);
    }

    console.log('🚀 Brevo API email delivered to %s (MessageID: %s)', to, data.messageId || data.id);
    return { success: true, messageId: data.messageId || data.id };
};

/**
 * Send email using Resend API
 */
const sendWithResend = async (to, subject, html, plainText) => {
    const resendKey = process.env.RESEND_API_KEY.trim();
    const fromAddress = process.env.MAIL_FROM || 'SnailShutter Studio <onboarding@resend.dev>';

    console.log('📧 Sending via Resend API to:', to);

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
 * Send an email (Supports Brevo API, Resend API, Brevo SMTP, Gmail SMTP)
 * @param {string} to Receiver email
 * @param {string} subject Email subject
 * @param {string} html HTML content
 * @param {string} [text] Optional plain text alternative
 */
const sendEmail = async (to, subject, html, text = '') => {
    const plainText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. If BREVO_API_KEY is present, use Brevo API for instant 1-second delivery to ANY recipient
    if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
        try {
            return await sendWithBrevo(to, subject, html, plainText);
        } catch (brevoError) {
            console.error('⚠️ Brevo API failed, falling back to SMTP:', brevoError.message);
        }
    }

    // 2. If RESEND_API_KEY is present, use Resend API
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
        try {
            return await sendWithResend(to, subject, html, plainText);
        } catch (resendError) {
            console.error('⚠️ Resend API failed, falling back to SMTP:', resendError.message);
        }
    }

    // 3. Fallback to Nodemailer SMTP (Works with Brevo SMTP, Gmail SMTP, SendGrid SMTP, etc.)
    try {
        const senderUser = process.env.MAIL_USER || 'no-reply@snailshutter.com';
        const senderName = process.env.MAIL_FROM_NAME || 'SnailShutter Studio';

        const mailOptions = {
            from: `"${senderName}" <${senderUser}>`,
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
        console.log('⚡ Email sent via SMTP (%s) to %s: %s', mailHost, to, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Send Email Error:', error);

        let userMessage = 'Failed to send email. Please try again later.';
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            userMessage = 'Could not connect to Mail server. Check MAIL_HOST and MAIL_PORT in .env';
        } else if (error.responseCode === 535 || (error.message && error.message.includes('Invalid login'))) {
            userMessage = 'Mail authentication failed. Check MAIL_USER and MAIL_PASS in .env.';
        }

        throw new Error(userMessage);
    }
};

module.exports = { sendEmail };
