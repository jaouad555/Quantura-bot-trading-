import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

initializeApp({
  projectId: firebaseConfig.projectId
});

const db = getFirestore();
db.settings({ databaseId: firebaseConfig.firestoreDatabaseId || '(default)' });

async function run() {
  try {
    await db.collection('test').doc('test').set({ hello: 'world' });
    const doc = await db.collection('test').doc('test').get();
    console.log('Got doc:', doc.data());
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
