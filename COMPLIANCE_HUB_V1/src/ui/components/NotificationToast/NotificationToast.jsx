import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../core/notifications/useNotifications';
import { NOTIFICATION_COPY } from '../../../core/notifications/notificationTypes';
import './NotificationToast.css';

export default function NotificationToast() {
    const { latestToast, dismissToast, markAsRead } = useNotifications();
    const navigate = useNavigate();

    useEffect(() => {
        if (!latestToast) return undefined;
        const timer = setTimeout(() => {
            dismissToast();
        }, 8000);
        return () => clearTimeout(timer);
    }, [latestToast, dismissToast]);

    if (!latestToast) return null;

    const copy = NOTIFICATION_COPY[latestToast.type] || NOTIFICATION_COPY.CASE_COMPLETED;
    const title = latestToast.title || copy.fallbackTitle;
    const message = latestToast.message || copy.fallbackMessage;
    const actionLabel = copy.actionLabel;

    const handleAction = () => {
        if (latestToast.targetUrl) {
            navigate(latestToast.targetUrl);
        }
        markAsRead(latestToast.id);
        dismissToast();
    };

    const handleClose = () => {
        dismissToast();
    };

    return (
        <div className="notification-toast" role="alert" aria-live="polite">
            <div className="notification-toast__content">
                <div className="notification-toast__header">
                    <span className="notification-toast__icon">🔔</span>
                    <strong className="notification-toast__title">{title}</strong>
                </div>
                <p className="notification-toast__message">{message}</p>
                <div className="notification-toast__actions">
                    <button
                        type="button"
                        className="notification-toast__action-btn"
                        onClick={handleAction}
                    >
                        {actionLabel}
                    </button>
                    <button
                        type="button"
                        className="notification-toast__close-btn"
                        onClick={handleClose}
                        aria-label="Fechar notificação"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}
