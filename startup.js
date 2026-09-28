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

// Gemini bridge: keep the existing authenticated /api/ai route, but translate
// its OpenAI-compatible request into Gemini GenerateContent. This keeps the
// API key server-side and lets Campusly use Gemini's Free Tier without exposing
// a provider key in the browser.
const nativeFetch = globalThis.fetch;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
function geminiResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
function openAiMessagesToGemini(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const system = list.filter(m => m && m.role === 'system').map(m => String(m.content || '')).join('\n\n').trim();
  const contents = list
    .filter(m => m && m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }]
    }));
  return { system, contents };
}
globalThis.fetch = async function (input, init = {}) {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (!String(url).startsWith('https://api.openai.com/v1/chat/completions')) {
    return nativeFetch(input, init);
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return geminiResponse(503, {
      error: 'Gemini AI belum dikonfigurasi di server. Tambahkan GEMINI_API_KEY.'
    });
  }

  try {
    const raw = init.body ? JSON.parse(String(init.body)) : {};
    const converted = openAiMessagesToGemini(raw.messages);
    if (!converted.contents.length) {
      return geminiResponse(400, { error: 'Pesan AI kosong.' });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
    const result = await nativeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(converted.system ? { systemInstruction: { parts: [{ text: converted.system }] } } : {}),
        contents: converted.contents,
        generationConfig: {
          temperature: typeof raw.temperature === 'number' ? raw.temperature : 0.4,
          maxOutputTokens: Number(raw.max_tokens || 2048)
        }
      })
    });

    const data = await result.json();
    if (!result.ok) {
      console.error('Gemini API error:', result.status, data?.error?.message || data);
      return geminiResponse(result.status, {
        error: data?.error?.message || 'Gemini gagal merespons.'
      });
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '')
      .join('')
      .trim();

    return geminiResponse(200, {
      choices: [{ message: { role: 'assistant', content: text } }]
    });
  } catch (error) {
    console.error('Gemini bridge error:', error);
    return geminiResponse(502, { error: 'Gagal menghubungi Gemini.' });
  }
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
