const assert = require('node:assert/strict');
const { createRoutes } = require('../server/routes.cjs');

function response() {
  return {
    headers: {}, status: 0, body: '',
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); },
    end(body = '') { this.body = Buffer.isBuffer(body) ? body.toString() : String(body); }
  };
}

async function main() {
  let securityCalls = 0;
  let requestBody = {};
  let aiRequest;
  const route = createRoutes({
    security: () => { securityCalls += 1; },
    json: (res, status, data) => { res.writeHead(status); res.end(JSON.stringify(data)); },
    binary: () => {}, staticFile: () => false, limited: () => true,
    body: async () => requestBody, fail: (message, status, extra) => Object.assign(new Error(message), { status, ...extra }), safeError: error => error.message,
    text: value => String(value || ''), jobs: new Map(), canvaConfig: () => ({}),
    cookieSession: () => ({}), canvaLogin: async () => {}, canvaCallback: async () => {},
    canvaImport: async () => {}, resumeJob: async () => {}, createJob: async () => 'job-1',
    listModels: async () => ({ selected: 'test-model' }), chatInstruction: () => '',
    gemini: async input => { aiRequest = input; return { text: 'translated', model: 'test-model' }; }, modeInstruction: () => '',
    chat: async () => ({ text: 'ok', model: 'test-model' }), jsonInstruction: () => ({}),
    makeDoc: async () => Buffer.from('docx'), makePdf: async () => Buffer.from('pdf'),
    makePpt: async () => Buffer.from('pptx')
  });

  const readyRes = response();
  await route({ method: 'GET', url: '/api/ready', headers: { host: 'localhost' } }, readyRes);
  assert.equal(readyRes.status, 200);
  assert.deepEqual(JSON.parse(readyRes.body).exports, ['docx', 'pdf', 'pptx']);

  const missingRes = response();
  await route({ method: 'GET', url: '/not-real', headers: { host: 'localhost' } }, missingRes);
  assert.equal(missingRes.status, 404);
  requestBody = { text: 'Halo', from: 'id', to: 'en' };
  const translationRes = response();
  await route({ method: 'POST', url: '/api/translate', headers: { host: 'localhost' } }, translationRes);
  assert.equal(translationRes.status, 200);
  assert.equal(JSON.parse(translationRes.body).text, 'translated');
  assert.match(aiRequest.contents[0].parts[0].text, /Indonesian ke English/);
  requestBody = { text: '   ', from: 'id', to: 'en' };
  const emptyTranslationRes = response();
  await route({ method: 'POST', url: '/api/translate', headers: { host: 'localhost' } }, emptyTranslationRes);
  assert.equal(emptyTranslationRes.status, 400);
  requestBody = { text: 'Hola', from: 'xx', to: 'en' };
  const invalidLanguageRes = response();
  await route({ method: 'POST', url: '/api/translate', headers: { host: 'localhost' } }, invalidLanguageRes);
  assert.equal(invalidLanguageRes.status, 400);
  assert.equal(securityCalls, 5);
  console.log('routes: ok');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
