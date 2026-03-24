const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

http.createServer((req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Connection received`);
    console.log(`[${timestamp}] Method: ${req.method}, URL: ${req.url}`);
    console.log(`[${timestamp}] Headers: `, req.headers);

    let filePath = req.url === '/' ? './index.html' : `.${req.url}`;

    if (req.url === '/api/getLastLogin') {
        fs.readFile('lastDate.txt', 'utf8', (err, data) => {
            if (err) {
                console.error(`[${timestamp}] Error reading file:`, err);
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({error: 'Error reading file'}));
            } else {
                console.log(`[${timestamp}] Successfully read last login`);
                res.writeHead(200, {'Content-Type': 'application/json'});
                res.end(JSON.stringify({lastLogin: data}));
            }
        });
        return;
    }

    if (req.url === '/api/setLastLogin' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log(`[${timestamp}] Received POST body: ${body}`);
            const currentDate = JSON.parse(body).currentDate;
            fs.writeFile('lastDate.txt', currentDate, (err) => {
                if (err) {
                    console.error(`[${timestamp}] Error writing to file:`, err);
                    res.writeHead(500, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({error: 'Error writing to file'}));
                } else {
                    console.log(`[${timestamp}] File saved successfully`);
                    res.writeHead(200, {'Content-Type': 'application/json'});
                    res.end(JSON.stringify({message: 'File saved successfully!'}));
                }
            });
        });
        return;
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.ico':
            contentType = 'image/x-icon';
            break;
        default:
            contentType = 'text/html';
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.error(`[${timestamp}] 404 Not Found: ${filePath}`);
                res.writeHead(404, {'Content-Type': 'text/html'});
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                console.error(`[${timestamp}] Server Error: ${err.code}`);
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            console.log(`[${timestamp}] Serving file: ${filePath}`);
            res.writeHead(200, {'Content-Type': contentType});
            res.end(content, 'utf-8');
        }
    });
}).listen(port, () => {
    console.log(`[${new Date().toISOString()}] Server running at http://localhost:${port}/`);
});

