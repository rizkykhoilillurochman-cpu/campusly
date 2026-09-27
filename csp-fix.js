/* CSP compatibility bridge: execute the app's existing declarative handlers
   without eval/new Function, so the UI still works when the host blocks inline
   event attributes. */
(function(){
  const call=(name,...args)=>{
    const fn=window[name];
    if(typeof fn==='function') return fn(...args);
  };
  function clickHandler(raw,el){
    let m;
    if(raw==='obNext()') return call('obNext');
    if(raw==='obBack()') return call('obBack');
    if(raw==='addObCourse()') return call('addObCourse');
    if(raw==='openTask()') return call('openTask');
    if(raw==='openNote()') return call('openNote');
    if(raw==='openClass()') return call('openClass');
    if(raw==='openEvent()') return call('openEvent');
    if(raw==='openFinance()') return call('openFinance');
    if(raw==='openBudget()') return call('openBudget');
    if(raw==='openThesis()') return call('openThesis');
    if(raw==='addGpaRow()') return call('addGpaRow');
    if(raw==='askAI()') return call('askAI');
    if(raw==='authLogin()') return call('authLogin');
    if(raw==='logout()') return call('logout');
    if(raw==='closeModal()') return call('closeModal');
    if(raw==='saveGpaSimulation()') return call('saveGpaSimulation');
    if(raw==='exportData()') return call('exportData');
    if(raw==='pullCloud()') return call('pullCloud');
    if(raw==='syncCloud()') return call('syncCloud');
    if(raw==='requestNotifications()') return call('requestNotifications');
    if(raw==='resetData()') return call('resetData');
    if(raw==='resetFocus()') return call('resetFocus');
    if(raw==='toggleFocus()') return call('toggleFocus');
    if(raw==='scheduleDueReminders()') return call('scheduleDueReminders');
    if(raw==="document.getElementById('docInput').click()") return document.getElementById('docInput')?.click();
    if(raw==="document.getElementById('importInput').click()") return document.getElementById('importInput')?.click();
    if(raw==="location.href='/api/auth/google'") return (location.href='/api/auth/google');
    if((m=raw.match(/^go\('([^']+)'\)$/))) return call('go',m[1]);
    if((m=raw.match(/^toggleGoal\('([^']*)'\)$/))) return call('toggleGoal',m[1]);
    if((m=raw.match(/^openEvent\('([^']*)'\)$/))) return call('openEvent',m[1]);
    if((m=raw.match(/^(?:removeObCourse|deleteEvent|deleteFinance|deleteNote|deleteDocument|deleteThesis|toggleTask)\((\d+)\)$/))){
      const fn=raw.slice(0,raw.indexOf('(')); return call(fn,Number(m[1]));
    }
    if((m=raw.match(/^searchDocument\((\d+)\)$/))) return call('searchDocument',Number(m[1]));
    if((m=raw.match(/^deleteReminder\((\d+)\)$/))) return call('deleteReminder',Number(m[1]));
    if((m=raw.match(/^setCalendarView\('(month|week|day)'\)$/))) return call('setCalendarView',m[1]);
    if((m=raw.match(/^moveCalendar\((-?1)\)$/))) return call('moveCalendar',Number(m[1]));
    if((m=raw.match(/^toast\('([^']*)'\)$/))) return call('toast',m[1]);
  }
  document.addEventListener('click',function(e){
    const el=e.target.closest?.('[onclick]');
    if(!el) return;
    const raw=el.getAttribute('onclick')?.trim();
    if(!raw) return;
    const handled=clickHandler(raw,el);
    if(handled!==undefined || /^(obNext|obBack|addObCourse|openTask|openNote|openClass|openEvent|openFinance|openBudget|openThesis|addGpaRow|askAI|authLogin|logout|closeModal|saveGpaSimulation|exportData|searchDocument|pullCloud|syncCloud|requestNotifications|resetData|resetFocus|toggleFocus|scheduleDueReminders|go|toggleGoal|removeObCourse|deleteEvent|deleteFinance|deleteNote|deleteDocument|deleteThesis|toggleTask|deleteReminder|setCalendarView|moveCalendar|toast)\b/.test(raw) || raw.startsWith('document.getElementById') || raw.startsWith('location.href=')) e.preventDefault();
  },true);
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter') return;
    const el=e.target;
    const raw=el?.getAttribute?.('onkeydown')||'';
    if(raw.includes('doSearch(this.value)')){e.preventDefault();return call('doSearch',el.value)}
    if(raw.includes('askAI()')){e.preventDefault();return call('askAI')}
  },true);
  document.addEventListener('submit',function(e){
    const raw=e.target?.getAttribute?.('onsubmit')||'';
    const m=raw.match(/^(authRegister|saveTask|saveNote|saveClass|saveEvent|saveFinance|saveBudget|saveGpaSimulation|saveObCourse|saveProfile|saveReminder|saveThesis)\(event\)$/);
    if(!m) return;
    e.preventDefault();
    call(m[1],e);
  },true);
})();
