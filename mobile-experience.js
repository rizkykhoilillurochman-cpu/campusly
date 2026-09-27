(function(){
  const routes=[['notes','Notes','Catatan & materi','▤'],['calendar','Calendar','Agenda','□'],['semester','Semester','KRS & mata kuliah','◈'],['gpa','GPA','IPK & simulasi','∑'],['finance','Finance','Keuangan','◌'],['focus','Focus','Pomodoro','◷'],['analytics','Analytics','Progress','▥'],['thesis','Thesis','Proyek akhir','▱'],['documents','Documents','File kuliah','▣'],['tools','Academic Tools','Kalkulator & tools','✦'],['notifications','Notifications','Notifikasi','♢'],['reminders','Reminders','Pengingat','⏰'],['settings','Settings','Pengaturan','⚙']];
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c]));
  function goRoute(r){ if(typeof window.go==='function'){window.go(r)}else{location.hash='#'+r} }
  function menu(){
    let old=document.querySelector('.cx-mobile-menu'); if(old){old.classList.add('open');return}
    const el=document.createElement('div'); el.className='cx-mobile-menu';
    el.innerHTML=`<div class="cx-menu-backdrop"></div><section class="cx-menu-sheet"><div class="cx-menu-head"><div><div class="cx-kicker">CAMPUSLY</div><h2>Semua fitur</h2><p>Akses seluruh ruang Campusly dari HP.</p></div><button class="cx-close" aria-label="Tutup">×</button></div><div class="cx-feature-grid">${routes.map(([r,n,s,i])=>`<button class="cx-feature" data-route="${r}"><span class="cx-feature-icon">${i}</span><span><b>${n}</b><small>${s}</small></span><i>›</i></button>`).join('')}</div></section>`;
    document.body.appendChild(el); requestAnimationFrame(()=>el.classList.add('open'));
    const close=()=>el.classList.remove('open'); el.querySelector('.cx-menu-backdrop').onclick=close; el.querySelector('.cx-close').onclick=close;
    el.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>{const r=b.dataset.route;close();setTimeout(()=>goRoute(r),80)});
  }
  function mobileNav(){
    const nav=document.querySelector('.mobile-nav'); if(!nav)return;
    nav.innerHTML=`<button data-route="home">⌂<br><span>Home</span></button><button data-route="tasks">✓<br><span>Tasks</span></button><button data-route="schedule">◫<br><span>Jadwal</span></button><button data-route="ai">✧<br><span>AI</span></button><button data-menu="1">☰<br><span>Menu</span></button>`;
    nav.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>goRoute(b.dataset.route));
    nav.querySelector('[data-menu]').onclick=menu;
    const r=location.hash.slice(1)||'home';nav.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===r));
  }
  function featureStrip(){
    if(innerWidth>760 || location.hash==='#ai')return;
    const content=document.querySelector('.content'); if(!content || content.querySelector('.cx-feature-strip'))return;
    const first=content.firstElementChild; if(!first)return;
    const box=document.createElement('div'); box.className='cx-feature-strip';
    box.innerHTML=`<div class="cx-strip-head"><div><b>Campusly tools</b><span>Semua yang lo butuhin buat kuliah</span></div><button data-menu>Semua ›</button></div><div class="cx-strip-scroll">${routes.slice(0,8).map(([r,n,s,i])=>`<button data-route="${r}"><span>${i}</span><b>${n}</b><small>${s}</small></button>`).join('')}</div>`;
    first.insertAdjacentElement('afterend',box);
    box.querySelector('[data-menu]').onclick=menu;box.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>goRoute(b.dataset.route));
  }
  function searchFix(){
    document.querySelectorAll('.cmd').forEach(x=>{x.textContent='';x.style.display='none'});
    const s=document.querySelector('.search'); if(s){s.setAttribute('role','search');s.title='Pencarian Campusly'}
  }
  function animate(){
    document.body.classList.add('cx-alive');
    if(!document.querySelector('.cx-orb')){const a=document.createElement('div');a.className='cx-orb cx-orb-a';const b=document.createElement('div');b.className='cx-orb cx-orb-b';document.body.prepend(a,b)}
  }
  function run(){mobileNav();searchFix();animate();featureStrip()}
  window.addEventListener('resize',run);window.addEventListener('hashchange',()=>setTimeout(run,50));
  new MutationObserver(()=>{clearTimeout(window.__cxT);window.__cxT=setTimeout(run,25)}).observe(document.body,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
