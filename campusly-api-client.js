/* Campusly — canonical API client boundary.
 * Normalizes AI requests and guarantees text responses never expose HTML documents.
 */
(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const htmlDoc=/<(?:!doctype\s+html|html[\s>]|head[\s>]|body[\s>])/i;
  const strip=s=>{
    let v=String(s??'').replace(/```(?:html|xml|markdown|md|text|javascript|js)?/gi,'').replace(/```/g,'').trim();
    if(!htmlDoc.test(v)) return v;
    const body=v.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]||v;
    return body.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s{2,}/g,' ').trim();
  };
  const infer=b=>{
    const raw=String(b.mode||b.type||b.feature||b.task||'').toLowerCase();
    if(/translate|terjemah/.test(raw)) return 'translate';
    if(/ppt|powerpoint|present/.test(raw)) return 'ppt';
    if(/paper|makalah|essay|artikel/.test(raw)) return 'paper';
    return 'chat';
  };
  const normalize=b=>{
    const x={...(b||{})},mode=infer(x); x.mode=mode;
    if(!Array.isArray(x.messages)||!x.messages.length){
      const source=x.prompt??x.text??x.content??x.question??x.topic??x.input??'';
      if(String(source).trim()) x.messages=[{role:'user',content:String(source)}];
    }
    if(mode==='translate' && x.messages?.[0]){
      const source=x.messages[0].content;
      const from=x.sourceLanguage||x.from||''; const to=x.targetLanguage||x.to||'';
      x.messages[0].content=`Terjemahkan teks berikut${from?` dari ${from}`:''}${to?` ke ${to}`:''}. Pertahankan makna dan format. Jangan beri komentar tambahan.\n\n${source}`;
    }
    if(mode==='paper' && x.messages?.[0]) x.messages[0].content=`Susun makalah akademik berdasarkan permintaan berikut. Hasil harus teks biasa/Markdown akademik, bukan HTML/XML/JavaScript.\n\n${x.messages[0].content}`;
    if(mode==='ppt' && x.messages?.[0]) x.messages[0].content=`Susun materi presentasi berdasarkan permintaan berikut. Hasil harus teks biasa dengan format SLIDE 1: ... lalu bullet dan VISUAL:, bukan HTML/XML/JavaScript.\n\n${x.messages[0].content}`;
    return x;
  };
  const apiUrl=u=>{try{return new URL(u,location.href).pathname}catch{return String(u||'')}};
  window.fetch=async function(input,init={}){
    const url=apiUrl(typeof input==='string'?input:input?.url);
    if(!/^\/api\/(?:ai|chat|translate|generate\/(?:paper|ppt)|export\/)/.test(url)) return nativeFetch(input,init);
    let opts={...init};
    if(input instanceof Request && !init.body){opts.method=input.method;opts.headers=input.headers;opts.body=input.body;}
    if(/^POST$/i.test(opts.method||'GET') && opts.body && typeof opts.body==='string'){
      try{
        const body=JSON.parse(opts.body);
        if(/^\/api\/(?:ai|chat|translate|generate\/paper|generate\/ppt)$/.test(url)) opts.body=JSON.stringify(normalize(body));
      }catch{}
    }
    const response=await nativeFetch(input,opts);
    if(!/^\/api\/(?:ai|chat|translate|generate\/paper|generate\/ppt)$/.test(url)) return response;
    try{
      const data=await response.clone().json();
      if(data && typeof data.text==='string') data.text=strip(data.text);
      if(data && typeof data.content==='string') data.content=strip(data.content);
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers:response.headers});
    }catch{
      try{
        const raw=await response.clone().text();
        if(htmlDoc.test(raw)) return new Response(JSON.stringify({ok:false,error:'Server mengembalikan HTML, bukan respons AI. Silakan coba lagi setelah deployment selesai.'}),{status:502,headers:{'Content-Type':'application/json; charset=utf-8'}});
      }catch{}
      return response;
    }
  };
})();
