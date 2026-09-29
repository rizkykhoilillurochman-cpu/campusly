// Campusly production launcher — one canonical server, free-first text AI,
// and a lightweight image fallback when the primary image endpoint is busy.
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
process.env.GEMINI_FALLBACK_MODELS = process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.1-flash-lite,gemini-3.5-flash,gemini-3.8-flash';
process.env.GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

const nativeFetch=global.fetch;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const retryable=new Set([429,500,502,503,504]);
global.fetch=async(url,options)=>{
  const u=String(url||'');
  if(!u.includes('generativelanguage.googleapis.com'))return nativeFetch(url,options);
  let response=await nativeFetch(url,options);
  if(retryable.has(response.status)){
    await sleep(500);
    response=await nativeFetch(url,options);
  }
  if(retryable.has(response.status)&&u.includes('/gemini-3.1-flash-image:generateContent')){
    const fallback=u.replace('/gemini-3.1-flash-image:generateContent','/gemini-3.1-flash-lite-image:generateContent');
    response=await nativeFetch(fallback,options);
  }
  return response;
};
require('./campusly-server.js');
