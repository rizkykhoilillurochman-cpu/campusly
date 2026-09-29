/* Campusly production server.
 * Core auth/data/static API stays in server.js on an internal port.
 * This front server owns the AI/export surface so it can be tested and hardened
 * without piling another patch into the legacy campusly-server.js implementation.
 */
const http=require('http');
const {spawn}=require('child_process');
const PptxGenJS=require('pptxgenjs');

const PORT=Number(process.env.PORT||8787);
const CORE_PORT=Number(process.env.CORE_PORT||8788);
const nativeFetch=global.fetch;
const aiHits=new Map();
const retryable=new Set([408,429,500,502,503,504]);

process.env.PORT=String(CORE_PORT);
require('./server.js');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const json=(res,code,obj)=>{const body=JSON.stringify(obj);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});res.end(body)};
const readBody=req=>new Promise((resolve,reject)=>{const chunks=[];let n=0;req.on('data',c=>{n+=c.length;if(n>16*1024*1024){reject(Object.assign(new Error('Payload terlalu besar'),{status:413}));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});
const readJson=async req=>{const b=await readBody(req);try{return JSON.parse(b.toString('utf8')||'{}')}catch{throw Object.assign(new Error('JSON tidak valid'),{status:400})}};
const clientKey=req=>req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown';
function rate(req){const key=clientKey(req),now=Date.now();let x=aiHits.get(key);if(!x||now-x.t>60000)x={n:0,t:now};x.n++;aiHits.set(key,x);return x.n<=20}

function modelList(){return [...new Set([process.env.GEMINI_MODEL||'gemini-3.1-flash-lite',...(process.env.GEMINI_FALLBACK_MODELS||'gemini-3.5-flash-lite,gemini-3.8-flash').split(',')].map(x=>x.trim()).filter(Boolean))]}
function normalizeMessages(messages,context,mode='chat'){
  const system=`Kamu adalah Campusly AI, teman kuliah digital untuk mahasiswa Indonesia Gen Z. Jawab santai, jelas, tetap akurat, tidak kaku. Jangan mengaku sudah melakukan sesuatu kalau belum. Untuk tugas akademik, bantu memahami dan menyusun, bukan mengarang sumber. ${mode==='paper'?'Saat membuat makalah, gunakan struktur akademik dan tandai referensi yang harus dicari; jangan mengarang DOI/URL/sumber.':''} ${context?`Konteks pengguna: ${String(context).slice(0,12000)}`:''}`;
  const list=Array.isArray(messages)?messages:[];
  return [{role:'system',content:system},...list.slice(-12).map(m=>({role:m?.role==='assistant'?'model':'user',content:String(m?.content??'')})).filter(m=>m.content)];
}
function geminiPayload(messages,context,mode){
  const list=normalizeMessages(messages,context,mode),system=list.shift();
  return {systemInstruction:{parts:[{text:system.content}]},contents:list.map(m=>({role:m.role,parts:[{text:m.content}]})),generationConfig:{temperature:0.35}};
}
async function callGemini(messages,context,mode='chat'){
  const key=String(process.env.GEMINI_API_KEY||'').trim();if(!key)throw Object.assign(new Error('GEMINI_API_KEY belum diatur di environment server.'),{status:503});
  let last='AI gagal.';
  for(const model of modelList()){
    try{
      const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      let r=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(geminiPayload(messages,context,mode))});
      if(retryable.has(r.status)){await sleep(450);r=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(geminiPayload(messages,context,mode))})}
      const d=await r.json().catch(()=>({}));
      if(!r.ok){last=`${model}: ${d?.error?.message||`HTTP ${r.status}`}`;continue}
      const text=d?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim();
      if(text)return text;
      last=`${model}: respons AI kosong.`;
    }catch(e){last=e.message||last}
  }
  throw Object.assign(new Error(last),{status:502});
}
function parseDataUrl(value){const m=String(value||'').match(/^data:([^;]+);base64,(.+)$/s);if(!m)throw Object.assign(new Error('Format gambar tidak valid.'),{status:400});return {mimeType:m[1],data:m[2]}}
async function callVision(image,question,context){
  const key=String(process.env.GEMINI_API_KEY||'').trim();if(!key)throw Object.assign(new Error('GEMINI_API_KEY belum diatur di environment server.'),{status:503});
  const img=parseDataUrl(image);
  for(const model of modelList()){
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const payload={systemInstruction:{parts:[{text:'Kamu adalah Campusly AI. Baca gambar dengan teliti. Jika gambar berisi soal, jelaskan langkah pengerjaan dan jawaban. Jika teks tidak terbaca, katakan bagian mana yang perlu difoto ulang.'}]},contents:[{role:'user',parts:[{inlineData:img},{text:String(question||'Baca dan jelaskan isi gambar.') }]}],generationConfig:{temperature:0.2}};
    const r=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));
    if(r.ok){const text=d?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim();if(text)return text}
    if(![400,401,403,404,429,500,502,503,504].includes(r.status))break;
  }
  throw Object.assign(new Error('Scan gagal. Coba foto lebih terang/dekat atau ulangi sebentar lagi.'),{status:502});
}
async function callImage(prompt){
  const key=String(process.env.GEMINI_API_KEY||'').trim();if(!key)throw Object.assign(new Error('Generate gambar membutuhkan provider gambar. GEMINI_API_KEY belum diatur.'),{status:503});
  const model=String(process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-image').trim();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const payload={contents:[{role:'user',parts:[{text:String(prompt).slice(0,12000)}]}],generationConfig:{responseModalities:['IMAGE']}};
  const r=await nativeFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));
  if(!r.ok){const message=d?.error?.message||`HTTP ${r.status}`;if(r.status===429||r.status===402)return Object.assign(new Error('Provider gambar sedang penuh atau membutuhkan billing. Fitur AI teks tetap gratis; generator gambar Gemini memang bukan free-tier.'),{status:402});throw Object.assign(new Error(`Generate gambar gagal: ${message}`),{status:r.status})}
  const part=d?.candidates?.[0]?.content?.parts?.find(p=>p?.inlineData?.data);if(!part)throw Object.assign(new Error('Provider gambar tidak mengembalikan gambar.'),{status:502});
  return `data:${part.inlineData.mimeType||'image/png'};base64,${part.inlineData.data}`;
}
function makePptx(text,title){
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='Rizky Khoillu Rochman';pptx.subject='Campusly presentation';pptx.title=title||'Campusly';pptx.company='Campusly';pptx.lang='id-ID';
  const raw=String(text||'').replace(/\r/g,'');
  let chunks=raw.split(/\n\s*(?=SLIDE\s*\d+\s*[:.-])/i).filter(Boolean);
  if(chunks.length<=1)chunks=raw.split(/\n\s*---\s*\n/).filter(Boolean);
  if(!chunks.length)chunks=[raw];
  chunks.slice(0,20).forEach((chunk,i)=>{
    const lines=chunk.split('\n').map(x=>x.trim()).filter(Boolean);let heading=i===0?(title||lines.shift()||`Slide ${i+1}`):(lines.shift()||`Slide ${i+1}`);heading=heading.replace(/^SLIDE\s*\d+\s*[:.-]\s*/i,'');
    const slide=pptx.addSlide();slide.background={color:'F5F6F8'};slide.addText(heading,{x:0.65,y:0.45,w:12,h:0.7,fontFace:'Aptos Display',fontSize:26,bold:true,color:'17191D',margin:0,breakLine:false});
    const bullets=lines.map(x=>x.replace(/^[-*•]\s*/,'')).filter(Boolean);if(!bullets.length)bullets.push('Materi dapat disesuaikan lagi dari Campusly AI.');
    slide.addText(bullets.map(x=>({text:x,options:{bullet:{indent:18},breakLine:true}})),{x:0.8,y:1.45,w:11.7,h:5.2,fontFace:'Aptos',fontSize:20,color:'343941',margin:0.02,breakLine:false,paraSpaceAfterPt:8,fit:'shrink'});
    slide.addText('Campusly',{x:0.65,y:7.05,w:2,h:0.25,fontSize:8,color:'8A919B',margin:0});
  });
  return pptx.write({outputType:'nodebuffer'});
}
async function proxyCore(req,res){
  try{
    const body=['GET','HEAD'].includes(req.method)?undefined:await readBody(req);
    const headers={...req.headers,host:`127.0.0.1:${CORE_PORT}`,connection:'close'};delete headers['content-length'];
    const r=await nativeFetch(`http://127.0.0.1:${CORE_PORT}${req.url}`,{method:req.method,headers,body,duplex:body?'half':undefined});
    const out=Buffer.from(await r.arrayBuffer());const h={};r.headers.forEach((v,k)=>{if(k!=='transfer-encoding')h[k]=v});res.writeHead(r.status,h);res.end(out);
  }catch(e){json(res,503,{error:'Core server belum siap.',detail:e.message})}
}

const front=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET'&&u.pathname==='/api/ai/health')return json(res,200,{ok:true,service:'campusly-ai',textModel:process.env.GEMINI_MODEL||'gemini-3.1-flash-lite',imageModel:process.env.GEMINI_IMAGE_MODEL||'gemini-3.1-flash-image'});
    if(req.method==='POST'&&u.pathname==='/api/ai'){
      if(!rate(req))return json(res,429,{error:'AI lagi rame. Tunggu sebentar lalu coba lagi.'});
      const b=await readJson(req);if(!Array.isArray(b.messages)||!b.messages.length)return json(res,400,{error:'Pesan AI kosong.'});
      const text=await callGemini(b.messages,b.context,'chat');return json(res,200,{ok:true,text,model:process.env.GEMINI_MODEL||'gemini-3.1-flash-lite'});
    }
    if(req.method==='POST'&&u.pathname==='/api/ai/vision'){
      if(!rate(req))return json(res,429,{error:'Scan lagi rame. Coba lagi sebentar.'});
      const b=await readJson(req);const text=await callVision(b.image,b.question,b.context);return json(res,200,{ok:true,text});
    }
    if(req.method==='POST'&&u.pathname==='/api/ai/image'){
      if(!rate(req))return json(res,429,{error:'Generator gambar lagi rame. Coba lagi sebentar.'});
      const b=await readJson(req);if(!String(b.prompt||'').trim())return json(res,400,{error:'Prompt gambar wajib diisi.'});
      try{return json(res,200,{ok:true,image:await callImage(b.prompt)})}catch(e){return json(res,e.status||502,{error:e.message})}
    }
    if(req.method==='POST'&&u.pathname==='/api/export/ppt'){
      const b=await readJson(req);if(!String(b.content||'').trim())return json(res,400,{error:'Materi PPT kosong.'});
      const pptx=await makePptx(b.content,b.title||'Campusly');res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':'attachment; filename="campusly-presentasi.pptx"','Content-Length':pptx.length,'Cache-Control':'no-store'});return res.end(pptx);
    }
    return proxyCore(req,res);
  }catch(e){return json(res,e.status||500,{error:e.message||'Server error'})}
});
front.listen(PORT,'0.0.0.0',()=>console.log(`Campusly production server listening on ${PORT}; core on ${CORE_PORT}`));
process.on('SIGTERM',()=>process.exit(0));process.on('SIGINT',()=>process.exit(0));
