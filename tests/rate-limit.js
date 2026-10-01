const assert = require('node:assert/strict');
const { createRateLimiter } = require('../server/rate-limit.cjs');

const previous = process.env.TRUST_PROXY;
try {
  delete process.env.TRUST_PROXY;
  const direct = createRateLimiter();
  const request = { headers: { 'x-forwarded-for': '203.0.113.9' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(direct.clientIp(request), '127.0.0.1');
  assert.equal(direct.limited(request, 'chat', 2), true);
  assert.equal(direct.limited(request, 'chat', 2), true);
  assert.equal(direct.limited(request, 'chat', 2), false);
  assert.equal(direct.limited(request, 'unknown', 2), false);

  process.env.TRUST_PROXY = 'true';
  const proxied = createRateLimiter();
  assert.equal(proxied.clientIp(request), '203.0.113.9');
  console.log('Rate limiter direct-IP and trusted-proxy checks passed.');
} finally {
  if (previous === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previous;
}
