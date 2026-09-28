const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PUBLIC_PORT = Number(process.env.PORT || 8787);
const INTERNAL_PORT = PUBLIC_PORT + 1;
const MAX_BODY = 512 * 1024;
const PUBLIC_FILES = new Set(['index.html','app.js','styles.css','mobile-menu.css','manifest.webmanifest','manifest.json','sw.js','icon.svg','ai-runtime.js','developer-contact.js']);
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml'};

function json(res, code, body){
  const text = JSON.stringify(body);
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(text)});
  res.end(text);
}

function readJson(req){
  return new Promise((resolve,reject)=>{
    let body = '';
    let done = false;
    req.on('data', chunk=>{
      if(done) return;
      body += chunk;
      if(Buffer.byteLength(body) > MAX_BODY){
        done = true;
        reject(new Error('Pesan terlalu besar'));
        req.destroy();
      }
    });
    req.on('end', ()=>{
      if(done) return;
      try{ resolve(body ? JSON.parse(body) : {}); }
      catch{ reject(new Error('JSON tidak valid')); }
    });
    req.on('error', reject);
  });
}

function geminiPayload(messages){
  const list = Array.isArray(messages) ? messages : [];
  const contents = list
    .filter(m=>m && m.role !== 'system')
    .map(m=>({
      role:m.role === 'assistant' ? 'model' : 'user',
      parts:[{text:String(m.content || '').trim()}]
    }))
    .filter(m=>m.parts[0].text);

  return {
    contents,
    generationConfig:{temperature:0.7,maxOutputTokens:1024}
  };
}

async function geminiFetch(url, options={}){
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if(!key) throw new Error('GEMINI_API_KEY kosong');
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), 20000);
  try{
    return await fetch(url, {
      ...options,
      headers:{...(options.headers || {}),'x-goog-api-key':key},
      signal:controller.signal
    });
  }finally{
    clearTimeout(timer);
  }
}

function modelName(){
  return String(process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim().replace(/^models\//,'');
}

async function generate(model, messages){
  const r = await geminiFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(geminiPayload(messages))
  });
  const d = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`${model}: HTTP ${r.status} — ${d?.error?.message || 'Gemini error'}`);
  return d?.candidates?.[0]?.content?.parts?.map(p=>p?.text || '').join('').trim() || '';
}

async function handleAI(req,res){
  try{
    const body = await readJson(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if(!messages.length) return json(res,400,{ok:false,error:'Pesan AI kosong'});

    const model = modelName();
    const text = await generate(model,messages);
    if(!text) return json(res,502,{ok:false,error:'Gemini tidak mengembalikan jawaban'});
    return json(res,200,{ok:true,text,provider:'gemini',model});
  }catch(e){
    console.error('[AI]',e?.stack || e);
    return json(res,502,{ok:false,error:e?.message || 'Gemini gagal'});
  }
}

async function handleHealth(res){
  return json(res,200,{
    ok:Boolean(String(process.env.GEMINI_API_KEY || '').trim()),
    configured:Boolean(String(process.env.GEMINI_API_KEY || '').trim()),
    model:modelName()
  });
}

function serveStatic(req,res){
  if(req.method !== 'GET') return false;
  const url = new URL(req.url,'http://localhost');
  const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//,'');
  if(!PUBLIC_FILES.has(name)) return false;
  const file = path.join(ROOT,name);
  try{
    const stat = fs.statSync(file);
    if(!stat.isFile()) return false;
    const data = fs.readFileSync(file);
    res.writeHead(200, {'Content-Type':MIME[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
    return true;
  }catch{return false;}
}

const child = spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(INTERNAL_PORT)},
  stdio:['ignore','pipe','pipe']
});
child.stdout.on('data',d=>process.stdout.write(d));
child.stderr.on('data',d=>process.stderr.write(d));
child.on('exit',code=>{if(server.listening) process.exit(code || 1);});

const server = http.createServer(async(req,res)=>{
  try{
    const url = new URL(req.url,'http://localhost');
    if(url.pathname === '/api/ai' && req.method === 'POST') return handleAI(req,res);
    if(url.pathname === '/api/ai/health' && req.method === 'GET') return handleHealth(res);
    if(serveStatic(req,res)) return;
    proxy(req,res);
  }catch(e){
    json(res,500,{ok:false,error:e?.message || 'Internal error'});
  }
});

function proxy(req,res){
  const options = {
    hostname:'127.0.0.1',
    port:INTERNAL_PORT,
    method:req.method,
    path:req.url,
    headers:{...req.headers,host:`127.0.0.1:${INTERNAL_PORT}`}
  };
  const p = http.request(options,r=>{
    res.writeHead(r.statusCode || 200,r.headers);
    r.pipe(res);
  });
  p.on('error',e=>json(res,502,{ok:false,error:'Campusly server belum siap',detail:e.message}));
  req.pipe(p);
}

server.listen(PUBLIC_PORT,'0.0.0.0',()=>console.log(`Campusly AI gateway listening on ${PUBLIC_PORT}; app on ${INTERNAL_PORT}`));

function stop(){
  server.close(()=>child.kill('SIGTERM'));
  setTimeout(()=>child.kill('SIGKILL'),5000).unref();
}
process.on('SIGTERM',stop);
process.on('SIGINT',stop);
