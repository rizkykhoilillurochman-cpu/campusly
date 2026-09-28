const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { DatabaseSync } = require('node:sqlite');

const execFileP = promisify(execFile);
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || ROOT;
const DB_FILE = path.join(DATA_DIR, 'campusly.sqlite');
const MAX_JSON = 2 * 1024 * 1024;
const MAX_FILE = 15 * 1024 * 1024;
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const PUBLIC = new Set(['index.html','app.js','styles.css','mobile-menu.css','manifest.webmanifest','manifest.json','sw.js','icon.svg','ai-fix.js']);

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT,google_sub TEXT UNIQUE,name TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS user_data(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);`);

const legacy = path.join(ROOT, 'server-data.json');
try {
  if (fs.existsSync(legacy) && db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
    const old = JSON.parse(fs.readFileSync(legacy, 'utf8'));
    for (const u of (old.users || [])) {
      db.prepare('INSERT OR IGNORE INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(u.id, u.email, u.passwordHash, u.createdAt || new Date().toISOString());
      db.prepare('INSERT OR REPLACE INTO user_data(user_id,data,updated_at) VALUES(?,?,?)').run(u.id, JSON.stringify(old.data?.[u.id] || {}), new Date().toISOString());
    }
  }
} catch (e) { console.warn('Legacy migration skipped:', e.message); }

const attempts = new Map();
const oauthStates = new Map();
const oauthCodes = new Map();
const getenv = (key) => process.env[key];
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function json(res, code, obj, extra = {}) {
  const s = JSON.stringify(obj);
  res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(s),...extra});
  res.end(s);
}
function headers(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function rate(req) {
  const ip = req.socket.remoteAddress || 'unknown', now = Date.now();
  let x = attempts.get(ip) || {n:0,t:now};
  if (now - x.t > 60000) x = {n:0,t:now};
  x.n++; attempts.set(ip,x); return x.n <= 30;
}
function readJson(req, limit = MAX_JSON) {
  return new Promise((resolve,reject)=>{let b='',done=false;req.on('data',c=>{if(done)return;b+=c;if(Buffer.byteLength(b)>limit){done=true;reject(Object.assign(new Error('Payload too large'),{status:413}));req.destroy();}});req.on('end',()=>{if(done)return;try{resolve(b?JSON.parse(b):{});}catch{reject(Object.assign(new Error('Invalid JSON'),{status:400}));}});req.on('error',reject);});
}
function readRaw(req, limit = MAX_FILE) {
  return new Promise((resolve,reject)=>{const chunks=[];let n=0;req.on('data',c=>{n+=c.length;if(n>limit){reject(Object.assign(new Error('File too large'),{status:413}));req.destroy();return;}chunks.push(c);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});
}
function hashPassword(p){const salt=crypto.randomBytes(16).toString('hex');return `${salt}:${crypto.scryptSync(p,salt,64).toString('hex')}`;}
function verifyPassword(p,s){try{const [salt,h]=String(s).split(':');if(!salt||!h)return false;const a=Buffer.from(h,'hex'),b=crypto.scryptSync(p,salt,64);return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
function issueSession(uid){const raw=crypto.randomBytes(32).toString('hex'),now=Date.now();db.prepare('INSERT INTO sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)').run(hashToken(raw),uid,now,now+SESSION_TTL);return raw;}
function auth(req){const h=String(req.headers.authorization||'');if(!/^Bearer\s+/i.test(h))return null;const token=h.replace(/^Bearer\s+/i,'').trim();if(!token)return null;const s=db.prepare('SELECT user_id,expires_at FROM sessions WHERE token_hash=?').get(hashToken(token));if(!s||s.expires_at<Date.now()){if(s)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));return null;}return s.user_id;}
function user(uid){return db.prepare('SELECT id,email,name FROM users WHERE id=?').get(uid);}

async function extractFile(name,type,data){
  const ext=path.extname(name).toLowerCase();
  if(['.txt','.md','.csv','.json','.html','.htm'].includes(ext)||String(type).startsWith('text/'))return data.toString('utf8');
  const tmp=path.join(require('os').tmpdir(),`campusly-${crypto.randomUUID()}${ext}`),out=path.join(require('os').tmpdir(),`campusly-out-${crypto.randomUUID()}`);
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(tmp,data);
  try{if(ext==='.pdf'){const r=await execFileP('pdftotext',[tmp,'-'],{maxBuffer:8*1024*1024});return r.stdout;}
    if(['.doc','.docx','.ppt','.pptx','.xls','.xlsx','.odt','.ods','.odp'].includes(ext)){const target=['.xls','.xlsx','.ods'].includes(ext)?'csv':'txt:Text';await execFileP('libreoffice',['--headless','--convert-to',target,'--outdir',out,tmp],{timeout:60000,maxBuffer:2*1024*1024});const files=fs.readdirSync(out);if(files[0])return fs.readFileSync(path.join(out,files[0]),'utf8');}
    throw new Error('Format belum didukung untuk ekstraksi teks di server.');
  }finally{try{fs.unlinkSync(tmp);}catch{}try{fs.rmSync(out,{recursive:true,force:true});}catch{}}
}

async function googleStart(res){
  const clientId=getenv('GOOGLE_CLIENT_ID'),secret=getenv('GOOGLE_CLIENT_SECRET');
  if(!clientId||!secret)return json(res,503,{error:'Google OAuth belum dikonfigurasi. Atur kredensial Google di environment server.'});
  const state=crypto.randomBytes(24).toString('hex');oauthStates.set(state,Date.now()+10*60*1000);
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.searchParams.set('client_id',clientId);u.searchParams.set('redirect_uri',getenv('GOOGLE_REDIRECT_URI')||`http://localhost:${PORT}/api/auth/google/callback`);u.searchParams.set('response_type','code');u.searchParams.set('scope','openid email profile');u.searchParams.set('state',state);res.writeHead(302,{Location:u.toString()});res.end();
}
async function googleCallback(req,res,url){
  const code=url.searchParams.get('code'),state=url.searchParams.get('state'),clientId=getenv('GOOGLE_CLIENT_ID'),secret=getenv('GOOGLE_CLIENT_SECRET');
  if(!code||!state||!oauthStates.has(state)||oauthStates.get(state)<Date.now())return json(res,400,{error:'OAuth state tidak valid atau kedaluwarsa.'});oauthStates.delete(state);
  if(!clientId||!secret)return json(res,503,{error:'Google OAuth belum dikonfigurasi.'});
  const redirectUri=getenv('GOOGLE_REDIRECT_URI')||`http://localhost:${PORT}/api/auth/google/callback`;
  const body=new URLSearchParams({code,client_id:clientId,client_secret:secret,redirect_uri:redirectUri,grant_type:'authorization_code'});
  const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const td=await tr.json();if(!tr.ok)return json(res,502,{error:'Gagal menukar kode Google.'});
  const ir=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${td.access_token}`}});const info=await ir.json();if(!ir.ok||!info.sub||!info.email)return json(res,502,{error:'Profil Google tidak dapat diverifikasi.'});
  let u=db.prepare('SELECT id,google_sub FROM users WHERE google_sub=? OR email=?').get(info.sub,String(info.email).toLowerCase());
  if(!u){u={id:crypto.randomUUID()};db.prepare('INSERT INTO users(id,email,google_sub,name,created_at) VALUES(?,?,?,?,?)').run(u.id,String(info.email).toLowerCase(),info.sub,info.name||'',new Date().toISOString());db.prepare('INSERT INTO user_data(user_id,data,updated_at) VALUES(?,?,?)').run(u.id,'{}',new Date().toISOString());}
  else if(!u.google_sub)db.prepare('UPDATE users SET google_sub=?,name=? WHERE id=?').run(info.sub,info.name||'',u.id);
  const exchange=crypto.randomBytes(32).toString('hex');oauthCodes.set(exchange,{userId:u.id,expiresAt:Date.now()+60000});res.writeHead(302,{Location:`/?oauth=success&code=${encodeURIComponent(exchange)}`});res.end();
}

function normalizeGeminiModel(value){return String(value||'gemini-2.5-flash-lite').trim().replace(/^models\//,'');}
function geminiPayload(messages){
  const list=Array.isArray(messages)?messages:[];
  const system=list.filter(m=>m?.role==='system').map(m=>String(m?.content??'')).filter(Boolean).join('\n\n');
  const contents=list.filter(m=>m?.role!=='system').map(m=>({role:m?.role==='assistant'?'model':'user',parts:[{text:String(m?.content??'') }]})).filter(m=>m.parts[0].text);
  const payload={contents,generationConfig:{temperature:0.4}};
  if(system)payload.systemInstruction={parts:[{text:system}]};
  return payload;
}
async function callGemini(messages){
  const key=String(getenv('GEMINI_API_KEY')||'').trim();if(!key)return null;
  const model=normalizeGeminiModel(getenv('GEMINI_MODEL'));
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(geminiPayload(messages))});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(`Gemini: ${d?.error?.message||`HTTP ${r.status}`}`);
  const text=d?.candidates?.[0]?.content?.parts?.map(p=>p?.text||'').join('').trim()||'';if(!text)throw new Error('Gemini mengembalikan jawaban kosong.');return text;
}
async function callOpenAI(messages){
  const key=String(getenv('OPENAI_API_KEY')||'').trim();if(!key)return null;
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model:getenv('OPENAI_MODEL')||'gpt-4o-mini',messages:messages||[],temperature:0.4})});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`OpenAI: ${d?.error?.message||`HTTP ${r.status}`}`);const text=d?.choices?.[0]?.message?.content||'';if(!text)throw new Error('OpenAI mengembalikan jawaban kosong.');return text;
}

async function route(req,res){
  headers(res);const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,service:'campusly-api',storage:'sqlite',version:'1.2.0-gemini-public-ai',uptime:Math.round(process.uptime())});
  if(req.method==='GET'&&url.pathname==='/api/ready'){try{db.prepare('SELECT 1 AS ok').get();return json(res,200,{ready:true,storage:'sqlite',version:'1.2.0-gemini-public-ai'});}catch{return json(res,503,{ready:false});}}
  if(url.pathname==='/api/auth/google'&&req.method==='GET')return googleStart(res);
  if(url.pathname==='/api/auth/google/callback'&&req.method==='GET')return googleCallback(req,res,url);
  if(url.pathname==='/api/auth/google/exchange'&&req.method==='POST'){const b=await readJson(req),code=String(b.code||''),entry=oauthCodes.get(code);if(!entry||entry.expiresAt<Date.now()){oauthCodes.delete(code);return json(res,400,{error:'Kode OAuth tidak valid atau kedaluwarsa.'});}oauthCodes.delete(code);return json(res,200,{token:issueSession(entry.userId),user:user(entry.userId)});}
  if(url.pathname.startsWith('/api/')){
    if((url.pathname==='/api/auth/register'||url.pathname==='/api/auth/login')&&!rate(req))return json(res,429,{error:'Terlalu banyak percobaan. Coba lagi sebentar.'});
    if(url.pathname==='/api/auth/register'&&req.method==='POST'){const b=await readJson(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return json(res,400,{error:'Email valid dan password minimal 8 karakter diperlukan.'});if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email))return json(res,409,{error:'Akun sudah terdaftar.'});const id=crypto.randomUUID();db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id,email,hashPassword(password),new Date().toISOString());db.prepare('INSERT INTO user_data(user_id,data,updated_at) VALUES(?,?,?)').run(id,'{}',new Date().toISOString());return json(res,201,{token:issueSession(id),user:{id,email}});}
    if(url.pathname==='/api/auth/login'&&req.method==='POST'){const b=await readJson(req),email=String(b.email||'').trim().toLowerCase(),u=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!u||!u.password_hash||!verifyPassword(String(b.password||''),u.password_hash))return json(res,401,{error:'Email atau password salah.'});return json(res,200,{token:issueSession(u.id),user:{id:u.id,email:u.email}});}
    if(url.pathname==='/api/ai'&&req.method==='POST'){
      if(!rate(req))return json(res,429,{error:'Terlalu banyak permintaan AI. Coba lagi sebentar.'});
      const b=await readJson(req),messages=Array.isArray(b.messages)?b.messages:[];
      if(!messages.length)return json(res,400,{error:'Pesan AI kosong.'});
      try{
        if(getenv('GEMINI_API_KEY')){const text=await callGemini(messages);return json(res,200,{text,provider:'gemini',model:normalizeGeminiModel(getenv('GEMINI_MODEL'))});}
        if(getenv('OPENAI_API_KEY')){const text=await callOpenAI(messages);return json(res,200,{text,provider:'openai',model:getenv('OPENAI_MODEL')||'gpt-4o-mini'});}
        return json(res,503,{error:'AI provider belum dikonfigurasi di server. Isi GEMINI_API_KEY dan GEMINI_MODEL.'});
      }catch(e){console.error('AI request failed:',e.message);return json(res,502,{error:e.message});}
    }
    const uid=auth(req);
    if(url.pathname==='/api/auth/me'&&req.method==='GET'){if(!uid)return json(res,401,{error:'Unauthorized'});return json(res,200,{user:user(uid)});}
    if(url.pathname==='/api/auth/logout'&&req.method==='POST'){const h=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');if(h)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(h));return json(res,200,{ok:true});}
    if(url.pathname==='/api/sync'&&req.method==='GET'){if(!uid)return json(res,401,{error:'Unauthorized'});const r=db.prepare('SELECT data,updated_at FROM user_data WHERE user_id=?').get(uid);return json(res,200,{data:r?JSON.parse(r.data):{},updatedAt:r?.updated_at||null});}
    if(url.pathname==='/api/sync'&&req.method==='PUT'){if(!uid)return json(res,401,{error:'Unauthorized'});const b=await readJson(req),data=b.data||{},now=new Date().toISOString();db.prepare(`INSERT INTO user_data(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at`).run(uid,JSON.stringify(data),now);return json(res,200,{ok:true,syncedAt:now});}
    if(url.pathname==='/api/documents/extract'&&req.method==='POST'){if(!uid)return json(res,401,{error:'Unauthorized'});const name=String(req.headers['x-file-name']||'document'),type=String(req.headers['x-file-type']||'application/octet-stream');const data=await readRaw(req);try{return json(res,200,{name,type,size:data.length,text:await extractFile(name,type,data)});}catch(e){return json(res,415,{error:e.message});}}
    return json(res,404,{error:'API route not found'});
  }
  const file=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');if(!PUBLIC.has(file))return json(res,404,{error:'Not found'});const p=path.join(ROOT,file);if(!fs.existsSync(p))return json(res,404,{error:'Not found'});const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[path.extname(p)]||'text/plain; charset=utf-8','Cache-Control':['index.html','sw.js','manifest.json','manifest.webmanifest'].includes(file)?'no-cache':'public, max-age=31536000, immutable'});fs.createReadStream(p).pipe(res);
}
setInterval(()=>{const now=Date.now();db.prepare('DELETE FROM sessions WHERE expires_at<?').run(now);for(const [k,v] of oauthStates)if(v<now)oauthStates.delete(k);for(const [k,v] of oauthCodes)if(v.expiresAt<now)oauthCodes.delete(k);},15*60*1000).unref();
const server=http.createServer((req,res)=>route(req,res).catch(e=>{console.error('Unhandled request error:',e);if(!res.headersSent)json(res,e.status||500,{error:'Internal server error'});else res.destroy();}));
server.listen(PORT,'0.0.0.0',()=>console.log(`Campusly API listening on http://localhost:${PORT}`));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));