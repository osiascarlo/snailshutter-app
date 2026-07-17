require('dotenv').config();
const pool = require('./config/db');

async function fixPasswords() {
    const ADMIN_HASH  = '$2b$10$Y74oXpL98yvgjLvi4XpW5OMTHRJHWYmqRCYt6hlSeiz.b5tk9JyAa';
    const STAFF_HASH  = '$2b$10$WXTj/HcvE7B13SqoEgrNGek2Dmj6wr8Kv2emnSwxJRflzGEQ2qYIS';
    const CLIENT_HASH = '$2b$10$372KsaJrmaGKRphl8eDNEukSZIh2134t/BZaU/UFihkxVfcJstHF2';

    const updates = [
        { email: 'admin@studio.com',  hash: ADMIN_HASH,  label: 'Admin' },
        { email: 'maria@studio.com',  hash: STAFF_HASH,  label: 'Maria (staff)' },
        { email: 'carlos@studio.com', hash: STAFF_HASH,  label: 'Carlos (staff)' },
        { email: 'juan@gmail.com',    hash: CLIENT_HASH, label: 'Juan (client)' },
    ];

    for (const u of updates) {
        const [result] = await pool.execute(
            'UPDATE users SET password = ? WHERE email = ?',
            [u.hash, u.email]
        );
        console.log(`${u.label} <${u.email}>: ${result.affectedRows} row(s) updated`);
    }

    console.log('\nDone! You can now log in with:');
    console.log('  admin@studio.com  /  Admin@123');
    console.log('  maria@studio.com  /  Staff@123');
    console.log('  carlos@studio.com /  Staff@123');
    console.log('  juan@gmail.com    /  Client@123');
    process.exit(0);
}

fixPasswords().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
