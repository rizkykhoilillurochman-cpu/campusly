/* Bridge legacy global `let state` to the final polish layer without changing app architecture. */
(function(){
  try{
    window.state=state;
    window.cpImport=function(){
      const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
      input.onchange=()=>{const file=input.files&&input.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const incoming=JSON.parse(r.result);if(!incoming||typeof incoming!=='object')throw Error();Object.keys(state).forEach(k=>{if(!(k in incoming))delete state[k]});Object.assign(state,incoming);localStorage.setItem('campusly_state_v1',JSON.stringify(state));window.toast?.('Backup berhasil dipulihkan');window.render?.()}catch{window.toast?.('File backup tidak valid.')}};r.readAsText(file)};input.click();
    };
    window.addEventListener('storage',e=>{if(e.key!=='campusly_state_v1'||!e.newValue)return;try{const incoming=JSON.parse(e.newValue);Object.keys(state).forEach(k=>{if(!(k in incoming))delete state[k]});Object.assign(state,incoming);window.render?.()}catch{}});
  }catch(e){console.warn('Campusly state bridge unavailable',e)}
})();
