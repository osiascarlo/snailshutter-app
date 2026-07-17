const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const server = http.createServer((req, res) => {
    try {
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
        } else if (filePath.startsWith('/api/')) {
            // Handle API requests
            if (filePath === '/api/test') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'API is working!',
                    timestamp: new Date().toISOString()
                }));
                return;
            }
        }
        
        const fullPath = path.join(__dirname, filePath);
        
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                console.error('Error:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
                return;
            }
            
            console.log('Serving file:', filePath);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
    }
});

server.listen(PORT, '0.0.0.1', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
