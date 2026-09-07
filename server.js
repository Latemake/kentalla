import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './build.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); } catch { res.writeHead(400).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  if (!file.startsWith(root + path.sep) || !['index.html', 'style.css', 'app.js', 'engine.js', 'browser.js', 'kentällä text.png', 'kentällä app icon.png'].includes(path.basename(file))) { res.writeHead(404).end(); return; }
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'text/plain', 'Cache-Control': 'no-store' }); res.end(data); });
}).listen(3000, '0.0.0.0', () => console.log('Kentällä: http://localhost:3000'));
