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
    queueLimit: 0
};

// Enable SSL if we are connecting to a remote database
if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
    poolOpts.ssl = { rejectUnauthorized: false };
}

const pool = mysql.createPool(poolOpts);

module.exports = pool;
