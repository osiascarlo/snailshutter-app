const nodemailer = require('nodemailer');
require('dotenv').config();

const dns = require('dns');
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.MAIL_PORT, 10) || (mailHost.includes('brevo') || mailHost.includes('sendinblue') ? 587 : 465);

const transporter = nodemailer.createTransport({
    pool: true,                    // Reuse SMTP connections for fast dispatch
    maxConnections: 5,             // Max parallel connections
    maxMessages: 100,              // Max messages per connection
    host: mailHost,
    port: port,
    secure: port === 465,          // true for port 465 (SSL)
    family: 4,                     // Force IPv4 to prevent ENETUNREACH IPv6 errors on Render
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    tls: {
        rejectUnauthorized: false  // avoid ECONNRESET
    },
    connectionTimeout: 8000,       // 8s max connection timeout
    greetingTimeout: 5000,         // 5s greeting timeout
    socketTimeout: 10000           // 10s socket inactivity timeout
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

let cachedBrevoSender = null;

/**
 * Auto-detect verified sender email from Brevo account if not explicitly set
 */
const getBrevoSender = async (brevoKey) => {
    if (process.env.BREVO_SENDER_EMAIL && process.env.BREVO_SENDER_EMAIL.trim()) {
        return process.env.BREVO_SENDER_EMAIL.trim();
    }
    if (cachedBrevoSender) {
        return cachedBrevoSender;
    }

    try {
        const res = await fetch('https://api.brevo.com/v3/senders', {
            headers: {
                'Accept': 'application/json',
                'api-key': brevoKey
            }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.senders && data.senders.length > 0) {
                const activeSender = data.senders.find(s => s.active) || data.senders[0];
                if (activeSender && activeSender.email) {
                    cachedBrevoSender = activeSender.email;
                    console.log('✅ Auto-detected Brevo verified sender email:', cachedBrevoSender);
                    return cachedBrevoSender;
                }
            }
        } else {
            const errBody = await res.text();
            console.error('⚠️ Brevo Scheders API fetch failed (%d):', res.status, errBody);
        }
    } catch (err) {
        console.error('⚠️ Could not auto-detect Brevo sender:', err.message);
    }

    if (process.env.MAIL_USER && process.env.MAIL_USER.includes('@')) {
        return process.env.MAIL_USER.trim();
    }

    return 'johncarloosias123@gmail.com';
};

/**
 * Send email using Brevo REST API (Instant 1-second delivery to ANY email address)
 */
const sendWithBrevo = async (to, subject, html, plainText) => {
    const brevoKey = process.env.BREVO_API_KEY.trim();
    const senderEmail = await getBrevoSender(brevoKey);
    const senderName = process.env.MAIL_FROM_NAME || 'SnailShutter Studio';

    console.log('📧 Sending via Brevo API to:', to, 'using verified sender:', senderEmail);

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
        throw new Error(`HTTP ${response.status} - ${errorDetails} (Tried sender: ${senderEmail})`);
    }

    console.log('🚀 Brevo API email delivered to %s (MessageID: %s)', to, data.messageId || data.id);
    return { success: true, messageId: data.messageId || data.id, provider: 'Brevo API', sender: senderEmail };
};

let cachedMailjetSender = null;

/**
 * Auto-detect verified sender email from Mailjet account if not explicitly set
 */
const getMailjetSender = async (publicKey, secretKey) => {
    if (process.env.MAILJET_SENDER_EMAIL && process.env.MAILJET_SENDER_EMAIL.trim()) {
        return process.env.MAILJET_SENDER_EMAIL.trim();
    }
    if (process.env.MAIL_FROM && process.env.MAIL_FROM.includes('@')) {
        return process.env.MAIL_FROM.trim();
    }
    if (cachedMailjetSender) {
        return cachedMailjetSender;
    }

    try {
        const authHeader = 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
        const res = await fetch('https://api.mailjet.com/v3/REST/sender', {
            headers: {
                'Accept': 'application/json',
                'Authorization': authHeader
            }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.Data && data.Data.length > 0) {
                const activeSender = data.Data.find(s => s.Status === 'Active') || data.Data[0];
                if (activeSender && activeSender.Email) {
                    cachedMailjetSender = activeSender.Email;
                    console.log('✅ Auto-detected Mailjet verified sender email:', cachedMailjetSender);
                    return cachedMailjetSender;
                }
            }
        } else {
            const errBody = await res.text();
            console.error('⚠️ Mailjet Senders API fetch failed (%d):', res.status, errBody);
        }
    } catch (err) {
        console.error('⚠️ Could not auto-detect Mailjet sender:', err.message);
    }

    if (process.env.MAIL_USER && process.env.MAIL_USER.includes('@')) {
        return process.env.MAIL_USER.trim();
    }

    return 'johncarloosias123@gmail.com';
};

/**
 * Send email using Mailjet REST API v3.1 (Instant cloud delivery over HTTPS)
 */
const sendWithMailjet = async (to, subject, html, plainText, publicKey, secretKey) => {
    const senderEmail = await getMailjetSender(publicKey, secretKey);
    const senderName = process.env.MAIL_FROM_NAME || 'SnailShutter Studio';
    const authHeader = 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    console.log('📧 Sending via Mailjet API to:', to, 'using verified sender:', senderEmail);

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': authHeader
        },
        body: JSON.stringify({
            Messages: [
                {
                    From: {
                        Email: senderEmail,
                        Name: senderName
                    },
                    To: [
                        {
                            Email: to,
                            Name: to
                        }
                    ],
                    Subject: subject,
                    TextPart: plainText,
                    HTMLPart: html
                }
            ]
        })
    });

    const data = await response.json();

    if (!response.ok || (data.Messages && data.Messages[0] && data.Messages[0].Status === 'error')) {
        const errorDetails = (data.Messages && data.Messages[0] && data.Messages[0].Errors) 
            ? JSON.stringify(data.Messages[0].Errors) 
            : (data.ErrorMessage || JSON.stringify(data));
        console.error('❌ Mailjet API Error (%d):', response.status, errorDetails);
        throw new Error(`Mailjet API Error: ${errorDetails} (Tried sender: ${senderEmail})`);
    }

    const msgInfo = (data.Messages && data.Messages[0]) ? data.Messages[0] : {};
    const messageId = msgInfo.To && msgInfo.To[0] && msgInfo.To[0].MessageID ? msgInfo.To[0].MessageID : 'mj-' + Date.now();
    console.log('🚀 Mailjet API email delivered to %s (MessageID: %s)', to, messageId);
    return { success: true, messageId: String(messageId), provider: 'Mailjet API', sender: senderEmail };
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
    return { success: true, messageId: data.id, provider: 'Resend API' };
};

/**
 * Send an email (Supports Mailjet API, Brevo API, Resend API, Gmail/Nodemailer SMTP)
 * @param {string} to Receiver email
 * @param {string} subject Email subject
 * @param {string} html HTML content
 * @param {string} [text] Optional plain text alternative
 */
const sendEmail = async (to, subject, html, text = '') => {
    const plainText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    let brevoErrorMsg = null;
    let resendErrorMsg = null;
    let mailjetErrorMsg = null;
    let lastErrorMsg = null;

    // 1. Prioritize BREVO_API_KEY as #1 for free instant delivery with verified sender detection
    if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
        try {
            return await sendWithBrevo(to, subject, html, plainText);
        } catch (brevoError) {
            console.error('⚠️ Brevo API failed:', brevoError.message);
            brevoErrorMsg = brevoError.message;
            lastErrorMsg = brevoError.message;
            if (!process.env.RESEND_API_KEY && !process.env.MAILJET_API_KEY && (!process.env.MAIL_USER || !process.env.MAIL_PASS)) {
                return { success: false, error: `Brevo API failed: ${brevoError.message}`, brevoError: brevoErrorMsg, provider: 'Brevo API' };
            }
            console.warn('Attempting next fallback provider...');
        }
    }

    // 2. If RESEND_API_KEY is present, use Resend API as #2 fallback
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
        try {
            return await sendWithResend(to, subject, html, plainText);
        } catch (resendError) {
            console.error('⚠️ Resend API failed:', resendError.message);
            resendErrorMsg = resendError.message;
            lastErrorMsg = resendError.message;
            if (!process.env.MAILJET_API_KEY && (!process.env.MAIL_USER || !process.env.MAIL_PASS)) {
                return { success: false, error: `Resend API failed: ${resendError.message}`, resendError: resendErrorMsg, provider: 'Resend API' };
            }
            console.warn('Attempting next fallback provider...');
        }
    }

    // 3. If Mailjet API keys are present, try Mailjet API as #3 fallback
    const mailjetPub = (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC || '').trim();
    let mailjetSec = (process.env.MAILJET_SECRET_KEY || process.env.MJ_APIKEY_PRIVATE || '').trim();
    let mjPublic = mailjetPub;
    if (mailjetPub.includes(':') && !mailjetSec) {
        const parts = mailjetPub.split(':');
        mjPublic = parts[0].trim();
        mailjetSec = parts[1].trim();
    }

    if (mjPublic && mailjetSec) {
        try {
            return await sendWithMailjet(to, subject, html, plainText, mjPublic, mailjetSec);
        } catch (mailjetError) {
            console.error('⚠️ Mailjet API failed:', mailjetError.message);
            mailjetErrorMsg = mailjetError.message;
            lastErrorMsg = mailjetError.message;
            if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
                return { success: false, error: `Mailjet API failed: ${mailjetError.message}`, mailjetError: mailjetErrorMsg, provider: 'Mailjet API' };
            }
            console.warn('Attempting SMTP fallback...');
        }
    }

    // 3. Fallback to Nodemailer SMTP
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
        return { success: true, messageId: info.messageId, provider: 'SMTP' };
    } catch (error) {
        console.error('⚠️ Send Email SMTP Warning:', error.message || error);
        return { 
            success: false, 
            error: lastErrorMsg || error.message || 'All email providers failed',
            smtpError: error.message || 'SMTP connection warning', 
            brevoError: brevoErrorMsg || undefined,
            resendError: resendErrorMsg || undefined,
            mailjetError: mailjetErrorMsg || undefined,
            provider: 'All failovers unsuccessful'
        };
    }
};

module.exports = { sendEmail };
