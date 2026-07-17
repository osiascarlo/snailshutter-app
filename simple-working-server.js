const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

console.log('Starting servers on ports', PORT1, 'and', PORT2);

// Server 1 (port 8080)
const server1 = http.createServer((req, res) => {
    console.log('Server1 Request:', req.method, req.url);
    
    // Set headers
    res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    
    // Simple routing
    let urlPath = req.url;
    if (urlPath === '/') {
        urlPath = '/index.html';
    }
    
    const filePath = path.join(__dirname, urlPath);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('File not found:', filePath);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        // Read and serve file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log('Error reading file:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
                return;
            }
            
            res.end(data);
        });
    });
});

// Server 2 (port 3000)
const server2 = http.createServer((req, res) => {
    console.log('Server2 Request:', req.method, req.url);
    
    // Set headers
    res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    
    // Simple routing
    let urlPath = req.url;
    if (urlPath === '/') {
        urlPath = '/index.html';
    }
    
    const filePath = path.join(__dirname, urlPath);
    
    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log('File not found:', filePath);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        // Read and serve file
        fs.readFile(filePath, (err, data) => {
            if (err) {
                console.log('Error reading file:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server error');
                return;
            }
            
            res.end(data);
        });
    });
});

// Start both servers
server1.listen(PORT1, '0.0.0.0', () => {
    console.log(`Server1 running at http://localhost:${PORT1}`);
});

server2.listen(PORT2, '0.0.0.0', () => {
    console.log(`Server2 running at http://localhost:${PORT2}`);
});
