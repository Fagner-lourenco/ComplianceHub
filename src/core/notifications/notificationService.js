import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const NOTIFICATIONS_LIMIT = 30;
const UNREAD_LIMIT = 20;

function mapNotificationDoc(docSnapshot) {
    const data = docSnapshot.data();
    return {
        id: docSnapshot.id,
        tenantId: data.tenantId || null,
        recipientUid: data.recipientUid || null,
        type: data.type || '',
        title: data.title || '',
        message: data.message || '',
        caseId: data.caseId || null,
        candidateName: data.candidateName || null,
        targetUrl: data.targetUrl || '',
        read: !!data.read,
        played: !!data.played,
        createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
        readAt: data.readAt?.toDate?.() || data.readAt || null,
        playedAt: data.playedAt?.toDate?.() || data.playedAt || null,
        source: data.source || null,
    };
}

export function subscribeToMyNotifications(uid, callback) {
    if (!uid) {
        callback([], null);
        return () => {};
    }

    const q = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(NOTIFICATIONS_LIMIT),
    );

    return onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(mapNotificationDoc);
        callback(notifications, null);
    }, (error) => {
        console.error('Error subscribing to notifications:', error);
        callback([], error);
    });
}

export function subscribeToUnreadNotifications(uid, callback) {
    if (!uid) {
        callback(0, null);
        return () => {};
    }

    const q = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', uid),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(UNREAD_LIMIT),
    );

    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.length, null);
    }, (error) => {
        console.error('Error subscribing to unread notifications:', error);
        callback(0, error);
    });
}

async function callBackendFunction(name, payload) {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(undefined, 'southamerica-east1');
    const fn = httpsCallable(functions, name);
    const result = await fn(payload);
    return result.data;
}

export async function markNotificationAsRead(notificationId) {
    if (!notificationId) return { success: false };
    return callBackendFunction('markNotificationAsRead', { notificationId });
}

export async function markAllNotificationsAsRead() {
    return callBackendFunction('markAllNotificationsAsRead', {});
}
