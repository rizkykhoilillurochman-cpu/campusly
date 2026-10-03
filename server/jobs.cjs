function createJobs({ crypto, fail, safeError, jobStore, jobs, buildPaper, buildPpt, concurrency = 2, maxJobs = 30 }) {
  const queue = [];
  let active = 0;

  function persistJobs() {
    return jobStore.save().catch(error => console.error('JOB_STORE_WRITE_FAILED', error.message));
  }

  async function runJob(job) {
    job.status = 'running';
    await persistJobs();
    try {
      if (job.kind === 'paper') {
        const result = await buildPaper(job.input, (stage, message) => {
          job.stage = stage;
          job.message = message;
          job.progress = stage === 'outline' ? 15 : stage === 'chapter' ? 45 : stage === 'references' ? 70 : 90;
          void persistJobs();
        });
        job.result = { kind: 'paper', document: result.document, groundingOk: result.groundingOk };
      } else {
        const result = await buildPpt(job.input, (stage, message) => {
          job.stage = stage;
          job.message = message;
          job.progress = stage === 'outline' ? 35 : 70;
          void persistJobs();
        });
        job.result = { kind: 'ppt', document: result.document || result };
      }
      job.status = 'done';
      job.progress = 100;
      job.stage = 'done';
      job.message = 'Selesai.';
      delete job.input;
    } catch (error) {
      job.status = 'error';
      job.error = safeError(error);
      job.stage = 'error';
      job.message = job.error;
    }
    await persistJobs();
  }

  function pump() {
    while (active < concurrency && queue.length) {
      const id = queue.shift();
      const job = jobs.get(id);
      if (!job || job.status !== 'queued') continue;
      active += 1;
      runJob(job).finally(() => { active -= 1; pump(); });
    }
  }

  async function createJob(kind, input) {
    if (jobs.size >= maxJobs) throw fail('Antrean generate sedang penuh. Coba lagi sebentar.', 429, { code: 'JOB_QUEUE_FULL' });
    const id = crypto.randomUUID();
    const job = { id, kind, input, status: 'queued', progress: 0, stage: 'queued', message: 'Menunggu antrean…', createdAt: Date.now(), expiresAt: Date.now() + 30 * 60 * 1000, result: null, error: null };
    jobs.set(id, job);
    try { await jobStore.save(); }
    catch {
      jobs.delete(id);
      throw fail('Penyimpanan job sedang bermasalah. Coba lagi sebentar.', 503, { code: 'JOB_STORE_UNAVAILABLE' });
    }
    queue.push(id);
    pump();
    return id;
  }

  async function resumeJob(id) {
    const job = jobs.get(id);
    if (!job) throw fail('Job tidak ditemukan atau sudah kedaluwarsa.', 404, { code: 'JOB_NOT_FOUND' });
    if (job.status !== 'interrupted') throw fail('Job ini tidak perlu dilanjutkan.', 409, { code: 'JOB_NOT_INTERRUPTED' });
    if (!job.input) throw fail('Data untuk melanjutkan job tidak tersedia.', 409, { code: 'JOB_INPUT_MISSING' });
    job.status = 'queued';
    job.stage = 'queued';
    job.error = null;
    job.message = 'Dimasukkan lagi ke antrean…';
    job.expiresAt = Date.now() + 30 * 60 * 1000;
    await jobStore.save();
    queue.push(job.id);
    pump();
    return job.id;
  }

  function interruptAll() {
    for (const job of jobs.values()) {
      if (job.status !== 'queued' && job.status !== 'running') continue;
      job.status = 'interrupted';
      job.stage = 'interrupted';
      job.message = 'Proses terhenti saat server dimulai ulang. Kamu bisa lanjutkan.';
    }
  }

  return { createJob, resumeJob, persistJobs, interruptAll, get activeCount() { return active; } };
}

module.exports = { createJobs };
