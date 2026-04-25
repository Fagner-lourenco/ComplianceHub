/* global process */
/* Usage: node --env-file=.env.local delete-record.js <CASE_ID> */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const caseId = process.argv[2];
if (!caseId) {
    console.error('Usage: node delete-record.js <CASE_ID>');
    process.exit(1);
}

async function main() {
    await signInWithEmailAndPassword(auth, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
    console.log('Authenticated.');

    const caseRef = doc(db, 'cases', caseId);
    const caseSnap = await getDoc(caseRef);

    if (!caseSnap.exists()) {
        console.error(`Case ${caseId} not found.`);
        process.exit(1);
    }

    const data = caseSnap.data();
    const candidateId = data.candidateId;
    console.log(`Case found: ${data.candidateName} / ${data.candidatePosition || '-'} / tenant: ${data.tenantId}`);

    await deleteDoc(caseRef);
    console.log(`Deleted case: ${caseId}`);

    if (candidateId) {
        const candRef = doc(db, 'candidates', candidateId);
        const candSnap = await getDoc(candRef);
        if (candSnap.exists()) {
            await deleteDoc(candRef);
            console.log(`Deleted candidate: ${candidateId}`);
        }
    }

    console.log('Done.');
    process.exit(0);
}

main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
