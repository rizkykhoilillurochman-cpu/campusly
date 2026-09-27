/* CSP compatibility bridge v2: bind critical UI buttons directly so
   strict hosts do not depend on inline onclick execution. */
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
      btn.__campuslyWired=true;
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        run(action);
      },true);
    });
  }
  wire();
  new MutationObserver(wire).observe(document.documentElement,{subtree:true,childList:true});

  document.addEventListener('click',function(e){
    var el=e.target.closest && e.target.closest('[onclick]');
    if(!el) return;
    var raw=(el.getAttribute('onclick')||'').trim();
    var m;
    if(raw==='obNext()'){e.preventDefault();e.stopImmediatePropagation();return run('obNext');}
    if(raw==='obBack()'){e.preventDefault();e.stopImmediatePropagation();return run('obBack');}
    if((m=raw.match(/^go\('([^']+)'\)$/))){e.preventDefault();e.stopImmediatePropagation();var f=fn('go');if(f)return f(m[1]);}
    if((m=raw.match(/^toggleGoal\('([^']*)'\)$/))){e.preventDefault();e.stopImmediatePropagation();var g=fn('toggleGoal');if(g)return g(m[1]);}
    if((m=raw.match(/^openEvent\('([^']*)'\)$/))){e.preventDefault();e.stopImmediatePropagation();var oe=fn('openEvent');if(oe)return oe(m[1]);}
  },true);

  document.addEventListener('submit',function(e){
    var raw=e.target && (e.target.getAttribute('onsubmit')||'');
    var m=raw.match(/^(authRegister|saveTask|saveNote|saveClass|saveEvent|saveFinance|saveBudget|saveGpaSimulation|saveObCourse|saveProfile|saveReminder|saveThesis)\(event\)$/);
    if(!m) return;
    var f=fn(m[1]);
    if(f){e.preventDefault();e.stopImmediatePropagation();f(e);}
  },true);
})();
