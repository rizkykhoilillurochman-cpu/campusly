/* Campusly UI/navigation overhaul: reliable back navigation + crisp inline SVG icons. */
(function(){
  'use strict';

  const uiStyle=document.createElement('style');
  uiStyle.textContent='.campusly-iconized{display:inline-flex!important;align-items:center;justify-content:center;gap:7px}.campusly-action-icon{display:inline-grid;place-items:center;flex:0 0 18px}.campusly-action-icon .campusly-svg{width:18px;height:18px}.campusly-iconized>span:last-child{min-width:0}.campusly-svg{shape-rendering:geometricPrecision}';
  document.head.appendChild(uiStyle);

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
    settings:['Settings','M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1']
  };

  const ACTIONS={
    'Scan soal':'M4 7h16v13H4zM8 7l1.5-3h5L16 7M12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    'Buat makalah':'M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 0v4h4M8 11h8M8 15h8M8 19h5',
    'Study plan':'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM8 4v16M11 9h5M11 13h5M11 17h3',
    'Analisis GPA':'M5 19V10M12 19V6M19 19v-9M3 21h18',
    'PDF':'M6 3h9l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm8 0v4h4M8 12h8M8 16h6',
    'PPT':'M4 5h16v14H4zM8 16l3-3 2 2 3-4 4 5',
    'Gambar':'M4 5h16v14H4zM7 16l3-3 2 2 3-4 3 5M8 9h.01',
    'Hapus chat':'M6 6h12M9 6v-2h6v2M8 6l1 15h6l1-15M10 10v7M14 10v7',
    'Kirim lagi':'M20 12a8 8 0 1 1-2.3-5.7M20 4v6h-6',
    'Prioritas hari ini':'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8'
  };

  function svgPath(path){return `<svg class="campusly-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`}
  function svg(route){return svgPath((ICONS[route]||ICONS.home)[1])}
  function routeFromButton(btn){const m=(btn.getAttribute('onclick')||'').match(/go\(['"]([^'"]+)['"]\)/);return m?m[1]:null}
  function cleanLabel(text){return String(text||'').replace(/^\s*[^\p{L}\p{N}]+/u,'').replace(/\s+/g,' ').trim()}

  function polishIcons(){
    document.querySelectorAll('.side-nav button').forEach(btn=>{const r=routeFromButton(btn),el=btn.querySelector('.ico');if(r&&el)el.innerHTML=svg(r)});
    document.querySelectorAll('.mobile-nav button').forEach(btn=>{const r=routeFromButton(btn),el=btn.querySelector('.micon');if(!el)return;el.innerHTML=r?svg(r):svgPath('M4 7h16M4 12h16M4 17h16')});
    const search=document.querySelector('.search');
    if(search&&!search.querySelector('.campusly-search-icon')){const input=search.querySelector('input');if(input){const icon=document.createElement('span');icon.className='campusly-search-icon';icon.innerHTML=svgPath('M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l4.5 4.5');search.insertBefore(icon,input);if(search.firstChild&&search.firstChild.nodeType===3)search.firstChild.remove()}}
    document.querySelectorAll('.content button').forEach(btn=>{if(btn.classList.contains('campusly-iconized'))return;const label=cleanLabel(btn.textContent),path=ACTIONS[label];if(!path)return;btn.classList.add('campusly-iconized');btn.innerHTML=`<span class="campusly-action-icon">${svgPath(path)}</span><span>${label}</span>`});
  }

  let previousRoute='home';
  const originalGo=window.go;
  if(typeof originalGo==='function'){window.go=function(next){const current=location.hash.slice(1)||'home';if(next&&next!==current)previousRoute=current;return originalGo.apply(this,arguments)}}
  window.campuslyBack=function(){const current=location.hash.slice(1)||'home';const target=previousRoute&&previousRoute!==current?previousRoute:'home';previousRoute='home';if(typeof window.go==='function')window.go(target);else location.hash=target};

  const originalHeader=window.header;
  if(typeof originalHeader==='function'){window.header=function(k,t,s,action){const current=location.hash.slice(1)||'home';const back=current!=='home'?`<button type="button" class="campusly-back" onclick="campuslyBack()" aria-label="Kembali"><span class="campusly-back-icon">←</span><span>Kembali</span></button>`:'';const base=originalHeader.call(this,k,t,s,action||'');return back?`<div class="campusly-page-head">${back}${base}</div>`:base}}

  const originalRender=window.render;
  if(typeof originalRender==='function'){window.render=function(){const out=originalRender.apply(this,arguments);polishIcons();return out}}
  document.addEventListener('DOMContentLoaded',polishIcons,{once:true});
  setTimeout(polishIcons,0);
  if(typeof window.render==='function')window.render();
})();
