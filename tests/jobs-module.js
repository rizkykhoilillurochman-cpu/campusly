const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createJobs } = require('../server/jobs.cjs');

const jobs = new Map();
let saves = 0;
const fail = (message, status, extra) => Object.assign(new Error(message), { status, ...extra });
const manager = createJobs({
  crypto: { randomUUID }, fail, safeError: error => error.message,
  jobStore: { save: async () => { saves += 1; } }, jobs,
  buildPaper: async (input, progress) => { progress('outline', 'Menyusun…'); return { document: { title: input.topic }, groundingOk: true }; },
  buildPpt: async input => ({ document: { title: input.topic } }),
  concurrency: 1, maxJobs: 2
});

async function waitFor(job) {
  for (let i = 0; i < 50 && job.status !== 'done'; i++) await new Promise(resolve => setTimeout(resolve, 2));
}

(async () => {
  const id = await manager.createJob('paper', { topic: 'Uji' });
  const job = jobs.get(id);
  await waitFor(job);
  assert.equal(job.status, 'done');
  assert.deepEqual(job.result.document, { title: 'Uji' });
  assert.equal(job.input, undefined);
  assert.ok(saves >= 3);

  jobs.set('interrupted-1', { id: 'interrupted-1', status: 'interrupted', input: { topic: 'Lanjut' } });
  await manager.resumeJob('interrupted-1');
  await waitFor(jobs.get('interrupted-1'));
  assert.equal(jobs.get('interrupted-1').status, 'done');
  await assert.rejects(manager.createJob('paper', {}), error => error.code === 'JOB_QUEUE_FULL');
  console.log('job coordinator, resume, concurrency cap, and capacity checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
