const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

console.log('Starting server on port', PORT);

const server = http.createServer((req, res) => {
    try {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        
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
        
        // Simple routing
        let pathname = req.url;
        if (pathname === '/') {
            pathname = '/index.html';
        }
        
        // Remove query parameters
        const cleanPath = pathname.split('?')[0];
        const filePath = path.join(__dirname, cleanPath);
        
        // Get file extension
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg'
        };
        
        const mimeType = mimeTypes[ext] || 'text/plain';
        
        // Check if file exists
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error('File not found:', filePath);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found: ' + pathname);
                return;
            }
            
            // Serve file
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    console.error('Error reading file:', filePath, err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Server error');
                    return;
                }
                
                console.log('Serving:', filePath);
                res.writeHead(200, { 'Content-Type': mimeType });
                res.end(data);
            });
        });
        
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log('Serving files from:', __dirname);
});
