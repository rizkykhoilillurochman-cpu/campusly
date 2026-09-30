/* Campusly startup: normalize the AI model before loading the single production server. */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'campusly-production-server.js');
const source = fs.readFileSync(serverPath, 'utf8');
const model = 'gemini-3.7-flash';
const marker = /const MODEL = ['\"][^'\"]+['\"];?/;

if (!marker.test(source)) {
  throw new Error('Campusly startup: MODEL declaration not found; refusing to start with an unknown AI configuration.');
}

const patched = source.replace(marker, `const MODEL = process.env.GEMINI_MODEL = '${model}';`);
if (patched === source) {
  throw new Error('Campusly startup: AI model normalization did not change the server source.');
}

fs.writeFileSync(serverPath, patched, 'utf8');
console.log(`Campusly AI model locked to ${model} (Gemini 3 stable/free tier).`);
require(serverPath);
