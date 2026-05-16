import { useContext } from 'react';
import { NotificationContext } from './notificationContext';

export function useNotifications() {
    return useContext(NotificationContext);
}
