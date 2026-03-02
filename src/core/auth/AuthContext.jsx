import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Load profile from Firestore
                try {
                    const profileSnap = await getDoc(doc(db, 'userProfiles', firebaseUser.uid));
                    if (profileSnap.exists()) {
                        setUserProfile(profileSnap.data());
                    }
                } catch (err) {
                    console.error('Error loading user profile:', err);
                }
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const login = async (email, password) => {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
    };

    const register = async (email, password, displayName, role = 'client_viewer', tenantId = 'default') => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });

        const profile = {
            email,
            displayName,
            role,
            tenantId,
            status: 'active',
            createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'userProfiles', cred.user.uid), profile);
        setUserProfile(profile);
        return cred.user;
    };

    const logout = () => signOut(auth);

    const value = { user, userProfile, loading, login, register, logout };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
