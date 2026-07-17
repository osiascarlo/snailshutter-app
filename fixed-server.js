const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Mock API responses
const mockResponses = {
    '/api/services': {
        success: true,
        data: [
            {
                id: 1,
                name: 'Portrait Photography',
                description: 'Professional portrait sessions for individuals and families',
                price: 1500,
                duration_minutes: 60
            },
            {
                id: 2,
                name: 'Event Coverage',
                description: 'Complete event photography coverage for weddings, parties, and corporate events',
                price: 5000,
                duration_minutes: 240
            },
            {
                id: 3,
                name: 'Product Photography',
                description: 'High-quality product photography for e-commerce and marketing',
                price: 2000,
                duration_minutes: 120
            },
            {
                id: 4,
                name: 'Real Estate Photography',
                description: 'Professional real estate photography for properties and listings',
                price: 3000,
                duration_minutes: 180
            },
            {
                id: 5,
                name: 'Food Photography',
                description: 'Beautiful food photography for restaurants and menus',
                price: 2500,
                duration_minutes: 90
            },
            {
                id: 6,
                name: 'Fashion Photography',
                description: 'Creative fashion photography for portfolios and campaigns',
                price: 4000,
                duration_minutes: 150
            }
        ]
    }
};

const server = http.createServer((req, res) => {
    console.log('Request:', req.method, req.url);
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle API routes
    if (req.url.startsWith('/api/')) {
        if (mockResponses[req.url]) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(mockResponses[req.url]));
            return;
        }
    }
    
    // Simple routing
    let filePath = req.url;
    if (filePath === '/') {
        filePath = '/index.html';
    }
    
    // Handle special cases
    if (filePath.includes('.well-known')) {
        console.log('Blocking .well-known request');
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
    }
    
    const fullPath = path.join(__dirname, filePath);
    
    console.log('Full path:', fullPath);
    
    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File not found:', fullPath);
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
            
            // Set content type
            const ext = path.extname(fullPath).toLowerCase();
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
            
            console.log('✅ Serving:', filePath, 'as', mimeType);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(data);
        });
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${__dirname}`);
    console.log(`\n📋 Test URLs:`);
    console.log(`   • Main: http://localhost:${PORT}/`);
    console.log(`   • Test: http://localhost:${PORT}/server-test.html`);
    console.log(`   • API Test: http://localhost:${PORT}/assets/js/api.js`);
    console.log(`\n⚠️  Press Ctrl+C to stop server\n`);
});
