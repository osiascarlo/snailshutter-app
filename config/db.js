const mysql = require('mysql2/promise');
require('dotenv').config();

const poolOpts = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+08:00', // Forces mysql2 to convert and treat all datetimes as UTC+8 (Asia/Manila)
    dateStrings: true
};

// Enable SSL if we are connecting to a remote database
if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
    poolOpts.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolOpts);

// Ensure every connection session in the pool operates in Asia/Manila (UTC+8)
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+08:00'");
});

module.exports = pool;
