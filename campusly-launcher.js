// Campusly production launcher.
// One canonical AI process, with a free-first model policy, bounded retries,
// and a small serialized provider queue so mobile double-taps do not create
// a burst of concurrent Gemini requests.

const PRIMARY = 'gemini-3.5-flash-lite';
const FALLBACKS = 'gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash';

// Ignore stale Render env model values such as gemini-2.5-*.
process.env.GEMINI_MODEL = PRIMARY;
process.env.GEMINI_FALLBACK_MODELS = FALLBACKS;
process.env.GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash';
process.env.GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

const nativeFetch = global.fetch;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let geminiTail = Promise.resolve();
let queueDepth = 0;
const MAX_QUEUE = 8;

function isGemini(url) {
  return String(url || '').includes('generativelanguage.googleapis.com');
}

async function fetchGemini(url, options) {
  if (queueDepth >= MAX_QUEUE) {
    const error = new Error('AI sedang menerima banyak permintaan. Coba lagi beberapa detik.');
    error.status = 429;
    throw error;
  }
  queueDepth++;

  const run = async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await nativeFetch(url, options);
          if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) return response;
          const retryAfter = Number(response.headers.get('retry-after') || 0);
          await sleep(Math.max(retryAfter * 1000, 650));
        } catch (error) {
          if (attempt === 1) throw error;
          await sleep(650);
        }
      }
    } finally {
      queueDepth--;
    }
  };

  const next = geminiTail.then(run, run);
  geminiTail = next.then(() => undefined, () => undefined);
  return next;
}

global.fetch = (url, options) => isGemini(url) ? fetchGemini(url, options) : nativeFetch(url, options);

require('./campusly-server.js');
