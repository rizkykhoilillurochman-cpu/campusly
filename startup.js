const http = require('http');
const fs = require('fs');
const path = require('path');

// Compatibility shim for the current Campusly frontend.
// The UI intentionally uses inline event handlers (onclick/onsubmit/etc.).
// server.js currently sends a CSP that blocks those handlers, so buttons such
// as onboarding "Continue" render but cannot execute. Keep the server logic
// intact and relax only that specific CSP directive at the response boundary.
const originalSetHeader = http.ServerResponse.prototype.setHeader;
http.ServerResponse.prototype.setHeader = function (name, value) {
  if (String(name).toLowerCase() === 'content-security-policy' && typeof value === 'string') {
    value = value.replace(/script-src\s+'self'\s*;/i, "script-src 'self' 'unsafe-inline';");
  }
  return originalSetHeader.call(this, name, value);
};

// server.js currently omits manifest.json from its PUBLIC allow-list even
// though index.html and the service worker request it. Serve the manifest and
// favicon here so those requests no longer return 404.
const originalCreateServer = http.createServer;
http.createServer = function (handler) {
  return originalCreateServer.call(http, (req, res) => {
    const pathname = String(req.url || '').split('?')[0];
    if (req.method === 'GET' && pathname === '/manifest.json') {
      const file = path.join(__dirname, 'manifest.json');
      if (fs.existsSync(file)) {
        const body = fs.readFileSync(file);
        res.writeHead(200, {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Content-Length': body.length
        });
        return res.end(body);
      }
    }
    if (req.method === 'GET' && pathname === '/favicon.ico') {
      const file = path.join(__dirname, 'icon.svg');
      if (fs.existsSync(file)) {
        const body = fs.readFileSync(file);
        res.writeHead(200, {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
          'Content-Length': body.length
        });
        return res.end(body);
      }
    }
    return handler(req, res);
  });
};

require('./server.js');
