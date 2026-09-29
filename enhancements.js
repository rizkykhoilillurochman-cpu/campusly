/* Campusly v2 polish + AI tools + developer page. Loaded after app-v2.js. */
(function(){
  const APP = {
    developer: 'Rizky',
    email: '',
    instagram: ''
  };
  const esc2 = (v='') => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = () => S;
  const saveState = () => save();
  const toast2 = m => toast(m);
  const context = () => {
    const s=state();
    return `Semester ${s.profile?.semester||1}; GPA ${s.profile?.gpa||'belum ada'}; target ${s.profile?.targetGpa||3.75}; tugas aktif ${(s.tasks||[]).filter(x=>!x.done).map(x=>x.title).join(', ')||'tidak ada'}; mata kuliah ${(s.courses||[]).map(x=>x.name).join(', ')||'belum ada'}.`;
  };
  async function postJSON(url, body){
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||`Request gagal (${r.status})`);
    return d;
  }
  function readDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('File gambar gagal dibaca.'));r.readAsDataURL(file);});}
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function exportFile(url,body,name){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){let d={};try{d=await r.json()}catch{}throw new Error(d.error||`Export gagal (${r.status})`)}downloadBlob(await r.blob(),name);}

  window.developer = function(){
    return `${head('ABOUT','Developer & Kontak','Info pembuat Campusly dan cara menghubungi.')}
      <div class="developer-grid">
        <article class="card developer-card">
          <div class="dev-avatar">${esc2((APP.developer||'C')[0].toUpperCase())}</div>
          <div><span class="tag">DEVELOPER</span><h2>${esc2(APP.developer)}</h2><p>Pembuat dan pengembang Campusly.</p></div>
        </article>
        <article class="card">
          <h2>Kontak</h2>
          <div class="dev-contact">
            <div><b>Email</b>${APP.email?`<a href="mailto:${esc2(APP.email)}">${esc2(APP.email)}</a>`:'<span>Belum diatur</span>'}</div>
            <div><b>Instagram</b>${APP.instagram?`<a href="https://instagram.com/${esc2(APP.instagram.replace(/^@/,''))}" target="_blank" rel="noopener">@${esc2(APP.instagram.replace(/^@/,''))}</a>`:'<span>Belum diatur</span>'}</div>
          </div>
          <p class="muted dev-note">Data kontak ini sengaja dipisahkan dari kontak dosen/teman.</p>
        </article>
      </div>`;
  };

  window.ai = function(){
    const s=state();
    const msgs=(s.aiMessages||[]).length?s.aiMessages:[{role:'assistant',text:'Halo. Gue Campusly AI. Bisa jawab pertanyaan, scan soal, bikin makalah, bikin PPT, dan generate gambar.'}];
    return `${head('ASSISTANT','Campusly AI','Satu tempat buat tanya, scan, nulis, presentasi, dan gambar.')}
      <article class="card ai ai-pro">
        <div class="ai-tools">
          <button class="ai-tool" onclick="scanSoal()"><span>📷</span><b>Scan soal</b><small>Foto soal → jawaban + pembahasan</small></button>
          <button class="ai-tool" onclick="makalahModal()"><span>📄</span><b>Buat makalah</b><small>Draft + export PDF</small></button>
          <button class="ai-tool" onclick="pptModal()"><span>📊</span><b>Buat PPT</b><small>Outline → file PowerPoint</small></button>
          <button class="ai-tool" onclick="imageModal()"><span>🎨</span><b>Generate gambar</b><small>Prompt → gambar AI</small></button>
        </div>
        <div class="chat">${msgs.map(x=>`<div class="bubble ${x.role==='user'?'me':''}"><small>${x.role==='user'?'Kamu':'Campusly AI'}</small>${esc2(x.text)}</div>`).join('')}</div>
        <div class="ai-box"><textarea id="aiq" placeholder="Contoh: jelaskan ideologi Pancasila dengan bahasa sederhana..."></textarea><button class="btn primary" onclick="sendAI()">Kirim</button></div>
        <div class="chips"><button onclick="askAI('Apa prioritas tugas saya hari ini?')">Prioritas</button><button onclick="askAI('Buat study plan minggu ini.')">Study plan</button><button onclick="askAI('Analisis GPA saya.')">Analisis GPA</button></div>
      </article>`;
  };

  window.scanSoal = function(){
    const input=document.createElement('input'); input.type='file'; input.accept='image/png,image/jpeg,image/webp';
    input.onchange=async()=>{const f=input.files?.[0];if(!f)return;if(f.size>8*1024*1024)return toast2('Ukuran gambar maksimal 8 MB.');
      try{toast2('Sedang membaca soal…');const image=await readDataURL(f);const d=await postJSON('/api/ai/vision',{image,question:'Baca soal pada gambar, tuliskan jawaban yang benar, lalu jelaskan langkah pengerjaannya dengan jelas.',context:context()});const s=state();s.aiMessages=s.aiMessages||[];s.aiMessages.push({role:'user',text:'📷 Scan soal'});s.aiMessages.push({role:'assistant',text:d.text});saveState();go('ai');}catch(e){toast2(e.message||'Scan soal gagal.');}};
    input.click();
  };

  function textModal(title,fields,onSubmit){
    const html=`<div class="form">${fields.map(f=>f.type==='textarea'?`<label class="field"><span>${esc2(f.label)}</span><textarea name="${esc2(f.name)}" placeholder="${esc2(f.placeholder||'')}"></textarea></label>`:`<label class="field"><span>${esc2(f.label)}</span><input name="${esc2(f.name)}" placeholder="${esc2(f.placeholder||'')}"></label>`).join('')}</div>`;
    modal(title,html,async()=>{const o=Object.fromEntries(new FormData($('.modal')));await onSubmit(o);});
  }
  window.makalahModal=function(){textModal('Buat makalah',[{name:'topic',label:'Topik',placeholder:'Contoh: Pengaruh AI terhadap pendidikan'},{name:'level',label:'Tingkat',placeholder:'Mahasiswa / umum'},{name:'length',label:'Panjang',placeholder:'Contoh: 8 halaman'},{name:'instructions',label:'Instruksi tambahan',type:'textarea',placeholder:'Struktur, gaya bahasa, poin wajib, dll.'}],async o=>{
    if(!o.topic?.trim())return toast2('Topik wajib diisi.');closeModal();toast2('AI sedang menyusun makalah…');
    try{const d=await postJSON('/api/ai',{messages:[{role:'user',content:`Buat draft makalah akademik berbahasa Indonesia. Topik: ${o.topic}. Tingkat: ${o.level||'mahasiswa'}. Panjang: ${o.length||'sedang'}. Instruksi: ${o.instructions||'buat terstruktur dan mudah diedit'}. Gunakan judul, abstrak, pendahuluan, pembahasan, penutup, dan daftar pustaka hanya jika sumber diberikan.`}],context:context()});
      state().aiMessages=state().aiMessages||[];state().aiMessages.push({role:'user',text:`📄 Buat makalah: ${o.topic}`},{role:'assistant',text:d.text});saveState();go('ai');
      const ok=confirm('Makalah selesai. Export PDF sekarang?');if(ok)await exportFile('/api/export/pdf',{title:o.topic,content:d.text},'campusly-makalah.pdf');
    }catch(e){toast2(e.message||'Gagal membuat makalah.');}
  });};
  window.pptModal=function(){textModal('Buat PPT',[{name:'topic',label:'Topik',placeholder:'Contoh: Sistem informasi akademik'},{name:'slides',label:'Jumlah slide',placeholder:'Contoh: 8'},{name:'instructions',label:'Isi wajib',type:'textarea',placeholder:'Poin yang harus masuk ke presentasi'}],async o=>{
    if(!o.topic?.trim())return toast2('Topik wajib diisi.');closeModal();toast2('AI sedang menyusun PPT…');
    try{const d=await postJSON('/api/ai',{messages:[{role:'user',content:`Buat materi presentasi PowerPoint berbahasa Indonesia tentang ${o.topic}. Target ${o.slides||8} slide. Instruksi wajib: ${o.instructions||'buat ringkas, jelas, dan siap presentasi'}. Format setiap slide: SLIDE N: Judul lalu poin-poin.`}],context:context()});
      state().aiMessages=state().aiMessages||[];state().aiMessages.push({role:'user',text:`📊 Buat PPT: ${o.topic}`},{role:'assistant',text:d.text});saveState();go('ai');
      const ok=confirm('Outline PPT selesai. Export .pptx sekarang?');if(ok)await exportFile('/api/export/ppt',{title:o.topic,content:d.text},'campusly-presentasi.pptx');
    }catch(e){toast2(e.message||'Gagal membuat PPT.');}
  });};
  window.imageModal=function(){textModal('Generate gambar',[{name:'prompt',label:'Deskripsi gambar',placeholder:'Contoh: ilustrasi mahasiswa belajar di perpustakaan modern'}],async o=>{
    if(!o.prompt?.trim())return toast2('Deskripsi wajib diisi.');closeModal();toast2('AI sedang membuat gambar…');
    try{const d=await postJSON('/api/ai/image',{prompt:o.prompt});const s=state();s.aiMessages=s.aiMessages||[];s.aiMessages.push({role:'user',text:`🎨 Generate gambar: ${o.prompt}`});saveState();
      const wrap=document.createElement('div');wrap.className='generated-image-card';wrap.innerHTML=`<div class="card"><b>Gambar berhasil dibuat</b><img src="${d.image}" alt="Hasil generate AI"><button class="btn primary" id="saveImg">Simpan gambar</button></div>`;document.body.append(wrap);wrap.querySelector('#saveImg').onclick=()=>{const a=document.createElement('a');a.href=d.image;a.download='campusly-generated.png';a.click()};
    }catch(e){toast2(e.message||'Gagal generate gambar.');}
  });};

  window.sendAI=async function(){const el=document.getElementById('aiq');const q=el?.value.trim();if(q)await window.askAI(q);};
  window.askAI=async function(q){
    const s=state();s.aiMessages=s.aiMessages||[];s.aiMessages.push({role:'user',text:q});saveState();render();
    try{const d=await postJSON('/api/ai',{messages:s.aiMessages.slice(-12).map(x=>({role:x.role,content:x.text})),context:context()});s.aiMessages.push({role:'assistant',text:d.text});saveState();render();}
    catch(e){s.aiMessages.push({role:'assistant',text:`AI belum bisa tersambung: ${e.message||'server AI bermasalah'}`});saveState();render();}
  };

  const oldRender=window.render;
  window.render=function(){
    if(typeof R!=='undefined' && R==='developer'){$('#app').innerHTML=shell(window.developer());return;}
    oldRender();
  };
  window.menu=function(){return `${head('NAVIGATION','Menu','Fitur Campusly dan informasi developer.')}
    <div class="menu-grid">
      ${F.filter(x=>!['home','tasks','calendar','ai','contacts'].includes(x[0])).map(([r,l])=>`<button onclick="go('${r}')">${icon(r)}<span><b>${esc2(l)}</b><small>Buka ${esc2(l)}</small></span>${icon('arrow')}</button>`).join('')}
      <button onclick="go('developer')">${icon('contacts')}<span><b>Developer & Kontak</b><small>Email & Instagram</small></span>${icon('arrow')}</button>
    </div>`;};
  const st=document.createElement('style');st.textContent=`
    .ai-pro{padding:16px}.ai-tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}.ai-tool{border:1px solid var(--line);background:var(--surface);color:var(--text);border-radius:14px;padding:12px;text-align:left;display:grid;gap:4px}.ai-tool span{font-size:20px}.ai-tool b{font-size:13px}.ai-tool small{color:var(--muted);font-size:10px}.developer-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:12px}.developer-card{display:flex;align-items:center;gap:14px}.dev-avatar{width:58px;height:58px;border-radius:16px;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-size:25px;font-weight:900}.developer-card h2{margin:7px 0 3px}.dev-contact{display:grid;gap:14px;margin-top:16px}.dev-contact div{display:grid;gap:3px}.dev-contact a{color:var(--text);font-weight:750}.dev-contact span{color:var(--muted)}.dev-note{font-size:12px}.generated-image-card{position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:grid;place-items:center;padding:16px}.generated-image-card .card{width:min(720px,100%);max-height:90vh;overflow:auto}.generated-image-card img{display:block;width:100%;max-height:65vh;object-fit:contain;border-radius:12px;margin:12px 0}.ai-tool:active{transform:scale(.99)}
    @media(max-width:700px){.ai-tools{grid-template-columns:1fr 1fr}.developer-grid{grid-template-columns:1fr}.ai-tool{min-height:92px}.generated-image-card{padding:8px}}
    [data-theme=dark] .ai-tool{background:#202329;color:var(--text)}
  `;document.head.appendChild(st);
  if(location.hash==='#contacts'){location.hash='#developer';}
  if(location.hash==='#developer')setTimeout(()=>render(),0);
})();
