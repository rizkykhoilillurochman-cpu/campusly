/* Campusly AI runtime fix: always use the server Gemini route; never silently fall back to canned replies. */
window.askAI = async function(q){
  const text = String(q || '').trim();
  if(!text) return;
  state.aiMessages = state.aiMessages || [];
  state.aiMessages.push({role:'user', text});
  save();
  render();
  try {
    const r = await fetch('/api/ai', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:[
        {role:'system',content:aiContext()},
        {role:'user',content:text}
      ]})
    });
    const d = await r.json().catch(()=>({}));
    if(!r.ok || !d.text) throw new Error(d.error || `AI gagal (${r.status})`);
    state.aiMessages.push({role:'assistant', text:d.text});
    save();
    render();
  } catch(e) {
    state.aiMessages.push({role:'assistant', text:`⚠️ Gemini belum menjawab: ${e.message}. Cek GEMINI_API_KEY/GEMINI_MODEL di Blitz > Environment lalu Restart now.`});
    save();
    render();
  }
};
