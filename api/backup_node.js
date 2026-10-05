const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const pool = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { logSystemEvent } = require('../utils/logger');

// Security: All backup & restore actions strictly require admin authorization
const adminOnly = [authMiddleware, roleMiddleware(['admin'])];

// Ensure backups storage directory exists
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

// Multer storage for uploaded SQL backups
const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, backupsDir);
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const cleanName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_.-]/g, '_');
        cb(null, `uploaded_${timestamp}_${cleanName}`);
    }
});

const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.sql') {
            cb(null, true);
        } else {
            cb(new Error('Invalid backup file. Only .sql files are supported.'));
        }
    }
});

// Helper: Format bytes to human readable size
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper: Get DB connection credentials
function getDbCredentials() {
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'studio_booking',
        port: process.env.DB_PORT || '3306'
    };
}

/**
 * Generate a complete database backup .sql file
 * Primary engine: mysqldump CLI via child_process.spawn
 * Fallback engine: Pure JavaScript table schema and row exporter
 */
async function generateBackup({ type = 'manual', notes = '', creator = 'System Administrator' }) {
    const creds = getDbCredentials();
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    
    const prefix = type === 'safety' ? 'safety_backup' : (type === 'upload' ? 'uploaded_backup' : 'backup');
    const filename = `${prefix}_${creds.database}_${dateStr}.sql`;
    const filePath = path.join(backupsDir, filename);
    const metaPath = path.join(backupsDir, `${filename}.meta.json`);

    // Fetch database statistics before dump
    let totalRecords = 0;
    let tablesCount = 0;
    let tableNames = [];
    try {
        const [tables] = await pool.query('SHOW TABLES');
        tableNames = tables.map(r => Object.values(r)[0]);
        tablesCount = tableNames.length;
        for (const t of tableNames) {
            const [cnt] = await pool.query(`SELECT COUNT(*) as c FROM \`${t}\``);
            totalRecords += (cnt[0] ? cnt[0].c : 0);
        }
    } catch (e) {
        console.warn('[Backup] Could not fetch preliminary table stats:', e.message);
    }

    let methodUsed = 'mysqldump_cli';

    // Attempt 1: Try mysqldump CLI
    try {
        await new Promise((resolve, reject) => {
            const args = [
                '-h', creds.host,
                '-u', creds.user,
                '-P', String(creds.port),
                '--default-character-set=utf8mb4',
                '--single-transaction',
                '--quick',
                '--add-drop-table',
                '--create-options',
                creds.database
            ];

            if (creds.password) {
                args.splice(2, 0, `-p${creds.password}`);
            }

            const outStream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
            const child = spawn('mysqldump', args);

            child.stdout.pipe(outStream);

            let stderrMsg = '';
            child.stderr.on('data', chunk => {
                stderrMsg += chunk.toString();
            });

            child.on('error', err => {
                outStream.close();
                reject(err);
            });

            child.on('close', code => {
                outStream.close();
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`mysqldump exited with code ${code}: ${stderrMsg}`));
                }
            });
        });
    } catch (cliErr) {
        console.warn('[Backup] mysqldump CLI failed, running JavaScript native fallback:', cliErr.message);
        methodUsed = 'node_js_fallback';

        // Attempt 2: Pure Node.js SQL generator
        const chunks = [];
        chunks.push(`-- ========================================================\n`);
        chunks.push(`-- SnailShutter Studio Database Backup\n`);
        chunks.push(`-- Generated: ${now.toISOString()} (${now.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })})\n`);
        chunks.push(`-- Database: ${creds.database}\n`);
        chunks.push(`-- Creator: ${creator}\n`);
        chunks.push(`-- Type: ${type}\n`);
        chunks.push(`-- ========================================================\n\n`);
        chunks.push(`/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n`);
        chunks.push(`/*!40101 SET NAMES utf8mb4 */;\n`);
        chunks.push(`/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n`);
        chunks.push(`/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n\n`);

        for (const tableName of tableNames) {
            chunks.push(`--\n-- Table structure for table \`${tableName}\`\n--\n`);
            chunks.push(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
            const [createRows] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
            if (createRows && createRows[0]) {
                const createSql = createRows[0]['Create Table'] || Object.values(createRows[0])[1];
                chunks.push(`${createSql};\n\n`);
            }

            chunks.push(`--\n-- Dumping data for table \`${tableName}\`\n--\n`);
            const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
            if (rows && rows.length > 0) {
                const colNames = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
                const batchSize = 100;
                for (let i = 0; i < rows.length; i += batchSize) {
                    const batch = rows.slice(i, i + batchSize);
                    const valuesList = batch.map(row => {
                        const vals = Object.values(row).map(val => {
                            if (val === null || val === undefined) return 'NULL';
                            if (typeof val === 'number') return val;
                            if (typeof val === 'boolean') return val ? 1 : 0;
                            if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
                            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            const escaped = String(val)
                                .replace(/\\/g, '\\\\')
                                .replace(/'/g, "\\'")
                                .replace(/\0/g, '\\0')
                                .replace(/\n/g, '\\n')
                                .replace(/\r/g, '\\r')
                                .replace(/\x1a/g, '\\Z');
                            return `'${escaped}'`;
                        });
                        return `(${vals.join(', ')})`;
                    });
                    chunks.push(`INSERT INTO \`${tableName}\` (${colNames}) VALUES\n${valuesList.join(',\n')};\n`);
                }
                chunks.push('\n');
            }
        }

        chunks.push(`/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n`);
        chunks.push(`/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n`);
        chunks.push(`/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n`);

        fs.writeFileSync(filePath, chunks.join(''), 'utf-8');
    }

    const fileStat = fs.statSync(filePath);

    // Save companion metadata
    const metadata = {
        filename,
        filePath,
        sizeBytes: fileStat.size,
        sizeFormatted: formatBytes(fileStat.size),
        createdAt: now.toISOString(),
        type,
        notes: notes || (type === 'safety' ? 'Automatic Pre-Restore Safety Snapshot' : 'Manual Database Snapshot'),
        creator,
        tablesCount,
        recordsCount: totalRecords,
        method: methodUsed,
        database: creds.database
    };

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return metadata;
}

/**
 * Execute restoration from a .sql backup file
 * Primary engine: mysql CLI via child_process.spawn
 * Fallback engine: Pure JavaScript SQL statement parser & runner
 */
async function restoreBackupFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error('Backup file does not exist on server.');
    }

    const creds = getDbCredentials();
    const startTime = Date.now();
    let methodUsed = 'mysql_cli';

    try {
        await new Promise((resolve, reject) => {
            const args = [
                '-h', creds.host,
                '-u', creds.user,
                '-P', String(creds.port),
                '--default-character-set=utf8mb4',
                creds.database
            ];

            if (creds.password) {
                args.splice(2, 0, `-p${creds.password}`);
            }

            const inStream = fs.createReadStream(filePath);
            const child = spawn('mysql', args);

            inStream.pipe(child.stdin);

            let stderrMsg = '';
            child.stderr.on('data', chunk => {
                stderrMsg += chunk.toString();
            });

            child.on('error', err => reject(err));

            child.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`mysql client exited with code ${code}: ${stderrMsg}`));
                }
            });
        });
    } catch (cliErr) {
        console.warn('[Restore] mysql CLI restore failed, using JavaScript native parser fallback:', cliErr.message);
        methodUsed = 'node_js_fallback';

        const sqlContent = fs.readFileSync(filePath, 'utf-8');
        
        // Split statements safely
        const statements = [];
        let current = '';
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < sqlContent.length; i++) {
            const char = sqlContent[i];
            const nextChar = sqlContent[i + 1];

            // Handle comments at line starts
            if (!inString && char === '-' && nextChar === '-') {
                while (i < sqlContent.length && sqlContent[i] !== '\n') i++;
                continue;
            }

            // String boundary
            if ((char === "'" || char === '"' || char === '`') && sqlContent[i - 1] !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (stringChar === char) {
                    inString = false;
                }
            }

            if (char === ';' && !inString) {
                const trimmed = current.trim();
                if (trimmed) statements.push(trimmed);
                current = '';
            } else {
                current += char;
            }
        }
        if (current.trim()) statements.push(current.trim());

        const connection = await pool.getConnection();
        try {
            await connection.query('SET FOREIGN_KEY_CHECKS = 0');
            for (const stmt of statements) {
                if (stmt.trim()) {
                    await connection.query(stmt);
                }
            }
            await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } finally {
            connection.release();
        }
    }

    const durationMs = Date.now() - startTime;

    // Verify database state after restore
    const [tables] = await pool.query('SHOW TABLES');
    let totalRecords = 0;
    for (const t of tables) {
        const tName = Object.values(t)[0];
        const [cnt] = await pool.query(`SELECT COUNT(*) as c FROM \`${tName}\``);
        totalRecords += (cnt[0] ? cnt[0].c : 0);
    }

    return {
        success: true,
        method: methodUsed,
        durationMs,
        tablesCount: tables.length,
        recordsCount: totalRecords
    };
}

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/backup/stats
 * Returns database metrics, size, tables list, and backup history summary
 */
router.get('/stats', adminOnly, async (req, res) => {
    try {
        const creds = getDbCredentials();

        // 1. Table stats from information_schema
        const [tableStats] = await pool.query(`
            SELECT 
                table_name AS name,
                table_rows AS approx_rows,
                data_length + index_length AS size_bytes,
                ROUND((data_length + index_length) / 1024, 2) AS size_kb,
                engine
            FROM information_schema.tables
            WHERE table_schema = ?
            ORDER BY (data_length + index_length) DESC
        `, [creds.database]);

        // Exact row count
        const detailedTables = [];
        let totalExactRecords = 0;
        let totalSizeBytes = 0;

        for (const t of tableStats) {
            try {
                const [cnt] = await pool.query(`SELECT COUNT(*) as c FROM \`${t.name}\``);
                const exactCount = cnt[0] ? cnt[0].c : t.approx_rows;
                totalExactRecords += exactCount;
                totalSizeBytes += Number(t.size_bytes) || 0;
                detailedTables.push({
                    name: t.name,
                    rows: exactCount,
                    sizeBytes: Number(t.size_bytes) || 0,
                    sizeFormatted: formatBytes(Number(t.size_bytes) || 0),
                    engine: t.engine || 'InnoDB'
                });
            } catch (err) {
                detailedTables.push({
                    name: t.name,
                    rows: t.approx_rows,
                    sizeBytes: Number(t.size_bytes) || 0,
                    sizeFormatted: formatBytes(Number(t.size_bytes) || 0),
                    engine: t.engine || 'InnoDB'
                });
            }
        }

        // 2. Local backups list & latest timestamp
        let backupsCount = 0;
        let lastBackupTime = null;
        if (fs.existsSync(backupsDir)) {
            const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.sql'));
            backupsCount = files.length;
            if (files.length > 0) {
                const stats = files.map(f => fs.statSync(path.join(backupsDir, f)));
                stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
                lastBackupTime = stats[0].mtime.toISOString();
            }
        }

        // 3. MySQL Server Version
        let serverVersion = 'MySQL / MariaDB';
        try {
            const [ver] = await pool.query('SELECT VERSION() as v');
            if (ver && ver[0]) serverVersion = ver[0].v;
        } catch (e) {
            // Ignore
        }

        res.json({
            success: true,
            data: {
                databaseName: creds.database,
                serverHost: creds.host,
                serverVersion,
                totalSizeBytes,
                totalSizeMB: (totalSizeBytes / (1024 * 1024)).toFixed(2),
                totalSizeFormatted: formatBytes(totalSizeBytes),
                totalRecords: totalExactRecords,
                tablesCount: detailedTables.length,
                tables: detailedTables,
                backupsCount,
                lastBackupTime
            }
        });
    } catch (error) {
        console.error('Backup Stats Error:', error);
        res.status(500).json({ success: false, error: 'Failed to retrieve database stats: ' + error.message });
    }
});

/**
 * GET /api/admin/backup/list
 * Lists all available backup files stored on the server with metadata
 */
router.get('/list', adminOnly, async (req, res) => {
    try {
        if (!fs.existsSync(backupsDir)) {
            return res.json({ success: true, backups: [] });
        }

        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.sql'));
        const backups = [];

        for (const file of files) {
            const filePath = path.join(backupsDir, file);
            const metaPath = path.join(backupsDir, `${file}.meta.json`);
            const stat = fs.statSync(filePath);

            let meta = {};
            if (fs.existsSync(metaPath)) {
                try {
                    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                } catch (e) {
                    // Ignore corrupted meta
                }
            }

            const isSafety = file.startsWith('safety_backup_');
            const isUpload = file.startsWith('uploaded_');
            const type = meta.type || (isSafety ? 'safety' : (isUpload ? 'upload' : 'manual'));

            backups.push({
                filename: file,
                sizeBytes: stat.size,
                sizeFormatted: formatBytes(stat.size),
                createdAt: meta.createdAt || stat.birthtime.toISOString() || stat.mtime.toISOString(),
                type,
                notes: meta.notes || (isSafety ? 'Automatic Pre-Restore Safety Snapshot' : (isUpload ? 'Uploaded External Backup' : 'Manual Database Snapshot')),
                creator: meta.creator || 'Administrator',
                tablesCount: meta.tablesCount || null,
                recordsCount: meta.recordsCount || null,
                method: meta.method || 'sql'
            });
        }

        // Sort newest first
        backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, backups });
    } catch (error) {
        console.error('Backup List Error:', error);
        res.status(500).json({ success: false, error: 'Failed to list backups: ' + error.message });
    }
});

/**
 * POST /api/admin/backup/create
 * Creates a new manual backup snapshot
 */
router.post('/create', adminOnly, async (req, res) => {
    try {
        const notes = (req.body.notes || '').trim();
        const adminName = req.user ? `${req.user.name || 'Admin'} (${req.user.email})` : 'Administrator';

        const backup = await generateBackup({
            type: 'manual',
            notes,
            creator: adminName
        });

        // Audit Logging
        logSystemEvent({
            req,
            action: 'DATABASE_BACKUP_CREATED',
            module: 'Settings',
            details: `Admin created database snapshot "${backup.filename}" (${backup.sizeFormatted}, ${backup.recordsCount} records in ${backup.tablesCount} tables). Notes: ${notes || 'None'}`,
            status: 'success'
        });

        res.json({
            success: true,
            message: 'Database backup created successfully.',
            backup
        });
    } catch (error) {
        console.error('Backup Create Error:', error);
        res.status(500).json({ success: false, error: 'Failed to create database backup: ' + error.message });
    }
});

/**
 * GET /api/admin/backup/download/:filename
 * Securely streams a backup file to admin for off-site preservation
 */
router.get('/download/:filename', adminOnly, (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        if (!filename.endsWith('.sql')) {
            return res.status(400).json({ success: false, error: 'Invalid backup file format' });
        }

        const filePath = path.join(backupsDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Backup file not found on server' });
        }

        // Audit Logging
        logSystemEvent({
            req,
            action: 'DATABASE_BACKUP_DOWNLOADED',
            module: 'Settings',
            details: `Admin downloaded database backup file "${filename}".`,
            status: 'info'
        });

        res.download(filePath, filename);
    } catch (error) {
        console.error('Backup Download Error:', error);
        res.status(500).json({ success: false, error: 'Failed to download backup: ' + error.message });
    }
});

/**
 * DELETE /api/admin/backup/:filename
 * Deletes an old backup snapshot from the server
 */
router.delete('/:filename', adminOnly, (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        if (!filename.endsWith('.sql')) {
            return res.status(400).json({ success: false, error: 'Invalid file name' });
        }

        const filePath = path.join(backupsDir, filename);
        const metaPath = path.join(backupsDir, `${filename}.meta.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Backup file not found' });
        }

        fs.unlinkSync(filePath);
        if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
        }

        // Audit Logging
        logSystemEvent({
            req,
            action: 'DATABASE_BACKUP_DELETED',
            module: 'Settings',
            details: `Admin deleted backup snapshot "${filename}".`,
            status: 'warning'
        });

        res.json({ success: true, message: `Backup file "${filename}" deleted successfully.` });
    } catch (error) {
        console.error('Backup Delete Error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete backup: ' + error.message });
    }
});

/**
 * POST /api/admin/backup/restore
 * Restores database from a selected server snapshot
 * AUTOMATIC SAFETY GUARANTEE: Automatically creates a pre-restore safety snapshot first!
 */
router.post('/restore', adminOnly, async (req, res) => {
    try {
        const filename = path.basename(req.body.filename || '');
        if (!filename || !filename.endsWith('.sql')) {
            return res.status(400).json({ success: false, error: 'Invalid or missing backup filename.' });
        }

        const filePath = path.join(backupsDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, error: 'Selected backup file does not exist on server.' });
        }

        const adminName = req.user ? `${req.user.name || 'Admin'} (${req.user.email})` : 'Administrator';

        // 1. Mandatory Safety Pre-Restore Snapshot
        console.log(`[Restore] Initiating automatic safety backup before restoring "${filename}"...`);
        let safetyBackup = null;
        try {
            safetyBackup = await generateBackup({
                type: 'safety',
                notes: `Emergency automatic safety snapshot captured prior to restoring ${filename}`,
                creator: adminName
            });
            console.log(`[Restore] Safety backup created: ${safetyBackup.filename}`);
        } catch (safetyErr) {
            console.error('[Restore] Safety backup failed:', safetyErr);
            return res.status(500).json({
                success: false,
                error: 'Cannot proceed with restore: Failed to create automatic safety backup. No data was modified: ' + safetyErr.message
            });
        }

        // 2. Perform Restoration
        console.log(`[Restore] Restoring database from "${filename}"...`);
        const restoreResult = await restoreBackupFile(filePath);

        // 3. Audit Logging
        logSystemEvent({
            req,
            action: 'DATABASE_RESTORED',
            module: 'Settings',
            details: `Admin restored database from snapshot "${filename}" in ${restoreResult.durationMs}ms (${restoreResult.recordsCount} records across ${restoreResult.tablesCount} tables). Pre-restore safety backup preserved as "${safetyBackup.filename}".`,
            status: 'danger'
        });

        res.json({
            success: true,
            message: `Database successfully restored from "${filename}". All tables and records were verified.`,
            safetyBackup: safetyBackup.filename,
            durationMs: restoreResult.durationMs,
            recordsCount: restoreResult.recordsCount,
            tablesCount: restoreResult.tablesCount
        });
    } catch (error) {
        console.error('Database Restore Error:', error);
        res.status(500).json({ success: false, error: 'Database restoration failed: ' + error.message });
    }
});

/**
 * POST /api/admin/backup/upload-restore
 * Uploads an external .sql backup file and restores it with automatic pre-restore safety snapshot
 */
router.post('/upload-restore', adminOnly, (req, res) => {
    upload.single('backupFile')(req, res, async (err) => {
        if (err) {
            console.error('Upload backup error:', err);
            return res.status(400).json({ success: false, error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No .sql backup file uploaded.' });
        }

        const uploadedFilePath = req.file.path;
        const uploadedFilename = req.file.filename;
        const adminName = req.user ? `${req.user.name || 'Admin'} (${req.user.email})` : 'Administrator';

        try {
            // 1. Mandatory Safety Pre-Restore Snapshot
            console.log(`[Upload Restore] Creating safety backup before restoring uploaded file "${req.file.originalname}"...`);
            let safetyBackup = null;
            try {
                safetyBackup = await generateBackup({
                    type: 'safety',
                    notes: `Emergency safety snapshot prior to restoring uploaded file ${req.file.originalname}`,
                    creator: adminName
                });
            } catch (safetyErr) {
                // Delete uploaded temp file if safety fails
                if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
                return res.status(500).json({
                    success: false,
                    error: 'Cannot restore: Failed to create automatic safety backup. No data was modified: ' + safetyErr.message
                });
            }

            // 2. Perform Restoration of Uploaded File
            const restoreResult = await restoreBackupFile(uploadedFilePath);

            // Write metadata for uploaded backup
            const metaPath = path.join(backupsDir, `${uploadedFilename}.meta.json`);
            fs.writeFileSync(metaPath, JSON.stringify({
                filename: uploadedFilename,
                originalName: req.file.originalname,
                sizeBytes: req.file.size,
                sizeFormatted: formatBytes(req.file.size),
                createdAt: new Date().toISOString(),
                type: 'upload',
                notes: `Uploaded and restored by ${adminName} (Original: ${req.file.originalname})`,
                creator: adminName,
                tablesCount: restoreResult.tablesCount,
                recordsCount: restoreResult.recordsCount
            }, null, 2), 'utf-8');

            // 3. Audit Logging
            logSystemEvent({
                req,
                action: 'DATABASE_UPLOAD_RESTORED',
                module: 'Settings',
                details: `Admin uploaded and restored database from "${req.file.originalname}" (${formatBytes(req.file.size)}). Pre-restore safety backup preserved as "${safetyBackup.filename}".`,
                status: 'danger'
            });

            res.json({
                success: true,
                message: `Uploaded database backup "${req.file.originalname}" restored successfully.`,
                safetyBackup: safetyBackup.filename,
                durationMs: restoreResult.durationMs,
                recordsCount: restoreResult.recordsCount,
                tablesCount: restoreResult.tablesCount
            });
        } catch (restoreErr) {
            console.error('Upload Restore Execution Error:', restoreErr);
            res.status(500).json({ success: false, error: 'Failed to restore uploaded database backup: ' + restoreErr.message });
        }
    });
});

module.exports = router;
