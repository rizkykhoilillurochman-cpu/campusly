const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const code = `import { buildAIContext } from './campusly-context.js';
const date = new Date(2026, 0, 5, 12);
const context = buildAIContext({profile:{name:'Nama Lengkap',preferredName:'Riz',major:'Informatika',semester:3,nim:'RAHASIA'},tasks:[
 {id:'late',title:'Telat',deadline:'2026-01-04'}, {id:'today',title:'Hari ini',deadline:'2026-01-05'},
 {id:'tomorrow',title:'Besok',deadline:'2026-01-06'}, {id:'later',title:'Nanti',deadline:'2026-02-01'},
 {id:'done',title:'Selesai',deadline:'2026-01-05',done:true}, {id:'deleted',title:'Terhapus',deadline:'2026-01-05',deletedAt:'2026-01-01'}
],schedule:[{name:'Senin',day:'Senin',start:'08:00'},{name:'Selasa',day:'Selasa',start:'09:00'},{name:'Rabu',day:'Rabu',start:'10:00'}]},date);
if(context.data.tasks.length!==3 || context.data.schedule.length!==2 || 'nim' in context.data.profile || 'name' in context.data.profile || context.summary.scheduleTodayCount!==1) process.exit(1);
console.log(context.json);`;
for (const zone of ['Asia/Jakarta', 'America/Los_Angeles']) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: path.join(__dirname, '..'), env: { ...process.env, TZ: zone }, encoding: 'utf8' });
  assert.equal(result.status, 0, `${zone}: ${result.stderr}`);
  const value = JSON.parse(result.stdout.trim());
  assert.equal(value.profile.preferredName, 'Riz');
  assert.ok(!result.stdout.includes('RAHASIA'));
}
console.log('AI context minimization and schedule/task relevance checks passed.');
