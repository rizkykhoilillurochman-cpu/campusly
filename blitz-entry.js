const http = require('http');
const { spawn } = require('child_process');

const PUBLIC_PORT = Number(process.env.PORT || 8787);
const INTERNAL_PORT = PUBLIC_PORT + 1;
const MAX_BODY = 256 * 1024;
const attempts = new Map();

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

function allowed(ip) {
  const now = Date.now();
  const x = attempts.get(ip) || { n: 0, t: now };
  if (now - x.t >= 60000) { x.n = 0; x.t = now; }
  x.n++;
  attempts.set(ip, x);
  return x.n <= 30;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let done = false;
    req.on('data', chunk => {
      if (done) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        done = true;
        reject(new Error('Pesan terlalu besar.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (done) return;
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('JSON tidak valid.')); }
    });
    req.on('error', reject);
  });
}

function geminiPayload(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const system = list
    .filter(m => m?.role === 'system')
    .map(m => String(m?.content ?? ''))
    .filter(Boolean)
    .join('\n\n');

  const contents = list
    .filter(m => m?.role !== 'system')
    .map(m => ({
      role: m?.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m?.content ?? '') }]
    }))
    .filter(m => m.parts[0].text);

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 2048
    }
  };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };
  return payload;
}

async function callGemini(messages) {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('GEMINI_API_KEY kosong. Isi GEMINI_API_KEY di Blitz > Environment.');

  const models = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.6-flash'
  ];
  const payload = JSON.stringify(geminiPayload(messages));
  let lastError = null;

  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: payload,
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const text = data?.candidates?.[0]?.content?.parts
          ?.map(p => p?.text || '')
          .join('')
          .trim() || '';
        if (text) return { text, model };
        lastError = new Error(`Gemini ${model} memberi jawaban kosong.`);
        continue;
      }

      const message = data?.error?.message || `HTTP ${response.status}`;
      lastError = new Error(`Gemini ${model}: ${message}`);

      // 404 = model/endpoint tidak tersedia, jadi coba model berikutnya.
      // 400/401/403 = request/key bermasalah; retry model tidak akan membantu.
      if ([400, 401, 403].includes(response.status)) break;
    } catch (err) {
      lastError = new Error(
        err?.name === 'AbortError'
          ? `Gemini ${model}: timeout 20 detik.`
          : `Gemini ${model}: ${err?.message || 'koneksi gagal.'}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('Gemini gagal dipanggil.');
}

async function ai(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  if (!allowed(ip)) return json(res, 429, { error: 'Terlalu banyak permintaan AI. Coba lagi sebentar.' });

  try {
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json(res, 400, { error: 'Pesan AI kosong.' });
    const result = await callGemini(messages);
    return json(res, 200, {
      ok: true,
      text: result.text,
      provider: 'gemini',
      model: result.model
    });
  } catch (err) {
    console.error('[AI]', err?.stack || err?.message || err);
    return json(res, 502, {
      ok: false,
      error: err?.message || 'AI gagal dipanggil.'
    });
  }
}

function patchAppJs(body) {
  const source = body.toString('utf8');
  const replacement = `async function askAI(q){const text=String(q||'').trim();if(!text)return;state.aiMessages=state.aiMessages||[];state.aiMessages.push({role:'user',text});save();render();try{const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:aiContext()},{role:'user',content:text}]})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.text)throw new Error(d.error||\`AI gagal (HTTP \${r.status})\`);state.aiMessages.push({role:'assistant',text:d.text});}catch(e){state.aiMessages.push({role:'assistant',text:'⚠️ '+(e?.message||'AI gagal terhubung.')});}save();render()}`;
  const patched = source.replace(/async function askAI\(q\)\{.*?\}\nfunction aiContext/s, replacement + '\nfunction aiContext');
  return patched === source ? source : patched;
}

function proxy(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: INTERNAL_PORT,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}` }
  };

  const upstream = http.request(options, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      let body = Buffer.concat(chunks);
      const type = String(response.headers['content-type'] || '');
      const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
      if (req.method === 'GET' && pathname === '/app.js' && type.includes('javascript')) {
        body = Buffer.from(patchAppJs(body));
        const headers = { ...response.headers, 'content-length': body.length, 'cache-control': 'no-store' };
        delete headers['content-encoding'];
        res.writeHead(response.statusCode || 200, headers);
        return res.end(body);
      }
      res.writeHead(response.statusCode || 200, response.headers);
      res.end(body);
    });
  });
  upstream.on('error', err => {
    console.error('[PROXY]', err?.message || err);
    json(res, 502, { error: 'Campusly server belum siap.' });
  });
  req.pipe(upstream);
}

const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.on('data', d => process.stdout.write(d));
child.stderr.on('data', d => process.stderr.write(d));
child.on('exit', code => {
  if (server.listening) process.exit(code || 1);
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/ai' && req.method === 'POST') return ai(req, res);
  return proxy(req, res);
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`Campusly Blitz entry listening on ${PUBLIC_PORT}; app server on ${INTERNAL_PORT}`);
});

function shutdown() {
  server.close(() => child.kill('SIGTERM'));
  setTimeout(() => child.kill('SIGKILL'), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
