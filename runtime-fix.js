/* Campusly runtime guard: onboarding + theme + enhanced pages stay in sync. */
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
  const coreRender=window.render;
  const enhancedRoutes=new Set(['home','menu','settings']);
  const renderPage=()=>{
    const route=(location.hash.slice(1)||'home');
    if(enhancedRoutes.has(route)&&typeof window[route]==='function'&&typeof window.shell==='function'){
      const app=document.getElementById('app');
      if(app)app.innerHTML=window.shell(window[route]());
      apply();
      return;
    }
    coreRender?.();
    apply();
  };
  window.render=renderPage;
  window.campuslySetTheme=(value)=>{
    const t=value==='dark'?'dark':'light';
    const s=read();
    s.settings={...(s.settings||{}),theme:t};
    localStorage.setItem(KEY,JSON.stringify(s));
    apply();
    renderPage();
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
