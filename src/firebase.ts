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
  // In development show a helpful warning. In production (deployed) it's normal
  // to not have a local `.env` — hosting providers use environment variables.
  if (import.meta.env.DEV) {
    console.warn(
      'Firebase is not configured. Falling back to localStorage for history and index.\n' +
        'Create a .env file with VITE_FIREBASE_* keys for local dev, or set the VITE_FIREBASE_* environment variables in your hosting provider (e.g., Vercel) for production.'
    );
  } else {
    // Keep noise low in production; log a concise info so deploy logs can show it if needed
    console.info('Firebase not configured — using localStorage fallback. Set VITE_FIREBASE_* in your host to enable Firestore.');
  }
}

// Setup anonymous auth and an auth-ready promise so writes wait until auth is ready
let authReady: Promise<void> = Promise.resolve();
let authUser: any = null;
if (firestoreDb) {
  try {
    const auth = getAuth();
    // try sign-in anonymously; onAuthStateChanged will fire when ready
    signInAnonymously(auth).catch((err) => console.warn('Anonymous sign-in failed', err));

    authReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          authUser = user;
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

export async function getHistory(kind = 'cleaning') {
  const localKey = `${kind}History`;
  if (!firestoreDb) {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  try {
    const q = query(collection(firestoreDb, `${kind}History`), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  } catch (err: any) {
    console.warn(`Failed to read ${kind}History from Firestore, falling back to localStorage`, err?.code || err?.message || err);
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export async function addHistoryEntry(entry: { user: string; dateISO: string; display: string }, kind = 'cleaning') {
  const localKey = `${kind}History`;
  if (!firestoreDb) {
    const current = (await getHistory(kind)) || [];
    const next = [...current, entry];
    try {
      localStorage.setItem(localKey, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to write local history', e);
    }
    return 'local-' + Date.now();
  }

  // wait for anonymous auth to be ready if rules require authentication
  try {
    await authReady;
  } catch {}
  try {
    const ref = await addDoc(collection(firestoreDb, `${kind}History`), { ...entry, createdAt: serverTimestamp() });
    return ref.id;
  } catch (err: any) {
    console.warn(`Failed to write ${kind}History to Firestore, falling back to localStorage`, err?.code || err?.message || err);
    const current = (await getHistory(kind)) || [];
    const next = [...current, entry];
    try {
      localStorage.setItem(localKey, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to write local history', e);
    }
    return 'local-' + Date.now();
  }
}

export async function getIndex(kind = 'cleaning') {
  const localKey = `${kind}Index`;
  if (!firestoreDb) {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? parseInt(raw) : null;
    } catch {
      return null;
    }
  }
  try {
    const docRef = doc(firestoreDb, 'appState', kind);
    const d = await getDoc(docRef);
    if (d.exists()) return (d.data() as any).index as number;
    return null;
  } catch (err: any) {
    console.warn(`Failed to read ${kind} index from Firestore, falling back to localStorage`, err?.code || err?.message || err);
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? parseInt(raw) : null;
    } catch {
      return null;
    }
  }
}

export async function setIndex(index: number, kind = 'cleaning') {
  const localKey = `${kind}Index`;
  if (!firestoreDb) {
    try {
      localStorage.setItem(localKey, index.toString());
    } catch (e) {
      console.error('Failed to write local index', e);
    }
    return;
  }

  try {
    await authReady;
  } catch {}
  try {
    await setDoc(doc(firestoreDb, 'appState', kind), { index }, { merge: true });
  } catch (err: any) {
    console.warn(`Failed to write ${kind} index to Firestore, falling back to localStorage`, err?.code || err?.message || err);
    try {
      localStorage.setItem(localKey, index.toString());
    } catch (e) {
      console.error('Failed to write local index', e);
    }
  }
}

// Try to sync any locally-stored index for `kind` to Firestore when possible.
export async function syncLocalIndexToFirestore(kind = 'cleaning') {
  const localKey = `${kind}Index`;
  const raw = localStorage.getItem(localKey);
  if (!raw) return false;
  const localIndex = parseInt(raw as string);
  if (isNaN(localIndex)) return false;
  if (!firestoreDb) return false;

  try {
    await authReady;
  } catch {}

  try {
    await setDoc(doc(firestoreDb, 'appState', kind), { index: localIndex }, { merge: true });
    // keep local copy as fallback; do not remove automatically
    return true;
  } catch (err: any) {
    console.warn(`Failed to sync ${kind} index to Firestore`, err?.code || err?.message || err);
    return false;
  }
}

export function getFirebaseDiagnostics() {
  return {
    isConfigured,
    firestoreAvailable: !!firestoreDb,
    authUser: authUser ? { uid: authUser.uid, isAnonymous: !!authUser.isAnonymous } : null,
  };
}

// Backwards compatible helpers
export async function getCleaningIndex() {
  return getIndex('cleaning');
}

export async function setCleaningIndex(index: number) {
  return setIndex(index, 'cleaning');
}
