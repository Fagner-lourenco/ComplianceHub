import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';
import {
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-compliancehub').trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com').trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '000000000').trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || '1:000:web:000').trim(),
};

const DATABASE_ID = 'compliance-hub-v2';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const createFirestore = () => {
    if (typeof window === 'undefined') {
        return initializeFirestore(app, {
            localCache: memoryLocalCache(),
            experimentalForceLongPolling: true,
        }, DATABASE_ID);
    }

    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
            }),
            experimentalForceLongPolling: true,
        }, DATABASE_ID);
    } catch (error) {
        console.warn('Firestore persistent cache unavailable, falling back to memory cache.', error);
        return initializeFirestore(app, {
            localCache: memoryLocalCache(),
            experimentalForceLongPolling: true,
        }, DATABASE_ID);
    }
};

export const db = createFirestore();
export const functions = getFunctions(app);

export default app;
