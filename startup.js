const http = require('http');
const fs = require('fs');
const path = require('path');

// Compatibility shim for the current Campusly frontend.
// The UI uses inline event handlers (onclick/onsubmit/etc.). server.js adds a
// CSP that blocks those handlers, so buttons such as onboarding "Continue"
// render but cannot execute. Rewrite the CSP at both setHeader and writeHead
// boundaries so the deployed server cannot accidentally restore the blocking
// policy.
function relaxInlineHandlers(value) {
  if (typeof value !== 'string') return value;
  if (!/script-src\s+/i.test(value)) return value;
  if (/'unsafe-inline'/i.test(value)) return value;
  return value.replace(/script-src\s+([^;]+)/i, (full, sources) => {
    return `script-src ${sources} 'unsafe-inline'`;
  });
}

const originalSetHeader = http.ServerResponse.prototype.setHeader;
http.ServerResponse.prototype.setHeader = function (name, value) {
  if (String(name).toLowerCase() === 'content-security-policy') {
    value = relaxInlineHandlers(value);
  }
  return originalSetHeader.call(this, name, value);
};

const originalWriteHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (statusCode, statusMessage, headers) {
  if (typeof statusMessage === 'object' && statusMessage !== null) {
    headers = statusMessage;
    statusMessage = undefined;
  }
  if (headers && typeof headers === 'object') {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-security-policy') {
        headers[key] = relaxInlineHandlers(headers[key]);
      }
    }
  }
  return statusMessage === undefined
    ? originalWriteHead.call(this, statusCode, headers)
    : originalWriteHead.call(this, statusCode, statusMessage, headers);
};

// server.js omits manifest.json from its PUBLIC allow-list even though the
// frontend requests it. Serve manifest.json and favicon.ico here.
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
