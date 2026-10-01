function createRateLimiter() {
  const buckets = { chat: new Map(), generate: new Map(), export: new Map(), vision: new Map() };

  function clientIp(req) {
    const trustProxy = String(process.env.TRUST_PROXY || '').toLowerCase() === 'true';
    if (trustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (forwarded) return forwarded;
    }
    return req.socket.remoteAddress || 'unknown';
  }

  function limited(req, bucket, max) {
    const map = buckets[bucket];
    if (!map) return false;
    const key = clientIp(req);
    const now = Date.now();
    let entry = map.get(key);
    if (!entry || now - entry.time >= 60000) entry = { time: now, count: 0 };
    entry.count++;
    map.set(key, entry);
    if (map.size > 5000) {
      for (const [ip, value] of map) if (now - value.time >= 60000) map.delete(ip);
    }
    return entry.count <= max;
  }

  return { clientIp, limited };
}

module.exports = { createRateLimiter };
