import { useEffect, useRef, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth';
import { doc, getDoc, getDocFromCache, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getFirestoreDocumentViaRest } from '../firebase/firestoreService';
import { AuthContext } from './auth-context';
import { createAuthFallbackProfile, mergeUserProfile } from './authProfile';

const AUTH_BOOT_TIMEOUT_MS = 8000;
const PROFILE_RESCUE_DELAY_MS = 3000;
const PROFILE_RESCUE_TIMEOUT_MS = 5000;
const RESOLVED_PROFILE_STATUSES = new Set(['cached', 'ready', 'missing', 'error']);
const PROFILE_SOURCE_RANK = {
    auth: 0,
    cache: 1,
    server: 2,
};

function isUnconfirmedMissingSnapshot(snapshot, sourceOverride = null) {
    return (
        Boolean(snapshot)
        && !snapshot.exists()
        && sourceOverride !== 'server'
        && snapshot.metadata?.fromCache
    );
}

function isConfirmedMissingSnapshot(snapshot, sourceOverride = null) {
    return Boolean(snapshot) && !snapshot.exists() && !isUnconfirmedMissingSnapshot(snapshot, sourceOverride);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileStatus, setProfileStatus] = useState('idle');
    const [profileError, setProfileError] = useState(null);
    const authResolvedRef = useRef(false);

    useEffect(() => {
        let unsubscribeProfile = () => {};
        let profileDelayTimer = null;
        let cancelled = false;

        const clearProfileDelayTimer = () => {
            if (profileDelayTimer) {
                window.clearTimeout(profileDelayTimer);
                profileDelayTimer = null;
            }
        };

        const applyResolvedProfile = (firebaseUser, snapshot, sourceOverride = null) => {
            if (cancelled) {
                return false;
            }

            const fallbackProfile = createAuthFallbackProfile(firebaseUser);

            if (isUnconfirmedMissingSnapshot(snapshot, sourceOverride)) {
                setProfileError(null);
                setUserProfile((currentProfile) => {
                    if (currentProfile?.uid === fallbackProfile.uid) {
                        return currentProfile;
                    }

                    return fallbackProfile;
                });
                setProfileStatus((currentStatus) => (
                    RESOLVED_PROFILE_STATUSES.has(currentStatus) ? currentStatus : 'loading'
                ));
                return false;
            }

            if (isConfirmedMissingSnapshot(snapshot, sourceOverride)) {
                console.warn('User profile document not found in userProfiles.');
                setUserProfile(fallbackProfile);
                setProfileError(null);
                setProfileStatus('missing');
                return true;
            }

            const source = sourceOverride || (snapshot.metadata?.fromCache ? 'cache' : 'server');
            const nextProfile = mergeUserProfile(firebaseUser, snapshot.data(), source);

            setProfileError(null);
            setUserProfile((currentProfile) => {
                if (!currentProfile || currentProfile.uid !== nextProfile.uid) {
                    return nextProfile;
                }

                const currentRank = PROFILE_SOURCE_RANK[currentProfile.source] ?? -1;
                const nextRank = PROFILE_SOURCE_RANK[nextProfile.source] ?? -1;
                return nextRank >= currentRank ? nextProfile : currentProfile;
            });
            setProfileStatus((currentStatus) => {
                if (currentStatus === 'ready' && source !== 'server') {
                    return currentStatus;
                }

                return source === 'cache' ? 'cached' : 'ready';
            });
            return true;
        };

        const applyProfileFallbackError = (firebaseUser, error) => {
            if (cancelled) {
                return;
            }

            clearProfileDelayTimer();
            console.error('Error in profile snapshot:', error);
            setProfileError(error);
            setUserProfile((currentProfile) => {
                if (
                    currentProfile
                    && currentProfile.uid === firebaseUser.uid
                    && (currentProfile.role || currentProfile.source === 'cache' || currentProfile.source === 'server')
                ) {
                    return currentProfile;
                }

                return createAuthFallbackProfile(firebaseUser);
            });
            setProfileStatus((currentStatus) => (
                RESOLVED_PROFILE_STATUSES.has(currentStatus) ? currentStatus : 'error'
            ));
        };

        const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
            authResolvedRef.current = true;
            clearProfileDelayTimer();
            unsubscribeProfile();

            if (!firebaseUser) {
                setUser(null);
                setUserProfile(null);
                setProfileError(null);
                setProfileStatus('idle');
                setLoading(false);
                return;
            }

            const fallbackProfile = createAuthFallbackProfile(firebaseUser);
            const profileRef = doc(db, 'userProfiles', firebaseUser.uid);

            setUser(firebaseUser);
            setUserProfile(fallbackProfile);
            setProfileError(null);
            setProfileStatus('loading');
            setLoading(false);

            profileDelayTimer = window.setTimeout(async () => {
                profileDelayTimer = null;
                setProfileStatus((currentStatus) => (
                    RESOLVED_PROFILE_STATUSES.has(currentStatus) ? currentStatus : 'delayed'
                ));

                try {
                    // 1. Try persistent cache first — instant if data exists
                    try {
                        const cached = await getDocFromCache(profileRef);
                        if (cached.exists() && applyResolvedProfile(firebaseUser, cached)) {
                            return;
                        }
                    } catch {
                        // No cached document, fall through to network
                    }

                    // 2. Race SDK getDoc vs REST API with timeout
                    const snapshot = await Promise.race([
                        Promise.any([
                            getDoc(profileRef),
                            getFirestoreDocumentViaRest(
                                'userProfiles',
                                firebaseUser.uid,
                                'REST profile rescue failed',
                            ),
                        ]),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Profile rescue timeout')), PROFILE_RESCUE_TIMEOUT_MS),
                        ),
                    ]);
                    applyResolvedProfile(firebaseUser, snapshot);
                } catch (rescueError) {
                    applyProfileFallbackError(firebaseUser, rescueError);
                }
            }, PROFILE_RESCUE_DELAY_MS);

            unsubscribeProfile = onSnapshot(
                profileRef,
                { includeMetadataChanges: true },
                (snapshot) => {
                    clearProfileDelayTimer();
                    applyResolvedProfile(firebaseUser, snapshot);
                },
                (error) => {
                    applyProfileFallbackError(firebaseUser, error);
                },
            );
        });

        const safeBootTimer = window.setTimeout(() => {
            if (!authResolvedRef.current) {
                console.warn('Safe Boot active: Auth initialization timed out.');
                setLoading(false);
            }
        }, AUTH_BOOT_TIMEOUT_MS);

        return () => {
            cancelled = true;
            unsubscribeAuth();
            unsubscribeProfile();
            clearProfileDelayTimer();
            window.clearTimeout(safeBootTimer);
        };
    }, []);

    const login = async (email, password) => {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return { user: credential.user };
    };

    const logout = () => signOut(auth);

    const refreshProfile = async () => {
        if (!auth.currentUser) {
            return null;
        }

        const snapshot = await getDoc(doc(db, 'userProfiles', auth.currentUser.uid));

        if (isUnconfirmedMissingSnapshot(snapshot)) {
            return userProfile;
        }

        if (isConfirmedMissingSnapshot(snapshot)) {
            setUserProfile(createAuthFallbackProfile(auth.currentUser));
            setProfileError(null);
            setProfileStatus('missing');
            return null;
        }

        const source = snapshot.metadata?.fromCache ? 'cache' : 'server';
        const nextProfile = mergeUserProfile(auth.currentUser, snapshot.data(), source);
        setUserProfile(nextProfile);
        setProfileError(null);
        setProfileStatus(source === 'cache' ? 'cached' : 'ready');
        return nextProfile;
    };

    const value = {
        user,
        userProfile,
        loading,
        profileStatus,
        profileError,
        hasResolvedProfile: RESOLVED_PROFILE_STATUSES.has(profileStatus),
        login,
        logout,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
