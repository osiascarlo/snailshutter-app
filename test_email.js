const { sendEmail } = require('./utils/mailer');

async function test() {
    console.log('Starting email test...');
    try {
        const result = await sendEmail('johncarloosias123@gmail.com', 'Test Email', '<h1>Test</h1><p>This is a test email from SnailShutter Studio.</p>');
        console.log('Result:', result);
    } catch (error) {
        console.error('Test Error:', error);
    }
}

test();
