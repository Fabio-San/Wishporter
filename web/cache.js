// cache.js — IndexedDB cache for Paimon.moe data files
const DB_NAME = "wishporter_cache";
const DB_VERSION = 1;
const STORE_NAME = "paimon_data";
const META_KEY = "meta";

const DATA_FILES = [
  { key: "characters", filename: "characters.js", url: "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/characters.js" },
  { key: "weapons", filename: "weaponList.js", url: "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/weaponList.js" },
  { key: "banners", filename: "banners.js", url: "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/banners.js" },
  { key: "dual", filename: "bannersDual.js", url: "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/bannersDual.js" },
];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getCachedData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const result = {};
      for (const item of req.result) {
        result[item.key] = item;
      }
      resolve(result);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function setCachedData(key, text) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ key, text, updated: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

async function hasCachedData() {
  const cached = await getCachedData();
  return DATA_FILES.every((f) => cached[f.key] && cached[f.key].text);
}

async function loadPaimonData(offline) {
  const cached = await getCachedData();
  const texts = {};
  const notes = [];
  let fetchedAny = false;

  for (const f of DATA_FILES) {
    if (!offline) {
      try {
        const res = await fetch(f.url, { cache: "no-cache" });
        if (res.ok) {
          const text = await res.text();
          texts[f.key] = text;
          await setCachedData(f.key, text);
          fetchedAny = true;
          continue;
        }
      } catch (e) {
        // network error, fall through to cache
      }
    }
    if (cached[f.key] && cached[f.key].text) {
      texts[f.key] = cached[f.key].text;
    }
  }

  if (fetchedAny) {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    notes.push("cache_saved");
  } else if (Object.keys(texts).length > 0) {
    const meta = cached[DATA_FILES[0].key];
    notes.push("cache_used");
  } else {
    notes.push("cache_missing");
  }

  return { texts, notes, fetchedAny };
}

async function clearCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

window.cache = { DATA_FILES, getCachedData, setCachedData, hasCachedData, loadPaimonData, clearCache };
