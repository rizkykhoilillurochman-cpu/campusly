(()=>{
  window.imageModal=()=>modal('Generate gambar',`<div class="tool-modal"><p>Deskripsiin gambar yang lo mau. Campusly bakal kirim prompt ke image model.</p><div class="form"><label class="field"><span>Prompt gambar</span><textarea id="img-prompt" placeholder="Contoh: ilustrasi mahasiswa belajar di perpustakaan modern, clean, 16:9"></textarea></label><div id="img-result" class="image-result"></div></div></div>`,async()=>{const prompt=document.getElementById('img-prompt')?.value.trim();if(!prompt)return toast?.('Isi prompt gambarnya dulu.');const out=document.getElementById('img-result');out.textContent='Lagi bikin gambar…';try{const r=await fetch('/api/ai/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});const d=await r.json();if(!r.ok||!d.image)throw new Error(d.error||'Generate gambar gagal');out.innerHTML=`<img src="${d.image}" alt="Hasil generate gambar"><a class="btn" href="${d.image}" download="campusly-gambar.png">Simpan gambar</a>`}catch(e){out.textContent='⚠️ '+(e.message||'Generate gambar gagal.')}} ,'Generate');

  const coreRender=window.render || (typeof render==='function'?render:null);
  const renderTools=()=>{if(typeof applyTheme==='function')applyTheme();const app=document.getElementById('app');if(app)app.innerHTML=typeof shell==='function'?shell(typeof tools==='function'?tools():'<div>Tools</div>'):'<div>Tools</div>';};
  const ensureMenuTools=()=>{if(location.hash!=='#menu')return;const host=document.querySelector('.menu-grid,.menu-section');if(!host||host.querySelector('[data-campusly-tools]'))return;const b=document.createElement('button');b.setAttribute('data-campusly-tools','1');b.type='button';b.innerHTML=`🧰<span><b>Tools kuliah</b><small>Kalkulator, translator, timer, konversi</small></span><i>›</i>`;b.onclick=()=>window.go('tools');host.prepend(b)};
  const afterRender=()=>setTimeout(ensureMenuTools,0);
  window.render=function(){if(location.hash==='#tools'){renderTools();return}const out=coreRender?.();afterRender();return out};

  const coreGo=window.go;
  window.go=function(r){
    if(r==='tools'){
      if(location.hash==='#tools')renderTools();
      else location.hash='tools';
      return;
    }
    return coreGo?.(r);
  };
  addEventListener('hashchange',()=>{if(location.hash==='#tools')renderTools();else if(location.hash==='#menu')afterRender()});
  setTimeout(()=>{window.render?.();afterRender()},0);
})();
