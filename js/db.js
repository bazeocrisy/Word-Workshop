// Minimal promise wrapper around IndexedDB. One database; every write is a single transaction.

export const DB_NAME = 'word-workshop';
const DB_VERSION = 1;
export const STORES = ['students', 'weeks', 'snapshots', 'attempts', 'images', 'meta'];

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('This browser cannot save data (IndexedDB is unavailable). Private browsing can cause this.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const mk = (name, key, indexes = []) => {
        if (db.objectStoreNames.contains(name)) return;
        const s = db.createObjectStore(name, { keyPath: key });
        indexes.forEach((ix) => s.createIndex(ix, ix));
      };
      mk('students', 'id');
      mk('weeks', 'id', ['studentId']);
      mk('snapshots', 'id', ['weekId', 'studentId']);
      mk('attempts', 'id', ['studentId', 'weekId']);
      mk('images', 'id');
      mk('meta', 'key');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Could not open the database.'));
    req.onblocked = () => reject(new Error('The database is open in another tab with an older version. Close other Word Workshop tabs and reload.'));
  });
  return dbPromise;
}

const done = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

/**
 * Run `fn(stores)` inside one transaction. Resolves with fn's return value after the transaction commits,
 * rejects (and rolls back) if anything throws or a request fails.
 */
export async function transact(names, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
    let result;
    let settled = false;
    // If fn is still running when the transaction commits, it awaited something that was not an IndexedDB
    // request and its later writes would be lost — treat that as an error instead of silently succeeding.
    t.oncomplete = () => (settled ? resolve(result) : reject(new Error('Internal error: the save finished before all changes were written.')));
    t.onerror = (ev) => reject((ev && ev.target && ev.target.error) || t.error || new Error('Could not save.'));
    t.onabort = () => reject(t.error || new Error('Save was cancelled.'));
    Promise.resolve().then(() => fn(stores, done)).then((r) => { result = r; settled = true; }, (e) => { settled = true; try { t.abort(); } catch { /* already done */ } reject(e); });
  });
}

export const get = (store, key) => transact([store], 'readonly', (s, d) => d(s[store].get(key)));
export const getAll = (store) => transact([store], 'readonly', (s, d) => d(s[store].getAll()));
export const getAllBy = (store, index, value) => transact([store], 'readonly', (s, d) => d(s[store].index(index).getAll(value)));
export const put = (store, value) => transact([store], 'readwrite', (s, d) => d(s[store].put(value)));
export const del = (store, key) => transact([store], 'readwrite', (s, d) => d(s[store].delete(key)));

export async function deleteDatabase() {
  if (dbPromise) { (await dbPromise).close(); dbPromise = null; }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = resolve; req.onerror = () => reject(req.error); req.onblocked = resolve;
  });
}
