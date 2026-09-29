/* Campusly navigation polish: explicit back button for every non-home section. */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .campusly-page-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
    .campusly-back{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:9px 14px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.06);color:inherit;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.12);transition:transform .15s ease,background .15s ease,border-color .15s ease}
    .campusly-back:hover{transform:translateY(-1px);background:rgba(255,255,255,.10);border-color:rgba(255,255,255,.22)}
    .campusly-back:active{transform:translateY(0)}
    .campusly-back-icon{font-size:20px;line-height:1}
    @media(max-width:700px){.campusly-page-head{display:block}.campusly-back{width:100%;margin-bottom:12px}.campusly-page-head .card-head{gap:12px}}
  `;
  document.head.appendChild(style);

  let previousRoute='home';
  const originalGo=window.go;
  if(typeof originalGo==='function'){
    window.go=function(next){
      const current=location.hash.slice(1)||'home';
      if(next && next!==current) previousRoute=current;
      return originalGo.apply(this,arguments);
    };
  }

  window.campuslyBack=function(){
    const current=location.hash.slice(1)||'home';
    const target=previousRoute && previousRoute!==current ? previousRoute : 'home';
    previousRoute='home';
    if(typeof window.go==='function') window.go(target);
    else location.hash=target;
  };

  const originalHeader=window.header;
  if(typeof originalHeader==='function'){
    window.header=function(k,t,s,action){
      const current=location.hash.slice(1)||'home';
      const back=current!=='home'?`<button type="button" class="campusly-back" onclick="campuslyBack()" aria-label="Kembali ke halaman sebelumnya"><span class="campusly-back-icon">←</span><span>Kembali</span></button>`:'';
      const base=originalHeader.call(this,k,t,s,action||'');
      if(!back)return base;
      return `<div class="campusly-page-head">${back}${base}</div>`;
    };
    if(typeof window.render==='function') window.render();
  }
})();
