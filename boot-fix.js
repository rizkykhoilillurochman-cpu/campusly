(function(){
  const KEY='campusly_state_v1';
  const arrayKeys=['tasks','notes','schedule','finance','budgets','courses','gpaRecords','thesisProjects','calendarEvents','documents','notifications','reminders'];
  const objectDefaults={profile:{name:'Rizky',preferredName:'Rizky',university:'',major:'',semester:1,gpa:0,targetGpa:3.75,credits:0,totalCredits:144},focus:{seconds:1500,running:false,session:0},settings:{theme:'dark',accent:'purple',notifications:false},onboarding:{complete:false,step:1},analytics:{focusSeconds:0,focusHistory:[]}};
  try{
    const raw=localStorage.getItem(KEY); if(raw){
      const s=JSON.parse(raw);
      for(const k of arrayKeys) if(!Array.isArray(s[k])) s[k]=[];
      for(const [k,d] of Object.entries(objectDefaults)) s[k]={...d,...(s[k]&&typeof s[k]==='object'?s[k]:{})};
      s.settings.theme='dark';
      localStorage.setItem(KEY,JSON.stringify(s));
    }
  }catch(e){console.warn('Campusly state repair skipped',e)}
  document.documentElement.classList.add('campusly-mobile-ready');
})();
