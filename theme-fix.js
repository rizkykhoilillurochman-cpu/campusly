/* Campusly theme control — canonical, independent of the settings-page renderer. */
(()=>{
  const KEY='campusly_state_v3';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const write=s=>localStorage.setItem(KEY,JSON.stringify(s));
  const apply=theme=>{
    const t=theme==='dark'?'dark':'light';
    document.documentElement.dataset.theme=t;
    document.documentElement.style.colorScheme=t;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',t==='dark'?'#101216':'#f5f6f8');
    const s=read();s.settings={...(s.settings||{}),theme:t};write(s);
    window.S&&(S.settings={...(S.settings||{}),theme:t});
  };
  window.campuslySetTheme=theme=>{apply(theme);window.render?.()};
  window.campuslyToggleTheme=()=>{
    const s=read();const next=s.settings?.theme==='dark'?'light':'dark';apply(next);window.render?.();
  };
  const inject=()=>{
    const header=document.querySelector('.app main>header');
    if(!header||header.querySelector('[data-theme-toggle]'))return;
    const b=document.createElement('button');
    b.type='button';b.setAttribute('data-theme-toggle','1');b.className='icon-btn';b.title='Ganti tema';b.setAttribute('aria-label','Ganti tema');
    const refresh=()=>{const dark=document.documentElement.dataset.theme==='dark';b.innerHTML=dark?'☀️':'🌙';b.title=dark?'Pakai tema terang':'Pakai tema gelap';b.setAttribute('aria-label',b.title)};
    b.onclick=()=>{window.campuslyToggleTheme();setTimeout(refresh,0)};
    header.insertBefore(b,header.querySelector('.avatar')||null);refresh();
  };
  const boot=()=>{const s=read();apply(s.settings?.theme||'light');inject()};
  const oldRender=window.render;
  if(typeof oldRender==='function')window.render=function(){const out=oldRender.apply(this,arguments);setTimeout(inject,0);return out};
  addEventListener('hashchange',()=>setTimeout(inject,0));
  boot();
  setTimeout(inject,0);
})();
