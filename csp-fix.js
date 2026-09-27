/* CSP compatibility bridge v4.
   The app historically renders inline onclick attributes. On hosts with a
   strict script-src policy those handlers are blocked. We intercept the
   onboarding buttons during the capture phase, before the blocked inline
   handler can execute, and call the real functions from app.js. */
(function(){
  function call(name){
    try {
      var fn=window[name];
      if(typeof fn==='function') fn();
    } catch(err) {
      console.error('Campusly onboarding action failed:',err);
    }
  }

  document.addEventListener('click',function(e){
    var btn=e.target && e.target.closest ? e.target.closest('.onboarding button') : null;
    if(!btn) return;

    var text=(btn.textContent||'').trim();
    var raw=btn.getAttribute('onclick')||'';
    var action=null;

    if(raw==='obNext()' || text==='Continue' || text==='Gas masuk Campusly') action='obNext';
    else if(raw==='obBack()' || text==='Back') action='obBack';
    if(!action) return;

    /* Stop the CSP-blocked inline handler from reaching the target. */
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    call(action);
  },true);
})();
