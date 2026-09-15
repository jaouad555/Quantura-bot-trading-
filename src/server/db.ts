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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig?.firestoreDatabaseId);

const SECRET = 'quantura_bot_secret_2026';
const KV_COLLECTION = `server_data/${SECRET}/kv_store`;

export const initDb = () => {
  console.log('Firebase Firestore initialized as backend DB.');
};

export const kv = {
  get: async (key: string): Promise<string | null> => {
    try {
      const snap = await getDoc(doc(db, KV_COLLECTION, key));
      if (snap.exists()) {
        return snap.data().value as string;
      }
    } catch (e) {
      console.error('KV Get Error:', e);
    }
    return null;
  },
  getAll: async (): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    try {
      const snap = await getDocs(collection(db, KV_COLLECTION));
      snap.forEach(d => {
        result[d.id] = d.data().value;
      });
    } catch (e) {
      console.error('KV GetAll Error:', e);
    }
    return result;
  },
  set: async (key: string, value: string): Promise<void> => {
    try {
      await setDoc(doc(db, KV_COLLECTION, key), { value });
    } catch (e) {
      console.error('KV Set Error:', e);
    }
  },
  delete: async (key: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, KV_COLLECTION, key));
    } catch (e) {
      console.error('KV Delete Error:', e);
    }
  },
  clear: async (): Promise<void> => {
    try {
      const snap = await getDocs(collection(db, KV_COLLECTION));
      const promises = snap.docs.map(d => deleteDoc(doc(db, KV_COLLECTION, d.id)));
      await Promise.all(promises);
    } catch (e) {
      console.error('KV Clear Error:', e);
    }
  }
};

export default db;
