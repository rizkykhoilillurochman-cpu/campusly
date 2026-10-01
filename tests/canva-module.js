const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createCanva } = require('../server/canva.cjs');

const envKeys = ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI', 'TRUST_PROXY'];
const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
envKeys.forEach(key => delete process.env[key]);
process.env.TRUST_PROXY = 'true';
const sessions = new Map();
let saved = 0;
const result = createCanva({
  crypto,
  fail: (message, status, extra = {}) => Object.assign(new Error(message), { status, ...extra }),
  json: (res, status, data) => { res.status = status; res.data = data; return data; },
  safeError: error => error.code,
  text: value => String(value ?? ''),
  body: async () => ({}),
  fetchJson: async () => ({ r: { ok: true }, d: { job: { status: 'success', result: { design: { urls: { edit_url: 'https://www.canva.com/design/test/edit' } } } } } }),
  sessions,
  sessionStore: { save: async () => { saved++; } }
});

(async () => {
  try {
    assert.equal(Boolean(result.canvaConfig()), false);
    const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, writeHead(status, headers) { this.status = status; this.headers = { ...this.headers, ...headers }; }, end() { this.ended = true; } };
    const unavailable = result.canvaLogin({}, res);
    assert.equal(unavailable.code, 'CANVA_NOT_CONFIGURED');
    assert.equal(res.status, 503);
    const session = result.cookieSession({ headers: {} }, res);
    assert.equal(session.id.length, 64);
    const secureRes = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
    result.cookieSession({ headers: { 'x-forwarded-proto': 'https' } }, secureRes);
    assert.match(secureRes.headers['Set-Cookie'], /; Secure/);
    await Promise.resolve();
    assert.ok(saved > 0);
    process.env.CANVA_CLIENT_ID = 'test-client';
    process.env.CANVA_CLIENT_SECRET = 'test-secret';
    process.env.CANVA_REDIRECT_URI = 'https://example.test/api/canva/callback';
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions.set(sessionId, { id: sessionId, expiresAt: Date.now() + 60000, canva: { accessToken: 'token', refreshToken: 'refresh', expiresAt: Date.now() + 600000 } });
    const previousFetch = global.fetch;
    let uploaded;
    global.fetch = async (url, options) => {
      assert.match(String(url), /api\.canva\.com\/rest\/v1\/imports$/);
      uploaded = { body: options.body, headers: options.headers };
      return { ok: true, status: 200, json: async () => ({ job: { id: 'import-1' } }) };
    };
    try {
      const req = Readable.from([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff])]);
      req.url = '/api/canva/import';
      req.headers = { cookie: `campusly_session=${sessionId}`, 'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'x-campusly-design-title': 'Tes' };
      const imported = { setHeader() {}, writeHead(status) { this.status = status; }, end() {} };
      const importResult = await result.canvaImport(req, imported);
      assert.equal(importResult.editUrl, 'https://www.canva.com/design/test/edit');
      assert.ok(Buffer.isBuffer(uploaded.body));
      assert.equal(uploaded.body[5], 0xff);
      assert.equal(uploaded.headers['Content-Type'], 'application/octet-stream');
    } finally { global.fetch = previousFetch; }
    console.log('Canva fallback and persistent session module checks passed.');
  } finally {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
