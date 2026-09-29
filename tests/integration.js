const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const port = Number(process.env.TEST_PORT || 8899);
const corePort = port + 1;
const root = path.join(__dirname, '..');

function req(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const r = http.request({
      hostname: '127.0.0.1', port, path: pathname, method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => { let parsed = text; try { parsed = text ? JSON.parse(text) : null; } catch {} resolve({ status: res.statusCode, headers: res.headers, body: parsed }); });
    });
    r.on('error', reject); if (payload) r.write(payload); r.end();
  });
}

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    try { if ((await req('GET', '/api/health')).status === 200) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server start timeout');
}

(async () => {
  const child = spawn(process.execPath, ['campusly-production-server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), CORE_PORT: String(corePort), GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  try {
    await waitForServer();
    let r = await req('GET', '/');
    if (r.status !== 200 || !String(r.body).includes('Campusly')) throw new Error('canonical shell');
    r = await req('GET', '/campusly-v5.js?v=test');
    if (r.status !== 200 || !String(r.body).includes('campusly_state_v5') || !String(r.body).includes('Jadwal')) throw new Error('canonical frontend');
    if (String(r.body).includes('Generate gambar') || String(r.body).includes('imageModal')) throw new Error('image generator still exposed in frontend');
    r = await req('GET', '/campusly-v5.css?v=test');
    if (r.status !== 200 || !String(r.body).includes('--accent') || !String(r.body).includes('.back-btn')) throw new Error('canonical stylesheet');
    r = await req('GET', '/manifest.webmanifest?v=test');
    if (r.status !== 200 || r.body.short_name !== 'Campusly') throw new Error('manifest');
    for (const legacy of ['/app.js','/styles.css','/sw.js','/sw-v29.js','/sw-v30.js','/campusly-v5-final.js','/developer-contact.js','/runtime-fix.js']) {
      r = await req('GET', legacy); if (r.status !== 404) throw new Error(`legacy path still exposed: ${legacy}`);
    }
    r = await req('GET', '/api/health'); if (r.status !== 200 || !r.body.ok) throw new Error('health');
    r = await req('GET', '/api/ready'); if (r.status !== 200 || !r.body.ready) throw new Error('ready');
    r = await req('GET', '/api/ai/health'); if (r.status !== 200 || !r.body.ok || r.body.imageGeneration !== false) throw new Error('AI health');
    r = await req('POST', '/api/ai', { messages: [{ role: 'user', content: 'halo' }] }); if (r.status !== 503) throw new Error('AI missing-key guard');
    r = await req('POST', '/api/ai/image', { prompt: 'test' }); if (r.status !== 404) throw new Error('image endpoint still exposed');
    r = await req('POST', '/api/export/pdf', { title: 'Tes', content: 'Campusly PDF export test' }); if (r.status !== 200 || !String(r.headers['content-type']).includes('application/pdf')) throw new Error('PDF export');
    r = await req('POST', '/api/export/ppt', { title: 'Tes', content: 'SLIDE 1: Campusly\n- Test export' }); if (r.status !== 200 || !String(r.headers['content-type']).includes('presentationml.presentation')) throw new Error('PPTX export');
    console.log('Campusly integration tests: PASS');
  } catch (error) {
    console.error('Campusly integration tests: FAIL', error.message); if (logs) console.error(logs); process.exitCode = 1;
  } finally { child.kill('SIGTERM'); }
})();
