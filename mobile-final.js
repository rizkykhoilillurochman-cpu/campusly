(function(){
  'use strict';
  if(!window.matchMedia || !window.matchMedia('(max-width:760px)').matches) return;
  var routes=[
    ['notes','Notes','Catatan & materi','▤'],['calendar','Calendar','Agenda','□'],['semester','Semester','KRS & mata kuliah','◈'],
    ['gpa','GPA','IPK & simulasi','∑'],['finance','Finance','Keuangan','◌'],['focus','Focus','Pomodoro','◷'],
    ['analytics','Analytics','Progress','▥'],['thesis','Thesis','Proyek akhir','▱'],['documents','Documents','File kuliah','▣'],
    ['tools','Academic Tools','Kalkulator & tools','✦'],['notifications','Notifications','Notifikasi','♢'],['reminders','Reminders','Pengingat','⏰'],
    ['settings','Settings','Profil & pengaturan','⚙']
  ];
  var go=function(r){if(typeof window.go==='function')window.go(r);else location.hash='#'+r;};
  function openMenu(){
    var old=document.getElementById('cx-final-menu');if(old){old.remove();return;}
    var overlay=document.createElement('div');overlay.id='cx-final-menu';overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(2,5,15,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);padding:14px;box-sizing:border-box;opacity:0;transition:opacity .18s ease';
    var sheet=document.createElement('section');sheet.style.cssText='position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));max-height:82dvh;overflow:auto;padding:18px;border-radius:28px;background:linear-gradient(180deg,#0b1125,#070b18);border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 90px rgba(0,0,0,.7);color:#fff;box-sizing:border-box;transform:translateY(16px);transition:transform .2s ease';
    sheet.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px"><div><div style="font-size:10px;letter-spacing:.18em;color:#9b9fff">CAMPUSLY</div><h2 style="margin:5px 0 2px;font:800 25px system-ui">Semua fitur</h2><p style="margin:0;color:#ffffff88;font:500 12px system-ui">Semua fitur Campusly, lengkap di HP.</p></div><button id="cx-final-close" aria-label="Tutup" style="width:42px;height:42px;flex:0 0 42px;border-radius:50%;border:1px solid #ffffff22;background:#ffffff0d;color:#fff;font-size:25px">×</button></div><div id="cx-final-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:9px"></div>';
    overlay.appendChild(sheet);document.body.appendChild(overlay);
    var grid=sheet.querySelector('#cx-final-grid');
    routes.forEach(function(x){var b=document.createElement('button');b.type='button';b.style.cssText='display:flex;align-items:center;gap:9px;min-height:68px;width:100%;padding:12px;text-align:left;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(255,255,255,.055);color:#fff;box-sizing:border-box';b.innerHTML='<span style="width:24px;text-align:center;font-size:19px">'+x[3]+'</span><span><b style="display:block;font:700 13px system-ui">'+x[1]+'</b><small style="display:block;margin-top:2px;color:#ffffff7a;font:500 10px system-ui">'+x[2]+'</small></span><i style="margin-left:auto;color:#ffffff55;font-style:normal;font-size:18px">›</i>';b.onclick=function(){overlay.remove();go(x[0]);};grid.appendChild(b);});
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};sheet.querySelector('#cx-final-close').onclick=function(){overlay.remove();};
    requestAnimationFrame(function(){overlay.style.opacity='1';sheet.style.transform='translateY(0)';});
  }
  function patchNav(){
    if(!window.matchMedia('(max-width:760px)').matches)return;
    var nav=document.querySelector('.mobile-nav');if(!nav)return;
    var labels=Array.prototype.map.call(nav.querySelectorAll('button'),function(b){return (b.innerText||'').trim().replace(/\s+/g,' ').split(' ').pop();});
    if(labels.join('|')!=='Home|Tasks|Jadwal|AI|Menu'){
      nav.innerHTML='<button data-final-route="home"><span style="font-size:24px;line-height:1">⌂</span><span>Home</span></button><button data-final-route="tasks"><span style="font-size:24px;line-height:1">✓</span><span>Tasks</span></button><button data-final-route="schedule"><span style="font-size:24px;line-height:1">◫</span><span>Jadwal</span></button><button data-final-route="ai"><span style="font-size:24px;line-height:1">✦</span><span>AI</span></button><button data-final-menu="1"><span style="font-size:24px;line-height:1">☰</span><span>Menu</span></button>';
      nav.querySelectorAll('button').forEach(function(b){b.style.cssText='min-width:0!important;width:100%!important;height:100%!important;margin:0!important;border:0!important;border-radius:19px!important;background:transparent!important;color:rgba(235,241,255,.62)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;font:600 12px/1.1 system-ui,sans-serif!important';});
      nav.querySelectorAll('[data-final-route]').forEach(function(b){b.onclick=function(){go(b.getAttribute('data-final-route'));};});
      nav.querySelector('[data-final-menu]').onclick=openMenu;
    }
    var current=(location.hash||'#home').slice(1);nav.querySelectorAll('[data-final-route]').forEach(function(b){var active=b.getAttribute('data-final-route')===current;b.style.background=active?'linear-gradient(145deg,rgba(112,105,255,.48),rgba(55,135,255,.18))':'transparent';b.style.color=active?'#fff':'rgba(235,241,255,.62)';});nav.style.zIndex='2147483646';
  }
  function run(){document.querySelectorAll('.cmd,.search .cmd').forEach(function(x){x.remove();});patchNav();}
  var observer=new MutationObserver(function(){var nav=document.querySelector('.mobile-nav');if(nav&&(nav.innerText||'').indexOf('Profil')!==-1)run();});observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',run);window.addEventListener('resize',run);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
