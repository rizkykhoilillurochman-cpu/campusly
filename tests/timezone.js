const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const zone of ['Asia/Jakarta', 'America/Los_Angeles']) {
  const code = "import { localDateKey } from './campusly-dates.js'; console.log(localDateKey(new Date(2026, 0, 1, 0, 30)));";
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: path.join(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '2026-01-01', `local date is correct in ${zone}`);
}
console.log('Local calendar date checks passed in Jakarta and Los Angeles.');
