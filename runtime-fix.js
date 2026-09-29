/* Campusly runtime guard: onboarding + theme state stay in sync after every render. */
(()=>{
  const KEY='campusly_state_v3';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const theme=()=>read().settings?.theme==='dark'?'dark':'light';
  const apply=()=>{
    const t=theme();
    document.documentElement.dataset.theme=t;
    document.documentElement.style.colorScheme=t;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=t==='dark'?'#101216':'#f5f6f8';
    const b=document.querySelector('[data-theme-toggle]');
    if(b){b.textContent=t==='dark'?'☀️':'🌙';b.title=t==='dark'?'Pakai tema terang':'Pakai tema gelap';}
  };
  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=()=>{const result=originalRender();apply();return result};
  }
  window.campuslySetTheme=(value)=>{
    const t=value==='dark'?'dark':'light';
    const s=read();
    s.settings={...(s.settings||{}),theme:t};
    localStorage.setItem(KEY,JSON.stringify(s));
    apply();
    window.render?.();
    setTimeout(apply,0);
  };
  window.campuslyToggleTheme=()=>window.campuslySetTheme(theme()==='dark'?'light':'dark');
  const profileIncomplete=()=>{
    const p=read().profile||{};
    return !String(p.preferredName||p.name||'').trim() || !String(p.university||'').trim() || !String(p.major||'').trim();
  };
  const openOnboarding=()=>{
    if(!profileIncomplete()||document.getElementById('modal')||typeof window.campuslyOnboard!=='function')return;
    window.campuslyOnboard();
  };
  apply();
  let tries=0;
  const boot=setInterval(()=>{
    tries++;
    apply();
    openOnboarding();
    if(!profileIncomplete()||tries>=12)clearInterval(boot);
  },250);
})();
