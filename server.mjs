import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 8521);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Open http://127.0.0.1:${port}/`);
});
