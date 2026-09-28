// Campusly production launcher.
// Keeps the canonical server, but hardens Gemini access against legacy Render
// model env values, temporary capacity spikes, and bursty mobile retries.

const PRIMARY = 'gemini-3.5-flash-lite';
const FALLBACKS = 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash';

// Old Render environments may still contain gemini-2.5-* or gemini-3.7-*.
// For the free/high-throughput path, Campusly deliberately starts on 3.5 Flash-Lite.
process.env.GEMINI_MODEL = PRIMARY;
process.env.GEMINI_FALLBACK_MODELS = FALLBACKS;
process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';
process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

const nativeFetch = global.fetch;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let geminiTail = Promise.resolve();

function isGemini(url) {
  return String(url || '').includes('generativelanguage.googleapis.com');
}

async function fetchGemini(url, options) {
  const run = async () => {
    let last;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await nativeFetch(url, options);
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
        last = response;
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        await sleep(Math.max(retryAfter * 1000, 900 * (attempt + 1)));
      } catch (error) {
        if (attempt === 2) throw error;
        last = error;
        await sleep(900 * (attempt + 1));
      }
    }
    return last;
  };

  // Serialize Gemini calls so three rapid taps on mobile do not become three
  // simultaneous provider requests and immediately burn the project's RPM.
  const next = geminiTail.then(run, run);
  geminiTail = next.then(() => undefined, () => undefined);
  return next;
}

global.fetch = (url, options) => isGemini(url) ? fetchGemini(url, options) : nativeFetch(url, options);

require('./campusly-server.js');
