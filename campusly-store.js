/**
 * Shared, versioned client state. Keep this script ahead of both UI entrypoints.
 * @typedef {{id: string, updatedAt: string, deletedAt: string|null}} EntityMetadata
 * @typedef {{schemaVersion: 7, profile: object, settings: object, tasks: EntityMetadata[], schedule: EntityMetadata[], events: EntityMetadata[], notes: EntityMetadata[], finance: EntityMetadata[], grades: EntityMetadata[], translations: EntityMetadata[], ai: object[], documents: object[]}} CampuslyState
 */
(() => {
  'use strict';

  const KEY = 'campusly_state_v7';
  const SIGNAL_KEY = 'campusly_state_v7_signal';
  const DB_NAME = 'campusly-local';
  const DB_VERSION = 2;
  const STATE_STORE = 'state';
  const DOCUMENT_STORE = 'documents';
  const BACKUP_STORE = 'backups';
  const LEGACY_KEYS = ['campusly_state_v6', 'campusly_state_v5'];
  const defaults = {
    schemaVersion: 7,
    profile: { name: '', preferredName: '', university: '', major: '', faculty: '', nim: '', semester: 1, gpa: '', targetGpa: 3.75, completed: false },
    settings: { theme: 'dark', notifications: true, aiContextEnabled: true },
    tasks: [], schedule: [], events: [], notes: [], finance: [], grades: [], translations: [], ai: [], documents: []
  };

  const clone = value => structuredClone(value);
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const collections = ['tasks', 'schedule', 'events', 'notes', 'finance', 'grades', 'translations'];
  const active = value => {
    const result = clone(value);
    for (const name of collections) result[name] = result[name].filter(item => !item.deletedAt);
    return result;
  };
  function merge(base, incoming) {
    for (const [key, value] of Object.entries(incoming || {})) {
      if (object(value) && object(base[key])) merge(base[key], value);
      else base[key] = value;
    }
    return base;
  }
  function readRaw() {
    try {
      const current = localStorage.getItem(KEY);
      if (current) return JSON.parse(current);
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) return JSON.parse(legacy);
      }
    } catch (error) {
      console.warn('Campusly: state rusak, memakai state kosong.', error);
    }
    return {};
  }
  function normalize(value) {
    const data = merge(clone(defaults), object(value) ? value : {});
    data.schemaVersion = 7;
    delete data.reminders;
    data.settings.aiContextEnabled = data.settings.aiContextEnabled !== false;
    const now = new Date().toISOString();
    for (const collection of collections) {
      if (!Array.isArray(data[collection])) data[collection] = [];
      data[collection] = data[collection].filter(object).map(item => ({
        ...item,
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
        deletedAt: typeof item.deletedAt === 'string' ? item.deletedAt : null
      }));
    }
    return data;
  }

  let state = normalize(readRaw());
  let database = null;
  let localFallback = true;
  let revision = 0;
  let writeQueue = Promise.resolve();
  const listeners = new Set();

  function notify(meta = {}) {
    const snapshot = active(state);
    for (const callback of listeners) callback(snapshot, meta);
    window.dispatchEvent(new CustomEvent('campusly:state', { detail: { state: snapshot, revision, ...meta } }));
  }
  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB tidak tersedia.'));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
        if (!db.objectStoreNames.contains(DOCUMENT_STORE)) db.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(BACKUP_STORE)) db.createObjectStore(BACKUP_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Database lokal tidak bisa dibuka.'));
      request.onblocked = () => reject(new Error('Database lokal sedang dipakai tab lain.'));
    });
  }
  function readDatabase(db) {
    return new Promise((resolve, reject) => {
      const request = db.transaction(STATE_STORE, 'readonly').objectStore(STATE_STORE).get('root');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('State lokal tidak bisa dibaca.'));
    });
  }
  function writeDatabase(db, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      tx.objectStore(STATE_STORE).put(value, 'root');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('State lokal tidak bisa disimpan.'));
      tx.onabort = () => reject(tx.error || new Error('Penyimpanan lokal dibatalkan.'));
    });
  }
  function announceChange() {
    try { localStorage.setItem(SIGNAL_KEY, `${Date.now()}-${Math.random()}`); } catch { /* IndexedDB remains the source of truth. */ }
  }
  const ready = (async () => {
    try {
      database = await openDatabase();
      const stored = await readDatabase(database);
      if (stored) state = normalize(stored);
      else await writeDatabase(database, state); // One-time import from v5/v6/local snapshot.
      localFallback = false;
      for (const key of LEGACY_KEYS) localStorage.removeItem(key);
      localStorage.removeItem(KEY);
      const persistenceRequest = navigator.storage?.persist?.();
      persistenceRequest?.catch(() => false);
    } catch (error) {
      database = null;
      localFallback = true;
      console.info('Campusly memakai penyimpanan browser cadangan.', error.message);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* The UI can still run for this session. */ }
    }
    return true;
  })();

  function persist(next, { replace = false } = {}) {
    const previous = state;
    const normalized = normalize(next);
    const now = new Date().toISOString();
    if (!replace) for (const name of collections) {
      const incoming = new Map(normalized[name].map(item => [item.id, item]));
      for (const old of previous[name]) {
        const current = incoming.get(old.id);
        if (!current) {
          if (!old.deletedAt) normalized[name].push({ ...old, updatedAt: now, deletedAt: now });
          else normalized[name].push(old);
          continue;
        }
        const comparable = item => {
          const result = { ...item };
          delete result.updatedAt;
          delete result.deletedAt;
          return JSON.stringify(result);
        };
        if (comparable(old) !== comparable(current)) current.updatedAt = now;
      }
      normalized[name] = [...new Map(normalized[name].map(item => [item.id, item])).values()];
    }
    state = normalized;
    revision++;
    const snapshot = clone(state);
    writeQueue = writeQueue.then(async () => {
      await ready;
      if (database && !localFallback) {
        try { await writeDatabase(database, snapshot); announceChange(); return; }
        catch (error) {
          console.error('Campusly: IndexedDB gagal, pindah ke penyimpanan cadangan.', error);
          localFallback = true;
        }
      }
      try { localStorage.setItem(KEY, JSON.stringify(snapshot)); announceChange(); }
      catch (error) { console.error('Campusly: state tidak bisa disimpan.', error); }
    });
    notify();
    return state;
  }
  function appWrite(next) {
    // The main app owns domain data. AI owns its conversation and its context toggle.
    const ai = state.ai;
    const aiContextEnabled = state.settings.aiContextEnabled;
    const merged = merge(clone(state), next);
    merged.ai = ai;
    merged.settings.aiContextEnabled = aiContextEnabled;
    return persist(merged);
  }
  function aiWrite(next) {
    const latest = clone(state);
    latest.ai = Array.isArray(next.ai) ? next.ai : state.ai;
    latest.settings.aiContextEnabled = next.settings?.aiContextEnabled ?? state.settings.aiContextEnabled;
    return persist(latest);
  }
  window.CampuslyStore = Object.freeze({
    key: KEY,
    ready,
    flush: () => ready.then(() => writeQueue),
    read: () => active(state),
    writeApp: appWrite,
    writeAI: aiWrite,
    replace(value) {
      if (!object(value)) throw new TypeError('Format cadangan tidak valid.');
      if (Number(value.schemaVersion || 0) > 7) throw new TypeError('Cadangan dibuat oleh versi Campusly yang lebih baru.');
      for (const name of ['profile', 'settings']) if (value[name] !== undefined && !object(value[name])) throw new TypeError(`Bagian ${name} di cadangan tidak valid.`);
      for (const name of collections) if (value[name] !== undefined && (!Array.isArray(value[name]) || value[name].length > 10000 || value[name].some(item => !object(item)))) throw new TypeError(`Daftar ${name} di cadangan tidak valid.`);
      if (value.documents !== undefined && (!Array.isArray(value.documents) || value.documents.length > 1000 || value.documents.some(item => !object(item) || typeof item.id !== 'string'))) throw new TypeError('Daftar dokumen di cadangan tidak valid.');
      return persist(value, { replace: true });
    },
    async exportSnapshot() {
      await ready;
      return { ...clone(active(state)), documents: await this.listDocuments() };
    },
    async replaceDocuments(documents) {
      await ready;
      if (!Array.isArray(documents) || documents.length > 1000 || documents.some(item => !object(item) || typeof item.id !== 'string')) throw new TypeError('Daftar dokumen di cadangan tidak valid.');
      if (!database || localFallback) {
        const next = clone(state); next.documents = clone(documents); persist(next); await this.flush(); return;
      }
      await new Promise((resolve, reject) => {
        const tx = database.transaction(DOCUMENT_STORE, 'readwrite'), store = tx.objectStore(DOCUMENT_STORE);
        store.clear(); for (const item of documents) store.put(item);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('Dokumen cadangan tidak bisa dipulihkan.'));
        tx.onabort = () => reject(tx.error || new Error('Pemulihan dokumen dibatalkan.'));
      });
    },
    async saveRecoverySnapshot(snapshot) {
      await ready;
      if (!database || localFallback) { try { localStorage.setItem('campusly_recovery_v1', JSON.stringify(snapshot)); } catch { throw new Error('Ruang penyimpanan untuk titik pemulihan tidak cukup.'); } return; }
      await new Promise((resolve, reject) => {
        const tx = database.transaction(BACKUP_STORE, 'readwrite');
        tx.objectStore(BACKUP_STORE).put(snapshot, 'before-import');
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error || new Error('Titik pemulihan tidak bisa disimpan.'));
      });
    },
    clear() {
      for (const key of [KEY, SIGNAL_KEY, ...LEGACY_KEYS]) localStorage.removeItem(key);
      if (database) {
        const tx = database.transaction([STATE_STORE, DOCUMENT_STORE], 'readwrite');
        tx.objectStore(STATE_STORE).clear();
        tx.objectStore(DOCUMENT_STORE).clear();
      }
      return persist(clone(defaults), { replace: true });
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    async putDocument(document) {
      await ready;
      const record = { ...document, id: String(document.id || crypto.randomUUID()), updatedAt: new Date().toISOString() };
      if (!database || localFallback) {
        const latest = clone(state);
        latest.documents = [record, ...latest.documents.filter(item => item.id !== record.id)];
        persist(latest);
        await this.flush();
        return record;
      }
      await new Promise((resolve, reject) => {
        const tx = database.transaction(DOCUMENT_STORE, 'readwrite');
        tx.objectStore(DOCUMENT_STORE).put(record);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Dokumen tidak bisa disimpan.'));
      });
      return record;
    },
    async listDocuments() {
      await ready;
      if (!database || localFallback) return clone(state.documents || []);
      return new Promise((resolve, reject) => {
        const request = database.transaction(DOCUMENT_STORE, 'readonly').objectStore(DOCUMENT_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error('Dokumen tidak bisa dibaca.'));
      });
    },
    async deleteDocument(id) {
      await ready;
      if (!database || localFallback) {
        const latest = clone(state);
        const before = latest.documents.length;
        latest.documents = latest.documents.filter(item => item.id !== String(id));
        if (latest.documents.length === before) return false;
        persist(latest);
        await this.flush();
        return true;
      }
      return new Promise((resolve, reject) => {
        const tx = database.transaction(DOCUMENT_STORE, 'readwrite');
        tx.objectStore(DOCUMENT_STORE).delete(String(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('Dokumen tidak bisa dihapus.'));
      });
    }
  });

  // Import older installations once. Keep legacy keys until a later release can
  // safely remove them after the new store has been observed in use.
  window.addEventListener('storage', async event => {
    if (event.key !== SIGNAL_KEY) return;
    try {
      if (database && !localFallback) {
        const latest = await readDatabase(database);
        if (latest) state = normalize(latest);
      } else if (event.newValue) {
        const raw = localStorage.getItem(KEY);
        if (raw) state = normalize(JSON.parse(raw));
      }
      revision++;
      notify({ remote: true });
    } catch (error) {
      console.warn('Campusly: state tab lain tidak bisa disinkronkan.', error);
    }
  });
})();

export const CampuslyStore = window.CampuslyStore;
