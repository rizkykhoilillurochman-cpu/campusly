(()=>{
  const KEY='campusly_state_v3';
  const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  window.campuslyEditProfile=()=>{try{const s=read();s.profile=s.profile||{};s.profile.onboarded=false;localStorage.setItem(KEY,JSON.stringify(s));window.campuslyOnboard?.()}catch{}};
  const coreSettings=window.settings;
  window.settings=function(){const html=coreSettings?.()||'';return html.replace('onclick="campuslyOnboard()"','onclick="campuslyEditProfile()"')};

  let swReg=null;
  const style=()=>{if(document.getElementById('campusly-production-style'))return;const s=document.createElement('style');s.id='campusly-production-style';s.textContent=`
    .production-note{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;margin-top:12px;border:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--surface2));border-radius:18px}
    .production-note b,.production-note small{display:block}.production-note small{color:var(--muted);margin-top:2px}.production-note .btn{flex:0 0 auto}
    .focus-strip,.dash-card,.utility-row button,.tool-grid button,.ai-action-grid button,.menu-section button{transition:transform .18s ease,box-shadow .18s ease}
    .focus-strip:hover,.dash-card:hover,.utility-row button:hover,.tool-grid button:hover,.ai-action-grid button:hover,.menu-section button:hover{transform:translateY(-2px)}
    @media(max-width:700px){.production-note{align-items:flex-start;flex-direction:column}.production-note .btn{width:100%}.calendar-card{padding-bottom:94px}}
  `;document.head.appendChild(s)};

  const notify=async(title,body,tag)=>{try{if(!('Notification' in window)||Notification.permission!=='granted')return false;const reg=swReg||(await navigator.serviceWorker?.getRegistration());if(!reg?.showNotification)return false;await reg.showNotification(title,{body,icon:'/icon.svg',badge:'/icon.svg',tag:tag||'campusly',renotify:false});return true}catch{return false}};
  const enableNotifications=async()=>{if(!('Notification' in window)){window.toast?.('Browser ini belum mendukung notifikasi.');return false}if(Notification.permission==='denied'){window.toast?.('Notifikasi diblokir. Aktifkan dari pengaturan browser.');return false}const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted'){window.toast?.('Notifikasi belum diaktifkan.');return false}await notify('Campusly siap 🔔','Deadline dan agenda dekat bakal diingatkan.','campusly-ready');window.toast?.('Notifikasi aktif 🔔');return true};
  window.campuslyEnableNotifications=enableNotifications;

  const notificationCard=()=>{if(location.hash.slice(1)!=='settings')return;const section=document.querySelector('.app main>section');if(!section||section.querySelector('[data-campusly-notifications]'))return;const card=document.createElement('div');card.className='production-note';card.dataset.campuslyNotifications='1';const enabled='Notification' in window&&Notification.permission==='granted';card.innerHTML=`<div><b>Notifikasi Campusly</b><small>${enabled?'Aktif — pengingat deadline & agenda siap.':'Aktifkan pengingat tugas dan agenda di perangkat ini.'}</small></div><button class="btn primary" type="button">${enabled?'Tes notifikasi':'Aktifkan'}</button>`;card.querySelector('button').onclick=enableNotifications;section.appendChild(card)};

  const checkDeadlines=async()=>{const s=read(),tasks=(s.tasks||[]).filter(t=>!t.done&&t.deadline),events=(s.events||[]).filter(e=>e.date),seen=JSON.parse(localStorage.getItem('campusly_notified_v2')||'{}');for(const t of tasks){const due=new Date(`${t.deadline}T09:00:00`),diff=due-Date.now(),key=`task:${t.id}:${t.deadline}`;if(diff>=0&&diff<=86400000&&!seen[key]){await notify('Campusly · deadline dekat',`${t.title}${t.course?' · '+t.course:''}`,key);seen[key]=Date.now()}}for(const e of events){const due=new Date(`${e.date}T09:00:00`),diff=due-Date.now(),key=`event:${e.id||e.title}:${e.date}`;if(diff>=0&&diff<=86400000&&!seen[key]){await notify('Campusly · agenda dekat',`${e.title}${e.time?' · '+e.time:''}`,key);seen[key]=Date.now()}}localStorage.setItem('campusly_notified_v2',JSON.stringify(seen))};
  window.scheduleCampusNotifications=checkDeadlines;

  const boot=async()=>{style();if('serviceWorker' in navigator){try{swReg=await navigator.serviceWorker.register('/sw.js?v=46',{updateViaCache:'none'});await swReg.update().catch(()=>{})}catch{}}setTimeout(()=>{notificationCard();const s=read();if(!s.profile?.onboarded&&typeof window.campuslyOnboard==='function')window.campuslyOnboard();checkDeadlines()},300);setInterval(()=>{notificationCard();checkDeadlines()},60000);addEventListener('hashchange',()=>setTimeout(notificationCard,50))};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
