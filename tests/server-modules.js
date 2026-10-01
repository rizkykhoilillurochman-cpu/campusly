const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStaticHandler } = require('../server/static.cjs');
const { PUBLIC } = require('../server/config.cjs');
for (const asset of ['/campusly-bootstrap.js', '/campusly-store.js', '/campusly-dates.js', '/campusly-context.js', '/campusly-documents.js', '/campusly-calculator.js', '/campusly-v5.js', '/campusly-ai-v2.js']) assert.ok(PUBLIC[asset], `public module missing: ${asset}`);
const { json, binary, security } = require('../server/http-security.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'campusly-static-'));
try {
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>Campusly</h1>');
  const serve = createStaticHandler(root, { '/': 'index.html', '/blocked': '../secret.txt' }, { '.html': 'text/html' });
  const response = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value; }, getHeader(name) { return this.headers[name]; }, writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); }, end(body) { this.body = body; } });
  const page = response();
  assert.equal(serve(page, '/'), true);
  assert.equal(page.status, 200);
  assert.equal(page.body.toString(), '<h1>Campusly</h1>');
  assert.equal(serve(response(), '/blocked'), false);

  const api = response();
  json(api, 200, { ok: true });
  assert.equal(api.headers['Content-Type'], 'application/json; charset=utf-8');
  const apiError = response();
  apiError.setHeader('X-Request-ID', 'request-123');
  json(apiError, 503, { ok: false, error: 'Store unavailable' });
  assert.deepEqual(JSON.parse(apiError.body.toString()), { ok: false, code: 'REQUEST_FAILED', error: 'Store unavailable', requestId: 'request-123' });
  const file = response();
  binary(file, 200, Buffer.from('file'), 'application/octet-stream', 'file.bin');
  assert.equal(file.headers['X-Content-Type-Options'], 'nosniff');
  security(api);
  assert.equal(api.headers['X-Frame-Options'], 'DENY');
  console.log('Static, JSON, binary, and security-header module checks passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
