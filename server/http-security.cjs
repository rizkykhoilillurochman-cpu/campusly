function json(res, status, data) {
  const response = data?.ok === false
    ? { ...data, code: data.code || 'REQUEST_FAILED', requestId: data.requestId || res.getHeader?.('X-Request-ID') || undefined }
    : data;
  const body = Buffer.from(JSON.stringify(response));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': body.length
  });
  res.end(body);
}

function binary(res, status, body, type, name) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Length': body.length
  });
  res.end(body);
}

function security(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store');
}

module.exports = { json, binary, security };
