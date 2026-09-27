/* CSP compatibility bridge v3.
   Strict hosts may block inline onclick handlers before they can run.
   For the critical onboarding controls, remove the inline attribute entirely
   and replace it with a normal addEventListener handler. */
(function(){
  function fn(name){ return typeof window[name] === 'function' ? window[name] : null; }
  function run(name){ var f=fn(name); if(f) return f(); }

  function wire(){
    var buttons=document.querySelectorAll('.onboarding button');
    buttons.forEach(function(btn){
      if(btn.__campuslyWired) return;
      var text=(btn.textContent||'').trim();
      var raw=btn.getAttribute('onclick')||'';
      var action=null;
      if(raw==='obNext()' || text==='Continue' || text==='Gas masuk Campusly') action='obNext';
      else if(raw==='obBack()' || text==='Back') action='obBack';
      if(!action) return;

      /* Remove the CSP-blocked inline handler by replacing the node. */
      var clean=btn.cloneNode(true);
      clean.removeAttribute('onclick');
      clean.__campuslyWired=true;
      clean.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        run(action);
      });
      btn.replaceWith(clean);
    });
  }

  function start(){
    wire();
    new MutationObserver(wire).observe(document.documentElement,{subtree:true,childList:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
  else start();
})();
