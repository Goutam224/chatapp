const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
    proxy.web(req, res, { target: 'http://127.0.0.1:8001' });
});

server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/app/')) {
        proxy.ws(req, socket, head, { target: 'ws://127.0.0.1:8080' });
    } else {
        socket.destroy();
    }
});

proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err.message);
    if (res && res.writeHead) {
        res.writeHead(502);
        res.end('Proxy error');
    }
});

server.listen(8000, () => {
    console.log('✅ Proxy running on port 8000');
    console.log('   HTTP  → Laravel  on 8001');
    console.log('   WS    → Reverb   on 8080');
});