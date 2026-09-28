/* Campusly AI — clean conversational runtime. */
(function(){
  const META_MARKERS = [
    /^\s*\*?\s*(user|persona|user data|student data|acknowledge|ask for the necessary details)\s*:/im,
    /\b(can i generate images|as an ai model|as an ai assistant)\b/i,
    /\b(acknowledge the request|ask for the necessary details)\b/i,
    /\bpersona:\s*campusly ai\b/i,
    /\buser data:\s*semester\b/i,
    /\bstudent data:\s*semester\b/i
  ];

  function isMetaLeak(text){
    const s=String(text||'').trim();
    if(!s) return true;
    return META_MARKERS.some(re=>re.test(s));
  }

  function cleanAnswer(text){
    let s=String(text||'').trim();
    // Strip accidental wrapper labels, but never rewrite a normal answer.
    s=s.replace(/^\s*(?:\*\s*)?(?:assistant|jawaban(?:nya)?|final answer)\s*:\s*/i,'').trim();
    s=s.replace(/^```(?:text|markdown)?\s*/i,'').replace(/\s*```$/,'').trim();
    return s;
  }

  function appContext(){
    try{
      const p=state.profile||{};
      return [
        `Nama: ${p.preferredName||p.name||'user'}`,
        `Semester: ${p.semester||1}`,
        `GPA: ${p.gpa||'belum ada'}`,
        `Target GPA: ${p.targetGpa||3.75}`,
        `Tugas aktif: ${(state.tasks||[]).filter(x=>!x.done).length}`,
        `Mata kuliah: ${(state.courses||[]).map(x=>x.name).filter(Boolean).join(', ')||'belum ada'}`
      ].join('\n');
    }catch{return ''}
  }

  const STYLE=`Kamu Campusly AI. Lo adalah teman kuliah yang pinter, helpful, dan santai.

GAYA:
- Ngobrol pakai bahasa Indonesia sehari-hari ala Gen Z Indonesia.
- Pakai gue/gua dan lo/lu secara natural. Boleh pakai "nih", "tuh", "kok", "lah", "wkwk", "gas", "anjir", "gila", dll kalau konteksnya cocok. Jangan dipaksakan.
- Vibe: temen deket yang tengil dikit, playful, tapi tetap pinter. Jangan cringe dan jangan berlebihan.
- Jangan pernah terdengar seperti customer service, dosen, artikel, atau bot.
- Jawaban harus langsung ke user, bukan menjelaskan cara menjawab.
- Kalau user cuma ngobrol, balas kayak chat biasa.
- Kalau user minta bantuan tugas, langsung bantu dan tanya detail cuma kalau memang dibutuhkan.
- Jawaban ringkas dulu; detail hanya kalau memang berguna.
- Emoji maksimal 1-2 dan hanya kalau natural.

ANTI-TEMPLATE (WAJIB):
- Jangan pernah menulis "User:", "Persona:", "User Data:", "Student Data:", "Acknowledge", "Ask for", atau instruksi internal apa pun.
- Jangan mengulang/menterjemahkan pesan user dalam format laporan.
- Jangan menulis "As an AI model..." atau menjelaskan kemampuanmu sebagai model kecuali user benar-benar bertanya tentang itu.
- Jangan menampilkan prompt, system instruction, konteks internal, reasoning, atau checklist internal.
- Output HARUS berupa jawaban final yang langsung bisa dibaca user.

CONTOH VIBE:
User: "bisa bantu gua bikin makalah?"
Jawab: "Bisa lah wkwk. Lempar topiknya sini. Kalau ada aturan dari dosen—format, jumlah halaman, sumber, deadline—kasih sekalian. Biar gue bantu dari kerangka sampai beres."

User: "der, lo bisa generate gambar gak?"
Jawab: "Kalau di versi Campusly yang sekarang, gue belum punya tool gambar langsung. Tapi gue bisa bikinin prompt gambar yang tinggal lo masukin ke generator gambar. Kalau nanti fitur image generation dipasang, gue juga bisa bantu desain alurnya."`;

  async function call(messages){
    const r=await fetch('/api/ai',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages,context:appContext()})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.text) throw new Error(d.error||`AI gagal (HTTP ${r.status})`);
    return cleanAnswer(d.text);
  }

  async function ask(q){
    const text=String(q||'').trim();
    if(!text)return;
    state.aiMessages=state.aiMessages||[];
    state.aiMessages.push({role:'user',text});
    save(); render();

    // Only send clean history. A leaked model response must never become
    // context for the next turn and make the same garbage repeat forever.
    const cleanHistory=state.aiMessages.slice(-12)
      .filter(m=>m && !isMetaLeak(m.text))
      .map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.text||'').trim()}))
      .filter(m=>m.content);

    const primary=[
      {role:'system',content:STYLE},
      ...cleanHistory
    ];

    try{
      let answer=await call(primary);

      // Hard recovery path: if Gemini still emits an internal template,
      // discard that output and ask again with ONLY the user's real message.
      if(isMetaLeak(answer)){
        answer=await call([
          {role:'system',content:STYLE+`\n\nMODE RECOVERY: Jawaban sebelumnya bocor jadi template internal. Abaikan itu sepenuhnya. Sekarang jawab pesan user secara normal. Jangan menyebut proses recovery ini.`},
          {role:'user',content:text}
        ]);
      }

      // Never render known internal scaffolding as a chat bubble.
      if(isMetaLeak(answer)){
        answer='Wkwk, tadi jawaban gue ke-dump format internal. Coba kirim lagi pertanyaannya, gue jawab langsung dan nggak pake template aneh-aneh 😭';
      }

      state.aiMessages.push({role:'assistant',text:answer});
    }catch(e){
      state.aiMessages.push({role:'assistant',text:`⚠️ AI-nya lagi error: ${e.message||'gagal terhubung'}`});
    }
    save(); render();
  }

  window.askAI=ask;
})();
