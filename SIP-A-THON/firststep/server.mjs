import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!filename.startsWith(root)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': (types[path.extname(filename)] || 'application/octet-stream') + '; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`SymbioNet is ready at http://localhost:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
