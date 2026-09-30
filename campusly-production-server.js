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
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    ...(process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash-lite').split(',')
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
function inlineRuns(text){const runs=[];const re=/(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g;let last=0,m;while((m=re.exec(text))){if(m.index>last)runs.push(new TextRun({text:text.slice(last,m.index),font:'Times New Roman',size:24}));runs.push(new TextRun({text:m[2]||m[3]||m[4],font:'Times New Roman',size:24,bold:!!m[2],italics:!m[2]}));last=re.lastIndex;}if(last<text.length)runs.push(new TextRun({text:text.slice(last),font:'Times New Roman',size:24}));return runs.length?runs:[new TextRun({text:'',font:'Times New Roman',size:24})]}
async function makeDocx(text,title){
  const children=[]; let firstTitle=true;
  for(const raw of clean(text).split('\n')){
    const c=classify(raw),s=raw.trim();
    if(c.blank){children.push(new Paragraph({spacing:{after:0,line:360},children:[new TextRun({text:'',font:'Times New Roman',size:24})]}));continue;}
    if(firstTitle){children.push(new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:240,line:360},children:[new TextRun({text:(c.heading?.[1]||s).replace(/^#+\s*/,''),font:'Times New Roman',size:28,bold:true})]}));firstTitle=false;continue;}
    if(c.heading){children.push(new Paragraph({spacing:{before:240,after:120,line:360},keepNext:true,children:[new TextRun({text:(c.heading[1]||c.heading[0]).replace(/^#+\s*/,''),font:'Times New Roman',size:24,bold:true})]}));continue;}
    if(c.bullet){children.push(new Paragraph({style:'Normal',bullet:{level:0},spacing:{after:0,line:360},children:inlineRuns(c.bullet[1])}));continue;}
    if(c.number){children.push(new Paragraph({style:'Normal',numbering:{reference:'campusly-numbered',level:0},spacing:{after:0,line:360},children:inlineRuns(c.number[1])}));continue;}
    children.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,indent:{firstLine:720},spacing:{after:0,line:360},widowControl:true,children:inlineRuns(s)}));
  }
  const doc=new Document({creator:'Campusly',title:title||'Campusly',description:'Dokumen akademik Campusly',styles:{default:{document:{run:{font:'Times New Roman',size:24},paragraph:{spacing:{line:360,after:0}}}}},numbering:{config:[{reference:'campusly-numbered',levels:[{level:0,format:'decimal',text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}]}]},sections:[{properties:{page:{margin:{top:1701,right:1701,bottom:1701,left:2268}}},children}]});
  return Packer.toBuffer(doc);
}
function pdfEscape(text){return String(text).normalize('NFKD').replace(/[^\x20-\x7E\n]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');}
function wrapLines(text,max=82){const out=[];for(const raw of clean(text).split('\n')){if(!raw.trim()){out.push('');continue;}let line=raw.trim();while(line.length>max){let cut=line.lastIndexOf(' ',max);if(cut<20)cut=max;out.push(line.slice(0,cut));line=line.slice(cut+1);}out.push(line);}return out;}
function makePdf(text,title){
  const lines=wrapLines(text),pages=[];for(let i=0;i<lines.length;i+=42)pages.push(lines.slice(i,i+42));if(!pages.length)pages.push(['']);
  const objects=[];const add=x=>{objects.push(x);return objects.length};const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>'),bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');const pageRefs=[];
  for(const pageLines of pages){const stream=['BT','/F2 16 Tf','1 0 0 1 70 770 Tm',`(${pdfEscape(title||'Campusly')}) Tj`,'/F1 10 Tf'];let y=745;for(const line of pageLines){if(!line){y-=14;continue;}stream.push(`1 0 0 1 70 ${y} Tm (${pdfEscape(line)}) Tj`);y-=14;}stream.push('ET');const body=stream.join('\n');const contents=add(`<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`);pageRefs.push(add(`<< /Type /Page /Parent PAGES /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${contents} 0 R >>`));}
  const pagesId=add(`<< /Type /Pages /Kids [${pageRefs.map(x=>`${x} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`);for(const ref of pageRefs)objects[ref-1]=objects[ref-1].replace('PAGES',`${pagesId} 0 R`);const root=add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let output='%PDF-1.4\n',offset=Buffer.byteLength(output),xref=['0000000000 65535 f '];objects.forEach((obj,i)=>{xref.push(`${String(offset).padStart(10,'0')} 00000 n `);const chunk=`${i+1} 0 obj\n${obj}\nendobj\n`;output+=chunk;offset+=Buffer.byteLength(chunk);});output+=`xref\n0 ${objects.length+1}\n${xref.join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root ${root} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;return Buffer.from(output);
}
function svgData(label,index){const palette=['8B7CFF','42D392','FFB45B','5EA1FF','FF6B7A'],color=palette[index%palette.length],safe=String(label||'Ilustrasi materi').replace(/[<>&]/g,'').slice(0,40);const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420"><rect width="720" height="420" rx="36" fill="#F4F6FA"/><rect x="42" y="42" width="636" height="336" rx="26" fill="#FFFFFF" stroke="#D9DEE8"/><circle cx="105" cy="105" r="30" fill="#${color}"/><rect x="160" y="84" width="360" height="22" rx="11" fill="#20242C"/><rect x="160" y="122" width="280" height="14" rx="7" fill="#B7BFCC"/><rect x="82" y="190" width="150" height="128" rx="18" fill="#${color}" opacity=".88"/><rect x="254" y="215" width="150" height="103" rx="18" fill="#E8EBF1"/><rect x="426" y="170" width="190" height="148" rx="18" fill="#EEF1F6"/><path d="M455 278l42-48 34 28 48-68 35 38" fill="none" stroke="#${color}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="82" y="350" font-family="Arial" font-size="18" fill="#5F6877">${safe}</text></svg>`;return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;}
function slideChunks(text){const source=clean(text);const parts=source.split(/\n\s*(?=SLIDE\s*\d+\s*[:.-])/i).filter(Boolean);return (parts.length?parts:[source]).slice(0,20);}
async function makePptx(text,title){
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='Campusly';pptx.company='Campusly';pptx.subject='Presentasi akademik';pptx.title=title||'Campusly';pptx.lang='id-ID';
  for(const [index,chunk] of slideChunks(text).entries()){
    const lines=chunk.split('\n').map(x=>x.trim()).filter(Boolean);let heading=(lines.shift()||`Slide ${index+1}`).replace(/^SLIDE\s*\d+\s*[:.-]\s*/i,'');
    const visual=lines.find(x=>/^VISUAL:/i.test(x))?.replace(/^VISUAL:\s*/i,'')||'Ilustrasi materi';
    const bullets=lines.filter(x=>!/^VISUAL:/i.test(x)).map(x=>x.replace(/^[-*•]\s*/,'' )).filter(Boolean).slice(0,5);
    const slide=pptx.addSlide();slide.background={color:'FFFFFF'};slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.2,h:7.5,fill:{color:'8B7CFF'},line:{color:'8B7CFF'}});slide.addText(String(index+1).padStart(2,'0'),{x:.7,y:.35,w:.5,h:.3,fontFace:'Aptos',fontSize:10,bold:true,color:'8B7CFF',margin:0});slide.addText(heading,{x:.7,y:.75,w:7,h:.75,fontFace:'Aptos Display',fontSize:27,bold:true,color:'171A22',margin:0,fit:'shrink'});
    slide.addText((bullets.length?bullets:['Materi dapat disesuaikan sesuai kebutuhan.']).map(x=>`• ${x}`).join('\n'),{x:.8,y:1.75,w:6.1,h:4.5,fontFace:'Aptos',fontSize:18,color:'343941',margin:0,fit:'shrink',valign:'top',paraSpaceAfterPt:10});slide.addImage({data:svgData(visual,index),x:7.55,y:1.65,w:4.9,h:2.86});slide.addText(visual,{x:7.7,y:4.75,w:4.45,h:.7,fontFace:'Aptos',fontSize:10,color:'697386',margin:0,fit:'shrink'});slide.addText('Campusly',{x:7.7,y:6.85,w:2,h:.3,fontFace:'Aptos',fontSize:9,color:'9DA7B8',margin:0});
  }
  return pptx.write({outputType:'nodebuffer'});
}
function serveStatic(res,url){const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!PUBLIC_FILES.has(file))return false;const full=path.join(ROOT,file);if(!fs.existsSync(full))return false;res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Expires':'0'});fs.createReadStream(full).pipe(res);return true;}
function sendFile(res,data,type,filename){if(!Buffer.isBuffer(data)||!data.length)throw fail('File hasil export kosong.',500);res.writeHead(200,{'Content-Type':type,'Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':data.length,'Cache-Control':'no-store, no-transform','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'});res.end(data);}
const server=http.createServer(async(req,res)=>{
  try{
    securityHeaders(res);const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
    if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,version:'canonical-v11'});
    if(req.method==='GET'&&url.pathname==='/api/ready')return json(res,200,{ready:true,version:'canonical-v11',models:models(),exports:['docx','pdf','pptx'],download:'native-browser'});
    if(req.method==='GET'&&url.pathname==='/api/ai/health')return json(res,200,{ok:true,models:models(),vision:visionModels(),imageGeneration:false,exports:['docx','pdf','pptx']});
    if(req.method==='POST'&&url.pathname==='/api/ai'){if(!rate(req))return json(res,429,{error:'AI lagi ramai. Coba lagi sebentar.'});return json(res,200,{ok:true,text:await callGemini(await readJson(req))});}
    if(req.method==='POST'&&url.pathname==='/api/ai/vision'){if(!rate(req,20))return json(res,429,{error:'Scan lagi ramai. Coba lagi sebentar.'});return json(res,200,{ok:true,text:await callVision(await readJson(req))});}
    if(req.method==='POST'&&url.pathname==='/api/export/docx'){const body=await readJson(req);if(!String(body.content||'').trim())throw fail('Isi makalah kosong.',400);return sendFile(res,await makeDocx(body.content,body.title||'Campusly'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document','campusly-makalah.docx');}
    if(req.method==='POST'&&url.pathname==='/api/export/pdf'){const body=await readJson(req);if(!String(body.content||'').trim())throw fail('Isi makalah kosong.',400);return sendFile(res,makePdf(body.content,body.title||'Campusly'),'application/pdf','campusly-makalah.pdf');}
    if(req.method==='POST'&&url.pathname==='/api/export/ppt'){const body=await readJson(req);if(!String(body.content||'').trim())throw fail('Materi PPT kosong.',400);return sendFile(res,await makePptx(body.content,body.title||'Campusly'),'application/vnd.openxmlformats-officedocument.presentationml.presentation','campusly-presentasi.pptx');}
    if(req.method==='GET'&&serveStatic(res,url))return;
    return json(res,404,{error:'Not found'});
  }catch(error){console.error('Campusly server error:',error);if(!res.headersSent)return json(res,error.status||500,{error:error.message||'Internal server error'});res.destroy();}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Campusly canonical-v11 server listening on ${PORT}`));
function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
