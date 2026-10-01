const assert = require('node:assert/strict');
const { createPrompts } = require('../server/prompts.cjs');

const prompts = createPrompts();
assert.match(prompts.chatInstruction(), /Campusly AI/);
assert.match(prompts.modeInstruction('translate'), /Terjemahkan hanya teks pengguna/);
assert.match(prompts.modeInstruction('paper'), /Jangan mengarang sumber/);
assert.match(prompts.modeInstruction('ppt'), /JSON schema/);
console.log('prompt module: ok');
