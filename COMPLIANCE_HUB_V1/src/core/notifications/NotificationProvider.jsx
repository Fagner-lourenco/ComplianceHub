import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { useAuth } from '../auth/useAuth';
import {
    markAllNotificationsAsRead,
    markNotificationAsRead,
    subscribeToMyNotifications,
    subscribeToUnreadNotifications,
} from './notificationService';
import {
    isAudioUnlocked,
    isSoundEnabled,
    playNotificationSound,
    setSoundEnabled,
    unlockNotificationAudio,
} from './notificationSoundService';

import { NotificationContext } from './notificationContext';

// Mock notifications for demo mode
const DEMO_NOTIFICATIONS = [
    { id: 'notif-1', uid: 'demo-user', type: 'CASE_DONE', title: 'Analise concluida', body: 'A analise de Ana Paula Oliveira foi concluida.', read: false, createdAt: new Date('2026-03-21T11:35:00'), data: { caseId: 'CASE-001', tenantId: 'TEN-001' } },
    { id: 'notif-2', uid: 'demo-user', type: 'CASE_CORRECTION_NEEDED', title: 'Correcao solicitada', body: 'A analise de Maria Fernanda Costa necessita correcao de dados.', read: false, createdAt: new Date('2026-04-02T09:00:00'), data: { caseId: 'CASE-003', tenantId: 'TEN-001' } },
    { id: 'notif-3', uid: 'demo-user', type: 'CASE_COMMENT', title: 'Novo comentario', body: 'O analista comentou no caso Carlos Eduardo Santos.', read: true, createdAt: new Date('2026-03-19T14:00:00'), data: { caseId: 'CASE-002', tenantId: 'TEN-001' } },
];

export function NotificationProvider({ children }) {
    const { user, userProfile } = useAuth();
    const uid = user?.uid || null;
    const isDemo = userProfile?.source === 'demo';

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [latestToast, setLatestToast] = useState(null);
    const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);
    const [audioUnlocked, setAudioUnlockedState] = useState(isAudioUnlocked);

    const initialLoadRef = useRef(true);
    const lastCreatedAtRef = useRef(null);
    const toastTimerRef = useRef(null);

    // Subscribe to notifications list
    useEffect(() => {
        if (!uid && !isDemo) {
            // Use microtask to avoid setState-in-effect lint error
            queueMicrotask(() => {
                setNotifications([]);
                setUnreadCount(0);
            });
            initialLoadRef.current = true;
            return undefined;
        }

        if (isDemo) {
            setNotifications(DEMO_NOTIFICATIONS);
            setUnreadCount(DEMO_NOTIFICATIONS.filter(n => !n.read).length);
            initialLoadRef.current = false;
            return undefined;
        }

        const unsubscribe = subscribeToMyNotifications(uid, (items) => {
            setNotifications(items);

            // Detect new notifications after initial load
            if (!initialLoadRef.current) {
                const newOnes = items.filter((n) => {
                    if (n.read) return false;
                    if (!n.createdAt) return false;
                    const createdTime = n.createdAt instanceof Date ? n.createdAt.getTime() : 0;
                    const lastTime = lastCreatedAtRef.current || 0;
                    return createdTime > lastTime;
                });

                if (newOnes.length > 0) {
                    const newest = newOnes[0];
                    setLatestToast(newest);
                    playNotificationSound(newest.type);

                    if (toastTimerRef.current) {
                        window.clearTimeout(toastTimerRef.current);
                    }
                    toastTimerRef.current = window.setTimeout(() => {
                        setLatestToast(null);
                    }, 8000);
                }
            }

            // Track latest createdAt for next comparison
            const latest = items[0];
            if (latest?.createdAt) {
                const t = latest.createdAt instanceof Date ? latest.createdAt.getTime() : 0;
                lastCreatedAtRef.current = Math.max(lastCreatedAtRef.current || 0, t);
            }

            initialLoadRef.current = false;
        });

        return () => {
            unsubscribe();
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
        };
    }, [uid]);

    // Subscribe to unread count
    useEffect(() => {
        if (!uid && !isDemo) {
            queueMicrotask(() => {
                setUnreadCount(0);
            });
            return undefined;
        }

        if (isDemo) {
            setUnreadCount(DEMO_NOTIFICATIONS.filter(n => !n.read).length);
            return undefined;
        }

        const unsubscribe = subscribeToUnreadNotifications(uid, (count) => {
            setUnreadCount(count);
        });

        return () => unsubscribe();
    }, [uid, isDemo]);

    // Demo toast simulation
    useEffect(() => {
        if (!isDemo) return undefined;
        const timer = window.setTimeout(() => {
            const unread = DEMO_NOTIFICATIONS.filter(n => !n.read);
            if (unread.length > 0) {
                const newest = unread[0];
                setLatestToast(newest);
                if (toastTimerRef.current) {
                    window.clearTimeout(toastTimerRef.current);
                }
                toastTimerRef.current = window.setTimeout(() => {
                    setLatestToast(null);
                }, 8000);
            }
        }, 3000);
        return () => window.clearTimeout(timer);
    }, [isDemo]);

    const markAsRead = useCallback(async (notificationId) => {
        try {
            if (!isDemo) {
                await markNotificationAsRead(notificationId);
            }
            setNotifications((prev) =>
                prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.warn('Failed to mark notification as read:', err);
        }
    }, [isDemo]);

    const markAllAsRead = useCallback(async () => {
        try {
            if (!isDemo) {
                await markAllNotificationsAsRead();
            }
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.warn('Failed to mark all notifications as read:', err);
        }
    }, [isDemo]);

    const enableSoundAlerts = useCallback(async () => {
        const ok = await unlockNotificationAudio();
        if (ok) {
            setSoundEnabled(true);
            setSoundEnabledState(true);
            setAudioUnlockedState(true);
        }
        return ok;
    }, []);

    const disableSoundAlerts = useCallback(() => {
        setSoundEnabled(false);
        setSoundEnabledState(false);
    }, []);

    const dismissToast = useCallback(() => {
        setLatestToast(null);
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
    }, []);

    const value = {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        enableSoundAlerts,
        disableSoundAlerts,
        soundEnabled,
        audioUnlocked,
        latestToast,
        dismissToast,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
}
