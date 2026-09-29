(()=>{
  window.campuslyEditProfile=()=>{try{const key='campusly_state_v3',s=JSON.parse(localStorage.getItem(key)||'{}');s.profile=s.profile||{};s.profile.onboarded=false;localStorage.setItem(key,JSON.stringify(s));window.campuslyOnboard?.()}catch{}};
  const coreSettings=window.settings;
  window.settings=function(){const html=coreSettings?.()||'';return html.replace('onclick="campuslyOnboard()"','onclick="campuslyEditProfile()"')};
  const load=()=>{if(document.querySelector('script[data-campusly-production]'))return;const s=document.createElement('script');s.src='/production-fixes.js?v=1';s.dataset.campuslyProduction='1';document.body.appendChild(s)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
