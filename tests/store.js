const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function memoryIndexedDB() {
  const stores = new Map();
  const names = new Set();
  let upgraded = false;
  const db = {
    objectStoreNames: { contains: name => names.has(name) },
    createObjectStore(name, options = {}) { names.add(name); stores.set(name, { rows: new Map(), keyPath: options.keyPath }); },
    transaction(namesArg) {
      const tx = { oncomplete: null, onerror: null, onabort: null };
      const queueComplete = () => queueMicrotask(() => tx.oncomplete?.());
      tx.objectStore = name => {
        const store = stores.get(name);
        return {
          get(key) { const request = {}; queueMicrotask(() => { request.result = store.rows.get(key); request.onsuccess?.(); }); return request; },
          getAll() { const request = {}; queueMicrotask(() => { request.result = [...store.rows.values()]; request.onsuccess?.(); }); return request; },
          put(value, key) { store.rows.set(store.keyPath ? value[store.keyPath] : key, value); queueComplete(); },
          delete(key) { store.rows.delete(key); queueComplete(); },
          clear() { store.rows.clear(); queueComplete(); }
        };
      };
      return tx;
    }
  };
  return { open: () => { const request = {}; queueMicrotask(() => { request.result = db; if (!upgraded) { upgraded = true; request.onupgradeneeded?.(); } request.onsuccess?.(); }); return request; }, db };
}

function boot(seed = {}, indexedDB = null) {
  const values = new Map(Object.entries(seed));
  const listeners = new Map();
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    dispatchEvent: () => true,
    ...(indexedDB ? { indexedDB } : {})
  };
  const context = {
    window,
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    },
    structuredClone,
    navigator: {},
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init.detail; },
    console,
    Date,
    JSON,
    Object,
    Array
  };
  if (indexedDB) context.indexedDB = indexedDB;
  const source = fs.readFileSync(require.resolve('../campusly-store.js'), 'utf8').replace('export const CampuslyStore = window.CampuslyStore;', '');
  vm.runInNewContext(source, context);
  return { store: window.CampuslyStore, values, listeners };
}

(async () => {
  const legacy = boot({ campusly_state_v6: JSON.stringify({ tasks: [{ id: 'old', title: 'Tugas lama' }], ai: [{ role: 'user', text: 'Riwayat' }] }) });
  await legacy.store.ready;
  assert.equal(legacy.store.read().schemaVersion, 7);
  assert.equal(legacy.store.read().tasks[0].id, 'old');
  assert.equal(typeof legacy.store.read().tasks[0].updatedAt, 'string');
  assert.equal(legacy.store.read().tasks[0].deletedAt, null);
  assert.equal(JSON.parse(legacy.values.get('campusly_state_v7')).ai[0].text, 'Riwayat');
  const fallbackDocument = await legacy.store.putDocument({ id: 'fallback-doc', title: 'Dokumen lokal' });
  assert.equal(fallbackDocument.title, 'Dokumen lokal');
  assert.equal((await legacy.store.listDocuments()).length, 1);
  assert.equal(await legacy.store.deleteDocument('fallback-doc'), true);

  legacy.store.writeAI({ ai: [{ role: 'assistant', text: 'Jawaban' }], settings: { aiContextEnabled: false } });
  legacy.store.writeApp({ ...legacy.store.read(), tasks: [
    { ...legacy.store.read().tasks[0], title: 'Tugas diperbarui', updatedAt: '2000-01-01T00:00:00.000Z' },
    { id: 'new', title: 'Tugas baru' }
  ] });
  await legacy.store.flush();
  const saved = legacy.store.read();
  assert.equal(saved.ai[0].text, 'Jawaban');
  assert.equal(saved.settings.aiContextEnabled, false);
  assert.equal(saved.tasks.length, 2);
  assert.notEqual(saved.tasks.find(item => item.id === 'old').updatedAt, '2000-01-01T00:00:00.000Z');
  legacy.store.writeApp({ ...saved, tasks: [saved.tasks.find(item => item.id === 'new')] });
  await legacy.store.flush();
  assert.deepEqual(legacy.store.read().tasks.map(item => item.id), ['new']);
  assert.ok(JSON.parse(legacy.values.get('campusly_state_v7')).tasks.find(item => item.id === 'old').deletedAt);
  assert.throws(() => legacy.store.replace({ schemaVersion: 7, tasks: 'not-an-array' }), /tidak valid/);

  const remoteState = { schemaVersion: 7, tasks: [{ id: 'remote' }] };
  legacy.values.set('campusly_state_v7', JSON.stringify(remoteState));
  await legacy.listeners.get('storage')({ key: 'campusly_state_v7_signal', newValue: 'remote' });
  assert.equal(legacy.store.read().tasks[0].id, 'remote');
  legacy.store.clear();
  await legacy.store.flush();
  assert.deepEqual(legacy.store.read().tasks, []);
  assert.deepEqual(JSON.parse(legacy.values.get('campusly_state_v7')).tasks, []);

  const disk = memoryIndexedDB();
  const persistent = boot({}, disk);
  await persistent.store.ready;
  persistent.store.writeApp({ ...persistent.store.read(), tasks: [{ id: 'disk-task' }] });
  await persistent.store.flush();
  const document = await persistent.store.putDocument({ id: 'paper-1', title: 'Makalah', body: 'Isi panjang'.repeat(80) });
  assert.equal(document.title, 'Makalah');
  assert.equal((await persistent.store.listDocuments()).length, 1);
  const snapshot = await persistent.store.exportSnapshot();
  assert.equal(snapshot.documents[0].id, 'paper-1');
  await persistent.store.saveRecoverySnapshot(snapshot);
  await persistent.store.replaceDocuments([{ id: 'paper-2', title: 'Dipulihkan' }]);
  assert.equal((await persistent.store.listDocuments())[0].id, 'paper-2');
  await persistent.store.replaceDocuments(snapshot.documents);
  assert.throws(() => persistent.store.replace({ documents: [{ title: 'Tanpa ID' }] }), /dokumen.*tidak valid/i);
  assert.equal(await persistent.store.deleteDocument('paper-1'), true);
  assert.equal((await persistent.store.listDocuments()).length, 0);
  const restored = boot({}, disk);
  await restored.store.ready;
  assert.equal(restored.store.read().tasks[0].id, 'disk-task');
  assert.equal(persistent.values.has('campusly_state_v7'), false);
  console.log('Shared store migration, ownership, IndexedDB documents, fallback, and cross-tab sync passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
