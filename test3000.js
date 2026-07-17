const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>SnailShutter Server is Running!</h1><p>Port 3000 is working!</p>');
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
