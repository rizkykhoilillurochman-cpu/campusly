const http=require('http');
const {spawn}=require('child_process');
const path=require('path');
const port=Number(process.env.TEST_PORT||8899);
function req(method,pathname,body){return new Promise((resolve,reject)=>{const payload=body===undefined?null:JSON.stringify(body);const r=http.request({hostname:'127.0.0.1',port,path:pathname,method,headers:payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{const buf=Buffer.concat(chunks);let parsed=buf.toString();try{parsed=JSON.parse(parsed)}catch{}resolve({status:res.statusCode,headers:res.headers,body:parsed,bytes:buf.length})})});r.on('error',reject);if(payload)r.write(payload);r.end()})}
async function wait(){const start=Date.now();while(Date.now()-start<10000){try{if((await req('GET','/api/health')).status===200)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server start timeout')}
(async()=>{const child=spawn(process.execPath,['campusly-production-server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),GEMINI_API_KEY:''},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);try{
await wait();
let r=await req('GET','/');if(r.status!==200||!String(r.body).includes('Campusly'))throw Error('shell');
r=await req('GET','/campusly-v5.js?v=test');if(r.status!==200||!String(r.body).includes('campusly_state_v6')||!String(r.body).includes('Beranda'))throw Error('frontend');
r=await req('GET','/campusly-v5.css?v=test');if(r.status!==200||!String(r.body).includes('--accent')||!String(r.body).includes('.home-nav .ui-icon svg'))throw Error('stylesheet');
for(const legacy of ['/app.js','/styles.css','/sw.js','/sw-v29.js','/sw-v30.js','/campusly-v5-final.js','/developer-contact.js','/runtime-fix.js']){r=await req('GET',legacy);if(r.status!==404)throw Error(`legacy path exposed: ${legacy}`)}
r=await req('GET','/api/health');if(r.status!==200||!r.body.ok||r.body.version!=='canonical-v11'||r.body.model!=='gemini-3.7-flash')throw Error('health');
r=await req('GET','/api/ready');if(r.status!==200||!r.body.ready||!r.body.exports.includes('docx')||!r.body.exports.includes('pptx')||r.body.ai!=='gemini-3.7-flash')throw Error('ready');
r=await req('GET','/api/ai/health');if(r.status!==200||!r.body.ok||r.body.imageGeneration!==false||r.body.model!=='gemini-3.7-flash'||!Array.isArray(r.body.models))throw Error('AI health');
r=await req('POST','/api/ai',{messages:[{role:'user',content:'halo'}]});if(r.status!==503)throw Error('AI key guard');
r=await req('POST','/api/ai/image',{prompt:'test'});if(r.status!==404)throw Error('image endpoint');
r=await req('POST','/api/export/docx',{title:'Tes',content:'# Judul\n\nAbstrak\n\nParagraf **tebal** dan *miring*.'});if(r.status!==200||!String(r.headers['content-type']).includes('wordprocessingml.document')||!String(r.headers['content-disposition']).includes('attachment')||r.bytes<1000)throw Error('DOCX export');
r=await req('POST','/api/export/pdf',{title:'Tes',content:'Paragraf akademik Campusly.'});if(r.status!==200||!String(r.headers['content-type']).includes('application/pdf')||r.bytes<500||!String(r.headers['content-disposition']).includes('attachment'))throw Error('PDF export');
r=await req('POST','/api/export/ppt',{title:'Tes',content:'SLIDE 1: Campusly\n- Test export\n- Pipeline canonical\nVISUAL: Diagram materi'});if(r.status!==200||!String(r.headers['content-type']).includes('presentationml.presentation')||r.bytes<1000||!String(r.headers['content-disposition']).includes('attachment'))throw Error('PPTX export');
r=await req('POST','/api/export/pdf',{title:'Tes',content:''});if(r.status!==400)throw Error('empty PDF guard');
r=await req('POST','/api/export/ppt',{title:'Tes',content:''});if(r.status!==400)throw Error('empty PPT guard');
console.log('Campusly integration tests: PASS')
}catch(e){console.error('Campusly integration tests: FAIL',e.message);if(logs)console.error(logs);process.exitCode=1}finally{child.kill('SIGTERM')}})();
