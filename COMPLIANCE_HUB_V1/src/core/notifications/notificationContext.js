import { createContext } from 'react';

export const NotificationContext = createContext({
    notifications: [],
    unreadCount: 0,
    markAsRead: () => {},
    markAllAsRead: () => {},
    enableSoundAlerts: () => {},
    disableSoundAlerts: () => {},
    soundEnabled: false,
    audioUnlocked: false,
    latestToast: null,
    dismissToast: () => {},
});
