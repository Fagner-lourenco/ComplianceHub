const STORAGE_KEYS = {
    soundEnabled: 'compliancehub.notifications.soundEnabled',
    audioUnlocked: 'compliancehub.notifications.audioUnlocked',
};

let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function isStorageTrue(key) {
    try {
        return localStorage.getItem(key) === 'true';
    } catch {
        return false;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, value ? 'true' : 'false');
    } catch {
        // ignore
    }
}

export function isSoundEnabled() {
    return isStorageTrue(STORAGE_KEYS.soundEnabled);
}

export function isAudioUnlocked() {
    return isStorageTrue(STORAGE_KEYS.audioUnlocked);
}

export function setSoundEnabled(enabled) {
    setStorage(STORAGE_KEYS.soundEnabled, enabled);
}

export async function unlockNotificationAudio() {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
        setStorage(STORAGE_KEYS.audioUnlocked, true);
        // Play a brief test tone to confirm unlock
        playTone(880, 0.08, 0.05);
        return true;
    } catch (err) {
        console.warn('[notificationSound] failed to unlock audio:', err);
        return false;
    }
}

function playTone(frequency, duration, volume = 0.1, type = 'sine') {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);

        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (err) {
        console.warn('[notificationSound] failed to play tone:', err);
    }
}

export function playNotificationSound(notificationType) {
    if (!isSoundEnabled() || !isAudioUnlocked()) {
        return;
    }

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        // Cannot play without user interaction
        return;
    }

    if (notificationType === 'CASE_COMPLETED') {
        // Soft two-tone: pleasant completion sound
        playTone(523.25, 0.12, 0.08); // C5
        setTimeout(() => playTone(659.25, 0.15, 0.08), 120); // E5
    } else if (notificationType === 'NEW_CLIENT_SOLICITATION') {
        // More alert-like three-tone
        playTone(440, 0.1, 0.08); // A4
        setTimeout(() => playTone(554.37, 0.1, 0.08), 100); // C#5
        setTimeout(() => playTone(659.25, 0.15, 0.08), 200); // E5
    } else {
        // Default soft ping
        playTone(523.25, 0.15, 0.06);
    }
}
