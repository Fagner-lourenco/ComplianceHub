/* global process */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

/*
 * IMPORTANT: Do NOT hardcode credentials here.
 * Set these environment variables before running:
 *   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
 *   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
 *   ADMIN_EMAIL, ADMIN_PASSWORD, MADERO_UID
 */
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const maderoUid = process.env.MADERO_UID;

    if (!firebaseConfig.apiKey || !adminEmail || !adminPassword || !maderoUid) {
        console.error('Missing required environment variables. See comments at top of file.');
        process.exit(1);
    }

    try {
        console.log('Signing in admin...');
        const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        
        console.log('Writing admin profile...');
        await setDoc(doc(db, 'userProfiles', cred.user.uid), {
            email: adminEmail,
            displayName: 'Administrador',
            role: 'admin',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        // Wait a small bit for rule evaluating cache
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Verifying admin profile...');
        const snap = await getDoc(doc(db, 'userProfiles', cred.user.uid));
        console.log('Admin profile exists:', snap.exists(), 'Role:', snap.data()?.role);

        console.log('Writing Madero profile using admin Auth session...');
        await setDoc(doc(db, 'userProfiles', maderoUid), {
            email: 'analista.rh@madero.com.br',
            displayName: "João (RH Madero)",
            role: "client_manager",
            tenantId: "madero-br",
            tenantName: "Madero Indústria e Comércio S.A.",
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log('✅ Done! Both profiles created.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

main();
