/* Campusly — single production server.
 * Static app + Gemini AI + DOCX/PDF/PPTX exports.
 * No legacy model router, no duplicate runtime, no overlay patches.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const MODEL = 'gemini-3.8-flash';
const MAX_BODY = 16 * 1024 * 1024;
const PUBLIC = new Set(['index.html', 'campusly-v5.js', 'campusly-v5.css', 'manifest.webmanifest', 'icon.svg']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};
const hits = new Map();
const fail = (message, status = 500) => Object.assign(new Error(message), { status });

function json(res, status, data) {
  const buffer = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': buffer.length });
  res.end(buffer);
}
function headers(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function rateLimit(req, limit = 30) {
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
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function body(req) {
  const raw = (await readBody(req)).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw fail('JSON tidak valid.', 400); }
}
function clean(text) { return String(text ?? '').replace(/\r/g, '').replace(/```(?:html|xml|markdown|md|text|javascript|js)?/gi, '').replace(/```/g, '').trim(); }
function isHtml(text) { return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]|<style[\s>]/i.test(String(text || '')); }
function textOnly(text) {
  const value = String(text || ''); if (!isHtml(value)) return value.trim();
  const match = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i); const source = match ? match[1] : value;
  return source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s{2,}/g, ' ').trim();
}
function systemInstruction(mode) {
  if (mode === 'paper') return 'Kamu adalah penulis akademik profesional berbahasa Indonesia. Tulis formal, objektif, natural, dan siap dimasukkan ke dokumen. Jangan mengarang sumber, DOI, URL, kutipan, data, atau fakta. Jangan menghasilkan HTML, XML, CSS, JavaScript, atau source code. Jika referensi tidak dapat diverifikasi, tandai sebagai perlu diverifikasi. Strukturkan dengan judul, abstrak, kata kunci, pendahuluan, pembahasan, kesimpulan, dan daftar pustaka.';
  if (mode === 'ppt') return 'Kamu adalah penyusun presentasi akademik profesional berbahasa Indonesia. Gunakan bahasa baku. Jangan menghasilkan HTML, XML, CSS, JavaScript, atau source code. Format wajib: SLIDE N: Judul, 3-5 bullet ringkas, lalu satu baris VISUAL: deskripsi ilustrasi. Jangan menambahkan komentar di luar slide.';
  if (mode === 'translate') return 'Kamu adalah penerjemah akademik. Pertahankan makna, struktur, istilah, dan tingkat formalitas. Jangan menambahkan komentar atau source code.';
  return 'Kamu adalah Campusly AI, asisten kuliah untuk mahasiswa Indonesia. Jawab natural, jelas, akurat, dan langsung ke inti. Jangan mengarang fakta. Jangan mengeluarkan HTML, XML, CSS, JavaScript, atau source code halaman web. Jangan menulis tag html, head, body, script, atau style.';
}
function conversation(messages) {
  return (Array.isArray(messages) ? messages : []).slice(-12).map(m => `${m?.role === 'assistant' ? 'Campusly AI' : 'Pengguna'}: ${String(m?.content ?? '').trim()}`).filter(Boolean).join('\n\n');
}
async function gemini(input, mode = 'chat') {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw fail('GEMINI_API_KEY belum diatur di environment server.', 503);
  const prompt = typeof input === 'string' ? input : conversation(input);
  if (!prompt.trim()) throw fail('Pesan AI kosong.', 400);
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ model: MODEL, input: prompt, system_instruction: systemInstruction(mode), generation_config: { temperature: mode === 'chat' ? 0.35 : 0.2, thinking_level: mode === 'chat' ? 'low' : 'medium' }, store: false })
  }).catch(e => { throw fail(`Tidak bisa menghubungi server AI: ${e.message || 'network error'}`, 502); });
  const raw = await response.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
  if (!response.ok) throw fail(data?.error?.message || `Gemini HTTP ${response.status}`, response.status >= 500 ? 502 : response.status);
  const text = textOnly(clean(data?.output_text || data?.steps?.findLast?.(s => s?.type === 'model_output')?.content?.map?.(x => x?.text || '').join('') || ''));
  if (!text) throw fail('Gemini mengembalikan respons kosong.', 502);
  if (isHtml(text)) throw fail('AI mengembalikan format halaman web, bukan jawaban teks.', 502);
  return text;
}
function imageInput(value) {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw fail('Format gambar tidak valid.', 400);
  return { type: 'image', mime_type: match[1], data: match[2] };
}
async function vision(dataIn) {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw fail('GEMINI_API_KEY belum diatur di environment server.', 503);
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ model: MODEL, input: [imageInput(dataIn.image), { type: 'text', text: String(dataIn.question || 'Baca gambar ini dengan teliti, lalu jelaskan isi atau soal dan jawabannya dalam bahasa Indonesia.') }], system_instruction: 'Kamu adalah Campusly AI. Analisis gambar dengan teliti. Jika berisi soal, jelaskan langkah pengerjaan dan jawabannya. Jangan mengeluarkan HTML atau source code.', generation_config: { temperature: 0.2, thinking_level: 'low' }, store: false })
  });
  const raw = await response.text(); let data = {}; try { data = JSON.parse(raw); } catch {}
  if (!response.ok) throw fail(data?.error?.message || `Gemini HTTP ${response.status}`, response.status >= 500 ? 502 : response.status);
  const text = textOnly(clean(data?.output_text || data?.steps?.findLast?.(s => s?.type === 'model_output')?.content?.map?.(x => x?.text || '').join('') || ''));
  if (!text) throw fail('Gemini tidak mengembalikan hasil pembacaan gambar.', 502);
  return text;
}
function parseMarkdown(text) { return String(text || '').split('\n').map(line => { const s = line.trim(); return { s, heading: s.match(/^#{1,3}\s+(.+)$/)?.[1], bullet: s.match(/^[-*•]\s+(.+)$/)?.[1] }; }); }
function inlineRuns(text) {
  const runs = []; const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g; let last = 0;
  for (const m of String(text).matchAll(re)) { if (m.index > last) runs.push(new TextRun({ text: String(text).slice(last, m.index) })); const value = m[0]; runs.push(new TextRun({ text: value.replace(/^\*+|\*+$/g, ''), bold: value.startsWith('**'), italics: value.startsWith('*') && !value.startsWith('**') })); last = m.index + value.length; }
  if (last < String(text).length) runs.push(new TextRun({ text: String(text).slice(last) })); return runs.length ? runs : [new TextRun({ text: String(text) })];
}
async function exportDocx(res, data) {
  const content = String(data.content || '').trim(); if (!content) throw fail('Konten DOCX kosong.', 400);
  const children = [];
  for (const row of parseMarkdown(content)) { if (!row.s) children.push(new Paragraph({ text: '' })); else if (row.heading) children.push(new Paragraph({ text: row.heading, heading: HeadingLevel.HEADING_2 })); else if (row.bullet) children.push(new Paragraph({ children: inlineRuns(row.bullet), bullet: { level: 0 } })); else children.push(new Paragraph({ children: inlineRuns(row.s), alignment: AlignmentType.JUSTIFIED })); }
  const buffer = await Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] }));
  res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="campusly-makalah.docx"', 'Content-Length': buffer.length, 'Cache-Control': 'no-store' }); res.end(buffer);
}
function pdfEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, ' '); }
function pdfBuffer(text, title) {
  const lines = []; for (const raw of String(text).split('\n')) { let rest = raw.trim(); if (!rest) { lines.push(''); continue; } while (rest.length > 92) { lines.push(rest.slice(0, 92)); rest = rest.slice(92); } lines.push(rest); }
  const pages = []; for (let i = 0; i < Math.max(1, lines.length); i += 48) pages.push(lines.slice(i, i + 48));
  const objects = []; const pagesObj = 2; const font = 3; objects[pagesObj] = '<< /Type /Pages /Kids [] /Count 0 >>'; objects[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'; const pageIds = [];
  for (const pageLines of pages) { const content = ['BT', '/F1 11 Tf', '50 790 Td', '14 TL']; pageLines.forEach((line, idx) => { if (idx) content.push('0 -14 Td'); content.push(`(${pdfEscape(line || ' ')}) Tj`); }); content.push('ET'); const stream = Buffer.from(content.join('\n'), 'latin1'); const contentId = objects.length; objects.push(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`); const pageId = objects.length; objects.push(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`); pageIds.push(pageId); }
  objects[pagesObj] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`; const catalog = objects.length; objects.push(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`); const info = objects.length; objects.push(`<< /Title (${pdfEscape(title || 'Campusly')}) >>`);
  let out = '%PDF-1.4\n'; const offsets = [0]; for (let i = 1; i < objects.length; i++) { offsets[i] = Buffer.byteLength(out, 'latin1'); out += `${i} 0 obj\n${objects[i]}\nendobj\n`; } const xref = Buffer.byteLength(out, 'latin1'); out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`; for (let i = 1; i < objects.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`; out += `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(out, 'latin1');
}
async function exportPdf(res, data) { const content = String(data.content || '').trim(); if (!content) throw fail('Konten PDF kosong.', 400); const buffer = pdfBuffer(content, data.title || 'Campusly'); res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="campusly-makalah.pdf"', 'Content-Length': buffer.length, 'Cache-Control': 'no-store' }); res.end(buffer); }
async function exportPpt(res, data) {
  const content = String(data.content || '').trim(); if (!content) throw fail('Konten PPTX kosong.', 400);
  const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Campusly'; pptx.subject = data.title || 'Campusly Presentasi';
  const rows = content.split(/(?=SLIDE\s+\d+\s*:)/i).map(x => x.trim()).filter(Boolean);
  for (const raw of rows) { const slide = pptx.addSlide(); const lines = raw.split('\n').map(x => x.trim()).filter(Boolean); const title = (lines.shift() || 'Campusly').replace(/^SLIDE\s+\d+\s*:\s*/i, ''); slide.addText(title, { x: 0.6, y: 0.5, w: 12.1, h: 0.7, fontSize: 26, bold: true }); const bullets = lines.filter(x => !/^VISUAL\s*:/i.test(x)).map(x => x.replace(/^[-*•]\s*/, '')); slide.addText(bullets.map(x => ({ text: x, options: { bullet: { indent: 16 } } })), { x: 0.8, y: 1.5, w: 11.6, h: 4.8, fontSize: 18, breakLine: true, valign: 'top', margin: 0.05 }); const visual = lines.find(x => /^VISUAL\s*:/i.test(x)); if (visual) slide.addText(visual, { x: 0.8, y: 6.35, w: 11.6, h: 0.5, fontSize: 11, italic: true }); }
  const buffer = await pptx.write({ outputType: 'nodebuffer' }); res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'Content-Disposition': 'attachment; filename="campusly-presentasi.pptx"', 'Content-Length': buffer.length, 'Cache-Control': 'no-store' }); res.end(buffer);
}
function serve(res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1).split('/')[0]; if (!PUBLIC.has(file)) return false; const full = path.join(ROOT, file); if (!fs.existsSync(full)) return false; const data = fs.readFileSync(full); res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': pathname === '/' ? 'no-store' : 'public, max-age=300', 'Content-Length': data.length }); res.end(data); return true;
}
async function route(req, res) {
  headers(res); const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); const p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }); return res.end(); }
  if (req.method === 'GET' && p === '/api/health') return json(res, 200, { ok: true, version: 'canonical-v10', model: MODEL });
  if (req.method === 'GET' && p === '/api/ready') return json(res, 200, { ready: true, exports: ['docx', 'pdf', 'pptx'], ai: MODEL });
  if (req.method === 'GET' && p === '/api/ai/health') return json(res, 200, { ok: true, imageGeneration: false, model: MODEL, models: [MODEL] });
  if (req.method === 'POST' && p === '/api/ai') { if (!rateLimit(req)) return json(res, 429, { error: 'Terlalu banyak permintaan. Tunggu sebentar.' }); try { const data = await body(req); return json(res, 200, { text: await gemini(data.messages, data.mode || 'chat') }); } catch (e) { return json(res, e.status || 500, { error: e.message || 'AI gagal.' }); } }
  if (req.method === 'POST' && p === '/api/ai/vision') { if (!rateLimit(req, 10)) return json(res, 429, { error: 'Terlalu banyak scan. Tunggu sebentar.' }); try { return json(res, 200, { text: await vision(await body(req)) }); } catch (e) { return json(res, e.status || 500, { error: e.message || 'Scan gagal.' }); } }
  if (req.method === 'POST' && p === '/api/export/docx') { try { return await exportDocx(res, await body(req)); } catch (e) { return json(res, e.status || 500, { error: e.message }); } }
  if (req.method === 'POST' && p === '/api/export/pdf') { try { return await exportPdf(res, await body(req)); } catch (e) { return json(res, e.status || 500, { error: e.message }); } }
  if (req.method === 'POST' && p === '/api/export/ppt') { try { return await exportPpt(res, await body(req)); } catch (e) { return json(res, e.status || 500, { error: e.message }); } }
  if (req.method === 'GET' && serve(res, p)) return;
  return json(res, 404, { error: 'Not found' });
}
const server = http.createServer((req, res) => route(req, res).catch(e => json(res, e.status || 500, { error: e.message || 'Server error.' })));
server.keepAliveTimeout = 65000; server.headersTimeout = 66000;
server.listen(PORT, '0.0.0.0', () => console.log(`Campusly canonical-v10 listening on ${PORT} — ${MODEL}`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
