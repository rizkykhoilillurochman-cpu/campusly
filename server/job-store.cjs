const fs = require('node:fs/promises');
const path = require('node:path');

class FileJobStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.jobs = new Map();
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) throw new Error('Job database format is invalid.');
      for (const job of rows) {
        if (!job || typeof job.id !== 'string') continue;
        if (job.status === 'queued' || job.status === 'running') {
          job.status = 'interrupted';
          job.stage = 'interrupted';
          job.message = 'Proses terhenti saat server dimulai ulang. Kamu bisa lanjutkan.';
        }
        this.jobs.set(job.id, job);
      }
      await this.save();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save();
    }
    return this;
  }

  save() {
    const snapshot = JSON.stringify([...this.jobs.values()]);
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      try {
        await fs.writeFile(tempPath, snapshot, { encoding: 'utf8', mode: 0o600 });
        await fs.rename(tempPath, this.filePath);
      } catch (error) {
        await fs.rm(tempPath, { force: true }).catch(() => {});
        throw error;
      }
    });
    return this.writeQueue;
  }
}

module.exports = { FileJobStore };
