function normalizeString(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export function getAuthDisplayName(firebaseUser) {
    const explicitName = normalizeString(firebaseUser?.displayName);

    if (explicitName) {
        return explicitName;
    }

    const email = normalizeString(firebaseUser?.email);

    if (email) {
        return email.split('@')[0];
    }

    return 'Usuario';
}

export function createAuthFallbackProfile(firebaseUser) {
    return {
        uid: firebaseUser?.uid ?? null,
        email: normalizeString(firebaseUser?.email) ?? '',
        displayName: getAuthDisplayName(firebaseUser),
        role: null,
        tenantId: null,
        tenantName: null,
        source: 'auth',
        photoURL: firebaseUser?.photoURL ?? null,
    };
}

export function mergeUserProfile(firebaseUser, profileData = {}, source = 'server') {
    const fallbackProfile = createAuthFallbackProfile(firebaseUser);
    const displayName = normalizeString(profileData.displayName) ?? fallbackProfile.displayName;
    const email = normalizeString(profileData.email) ?? fallbackProfile.email;
    const role = normalizeString(profileData.role);
    const tenantId = normalizeString(profileData.tenantId);
    const tenantName = normalizeString(profileData.tenantName);

    return {
        ...fallbackProfile,
        ...profileData,
        displayName,
        email,
        role,
        tenantId,
        tenantName,
        source,
    };
}
