const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '..');
const assets = new Map([
  ['/core.js', ['core.js', 'text/javascript']],
  ['/tests/browser.html', ['tests/browser.html', 'text/html']],
  ['/tests/browser.js', ['tests/browser.js', 'text/javascript']],
  ['/popup.html', ['popup.html', 'text/html']],
  ['/popup.css', ['popup.css', 'text/css']],
  ['/popup.js', ['popup.js', 'text/javascript']]
]);
http.createServer((req, res) => {
  const asset = assets.get(new URL(req.url, 'http://127.0.0.1').pathname);
  if (req.method !== 'GET' || !asset) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(path.join(base, asset[0])));
}).listen(8765, '127.0.0.1', () => console.log('Browser tests: http://127.0.0.1:8765/tests/browser.html'));
