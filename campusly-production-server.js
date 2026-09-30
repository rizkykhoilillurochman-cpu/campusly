/* Campusly — canonical production server.
 * One server only: static app + AI gateway + document exports.
 * Keep this file as the single backend source of truth.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const MAX_BODY = 16 * 1024 * 1024;
const PUBLIC_FILES = new Set(['index.html','campusly-v5.js','campusly-v5.css','manifest.webmanifest','icon.svg']);
const MIME = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml' };
const nativeFetch = global.fetch;
const hits = new Map();
const retryable = new Set([408,429,500,502,503,504]);
const SHUTDOWN_MODELS = new Set(['gemini-2.0-flash','gemini-2.0-flash-lite','gemini-2.0-flash-exp']);

function models() {
  return [...new Set([
    process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    ...(process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.7-flash,gemini-3.6-flash').split(',')
  ].map(x => x.trim()).filter(Boolean).filter(x => !SHUTDOWN_MODELS.has(x)))];
}
function visionModels() { return models(); }

function fail(message, status = 500) { return Object.assign(new Error(message), { status }); }
function json(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, no-cache, must-revalidate',
    'Pragma':'no-cache',
    'Content-Length':body.length,
    'X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':'*'
  });
  res.end(body);
}
function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    const chunks=[]; let size=0;
    req.on('data',chunk=>{
      size += chunk.length;
      if(size > MAX_BODY){ reject(fail('Payload terlalu besar.',413)); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end',()=>resolve(Buffer.concat(chunks)));
    req.on('error',reject);
  });
}
async function readJson(req) {
  const raw=(await readBody(req)).toString('utf8');
  if(!raw) return {};
  try { return JSON.parse(raw); } catch { throw fail('JSON tidak valid.',400); }
}
function rate(req, limit = 30) {
  const key=req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now=Date.now(); let item=hits.get(key);
  if(!item || now-item.time >= 60000) item={time:now,count:0};
  item.count++; hits.set(key,item);
  return item.count <= limit;
}
function clean(text) {
  return String(text ?? '').replace(/\r/g,'').replace(/```(?:html|xml|markdown|md|text|javascript|js)?/gi,'').replace(/```/g,'').trim();
}
function looksLikeHtml(text) {
  return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]|<style[\s>]/i.test(String(text||''));
}
function stripHtmlDocument(text) {
  const value=String(text||'');
  if(!looksLikeHtml(value)) return value.trim();
  const body=value.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || value;
  return body.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s{2,}/g,' ').trim();
}
function promptFor(mode, context) {
  const ctx=context ? `\nKonteks pengguna:\n${String(context).slice(0,12000)}` : '';
  if(mode==='paper') return `Kamu adalah penulis akademik profesional berbahasa Indonesia. Gunakan bahasa baku KBBI dan EYD/PUEBI. Tulis objektif, formal, natural, dan siap dimasukkan ke dokumen. Jangan memakai slang, emoji, sapaan percakapan, komentar meta, atau source code. Jangan mengarang sumber, DOI, URL, kutipan, data, atau fakta. Jika referensi tidak dapat diverifikasi, tandai sebagai referensi yang perlu diverifikasi. Struktur: judul, abstrak, kata kunci, pendahuluan, pembahasan, kesimpulan, daftar pustaka. Gunakan heading teks biasa dan paragraf utuh.${ctx}`;
  if(mode==='ppt') return `Kamu adalah penyusun presentasi akademik profesional berbahasa Indonesia. Gunakan bahasa baku KBBI dan EYD/PUEBI. Jangan memakai slang, emoji, komentar meta, HTML, XML, CSS, JavaScript, atau source code. Format WAJIB: SLIDE 1: Judul lalu 3-5 bullet ringkas dan satu baris VISUAL: deskripsi ilustrasi. Lanjutkan sesuai jumlah slide yang diminta. Jangan menambah teks di luar slide.${ctx}`;
  if(mode==='translate') return `Kamu adalah penerjemah akademik. Pertahankan makna, struktur, istilah, dan tingkat formalitas. Jangan menambahkan komentar, HTML, XML, CSS, JavaScript, atau source code.${ctx}`;
  return `Kamu adalah Campusly AI, teman kuliah digital untuk mahasiswa Indonesia. Jawab natural, santai, jelas, akurat, dan boleh memakai gue/lo bila cocok. Jangan mengarang fakta. Jangan mengeluarkan HTML, XML, CSS, JavaScript, source code halaman web, atau isi tag html/head/body. Untuk pertanyaan biasa, jawab langsung dalam teks.${ctx}`;
}
function geminiPayload(body) {
  const messages=Array.isArray(body.messages)?body.messages:[];
  const contents=messages.slice(-12).map(m=>({role:m?.role==='assistant'?'model':'user',parts:[{text:String(m?.content??'')}]})).filter(m=>m.parts[0].text.trim());
  if(!contents.length) throw fail('Pesan AI kosong.',400);
  return { systemInstruction:{parts:[{text:promptFor(String(body.mode||'chat'),body.context)}]}, contents, generationConfig:{temperature:String(body.mode||'chat')==='chat'?0.35:0.2} };
}
async function callGemini(body) {
  const key=String(process.env.GEMINI_API_KEY||'').trim();
  if(!key) throw fail('GEMINI_API_KEY belum diatur di environment server.',503);
  const available=models();
  if(!available.length) throw fail('Tidak ada model Gemini yang aktif dikonfigurasi.',503);
  const payload=geminiPayload(body); let last='AI gagal memberikan jawaban.';
  for(const model of available) {
    try {
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      let response=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(retryable.has(response.status)) { await new Promise(r=>setTimeout(r,350)); response=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); }
      const raw=await response.text(); let data={}; try{data=JSON.parse(raw)}catch{}
      if(!response.ok){ last=data?.error?.message || `${model}: HTTP ${response.status}`; continue; }
      const text=clean(data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('')||'');
      if(!text){last=`${model}: respons AI kosong.`;continue;}
      if(looksLikeHtml(text)){const recovered=stripHtmlDocument(text);if(recovered&&!looksLikeHtml(recovered))return recovered;last=`${model}: AI mengembalikan HTML, bukan teks.`;continue;}
      return text;
    } catch(e) { last=e.message||last; }
  }
  throw fail(last,502);
}
function parseImage(value) {
  const match=String(value||'').match(/^data:([^;]+);base64,(.+)$/s);
  if(!match) throw fail('Format gambar tidak valid.',400);
  return {mimeType:match[1],data:match[2]};
}
async function callVision(body) {
  const key=String(process.env.GEMINI_API_KEY||'').trim();
  if(!key) throw fail('GEMINI_API_KEY belum diatur di environment server.',503);
  const inlineData=parseImage(body.image); let last='AI tidak dapat membaca gambar saat ini.';
  for(const model of visionModels()) {
    try {
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:'Kamu adalah Campusly AI. Baca gambar dengan teliti. Jika gambar berisi soal, jelaskan langkah pengerjaan dan jawaban. Jika tidak terbaca, jelaskan bagian yang perlu difoto ulang. Gunakan bahasa Indonesia yang jelas. Jangan mengeluarkan HTML atau source code.'}]},contents:[{role:'user',parts:[{inlineData},{text:String(body.question||'Baca dan jelaskan isi gambar.')}]}],generationConfig:{temperature:0.2}})});
      const raw=await response.text(); let data={}; try{data=JSON.parse(raw)}catch{}
      if(response.ok){const text=stripHtmlDocument(clean(data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('')||''));if(text)return text;}
      last=data?.error?.message || `${model}: HTTP ${response.status}`;
    } catch(e) { last=e.message||last; }
  }
  throw fail(last,502);
}
const academicHeadings=new Set(['abstrak','kata kunci','pendahuluan','latar belakang','rumusan masalah','tujuan penelitian','manfaat penelitian','landasan teori','tinjauan pustaka','metode penelitian','metodologi penelitian','hasil penelitian','hasil dan pembahasan','pembahasan','kesimpulan','saran','daftar pustaka']);
function classify(line){const s=line.trim(),n=s.replace(/^#+\s*/,'').replace(/:$/,'').trim().toLowerCase();return{blank:!s,heading:s.match(/^#{1,3}\s+(.+)$/)||(academicHeadings.has(n)?[s,n]:null),bullet:s.match(/^[-*•]\s+(.+)$/),number:s.match(/^\d+[.)]\s+(.+)$/)}}