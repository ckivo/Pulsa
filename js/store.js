// Storage: every saved piece of data (goals, journals, finance, food, …) lives in IndexedDB, which has
// room for far more than localStorage's ~5 MB. Everything is loaded into memory once at startup, so the
// rest of the app reads and writes synchronously with the same API localStorage has:
// Store.getItem / setItem / removeItem / key(i) / length. Writes reach IndexedDB a moment later.
//
// The first time this version runs it moves everything out of localStorage into IndexedDB and then
// clears localStorage. If IndexedDB isn't available (some private windows), it falls back to localStorage.
const Store = (() => {
  const DB_NAME = 'pulse_store';
  const OS = 'kv';
  const mem = new Map();
  const writeListeners = [];
  let keyList = null;     // cached key order for key(i); rebuilt after adds/removes
  let db = null;
  let mode = 'memory';    // 'idb' | 'local' | 'memory'
  const pending = new Map(); // key → value (null = delete) waiting to be written
  let flushing = Promise.resolve();
  let flushQueued = false;
  // Other open tabs of the app see each other's writes.
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('pulse_store') : null;

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(OS);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }

  function readAll() {
    return new Promise((resolve, reject) => {
      const out = [];
      const req = db.transaction(OS, 'readonly').objectStore(OS).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) { resolve(out); return; }
        out.push([String(cur.key), String(cur.value)]);
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  function writeBatch(entries) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OS, 'readwrite');
      const os = tx.objectStore(OS);
      entries.forEach(([k, v]) => { if (v === null) os.delete(k); else os.put(v, k); });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Write aborted'));
    });
  }

  function legacyEntries() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k != null) out.push([k, localStorage.getItem(k)]);
      }
    } catch (e) { /* localStorage unavailable */ }
    return out;
  }

  async function init() {
    try {
      db = await openDb();
      (await readAll()).forEach(([k, v]) => mem.set(k, v));
      // Anything still in localStorage is either the first run of this version or was written by an
      // older cached copy of the app while offline; either way it's the newest, so it wins.
      const legacy = legacyEntries();
      if (legacy.length) {
        await writeBatch(legacy);
        legacy.forEach(([k, v]) => mem.set(k, v));
        legacy.forEach(([k]) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      }
      mode = 'idb';
    } catch (err) {
      console.warn('IndexedDB unavailable, using localStorage:', err);
      db = null;
      mem.clear();
      legacyEntries().forEach(([k, v]) => mem.set(k, v));
      mode = 'local';
    }
    // Ask the browser not to clear this site's data when space runs low.
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
    if (channel) {
      channel.onmessage = e => {
        const { k, v } = e.data || {};
        if (typeof k !== 'string') return;
        if (v === null) mem.delete(k); else mem.set(k, v);
        keyList = null;
      };
    }
  }

  function queue(k, v) {
    pending.set(k, v);
    if (flushQueued) return;
    flushQueued = true;
    Promise.resolve().then(() => { flushQueued = false; flushing = flushing.then(writePending); });
  }

  async function writePending() {
    if (!pending.size) return;
    const entries = [...pending.entries()];
    pending.clear();
    if (mode === 'idb') {
      try {
        await writeBatch(entries);
      } catch (err) {
        console.warn('Couldn’t save:', err);
        window.dispatchEvent(new CustomEvent('store-error', { detail: err }));
      }
    } else if (mode === 'local') {
      entries.forEach(([k, v]) => {
        try {
          if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
        } catch (err) {
          window.dispatchEvent(new CustomEvent('store-error', { detail: err }));
        }
      });
    }
  }

  function changed(k, v) {
    if (channel) { try { channel.postMessage({ k, v }); } catch (e) { /* ignore */ } }
    writeListeners.forEach(fn => { try { fn(k); } catch (e) { console.warn(e); } });
  }

  const api = {
    getItem(k) {
      k = String(k);
      return mem.has(k) ? mem.get(k) : null;
    },
    setItem(k, v) {
      k = String(k);
      v = String(v);
      if (!mem.has(k)) keyList = null;
      mem.set(k, v);
      queue(k, v);
      changed(k, v);
    },
    removeItem(k) {
      k = String(k);
      if (!mem.has(k)) return;
      mem.delete(k);
      keyList = null;
      queue(k, null);
      changed(k, null);
    },
    key(i) {
      if (!keyList) keyList = [...mem.keys()];
      return i >= 0 && i < keyList.length ? keyList[i] : null;
    },
    get length() { return mem.size; },
    keys() { return [...mem.keys()]; },
    // Runs fn(key) after every setItem / removeItem (used by device sync).
    onWrite(fn) { writeListeners.push(fn); },
    // Same as setItem / removeItem, but without telling onWrite listeners (sync applying remote data).
    setQuiet(k, v) {
      k = String(k);
      if (v === null) { if (mem.delete(k)) { keyList = null; queue(k, null); } return; }
      v = String(v);
      if (!mem.has(k)) keyList = null;
      mem.set(k, v);
      queue(k, v);
      if (channel) { try { channel.postMessage({ k, v }); } catch (e) { /* ignore */ } }
    },
    // Resolves once every write so far has reached storage (call before reloading the page).
    flush() {
      return new Promise(resolve => {
        Promise.resolve().then(() => { flushing = flushing.then(writePending); flushing.then(resolve, resolve); });
      });
    },
    get mode() { return mode; },
    // Loads saved data, then runs the app's scripts in order.
    boot(scripts) {
      init().then(() => {
        scripts.forEach(src => {
          const s = document.createElement('script');
          s.src = src;
          s.async = false; // keep execution order
          s.onerror = () => {
            document.body.insertAdjacentHTML('beforeend',
              '<div style="position:fixed;inset:auto 16px 16px;padding:12px 14px;border-radius:12px;background:#3a1717;color:#fff;font:13px system-ui;z-index:99">' +
              'Pulse couldn’t load part of the app (' + src + '). Check your connection and reload.</div>');
          };
          document.body.appendChild(s);
        });
      });
    }
  };
  return api;
})();
