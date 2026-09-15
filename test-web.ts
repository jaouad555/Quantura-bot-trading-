import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    await setDoc(doc(db, 'server_data', 'quantura_bot_secret_2026'), { hello: 'unauth-but-secure' });
    const snap = await getDoc(doc(db, 'server_data', 'quantura_bot_secret_2026'));
    console.log('Got doc:', snap.data());
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
