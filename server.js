const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8788);
const PUBLIC_FILES = new Set([
  'index.html',
  'campusly-v5.js',
  'campusly-v5.css',
  'manifest.webmanifest',
  'icon.svg'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
}

function serveStatic(req, res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1).split('?')[0];
  if (!PUBLIC_FILES.has(file)) return false;

  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return false;

  const cache = file === 'index.html' || file === 'manifest.webmanifest'
    ? 'no-cache'
    : 'public, max-age=31536000, immutable';

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(fullPath)] || 'application/octet-stream',
    'Cache-Control': cache
  });
  fs.createReadStream(fullPath).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  try {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, { ok: true, service: 'campusly-core', version: 'clean-v1' });
    }

    if (req.method === 'GET' && url.pathname === '/api/ready') {
      return json(res, 200, { ready: true });
    }

    if (serveStatic(req, res, url.pathname)) return;
    json(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('Core server error:', error);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
    else res.destroy();
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Campusly core listening on ${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
