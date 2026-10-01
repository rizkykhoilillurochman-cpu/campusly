const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FileJobStore } = require('../server/job-store.cjs');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'campusly-job-store-'));
  try {
    const file = path.join(directory, 'data', 'jobs.json');
    const first = await new FileJobStore(file).init();
    first.jobs.set('running-1', { id: 'running-1', status: 'running', input: { topic: 'Uji persistensi' }, progress: 45 });
    first.jobs.set('done-1', { id: 'done-1', status: 'done', result: { kind: 'ppt' } });
    await Promise.all([first.save(), first.save()]);

    const restarted = await new FileJobStore(file).init();
    assert.equal(restarted.jobs.get('running-1').status, 'interrupted');
    assert.equal(restarted.jobs.get('running-1').input.topic, 'Uji persistensi');
    assert.equal(restarted.jobs.get('done-1').status, 'done');
    const saved = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(saved.length, 2);

    const sessionFile = path.join(directory, 'data', 'sessions.json');
    const sessions = await new FileJobStore(sessionFile).init();
    sessions.jobs.set('session-1', { id: 'session-1', expiresAt: Date.now() + 60000, canva: { accessToken: 'test-token' } });
    await sessions.save();
    const restoredSessions = await new FileJobStore(sessionFile).init();
    assert.equal(restoredSessions.jobs.get('session-1').canva.accessToken, 'test-token');
    console.log('Persistent jobs, interrupted recovery, and atomic writes passed.');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
