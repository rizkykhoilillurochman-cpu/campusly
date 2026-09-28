(function(){
  'use strict';
  function isMobile(){return window.matchMedia && window.matchMedia('(max-width: 760px)').matches;}
  function patch(){
    if(!isMobile()) return;
    document.querySelectorAll('.cmd,.search .cmd').forEach(function(el){el.remove();});
    var nav=document.querySelector('.mobile-nav');
    if(!nav) return;

    // Important: only rebuild a freshly-rendered nav. Reassigning innerHTML on every
    // MutationObserver callback creates an infinite mutation loop and can blank/freeze mobile Safari.
    if(nav.dataset.cxPatched!=='1'){
      nav.innerHTML='<button data-cx-route="home"><span class="cx-icon">⌂</span><span>Home</span></button><button data-cx-route="tasks"><span class="cx-icon">✓</span><span>Tasks</span></button><button data-cx-route="schedule"><span class="cx-icon">◫</span><span>Jadwal</span></button><button data-cx-route="ai"><span class="cx-icon">✦</span><span>AI</span></button><button data-cx-menu="1"><span class="cx-icon">☰</span><span>Menu</span></button>';
      nav.dataset.cxPatched='1';
      nav.style.cssText='display:grid!important;position:fixed!important;left:10px!important;right:10px!important;bottom:calc(10px + env(safe-area-inset-bottom,0px))!important;height:76px!important;z-index:2147483646!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:4px!important;padding:6px!important;box-sizing:border-box!important;border-radius:25px!important;background:rgba(7,11,25,.97)!important;border:1px solid rgba(255,255,255,.18)!important;box-shadow:0 22px 75px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.13)!important;backdrop-filter:blur(32px) saturate(185%)!important;-webkit-backdrop-filter:blur(32px) saturate(185%)!important';
      nav.querySelectorAll('button').forEach(function(b){b.style.cssText='min-width:0!important;width:100%!important;height:100%!important;margin:0!important;border:0!important;border-radius:19px!important;background:transparent!important;color:rgba(235,241,255,.62)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;font:600 12px/1.1 system-ui,sans-serif!important';});
      nav.querySelectorAll('.cx-icon').forEach(function(i){i.style.cssText='font-size:24px!important;line-height:1!important';});
      nav.querySelectorAll('[data-cx-route]').forEach(function(b){
        var r=b.getAttribute('data-cx-route');
        b.onclick=function(){if(typeof window.go==='function')window.go(r);else location.hash='#'+r;};
      });
      var menu=nav.querySelector('[data-cx-menu]');
      if(menu) menu.onclick=showMenu;
    }

    var current=(location.hash||'#home').slice(1);
    nav.querySelectorAll('[data-cx-route]').forEach(function(b){
      var r=b.getAttribute('data-cx-route');
      b.style.background=r===current?'linear-gradient(145deg,rgba(112,105,255,.48),rgba(55,135,255,.18))':'transparent';
      b.style.color=r===current?'#fff':'rgba(235,241,255,.62)';
    });
  }
  function showMenu(){
    var old=document.getElementById('cx-mobile-menu'); if(old){old.remove();return;}
    var routes=[['notes','Notes','Catatan kuliah'],['calendar','Calendar','Agenda'],['semester','Semester','KRS & mata kuliah'],['gpa','GPA','IPK & target'],['finance','Finance','Keuangan mahasiswa'],['focus','Focus','Pomodoro & sesi fokus'],['analytics','Analytics','Progress & statistik'],['thesis','Thesis','Proyek akhir'],['documents','Documents','File kuliah'],['tools','Academic Tools','Tools akademik'],['notifications','Notifications','Notifikasi'],['reminders','Reminders','Pengingat'],['settings','Profil & Settings','Profil dan pengaturan']];
    var overlay=document.createElement('div'); overlay.id='cx-mobile-menu'; overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(2,5,15,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);padding:16px;box-sizing:border-box';
    var sheet=document.createElement('section'); sheet.style.cssText='position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));max-height:82dvh;overflow:auto;padding:18px;border-radius:28px;background:linear-gradient(180deg,#0b1125,#070b18);border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 90px rgba(0,0,0,.7);color:#fff';
    sheet.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:11px;letter-spacing:.18em;color:#9b9fff">CAMPUSLY</div><h2 style="margin:5px 0 0;font:800 25px system-ui">Semua fitur</h2></div><button id="cx-close" style="width:42px;height:42px;border-radius:50%;border:1px solid #ffffff22;background:#ffffff0d;color:#fff;font-size:25px">×</button></div><div id="cx-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:9px"></div>';
    overlay.appendChild(sheet); document.body.appendChild(overlay); overlay.onclick=function(e){if(e.target===overlay)overlay.remove();}; sheet.querySelector('#cx-close').onclick=function(){overlay.remove();};
    var grid=sheet.querySelector('#cx-grid'); routes.forEach(function(x){var b=document.createElement('button');b.style.cssText='text-align:left;min-height:68px;padding:12px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);color:#fff';b.innerHTML='<b style="font-size:14px">'+x[1]+'</b><br><small style="color:#ffffff88">'+x[2]+'</small>';b.onclick=function(){overlay.remove();if(typeof window.go==='function')window.go(x[0]);else location.hash='#'+x[0];};grid.appendChild(b);});
  }
  function start(){
    patch();
    var observer=new MutationObserver(function(){if(isMobile())patch();});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('hashchange',patch);window.addEventListener('resize',patch);
    setTimeout(patch,100);setTimeout(patch,500);setTimeout(patch,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
