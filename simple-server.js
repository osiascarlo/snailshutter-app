var http = require('http');
var fs = require('fs');
var path = require('path');

http.createServer(function (req, res) {
    console.log('Request:', req.url);
    
    var filePath = '.' + req.url;
    if (filePath == './') {
        filePath = './index.html';
    }
    
    var extname = String(path.extname(filePath)).toLowerCase();
    var mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg'
    };
    
    var contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            }
            else {
                res.writeHead(500);
                res.end('Server error: ' + error.code, 'utf-8');
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
    
}).listen(3000);

console.log('Server running at http://localhost:3000/');
