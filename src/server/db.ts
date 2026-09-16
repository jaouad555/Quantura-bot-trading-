import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('Could not load firebase-applet-config.json');
}

let app: any = null;
let db: any = null;
try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig?.firestoreDatabaseId);
  }
} catch (e) {
  console.warn('Firebase initialization skipped or failed, using local storage cache.');
}

const SECRET = 'quantura_bot_secret_2026';
const KV_COLLECTION = `server_data/${SECRET}/kv_store`;

// Local In-Memory & File-Based Storage Cache (Protects against Firestore Free-Tier Quota Exhaustion)
const LOCAL_STORAGE_FILE = path.join(process.cwd(), 'local_kv_cache.json');
let localMemoryCache: Record<string, string> = {};

// Load initial state from local file if exists
try {
  if (fs.existsSync(LOCAL_STORAGE_FILE)) {
    const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf8');
    localMemoryCache = JSON.parse(raw);
  }
} catch (err) {
  console.warn('Could not read local_kv_cache.json:', err);
}

const persistLocalCache = () => {
  try {
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(localMemoryCache, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal if filesystem is restricted
  }
};

let firestoreQuotaExceeded = false;

export const initDb = () => {
  console.log('Database initialized with local resilient cache and Firestore backup.');
};

export const kv = {
  get: async (key: string): Promise<string | null> => {
    // 1. Return from memory cache if available
    if (localMemoryCache[key] !== undefined) {
      return localMemoryCache[key];
    }
    
    // 2. Fallback to Firestore if quota has not exceeded
    if (db && !firestoreQuotaExceeded) {
      try {
        const snap = await getDoc(doc(db, KV_COLLECTION, key));
        if (snap.exists()) {
          const val = snap.data().value as string;
          localMemoryCache[key] = val;
          persistLocalCache();
          return val;
        }
      } catch (e: any) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
          firestoreQuotaExceeded = true;
          console.warn('[DB] Firestore quota reached. Seamlessly using local memory & disk storage.');
        } else {
          console.error('KV Get Error:', e?.message || e);
        }
      }
    }
    return null;
  },
  getAll: async (): Promise<Record<string, string>> => {
    if (db && !firestoreQuotaExceeded) {
      try {
        const snap = await getDocs(collection(db, KV_COLLECTION));
        snap.forEach(d => {
          localMemoryCache[d.id] = d.data().value;
        });
        persistLocalCache();
      } catch (e: any) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
          firestoreQuotaExceeded = true;
        } else {
          console.error('KV GetAll Error:', e?.message || e);
        }
      }
    }
    return { ...localMemoryCache };
  },
  set: async (key: string, value: string): Promise<void> => {
    // Always store immediately in local memory & disk
    localMemoryCache[key] = value;
    persistLocalCache();

    // Async sync to Firestore without blocking if quota allows
    if (db && !firestoreQuotaExceeded) {
      setDoc(doc(db, KV_COLLECTION, key), { value }).catch((e: any) => {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
          firestoreQuotaExceeded = true;
        }
      });
    }
  },
  delete: async (key: string): Promise<void> => {
    delete localMemoryCache[key];
    persistLocalCache();

    if (db && !firestoreQuotaExceeded) {
      deleteDoc(doc(db, KV_COLLECTION, key)).catch((e: any) => {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
          firestoreQuotaExceeded = true;
        }
      });
    }
  },
  clear: async (): Promise<void> => {
    localMemoryCache = {};
    persistLocalCache();

    if (db && !firestoreQuotaExceeded) {
      try {
        const snap = await getDocs(collection(db, KV_COLLECTION));
        const promises = snap.docs.map(d => deleteDoc(doc(db, KV_COLLECTION, d.id)));
        await Promise.all(promises);
      } catch (e: any) {
        if (e?.code === 'resource-exhausted' || e?.message?.includes('RESOURCE_EXHAUSTED')) {
          firestoreQuotaExceeded = true;
        }
      }
    }
  }
};

export default db;
