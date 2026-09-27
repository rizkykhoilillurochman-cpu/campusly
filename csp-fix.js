/* Campusly CSP bridge v5.
   The hosting CSP blocks inline onclick handlers. Keep onboarding controls
   functional without relying on inline JavaScript. This file is loaded
   before app.js so the capture handlers are installed before the UI renders. */
(function(){
  function call(name){
    try {
      var fn=window[name];
      if(typeof fn==='function') fn();
    } catch(err) {
      console.error('Campusly onboarding action failed:',err);
    }
  }

  function actionFor(btn){
    if(!btn || !btn.closest) return null;
    var root=btn.closest('.onboarding');
    if(!root) return null;
    var text=(btn.textContent||'').trim();
    var raw=btn.getAttribute('onclick')||'';
    if(raw==='obNext()' || text==='Continue' || text==='Gas masuk Campusly') return 'obNext';
    if(raw==='obBack()' || text==='Back') return 'obBack';
    return null;
  }

  function handle(e){
    var btn=e.target && e.target.closest ? e.target.closest('.onboarding button') : null;
    var action=actionFor(btn);
    if(!action) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    call(action);
  }

  document.addEventListener('click',handle,true);
  document.addEventListener('pointerup',function(e){
    /* Pointer fallback for hosts that suppress the normal click activation. */
    var btn=e.target && e.target.closest ? e.target.closest('.onboarding button') : null;
    if(!actionFor(btn)) return;
    if(e.pointerType==='mouse' || e.pointerType==='pen') return;
    handle(e);
  },true);

  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter' && e.key!==' ') return;
    var btn=e.target && e.target.closest ? e.target.closest('.onboarding button') : null;
    if(!actionFor(btn)) return;
    handle(e);
  },true);
})();
