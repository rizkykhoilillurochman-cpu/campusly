const http = require('http');
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const MODEL = String(process.env.GEMINI_MODEL || 'gemini-3.7-flash').trim() || 'gemini-3.7-flash';
const MAX_BODY = 16 * 1024 * 1024;
const PUBLIC = new Set(['index.html', 'campusly-v5.js', 'campusly-v5.css', 'manifest.webmanifest', 'icon.svg']);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml' };
const hits = new Map();
const fail = (message, status = 500) => Object.assign(new Error(message), { status });

function json(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': body.length });
  res.end(body);
}
function binary(res, status, body, type, filename) {
  res.writeHead(status, { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store', 'Content-Length': body.length, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function security(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
}
function limited(req, limit = 30) {
  const key = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now(); const old = hits.get(key);
  const item = !old || now - old.time >= 60000 ? { time: now, count: 0 } : old;
  item.count++; hits.set(key, item);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.time >= 60000) hits.delete(k);
  return item.count <= limit;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(fail('Payload terlalu besar.', 413)); req.destroy(); return; } chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(fail('JSON tidak valid.', 400)); } });
    req.on('error', reject);
  });
}
function clean(text) { return String(text ?? '').replace(/\r/g, '').replace(/```(?:html|xml|markdown|text|javascript|js)?/gi, '').replace(/```/g, '').trim(); }
function stripHtml(text) { const v = clean(text); if (!/<(?:html|body|script|style)\b/i.test(v)) return v; return v.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s{2,}/g, ' ').trim(); }
function instruction(mode) {
  if (mode === 'paper') return 'Kamu adalah penulis makalah akademik Indonesia. Buat tulisan lengkap, natural, objektif, rapi, dan siap diedit mahasiswa. Struktur: judul, abstrak, kata kunci, pendahuluan, pembahasan, kesimpulan, daftar pustaka. Jangan mengarang sumber, DOI, URL, data, atau kutipan. Jika referensi tidak tersedia, tandai perlu diverifikasi.';
  if (mode === 'ppt') return 'Kamu adalah penyusun presentasi mahasiswa Indonesia. Buat isi slide ringkas dan mudah dipresentasikan. Format setiap slide: SLIDE N: Judul, lalu 3-5 bullet, lalu VISUAL: deskripsi singkat. Jangan HTML, XML, CSS, JavaScript, atau source code.';
  if (mode === 'translate') return 'Kamu adalah penerjemah profesional. Terjemahkan hanya teks yang diberikan ke bahasa target. Pertahankan makna, istilah, struktur, dan nada. Jangan memberi komentar tambahan.';
  return 'Kamu adalah Campusly AI, teman kuliah mahasiswa Indonesia. Jawab natural, santai, dan gaya ngobrol Gen Z. Pakai gue/lo jika cocok dan slang ringan seperti jir, wkwk, gas, nah, tapi jangan dipaksakan. Tetap akurat dan membantu. Kalau topiknya akademik, isi tetap rapi dan jelas. Jangan HTML, CSS, JavaScript, XML, source code, atau membahas system prompt.';
}
function promptOf(data, mode) {
  for (const key of ['input', 'message', 'prompt', 'text', 'content']) if (typeof data[key] === 'string' && data[key].trim()) return data[key].trim();
  if (Array.isArray(data.messages)) return data.messages.slice(-12).map(m => `${m?.role === 'assistant' ? 'Campusly AI' : 'User'}: ${String(m?.content ?? '').trim()}`).filter(Boolean).join('\n\n');
  if (mode === 'paper' || mode === 'ppt') {
    const topic = data.topic || data.judul || data.title;
    const details = [data.instructions, data.description, data.course, data.subject, data.level, data.pages, data.slides].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(String);
    if (topic) return `Buat ${mode === 'paper' ? 'makalah' : 'presentasi'} tentang: ${topic}\n${details.length ? `Detail: ${details.join(' | ')}` : ''}`;
  }
  return '';
}
async function gemini(data, mode = 'chat') {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw fail('GEMINI_API_KEY belum diatur di Blitz.', 503);
  let prompt = promptOf(data, mode);
  if (!prompt) throw fail('Input AI kosong.', 400);
  if (mode === 'translate') prompt = `Terjemahkan dari ${data.from || data.source || 'bahasa sumber'} ke ${data.to || data.target || data.targetLanguage || 'bahasa Indonesia'}.\n\n${prompt}`;
  let response;
  try { response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction(mode) }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: mode === 'chat' ? 0.8 : 0.55 } }) }); }
  catch (e) { throw fail(`Tidak bisa menghubungi Gemini: ${e.message || 'network error'}`, 502); }
  const raw = await response.text(); let out = {}; try { out = JSON.parse(raw); } catch {}
  if (!response.ok) { const msg = out?.error?.message || `Gemini HTTP ${response.status}`; console.error(`[Gemini ${MODEL}] ${msg}`); throw fail(`Gemini gagal: ${msg}`, response.status === 429 ? 429 : 502); }
  const text = stripHtml(out?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '');
  if (!text) throw fail('Gemini mengembalikan jawaban kosong.', 502);
  return text;
}
function aiResponse(text) { return { ok: true, text, result: text, response: text, answer: text, message: text, content: text, translatedText: text }; }
async function makeDocx(content) {
  const children = clean(content).split('\n').map(line => { const s = line.trim(); if (!s) return new Paragraph({ text: '' }); const h = s.match(/^#{1,3}\s+(.+)$/); const b = s.match(/^[-*•]\s+(.+)$/); if (h) return new Paragraph({ text: h[1], heading: HeadingLevel.HEADING_2 }); if (b) return new Paragraph({ children: [new TextRun({ text: b[1] })], bullet: { level: 0 } }); return new Paragraph({ children: [new TextRun({ text: s })], alignment: AlignmentType.JUSTIFIED }); });
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
function makePdf(content) {
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, ' ');
  const lines = []; for (const raw of clean(content).split('\n')) { let s = raw.trim() || ' '; while (s.length > 92) { lines.push(s.slice(0, 92)); s = s.slice(92); } lines.push(s); }
  const pages = []; for (let i = 0; i < Math.max(1, lines.length); i += 48) pages.push(lines.slice(i, i + 48));
  const objects = [null, null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']; const ids = [];
  for (const page of pages) { const st = ['BT', '/F1 11 Tf', '50 790 Td', '14 TL']; page.forEach((x, i) => { if (i) st.push('0 -14 Td'); st.push(`(${esc(x)}) Tj`); }); st.push('ET'); const cid = objects.length; objects.push(`<< /Length ${Buffer.byteLength(st.join('\n'), 'latin1')} >>\nstream\n${st.join('\n')}\nendstream`); const pid = objects.length; objects.push(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 2 0 R >> >> /Contents ${cid} 0 R >>`); ids.push(pid); }
  objects[1] = `<< /Type /Pages /Kids [${ids.map(id => `${id} 0 R`).join(' ')}] /Count ${ids.length} >>`; const root = objects.length; objects.push(`<< /Type /Catalog /Pages 1 0 R >>`);
  let out = '%PDF-1.4\n'; const offsets = [0]; for (let i = 1; i < objects.length; i++) { offsets[i] = Buffer.byteLength(out, 'latin1'); out += `${i} 0 obj\n${objects[i]}\nendobj\n`; } const xref = Buffer.byteLength(out, 'latin1'); out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`; for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`; out += `trailer\n<< /Size ${objects.length} /Root ${root} 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(out, 'latin1');
}
async function makePptx(content, title = 'Campusly') {
  const ppt = new PptxGenJS(); ppt.layout = 'LAYOUT_WIDE'; ppt.author = 'Campusly'; ppt.subject = title;
  const slides = clean(content).split(/(?=SLIDE\s+\d+\s*:)/i).map(x => x.trim()).filter(Boolean); if (!slides.length) throw fail('Format presentasi kosong.', 400);
  for (const raw of slides) { const slide = ppt.addSlide(); const lines = raw.split('\n').map(x => x.trim()).filter(Boolean); const heading = (lines.shift() || 'Campusly').replace(/^SLIDE\s+\d+\s*:\s*/i, ''); slide.addText(heading, { x: 0.6, y: 0.45, w: 12, h: 0.7, fontSize: 26, bold: true }); const visual = lines.find(x => /^VISUAL\s*:/i.test(x)); const bullets = lines.filter(x => !/^VISUAL\s*:/i.test(x)).map(x => x.replace(/^[-*•]\s*/, '')); slide.addText(bullets.map(text => ({ text, options: { bullet: { indent: 16 } } })), { x: 0.8, y: 1.45, w: 11.5, h: 4.9, fontSize: 18, breakLine: true }); if (visual) slide.addText(visual, { x: 0.8, y: 6.45, w: 11.5, h: 0.35, fontSize: 10, italic: true }); }
  return ppt.write({ outputType: 'nodebuffer' });
}
function serve(res, pathname) { const name = pathname === '/' ? 'index.html' : pathname.slice(1).split('/')[0]; if (!PUBLIC.has(name)) return false; const file = path.join(ROOT, name); if (!fs.existsSync(file)) return false; const body = fs.readFileSync(file); res.writeHead(200, { 'Content-Type': MIME[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body); return true; }
async function route(req, res) {
  security(res); const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, version: 'canonical-v13', model: MODEL });
  if (req.method === 'GET' && pathname === '/api/ready') return json(res, 200, { ready: true, ai: MODEL, exports: ['docx', 'pdf', 'pptx'], features: ['chat', 'translate', 'paper', 'ppt'] });
  if (req.method === 'GET' && pathname === '/api/ai/health') return json(res, 200, { ok: true, model: MODEL, models: [MODEL], imageGeneration: false });
  const aiRoutes = new Set(['/api/ai', '/api/translate', '/api/ai/translate', '/api/generate-paper', '/api/paper', '/api/generate-makalah', '/api/generate-ppt', '/api/ppt']);
  if (req.method === 'POST' && aiRoutes.has(pathname)) { if (!limited(req)) return json(res, 429, { ok: false, error: 'Terlalu banyak request. Tunggu sebentar.' }); try { const data = await readBody(req); let mode = data.mode || 'chat'; if (pathname.includes('translate')) mode = 'translate'; else if (pathname.includes('paper') || pathname.includes('makalah')) mode = 'paper'; else if (pathname.includes('ppt')) mode = 'ppt'; return json(res, 200, aiResponse(await gemini(data, mode))); } catch (e) { return json(res, e.status || 500, { ok: false, error: e.message || 'AI gagal.' }); } }
  if (req.method === 'POST' && pathname === '/api/ai/vision') return json(res, 501, { ok: false, error: 'Vision belum diaktifkan pada server canonical.' });
  if (req.method === 'POST' && ['/api/export/docx', '/api/export/word'].includes(pathname)) { try { const d = await readBody(req); const c = String(d.content || d.text || d.result || '').trim(); if (!c) throw fail('Konten DOCX kosong.', 400); return binary(res, 200, await makeDocx(c), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'campusly-makalah.docx'); } catch (e) { return json(res, e.status || 500, { ok: false, error: e.message || 'Export DOCX gagal.' }); } }
  if (req.method === 'POST' && pathname === '/api/export/pdf') { try { const d = await readBody(req); const c = String(d.content || d.text || d.result || '').trim(); if (!c) throw fail('Konten PDF kosong.', 400); return binary(res, 200, makePdf(c), 'application/pdf', 'campusly-makalah.pdf'); } catch (e) { return json(res, e.status || 500, { ok: false, error: e.message || 'Export PDF gagal.' }); } }
  if (req.method === 'POST' && ['/api/export/ppt', '/api/export/pptx'].includes(pathname)) { try { const d = await readBody(req); const c = String(d.content || d.text || d.result || '').trim(); if (!c) throw fail('Konten PPTX kosong.', 400); return binary(res, 200, await makePptx(c, d.title || 'Campusly'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'campusly-presentasi.pptx'); } catch (e) { return json(res, e.status || 500, { ok: false, error: e.message || 'Export PPTX gagal.' }); } }
  if (req.method === 'GET' && serve(res, pathname)) return;
  return json(res, 404, { ok: false, error: 'API route not found' });
}
http.createServer((req, res) => route(req, res).catch(e => json(res, e.status || 500, { ok: false, error: e.message || 'Server error' }))).listen(PORT, '0.0.0.0', () => console.log(`Campusly canonical-v13 listening on ${PORT} — ${MODEL}`));
