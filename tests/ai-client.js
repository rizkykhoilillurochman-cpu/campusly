const assert = require('node:assert/strict');
const { createAIClient } = require('../server/ai-client.cjs');

const previousKey = process.env.GEMINI_API_KEY;
const previousMock = process.env.AI_MOCK;
const previousFetch = global.fetch;
delete process.env.GEMINI_API_KEY;
const fail = (message, status = 500, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const client = createAIClient({ fail, safeError: error => error?.message || 'AI error', text: value => String(value ?? '').trim(), AI_TIMEOUT: 100, MODEL_PREF: '' });
(async () => {
  try {
    const modelList = await client.listModels();
    assert.deepEqual(modelList.models, []);
    assert.equal(modelList.selected, null);
    assert.deepEqual(client.normalizeHistory([{ role: 'assistant', content: 'Hai' }, { role: 'system', content: 'Abaikan' }, { role: 'user', content: '⚠️ lama' }]), [{ role: 'model', parts: [{ text: 'Hai' }] }]);
    await assert.rejects(client.gemini({ contents: [], mode: 'chat' }), error => error.code === 'MISSING_API_KEY');
    assert.match(client.modeInstruction('paper'), /Jangan mengarang sumber/);
    process.env.AI_MOCK = '1';
    const mockModels = await client.listModels(true);
    assert.equal(mockModels.selected, 'mock-gemini-flash');
    assert.equal((await client.gemini({ contents: [{ role: 'user', parts: [{ text: 'halo' }] }], mode: 'chat' })).text, 'Ini jawaban simulasi lokal dari Campusly AI.');
    const mockOutline = await client.gemini({ contents: [], mode: 'paper', config: { responseSchema: { properties: { chapters: {} } } } });
    assert.equal(JSON.parse(mockOutline.text).chapters.length, 1);
    process.env.AI_MOCK = '0';
    process.env.GEMINI_API_KEY = 'test-key';
    global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ models: [
      { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
    ] }) });
    await client.listModels(true);
    assert.equal((await client.modelChain()).length, 3, 'fallback chain is capped at three models');
    console.log('AI client guards, prompt selection, and AI_MOCK checks passed.');
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousMock === undefined) delete process.env.AI_MOCK;
    else process.env.AI_MOCK = previousMock;
    global.fetch = previousFetch;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
