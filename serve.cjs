/* AI Chinese 6.0 · 概念原型 · 本地预览小服务（Node 内置模块，无依赖）
   用法：node serve.cjs   然后打开 http://127.0.0.1:5180/ */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = process.env.PORT ? Number(process.env.PORT) : 5180;
const guard = root + path.sep;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

http.createServer((req, res) => {
  const send = (code, headers, data) => {
    res.writeHead(code, headers);
    if (req.method === 'HEAD') res.end();
    else res.end(data);
  };
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    let filePath = decodeURIComponent(url.pathname);
    if (filePath === '/') filePath = '/index.html';
    const full = path.normalize(path.join(root, filePath));
    if (!full.startsWith(guard)) { send(403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden'); return; }
    fs.readFile(full, (err, data) => {
      if (err) { send(404, { 'Content-Type': 'text/plain; charset=utf-8' }, '404 Not Found'); return; }
      send(200, { 'Content-Type': types[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }, data);
    });
  } catch (e) {
    send(500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Server Error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log('AI Chinese 6.0 preview: http://127.0.0.1:' + port + '/');
});
