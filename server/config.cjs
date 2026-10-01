const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY = 12 * 1024 * 1024;
const MAX_TEXT = 100000;
const AI_TIMEOUT = 24000;
const MODEL_PREF = String(process.env.GEMINI_MODEL || '').trim();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};
const PUBLIC = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/campusly-bootstrap.js': 'campusly-bootstrap.js',
  '/campusly-store.js': 'campusly-store.js',
  '/campusly-dates.js': 'campusly-dates.js',
  '/campusly-context.js': 'campusly-context.js',
  '/campusly-documents.js': 'campusly-documents.js',
  '/campusly-calculator.js': 'campusly-calculator.js',
  '/campusly-v5.js': 'campusly-v5.js',
  '/campusly-v5.css': 'campusly-v5.css',
  '/campusly-ai-v2.js': 'campusly-ai-v2.js',
  '/campusly-ai-v2.css': 'campusly-ai-v2.css',
  '/manifest.webmanifest': 'manifest.webmanifest',
  '/icon.svg': 'icon.svg'
};

module.exports = { ROOT, PORT, MAX_BODY, MAX_TEXT, AI_TIMEOUT, MODEL_PREF, MIME, PUBLIC };
