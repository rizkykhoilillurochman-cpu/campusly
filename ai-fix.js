/* Campusly AI workbench — production mobile UX + resilient actions. */
(function(){
  const escv=v=>typeof esc==='function'?esc(v):String(v??'');
  const ctx=()=>{const p=state.profile||{};const tasks=(state.tasks||[]).filter(x=>!x.done).slice(0,15).map(x=>`${x.title}${x.deadline?` (${x.deadline})`:''}${x.priority?` [${x.priority}]`:''}`).join('; ')||'tidak ada';const classes=(state.schedule||[]).slice(0,15).map(x=>`${x.name} ${x.day||''} ${x.start||''}-${x.end||''}`).join('; ')||'tidak ada';const courses=(state.courses||[]).slice(0,15).map(x=>`${x.name}${x.credits?` (${x.credits} SKS)`:''}`).join(', ')||'tidak ada';const gpa=state.gpaRecords||[];const grades=gpa.slice(-15).map(x=>`${x.name}: ${x.grade}/${x.credits}SKS`).join('; ')||'tidak ada';return `Nama: ${p.preferredName||p.name||'mahasiswa'}; Universitas: ${p.university||'belum diisi'}; Jurusan: ${p.major||'belum diisi'}; Semester: ${p.semester||'belum diisi'}; GPA: ${p.gpa||'belum ada'}; Target GPA: ${p.targetGpa||'belum ada'}; Tugas aktif: ${tasks}; Jadwal: ${classes}; Mata kuliah: ${courses}; Nilai tercatat: ${grades}.`;};
  const history=()=> (state.aiMessages||[]).slice(-14).filter(m=>m&&m.text).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text)}));
  const push=(role,text)=>{state.aiMessages=state.aiMessages||[];state.aiMessages.push({role,text});save();};
  const friendlyError=(e,fallback='AI sedang ramai. Campusly akan coba jalur model lain otomatis.')=>{const s=String(e?.message||'');if(/429|high demand|quota|rate.?limit|503|502|504|currently experiencing|spikes in demand|provider|gemini-/i.test(s))return fallback;if(/timeout/i.test(s))return 'AI terlalu lama merespons. Coba lagi sebentar.';if(/API.?KEY|belum terpasang/i.test(s))return 'AI belum dikonfigurasi di server. Pasang GEMINI_API_KEY di deployment.';return s||fallback;};
  const md=s=>{let x=escv(s);x=x.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>');x=x.replace(/^### (.+)$/gm,'<h4>$1</h4>').replace(/^## (.+)$/gm,'<h3>$1</h3>').replace(/^# (.+)$/gm,'<h2>$1</h2>');x=x.replace(/^[-*] (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`);x=x.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/__(.+?)__/g,'<strong>$1</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>').replace(/(?<!_)_([^_\n]+)_(?!_)/g,'<em>$1</em>');return x.split(/\n{2,}/).map(p=>/^<(h2|h3|h4|ul|pre)/.test(p.trim())?p:`<p>${p.replace(/\n/g,'<br>')}</p>`).join('');};
  async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok){const err=new Error(d.error||`HTTP ${r.status}`);err.status=r.status;err.data=d;throw err;}return d;}
  function busy(on,label='Lagi mikir…'){const b=document.getElementById('aiSend');if(b)b.disabled=on;const s=document.getElementById('aiStatus');if(s)s.textContent=on?label:'';document.querySelectorAll('.ai-action').forEach(x=>x.disabled=on);}
  function scroll(){requestAnimationFrame(()=>{const c=document.querySelector('.chat');if(c)c.scrollTop=c.scrollHeight;});}

  // Deterministic tiny calculator fallback. It keeps obvious arithmetic usable
  // even during a provider outage, without pretending that a full AI answer exists.
  function quickMath(input){
    const raw=String(input||'').trim().toLowerCase().replace(/[×x]/g,'*').replace(/÷/g,'/');
    if(!/^[0-9+\-*/%().\s]+$/.test(raw)||!/[+\-*/%]/.test(raw)||raw.length>80)return null;
    try{const value=Function(`"use strict";return (${raw})`)();if(typeof value==='number'&&Number.isFinite(value))return `Hasilnya **${value}**.`;}catch(_e){}return null;
  }
  function localFallback(text){
    const math=quickMath(text);if(math)return math;
    if(/\b(joks|joke|lelucon)\b/i.test(text))return 'Kenapa mahasiswa suka deadline? Karena tanpa deadline, tugasnya jadi *depan-depan nanti* 😭';
    return null;
  }

  async function runAI(text,{reuseUser=false,label='Lagi mikir…'}={}){
    const q=String(text||'').trim();if(!q)return;
    if(!reuseUser)push('user',q);
    window.__aiRetry='';render();busy(true,label);try{
      const d=await post('/api/ai',{messages:history(),context:ctx()});
      push('assistant',d.text||'Gue belum dapet jawaban.');
    }catch(e){
      const local=localFallback(q);
      if(local)push('assistant',`ℹ️ Provider AI lagi bermasalah, jadi gue jawab lokal dulu.\n\n${local}`);
      else {push('assistant',`⚠️ ${friendlyError(e)}`);window.__aiRetry=q;}
    }finally{busy(false);render();scroll();}
  }

  window.askAI=async q=>{const text=String(q||'').trim();if(!text)return;await runAI(text);};
  window.sendAI=async()=>{const el=document.getElementById('aiInput'),q=el?.value.trim();if(!q)return;el.value='';await runAI(q);};
  window.retryAI=async()=>{const q=window.__aiRetry;if(!q)return;const msgs=state.aiMessages||[];const last=msgs[msgs.length-1];if(last?.role==='assistant'&&String(last.text).startsWith('⚠️')){msgs.pop();save();}await runAI(q,{reuseUser:true,label:'Nyoba jalur AI lain…'});};
  window.clearAI=()=>{state.aiMessages=[];window.__aiRetry='';window.__aiLastImage='';save();render();};
  window.scanAI=()=>{const i=document.getElementById('aiScan');if(i)i.click();};
  window.handleScanAI=async input=>{const file=input?.files?.[0];if(!file)return;if(file.size>8*1024*1024){toast('Foto maksimal 8 MB.');input.value='';return;}const reader=new FileReader();reader.onload=async()=>{push('user','📷 Scan soal');render();busy(true,'Membaca foto soal…');try{const d=await post('/api/ai/vision',{image:reader.result,question:'Baca semua soal pada gambar. Untuk tiap soal, tulis: jawaban akhir, langkah pengerjaan singkat, dan jika ada pilihan ganda sebutkan pilihan yang benar. Jangan mengarang bagian gambar yang tidak terbaca.',context:ctx()});push('assistant',d.text||'Gue belum bisa membaca soal ini.');}catch(e){push('assistant',`⚠️ ${friendlyError(e,'Scan gagal diproses. Pastikan foto terang, tidak blur, dan soal terlihat penuh.')}`);}finally{busy(false);render();scroll();input.value='';}};reader.readAsDataURL(file);};

  window.generateAIImage=async()=>{const el=document.getElementById('aiInput');const prompt=el?.value.trim()||window.prompt('Mau bikin gambar apa?','Ilustrasi akademik modern tentang mahasiswa belajar di perpustakaan');if(!prompt)return;push('user','🎨 '+prompt);render();busy(true,'Membuat gambar…');try{const d=await post('/api/ai/image',{prompt});window.__aiLastImage=d.image||'';push('assistant','🎨 Gambar berhasil dibuat.');}catch(e){push('assistant',`⚠️ ${friendlyError(e,'Generate gambar sedang tidak tersedia. Coba lagi sebentar.')}`);}finally{busy(false);render();scroll();}};

  async function exportLast(type){const msgs=state.aiMessages||[],last=[...msgs].reverse().find(m=>m.role==='assistant'&&m.text&&!String(m.text).startsWith('⚠️')&&!String(m.text).startsWith('ℹ️ Provider'));if(!last){toast('Belum ada jawaban AI yang bisa diekspor.');return;}try{toast(type==='pdf'?'Membuat PDF…':'Membuat PPT…');const r=await fetch(`/api/export/${type}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:last.text,title:type==='pdf'?'Campusly-Makalah':'Campusly-Presentasi'})});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||`Export gagal (HTTP ${r.status})`);}const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=type==='pdf'?'campusly-makalah.pdf':'campusly-presentasi.pptx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast(type==='pdf'?'PDF siap.':'PPT siap.');}catch(e){toast(friendlyError(e,'Export gagal.'));}}
  window.exportAIPdf=()=>exportLast('pdf');window.exportAIPpt=()=>exportLast('ppt');

  const action=(label,fn)=>`<button class="btn small ai-action" onclick="${fn}">${label}</button>`;
  window.ai=function(){const msgs=state.aiMessages||[];const bubbles=msgs.length?msgs.map((m,i)=>`<div class="bubble ${m.role==='user'?'me':''}">${m.role==='assistant'?md(m.text):escv(m.text).replace(/\n/g,'<br>')}${m.role==='assistant'&&i===msgs.length-1&&window.__aiLastImage?`<div style="margin-top:10px"><img src="${window.__aiLastImage}" alt="Gambar hasil AI" style="width:100%;border-radius:16px;display:block"><a class="btn small" style="display:inline-block;margin-top:8px" href="${window.__aiLastImage}" download="campusly-ai.png">Simpan gambar</a></div>`:''}</div>`).join(''):`<div class="bubble">Halo 👋 Gue Campusly AI. Tanya soal kuliah, minta bantu tugas, scan soal, bikin makalah, study plan, analisis GPA, PDF, PPT, atau gambar.</div>`;return `${header('ASSISTANT','Campusly AI','Satu tempat buat belajar dan ngerjain tugas.')}
<div class="card ai-card"><div class="chat" style="max-height:52vh;overflow:auto">${bubbles}</div><div class="ai-box"><textarea id="aiInput" placeholder="Tulis apa aja…" autocomplete="off" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAI()}"></textarea><button id="aiSend" class="btn primary" onclick="sendAI()">Kirim</button></div><div id="aiStatus" class="muted" style="min-height:20px;margin-top:6px"></div><div class="actions" style="margin-top:8px;flex-wrap:wrap">${action('📷 Scan soal','scanAI()')}${action('📄 Buat makalah',"askAI('Bantu gue bikin makalah akademik yang rapi. Tanya dulu topik, jurusan/mata kuliah, target panjang, gaya sitasi, dan sumber yang tersedia bila belum ada. Setelah cukup, buat judul, abstrak, pendahuluan, rumusan masalah, tujuan, pembahasan terstruktur, kesimpulan, dan daftar pustaka tanpa mengarang sumber.')")}${action('📚 Study plan',"askAI('Buat study plan realistis dari data Campusly gue. Prioritaskan deadline terdekat, jadwal kuliah, waktu belajar, dan target GPA. Buat rencana harian yang bisa langsung gue ikuti.')")}${action('📊 Analisis GPA',"askAI('Analisis GPA gue berdasarkan data Campusly. Jelaskan posisi sekarang, target, mata kuliah/nilai yang paling berpengaruh, dan strategi realistis untuk naik.')")}${action('⬇️ PDF','exportAIPdf()')}${action('⬇️ PPT','exportAIPpt()')}${action('🎨 Gambar','generateAIImage()')}${action('🧹 Hapus chat','clearAI()')}${window.__aiRetry?action('↻ Kirim lagi','retryAI()'):''}</div><input id="aiScan" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" style="display:none" onchange="handleScanAI(this)"></div>`;};
})();
