const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    console.log('Request:', req.method, req.url);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle OPTIONS requests for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Basic routing
    let filePath = req.url;
    if (filePath === '/') {
        filePath = '/index.html';
    }
    
    const fullPath = path.join(__dirname, filePath);
    
    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File not found:', filePath);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found: ' + filePath);
            return;
        }
        
        // Read and serve file
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
                return;
            }
            
            // Set proper MIME type
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
                '.json': 'application/json'
            };
            
            const mimeType = mimeTypes[ext] || 'text/plain';
            console.log('Serving:', filePath, 'as', mimeType);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`\n📋 Access the application:`);
    console.log(`   • Main page: http://localhost:${PORT}`);
    console.log(`   • Login: http://localhost:${PORT}/auth/login.html`);
    console.log(`   • Client Dashboard: http://localhost:${PORT}/client/dashboard.html`);
    console.log(`   • Staff Dashboard: http://localhost:${PORT}/staff/dashboard.html`);
    console.log(`   • Admin Dashboard: http://localhost:${PORT}/admin/dashboard.html`);
    console.log(`\n⚠️  Press Ctrl+C to stop server`);
});
