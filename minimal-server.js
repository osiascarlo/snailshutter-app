const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

console.log('Starting server on port', PORT);

const server = http.createServer((req, res) => {
    try {
        console.log('Request:', req.url);
        
        // Handle different routes
        let filePath = req.url;
        if (filePath === '/') {
            filePath = '/index.html';
        }
        
        const fullPath = path.join(__dirname, filePath);
        
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                console.error('Error:', err);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
                return;
            }
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
