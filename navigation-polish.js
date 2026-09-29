/* Campusly UI/navigation overhaul: reliable back navigation + crisp inline SVG icons. */
(function(){
  'use strict';

  const ICONS={
    home:['Home','M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
    tasks:['Tasks','M5 12.5 9.2 17 19 6.5'],
    notes:['Notes','M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 0v4h4M8 11h8M8 15h8M8 19h5'],
    schedule:['Jadwal','M4 5h16v14H4zM8 3v4M16 3v4M4 9h16M8 13h3M13 13h3M8 17h3'],
    calendar:['Calendar','M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2zm3-2v4m8-4v4M3 9h18M7 13h3M14 13h3M7 17h3'],
    semester:['Semester','M4 5h16v14H4zM8 9h8M8 13h8M8 17h5'],
    gpa:['GPA','M6 4h12v16H6zM9 8h6M9 12h6M9 16h4'],
    finance:['Finance','M12 3v18M17 7.5c0-1.9-1.8-3.5-5-3.5S7 5.6 7 7.5 8.7 10 12 10s5 1.6 5 3.5-1.8 3.5-5 3.5-5-1.6-5-3.5'],
    focus:['Focus','M12 6v6l4 2M12 2a10 10 0 1 0 10 10'],
    analytics:['Analytics','M5 19V9M12 19V5M19 19v-7M3 21h18'],
    thesis:['Thesis','M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM7 4v16M10 8h6M10 12h6M10 16h4'],
    documents:['Documents','M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 0v4h4M8 11h8M8 15h8M8 19h5'],
    tools:['Academic Tools','M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17a2 2 0 1 0 3 3l5.3-5.3a4 4 0 0 0 5.4-5.4L15 12l-3-3z'],
    ai:['Campusly AI','M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5zM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z'],
    notifications:['Notifications','M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4'],
    reminders:['Reminders','M7 4h10v16H7zM9 8h6M9 12h6M9 16h4'],
    settings:['Settings','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v3m0 13v3m9-10h-3M6 12H3m15.4-6.4-2.1 2.1M7.7 16.3l-2.1 2.1m12.8 0-2.1-2.1M7.7 7.7 5.6 5.6']
  };

  function svg(route){
    const item=ICONS[route]||ICONS.home;
    return `<svg class="campusly-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${item[1]}"/></svg>`;
  }

  function routeFromButton(btn){
    const m=(btn.getAttribute('onclick')||'').match(/go\(['"]([^'"]+)['"]\)/);
    return m?m[1]:null;
  }

  function polishIcons(){
    document.querySelectorAll('.side-nav button').forEach(btn=>{
      const r=routeFromButton(btn);
      const el=btn.querySelector('.ico');
      if(r&&el)el.innerHTML=svg(r);
    });
    document.querySelectorAll('.mobile-nav button').forEach(btn=>{
      const r=routeFromButton(btn);
      const el=btn.querySelector('.micon');
      if(!el)return;
      el.innerHTML=r?svg(r):`<svg class="campusly-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;
    });
    const search=document.querySelector('.search');
    if(search&&!search.querySelector('.campusly-search-icon')){
      const input=search.querySelector('input');
      if(input){
        const icon=document.createElement('span');
        icon.className='campusly-search-icon';
        icon.innerHTML='<svg class="campusly-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
        search.insertBefore(icon,input);
        if(search.firstChild && search.firstChild.nodeType===3)search.firstChild.remove();
      }
    }
  }

  let previousRoute='home';
  const originalGo=window.go;
  if(typeof originalGo==='function'){
    window.go=function(next){
      const current=location.hash.slice(1)||'home';
      if(next&&next!==current)previousRoute=current;
      return originalGo.apply(this,arguments);
    };
  }

  window.campuslyBack=function(){
    const current=location.hash.slice(1)||'home';
    const target=previousRoute&&previousRoute!==current?previousRoute:'home';
    previousRoute='home';
    if(typeof window.go==='function')window.go(target);else location.hash=target;
  };

  const originalHeader=window.header;
  if(typeof originalHeader==='function'){
    window.header=function(k,t,s,action){
      const current=location.hash.slice(1)||'home';
      const back=current!=='home'?`<button type="button" class="campusly-back" onclick="campuslyBack()" aria-label="Kembali"><span class="campusly-back-icon">←</span><span>Kembali</span></button>`:'';
      const base=originalHeader.call(this,k,t,s,action||'');
      return back?`<div class="campusly-page-head">${back}${base}</div>`:base;
    };
  }

  const originalRender=window.render;
  if(typeof originalRender==='function'){
    window.render=function(){
      const out=originalRender.apply(this,arguments);
      polishIcons();
      return out;
    };
  }

  document.addEventListener('DOMContentLoaded',polishIcons,{once:true});
  setTimeout(polishIcons,0);
  if(typeof window.render==='function')window.render();
})();
