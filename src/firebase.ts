import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Config via Vite env vars. Create a `.env` file with VITE_FIREBASE_* keys (see README below).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig && firebaseConfig.projectId);

let firestoreDb: ReturnType<typeof getFirestore> | null = null;
if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig as any);
    firestoreDb = getFirestore(app);
  } catch (e) {
    console.warn('Failed to initialize Firebase app', e);
    firestoreDb = null;
  }
} else {
  console.warn('Firebase is not configured. Falling back to localStorage for history and index.\nPlease move your .env to project root and restart Vite to enable Firestore.');
}

// Setup anonymous auth and an auth-ready promise so writes wait until auth is ready
let authReady: Promise<void> = Promise.resolve();
if (firestoreDb) {
  try {
    const auth = getAuth();
    // try sign-in anonymously; onAuthStateChanged will fire when ready
    signInAnonymously(auth).catch((err) => console.warn('Anonymous sign-in failed', err));

    authReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('[Firebase] Anonymous auth ready, uid=', user.uid);
          unsub();
          resolve();
        }
      });
      // safety timeout: resolve after 3s to avoid indefinite waiting
      setTimeout(() => resolve(), 3000);
    });
  } catch (e) {
    console.warn('Failed to initialize Firebase Auth', e);
  }
}

export async function getHistory() {
  if (!firestoreDb) {
    try {
      const raw = localStorage.getItem('cleaningHistory');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const q = query(collection(firestoreDb, 'cleaningHistory'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function addHistoryEntry(entry: { user: string; dateISO: string; display: string }) {
  if (!firestoreDb) {
    const current = (await getHistory()) || [];
    const next = [...current, entry];
    try {
      localStorage.setItem('cleaningHistory', JSON.stringify(next));
    } catch (e) {
      console.error('Failed to write local history', e);
    }
    return 'local-' + Date.now();
  }

  // wait for anonymous auth to be ready if rules require authentication
  try {
    await authReady;
  } catch {}

  const ref = await addDoc(collection(firestoreDb, 'cleaningHistory'), { ...entry, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getCleaningIndex() {
  if (!firestoreDb) {
    try {
      const raw = localStorage.getItem('cleaningIndex');
      return raw ? parseInt(raw) : null;
    } catch {
      return null;
    }
  }

  const docRef = doc(firestoreDb, 'appState', 'cleaning');
  const d = await getDoc(docRef);
  if (d.exists()) return (d.data() as any).index as number;
  return null;
}

export async function setCleaningIndex(index: number) {
  if (!firestoreDb) {
    try {
      localStorage.setItem('cleaningIndex', index.toString());
    } catch (e) {
      console.error('Failed to write local cleaningIndex', e);
    }
    return;
  }

  try {
    await authReady;
  } catch {}

  await setDoc(doc(firestoreDb, 'appState', 'cleaning'), { index }, { merge: true });
}
