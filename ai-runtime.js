/* Campusly AI — simple chat runtime. */
(function(){
  async function call(messages){
    const r=await fetch('/api/ai',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({messages})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.text) throw new Error(d.error||`AI gagal (HTTP ${r.status})`);
    return String(d.text).trim();
  }

  window.askAI=async function(q){
    const text=String(q||'').trim();
    if(!text)return;

    state.aiMessages=state.aiMessages||[];
    state.aiMessages.push({role:'user',text});
    save();
    render();

    const history=state.aiMessages.slice(-12)
      .filter(m=>m&&m.text)
      .map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text).trim()}))
      .filter(m=>m.content);

    try{
      const answer=await call(history);
      state.aiMessages.push({role:'assistant',text:answer||'Gue belum dapet jawaban dari AI.'});
    }catch(e){
      const message=String(e?.message||'gagal terhubung');
      state.aiMessages.push({role:'assistant',text:`⚠️ AI lagi error: ${message}`});
    }

    save();
    render();
  };
})();
