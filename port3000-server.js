const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

console.log('Starting server on port', PORT);

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    try {
        // Handle different routes
        let filePath = req.url;
        if (filePath === '/') {
            filePath = '/index.html';
        } else if (filePath.startsWith('/client/')) {
            // Client routes
            filePath = filePath;
        } else if (filePath.startsWith('/admin/')) {
            // Admin routes
            filePath = filePath;
        } else if (filePath.startsWith('/staff/')) {
            // Staff routes
            filePath = filePath;
        } else if (filePath.startsWith('/auth/')) {
            // Auth routes
            filePath = filePath;
        } else if (filePath.startsWith('/assets/')) {
            // Asset routes
            filePath = filePath;
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
            
            // Serve file
            fs.readFile(fullPath, (readErr, data) => {
                if (readErr) {
                    console.error('Error reading file:', filePath, readErr);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Server error');
                    return;
                }
                
                const ext = path.extname(filePath).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.css': 'text/css',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg'
                };
                
                const mimeType = mimeTypes[ext] || 'text/plain';
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
    console.log('Press Ctrl+C to stop server');
});
