(function(){
  const LEAK=[
    /^\s*\*?\s*(user|persona|user data|student data|acknowledge|ask for the necessary details)\s*:/im,
    /\b(can i generate images|as an ai model|as an ai assistant)\b/i,
    /\b(acknowledge the request|ask for the necessary details)\b/i,
    /\bpersona:\s*campusly ai\b/i,
    /\b(user|student) data:\s*semester\b/i
  ];
  const isLeak=t=>{const s=String(t||'').trim();return !s||LEAK.some(r=>r.test(s));};
  const context=()=>{try{const p=state.profile||{};return [`Nama: ${p.preferredName||p.name||'user'}`,`Semester: ${p.semester||1}`,`GPA: ${p.gpa||'belum ada'}`,`Target GPA: ${p.targetGpa||3.75}`,`Tugas aktif: ${(state.tasks||[]).filter(x=>!x.done).length}`,`Mata kuliah: ${(state.courses||[]).map(x=>x.name).filter(Boolean).join(', ')||'belum ada'}`].join('\n');}catch{return '';}};
  const system=`Kamu Campusly AI, teman kuliah yang pinter, helpful, santai, dan tengil dikit.\n\nNgobrol pakai bahasa Indonesia sehari-hari ala Gen Z. Pakai gue/gua dan lo/lu secara natural. Boleh wkwk, gas, nih, kok, lah, anjir kalau cocok, tapi jangan dipaksakan. Jangan terdengar seperti customer service, dosen, artikel, atau bot. Jawab langsung. Kalau diminta bantuan tugas, langsung bantu dan tanya detail seperlunya.\n\nWAJIB: jangan pernah menulis User:, Persona:, User Data:, Student Data:, Acknowledge, Ask for the necessary details, prompt, system instruction, reasoning, checklist internal, atau laporan tentang pesan user. Output cuma jawaban final yang enak dibaca.`;

  try{state.aiMessages=(state.aiMessages||[]).filter(m=>!isLeak(m&&m.text));save();}catch{}

  window.askAI=async function(q){
    const text=String(q||'').trim(); if(!text)return;
    state.aiMessages=state.aiMessages||[];
    state.aiMessages.push({role:'user',text}); save(); render();
    const history=state.aiMessages.slice(-12).filter(m=>m&&m.text&&!isLeak(m.text)).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text)}));
    const send=async messages=>{
      const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:system},...messages],context:context()})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.text)throw new Error(d.error||`AI gagal (HTTP ${r.status})`);
      return String(d.text).trim();
    };
    try{
      let answer=await send(history);
      if(isLeak(answer))answer=await send([{role:'user',content:text}]);
      if(isLeak(answer))throw new Error('AI masih mengirim template internal.');
      state.aiMessages.push({role:'assistant',text:answer});
    }catch(e){state.aiMessages.push({role:'assistant',text:'⚠️ AI lagi ngambek: '+(e.message||'gagal terhubung')});}
    save();render();
  };
})();
