const http = require('http');

const data = JSON.stringify({
    bookingId: 2,
    action: 'test_confirm'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
