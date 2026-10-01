const http=require('http');
const {spawn}=require('child_process');
const path=require('path');
const port=Number(process.env.TEST_PORT||8899);
function req(method,p,body){return new Promise((ok,no)=>{const x=body===undefined?null:JSON.stringify(body),r=http.request({hostname:'127.0.0.1',port,path:p,method,headers:x?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(x)}:{}},s=>{const a=[];s.on('data',c=>a.push(c));s.on('end',()=>{const b=Buffer.concat(a);let j=b.toString();try{j=JSON.parse(j)}catch{}ok({status:s.statusCode,headers:s.headers,body:j,bytes:b.length,raw:b})})});r.on('error',no);if(x)r.write(x);r.end()})}
async function wait(){for(let i=0;i<100;i++){try{if((await req('GET','/api/health')).status===200)return}catch{}await new Promise(r=>setTimeout(r,100))}throw Error('server start timeout')}
const assert=(v,m)=>{if(!v)throw Error(m)};
(async()=>{const child=spawn(process.execPath,['campusly-server-clean.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),GEMINI_API_KEY:'',AI_MOCK:'1'},stdio:['ignore','pipe','pipe']});try{await wait();
let r=await req('GET','/');assert(r.status===200&&String(r.raw).includes('Campusly'),'shell');
r=await req('GET','/api/health');assert(r.status===200&&r.body.version==='campusly-ai-v2'&&r.body.keyConfigured===false,'health');
r=await req('GET','/api/ready');assert(r.status===200&&r.body.ready&&r.body.features.includes('jobs')&&r.body.exports.includes('pptx'),'ready');
r=await req('GET','/api/ai/models');assert(r.status===200&&r.body.keyConfigured===false&&Array.isArray(r.body.models),'models empty-key');
r=await req('GET','/api/ai/check');assert(r.status===503&&r.body.code==='MISSING_API_KEY','check missing key');
for(const p of ['/api/ai','/api/chat','/api/translate','/api/generate-paper','/api/generate/paper','/api/generate-ppt','/api/generate/ppt']){const b=p.includes('translate')?{text:'hello'}:p.includes('paper')||p.includes('ppt')?{topic:'Tes'}:{messages:[{role:'user',content:'halo'}]};r=await req('POST',p,b);assert([200,202].includes(r.status),`alias ${p}`);}
r=await req('POST','/api/ai/vision',{image:'bad'});assert(r.status===400&&r.body.ok===false,'vision validation');
r=await req('POST','/api/jobs',{kind:'paper',topic:'Tes'});assert(r.status===202&&r.body.jobId,'job create');let job=r.body.jobId;await new Promise(r=>setTimeout(r,120));r=await req('GET',`/api/jobs/${job}`);assert(r.status===200&&['running','error','done'].includes(r.body.status),'job poll');
const document={title:'Tes Unicode – Makalah',identity:{name:'Ratna Éfrida',npm:'123',major:'Bisnis Digital',university:'Universitas Contoh',course:'Metodologi Penelitian',lecturer:'Dosen Contoh',year:'2026'},preface:'Kata pengantar dengan Unicode: é ñ “kutip” – tanda pisah.',abstract:'Ringkasan singkat.',keywords:['digital','mahasiswa'],chapters:[{number:1,title:'Pendahuluan',sections:[{title:'Latar Belakang',paragraphs:['Paragraf Unicode: café, naïve, “kutip pintar”, dan em dash – aman.']},{title:'Rumusan Masalah',paragraphs:['Rumusan masalah singkat.']}]}],references:[{title:'Sumber contoh',url:'https://example.com'}]};
r=await req('POST','/api/export/docx',{document});assert(r.status===200&&r.bytes>1000&&r.raw[0]===0x50&&r.raw[1]===0x4b,'DOCX');
r=await req('POST','/api/export/pdf',{document});assert(r.status===200&&r.bytes>1000&&r.raw.subarray(0,5).toString()==='%PDF-','PDF');
r=await req('POST','/api/export/pptx',{document:{title:'Tes PPT',theme:'minimal',slides:[{layout:'title',title:'Tes',bullets:[],notes:'Catatan speaker'},{layout:'content-bullets',title:'Unicode',bullets:['café','kutip “pintar”','tanda –'],imageQuery:'',notes:'Jelaskan slide.'}]}});assert(r.status===200&&r.bytes>1000&&r.raw[0]===0x50&&r.raw[1]===0x4b,'PPTX');
let limited=false;for(let i=0;i<35;i++){r=await req('POST','/api/ai',{messages:[{role:'user',content:'x'}]});if(r.status===429){limited=true;break}}assert(limited,'rate limit');
console.log('Campusly AI v2 integration: PASS');
}catch(e){console.error('Campusly AI v2 integration: FAIL',e.message);process.exitCode=1}finally{child.kill('SIGTERM')}})();
