const http=require('http');
const {spawn}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const port=Number(process.env.TEST_PORT||8899);
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'campusly-test-'));
const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dataDir,OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});
let out=''; child.stdout.on('data',d=>out+=d); child.stderr.on('data',d=>out+=d);
function req(method,p,body,token){return new Promise((resolve,reject)=>{const b=body===undefined?null:JSON.stringify(body);const r=http.request({hostname:'127.0.0.1',port,path:p,method,headers:{...(b?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}:{}),...(token?{Authorization:`Bearer ${token}`}:{})}},res=>{let s='';res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:s?(()=>{try{return JSON.parse(s)}catch{return s}})():null}))});r.on('error',reject);if(b)r.write(b);r.end()})}
(async()=>{try{
  await new Promise((resolve,reject)=>{const t=Date.now();const i=setInterval(()=>{if(out.includes('Campusly API listening')){clearInterval(i);resolve()}else if(Date.now()-t>5000){clearInterval(i);reject(new Error('server start timeout'))}},25)});
  let r=await req('GET','/'); if(r.status!==200||!String(r.body).includes('Campusly'))throw Error('shell');
  r=await req('GET','/manifest.webmanifest'); if(r.status!==200||r.body.short_name!=='Campusly')throw Error('manifest');
  r=await req('GET','/styles.css?v=24'); if(r.status!==200||!String(r.body).includes('--accent'))throw Error('styles');
  r=await req('GET','/mobile-menu.css?v=4'); if(r.status!==200||!String(r.body).includes('overflow-y'))throw Error('mobile menu css');
  r=await req('GET','/sw.js?v=3'); if(r.status!==200||!String(r.body).includes('campusly-v32'))throw Error('service worker');
  r=await req('GET','/ai-fix.js?v=1'); if(r.status!==200||!String(r.body).includes('scanAI'))throw Error('ai fix');
  r=await req('GET','/app.js?v=27'); if(r.status!==200||!String(r.body).includes('const KEY'))throw Error('app');
  r=await req('GET','/api/health'); if(r.status!==200||!r.body.ok)throw Error('health');
  r=await req('GET','/api/ready'); if(r.status!==200||!r.body.ready)throw Error('ready');
  r=await req('GET','/api/sync'); if(r.status!==401)throw Error('unauthorized');
  const email=`test-${Date.now()}@example.com`;r=await req('POST','/api/auth/register',{email,password:'Password123!'});if(r.status!==201||!r.body.token)throw Error('register');
  const token=r.body.token;r=await req('PUT','/api/sync',{data:{tasks:[{id:'t1',title:'Release QA'}]}},token);if(r.status!==200)throw Error('sync put');
  r=await req('GET','/api/sync',undefined,token);if(r.status!==200||r.body.data.tasks[0].title!=='Release QA')throw Error('sync get');
  r=await req('POST','/api/auth/logout',undefined,token);if(r.status!==200)throw Error('logout');
  r=await req('GET','/api/sync',undefined,token);if(r.status!==401)throw Error('logout invalidation');
  console.log('Campusly integration tests: PASS');
}catch(e){console.error('Campusly integration tests: FAIL',e.message);process.exitCode=1}finally{child.kill('SIGTERM');setTimeout(()=>fs.rmSync(dataDir,{recursive:true,force:true}),100)}})();
