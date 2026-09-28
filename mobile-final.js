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

  function go(r){ if(typeof window.go==='function') window.go(r); else location.hash='#'+r; }
  function removeShortcut(){ document.querySelectorAll('.cmd,.search .cmd').forEach(function(x){x.remove();}); }

  function openMenu(){
    var old=document.getElementById('cx-final-menu');
    if(old){old.remove();return;}
    var overlay=document.createElement('div');
    overlay.id='cx-final-menu';
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(2,5,15,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);padding:14px;box-sizing:border-box;';
    var sheet=document.createElement('section');
    sheet.style.cssText='position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));max-height:82dvh;overflow:auto;padding:18px;border-radius:28px;background:linear-gradient(180deg,#0b1125,#070b18);border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 90px rgba(0,0,0,.7);color:#fff;box-sizing:border-box;';
    sheet.innerHTML='<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px"><div><div style="font-size:10px;letter-spacing:.18em;color:#9b9fff">CAMPUSLY</div><h2 style="margin:5px 0 2px;font:800 25px system-ui">Semua fitur</h2><p style="margin:0;color:#ffffff88;font:500 12px system-ui">Semua fitur Campusly, lengkap di HP.</p></div><button id="cx-final-close" type="button" aria-label="Tutup" style="width:42px;height:42px;flex:0 0 42px;border-radius:50%;border:1px solid #ffffff22;background:#ffffff0d;color:#fff;font-size:25px">×</button></div><div id="cx-final-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:9px"></div>';
    overlay.appendChild(sheet); document.body.appendChild(overlay);
    var grid=sheet.querySelector('#cx-final-grid');
    routes.forEach(function(x){
      var b=document.createElement('button'); b.type='button';
      b.style.cssText='display:flex;align-items:center;gap:9px;min-height:68px;width:100%;padding:12px;text-align:left;border:1px solid rgba(255,255,255,.10);border-radius:17px;background:rgba(255,255,255,.055);color:#fff;box-sizing:border-box;';
      b.innerHTML='<span style="width:24px;text-align:center;font-size:19px">'+x[3]+'</span><span><b style="display:block;font:700 13px system-ui">'+x[1]+'</b><small style="display:block;margin-top:2px;color:#ffffff7a;font:500 10px system-ui">'+x[2]+'</small></span><i style="margin-left:auto;color:#ffffff55;font-style:normal;font-size:18px">›</i>';
      b.onclick=function(){overlay.remove();go(x[0]);}; grid.appendChild(b);
    });
    overlay.onclick=function(e){if(e.target===overlay)overlay.remove();};
    sheet.querySelector('#cx-final-close').onclick=function(){overlay.remove();};
  }

  function patchNav(){
    var nav=document.querySelector('.mobile-nav');
    if(!nav) return;
    nav.innerHTML='<button type="button" data-cx-route="home"><span>⌂</span><b>Home</b></button><button type="button" data-cx-route="tasks"><span>✓</span><b>Tasks</b></button><button type="button" data-cx-route="schedule"><span>◫</span><b>Jadwal</b></button><button type="button" data-cx-route="ai"><span>✦</span><b>AI</b></button><button type="button" data-cx-menu="1"><span>☰</span><b>Menu</b></button>';
    nav.style.cssText='display:grid!important;position:fixed!important;left:10px!important;right:10px!important;bottom:calc(10px + env(safe-area-inset-bottom,0px))!important;height:76px!important;z-index:2147483646!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;padding:6px!important;box-sizing:border-box!important;border-radius:25px!important;background:rgba(7,11,25,.96)!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:0 22px 75px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.13)!important;backdrop-filter:blur(32px) saturate(185%)!important;-webkit-backdrop-filter:blur(32px) saturate(185%)!important;';
    nav.querySelectorAll('button').forEach(function(b){
      b.style.cssText='min-width:0!important;width:100%!important;height:100%!important;margin:0!important;border:0!important;border-radius:19px!important;background:transparent!important;color:rgba(235,241,255,.62)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;font:600 12px/1.1 system-ui,sans-serif!important;';
    });
    var current=(location.hash||'#home').slice(1);
    nav.querySelectorAll('[data-cx-route]').forEach(function(b){
      b.onclick=function(){go(b.getAttribute('data-cx-route'));};
      if(b.getAttribute('data-cx-route')===current)b.style.cssText+='background:linear-gradient(145deg,rgba(112,105,255,.48),rgba(55,135,255,.18))!important;color:#fff!important;';
    });
    nav.querySelector('[data-cx-menu]').onclick=openMenu;
  }

  function patchLayout(){
    removeShortcut();
    document.body.style.setProperty('padding-bottom','calc(118px + env(safe-area-inset-bottom,0px))','important');
    var content=document.querySelector('.content');
    if(content) content.style.setProperty('padding-bottom','calc(132px + env(safe-area-inset-bottom,0px))','important');
    var main=document.querySelector('.main');
    if(main) main.style.setProperty('padding-bottom','0','important');
  }

  function run(){
    if(window.innerWidth>760)return;
    patchLayout();
    patchNav();
  }

  var queued=false;
  function schedule(){
    if(queued)return; queued=true;
    requestAnimationFrame(function(){queued=false;run();});
  }
  var observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',schedule);
  window.addEventListener('resize',schedule);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
  setTimeout(run,100);setTimeout(run,500);setTimeout(run,1200);setTimeout(run,2500);
})();
