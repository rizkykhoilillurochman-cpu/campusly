/* Campusly final UI/runtime patch — one last layer for the v2 deployment. */
(function(){
  const DEV={name:'Rizky Khoilillu Rochman',email:'',instagram:''};
  const escF=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg=n=>typeof icon==='function'?icon(n):'';
  const contact=()=>S.developerContact||DEV;
  if(!S.developerContact) S.developerContact={...DEV};

  function finalShell(content){
    const p=S.profile||{};
    const items=F.filter(([r])=>r!=='contacts').concat([['developer','Developer & Kontak']]);
    const mobile=[['home','home','Beranda'],['tasks','tasks','Tugas'],['calendar','calendar','Kalender'],['ai','ai','AI'],['menu','tools','Menu']];
    return `<div class="app final-app"><aside><div class="brand"><b>C</b>Campusly</div><nav>${items.map(([r,l])=>`<button class="${R===r?'on':''}" onclick="go('${r}')">${svg(r)}<span>${escF(l)}</span></button>`).join('')}</nav></aside><main><header><div class="search">${svg('search')}<input aria-label="Cari" placeholder="Cari tugas, catatan, kelas..." value="${escF(window.q||'')}" onkeydown="if(event.key==='Enter')search(this.value)"></div><button class="avatar" onclick="go('settings')">${escF((p.preferredName||p.name||'R')[0])}</button></header><section>${content}</section></main><nav class="mobile">${mobile.map(([r,i,l])=>`<button class="${R===r||(r==='menu'&&!['home','tasks','calendar','ai'].includes(R))?'on':''}" onclick="go('${r==='menu'?'menu':r}')">${svg(i)}<span>${l}</span></button>`).join('')}</nav></div>`;
  }

  function developerPage(){
    const c=contact();
    const ig=String(c.instagram||'').replace(/^@/,'');
    return `${head('ABOUT','Developer & Kontak','Pembuat Campusly dan kontak resminya.')}
      <div class="developer-grid">
        <article class="card developer-card">
          <div class="dev-avatar">${escF((c.name||'R')[0].toUpperCase())}</div>
          <div><span class="tag">DEVELOPER</span><h2>${escF(c.name||'Rizky Khoilillu Rochman')}</h2><p>Pembuat dan pengembang Campusly.</p></div>
        </article>
        <article class="card developer-contact-card">
          <div class="card-head"><div><h2>Kontak</h2><p>Email dan Instagram developer.</p></div></div>
          <div class="dev-contact">
            <a class="dev-link" href="${c.email?'mailto:'+encodeURIComponent(c.email):'#'}" onclick="if(!${!!c.email}){event.preventDefault();toast('Email developer belum diatur.')}" >${svg('notes')}<span><b>Email</b><small>${escF(c.email||'Belum diatur')}</small></span></a>
            <a class="dev-link" href="${ig?'https://instagram.com/'+encodeURIComponent(ig):'#'}" target="_blank" rel="noopener" onclick="if(!${!!ig}){event.preventDefault();toast('Instagram developer belum diatur.')}" >${svg('contacts')}<span><b>Instagram</b><small>${ig?'@'+escF(ig):'Belum diatur'}</small></span></a>
          </div>
          <p class="dev-note">Ini khusus kontak developer, bukan daftar kontak dosen/teman.</p>
        </article>
      </div>
      <article class="card developer-edit"><div class="card-head"><div><h2>Atur kontak developer</h2><p>Disimpan lokal di perangkat supaya tidak mengganggu data kontak kampus.</p></div></div>
        <div class="form developer-form"><label class="field"><span>Nama developer</span><input id="devName" value="${escF(c.name||'')}" /></label><label class="field"><span>Email</span><input id="devEmail" type="email" value="${escF(c.email||'')}" placeholder="nama@email.com" /></label><label class="field"><span>Instagram</span><input id="devInstagram" value="${escF(ig)}" placeholder="username tanpa @" /></label><button class="btn primary" onclick="saveDeveloperContact()">Simpan kontak developer</button></div>
      </article>`;
  }
  window.saveDeveloperContact=function(){
    S.developerContact={name:document.getElementById('devName')?.value.trim()||DEV.name,email:document.getElementById('devEmail')?.value.trim()||'',instagram:(document.getElementById('devInstagram')?.value||'').trim().replace(/^@/,'')};
    save();toast('Kontak developer tersimpan.');render();
  };

  function aiFinal(){
    const msgs=(S.aiMessages||[]).length?S.aiMessages:[{role:'assistant',text:'Halo. Gue Campusly AI. Bisa tanya apa saja soal kuliah, scan soal, bikin makalah, bikin PPT, atau generate gambar.'}];
    return `${head('ASSISTANT','Campusly AI','Satu tempat untuk tanya, scan, menulis, presentasi, dan membuat gambar.')}
      <article class="card ai ai-pro">
        <div class="ai-tools">
          <button class="ai-tool" onclick="window.scanSoal&&window.scanSoal()"><span>📷</span><b>Scan soal</b><small>Foto soal → jawaban + pembahasan</small></button>
          <button class="ai-tool" onclick="window.makalahModal&&window.makalahModal()"><span>📄</span><b>Buat makalah</b><small>Draft akademik + PDF</small></button>
          <button class="ai-tool" onclick="window.pptModal&&window.pptModal()"><span>📊</span><b>Buat PPT</b><small>Materi → PowerPoint</small></button>
          <button class="ai-tool" onclick="window.imageModal&&window.imageModal()"><span>🎨</span><b>Generate gambar</b><small>Prompt → gambar AI</small></button>
        </div>
        <div class="chat">${msgs.map(x=>`<div class="bubble ${x.role==='user'?'me':''}"><small>${x.role==='user'?'Kamu':'Campusly AI'}</small>${escF(x.text)}</div>`).join('')}</div>
        <div class="ai-box"><textarea id="aiq" placeholder="Contoh: jelaskan ideologi Pancasila dengan bahasa sederhana..."></textarea><button class="btn primary" onclick="sendAI()">Kirim</button></div>
        <div class="chips"><button onclick="askAI('Apa prioritas tugas saya hari ini?')">Prioritas</button><button onclick="askAI('Buat study plan minggu ini.')">Study plan</button><button onclick="askAI('Analisis GPA saya.')">Analisis GPA</button></div>
      </article>`;
  }

  function menuFinal(){
    const items=F.filter(x=>!['home','tasks','calendar','ai','contacts'].includes(x[0]));
    return `${head('NAVIGATION','Menu','Semua fitur Campusly dalam satu tempat.')}
      <div class="menu-grid">${items.map(([r,l])=>`<button onclick="go('${r}')">${svg(r)}<span><b>${escF(l)}</b><small>Buka ${escF(l)}</small></span>${svg('arrow')}</button>`).join('')}
      <button onclick="go('developer')">${svg('contacts')}<span><b>Developer & Kontak</b><small>Nama, email, Instagram</small></span>${svg('arrow')}</button></div>`;
  }

  function finalRender(){
    const pages={home,tasks,notes,schedule,calendar,semester,gpa,finance,focus,analytics,thesis,documents,tools,ai:aiFinal,reminders,settings,menu:menuFinal,developer:developerPage,contacts:developerPage};
    if(!pages[R]) R='home';
    $('#app').innerHTML=finalShell(pages[R]());
    if(R==='focus')tick();
  }
  window.render=finalRender;
  window.go=function(r){R=r;location.hash=r;closeModal();finalRender()};
  window.addEventListener('hashchange',()=>{R=location.hash.slice(1)||'home';finalRender()});
  finalRender();
})();
