import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../../core/notifications/useNotifications';
import { NOTIFICATION_COPY } from '../../../core/notifications/notificationTypes';
import { formatDate } from '../../../core/formatDate';
import './NotificationBell.css';

function timeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const then = date instanceof Date ? date : new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    return formatDate(then);
}

export default function NotificationBell() {
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        enableSoundAlerts,
        disableSoundAlerts,
        soundEnabled,
        audioUnlocked,
    } = useNotifications();

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleToggle = () => setIsOpen((prev) => !prev);

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }
        if (notification.targetUrl) {
            navigate(notification.targetUrl);
        }
        setIsOpen(false);
    };

    const handleMarkAll = async () => {
        await markAllAsRead();
    };

    const handleToggleSound = async () => {
        if (soundEnabled) {
            disableSoundAlerts();
        } else {
            await enableSoundAlerts();
        }
    };

    return (
        <div className="notification-bell" ref={dropdownRef}>
            <button
                type="button"
                className="notification-bell__trigger"
                onClick={handleToggle}
                aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ''}`}
                aria-expanded={isOpen}
            >
                <span className="notification-bell__icon">🔔</span>
                {unreadCount > 0 && (
                    <span className="notification-bell__badge" aria-hidden="true">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notification-bell__dropdown">
                    <div className="notification-bell__header">
                        <span className="notification-bell__title">Notificações</span>
                        <div className="notification-bell__header-actions">
                            {!audioUnlocked && (
                                <button
                                    type="button"
                                    className="notification-bell__sound-cta"
                                    onClick={handleToggleSound}
                                    title="Ativar alertas sonoros"
                                >
                                    🔊 Ativar alertas sonoros
                                </button>
                            )}
                            {audioUnlocked && (
                                <button
                                    type="button"
                                    className="notification-bell__sound-toggle"
                                    onClick={handleToggleSound}
                                    title={soundEnabled ? 'Desativar som' : 'Ativar som'}
                                >
                                    {soundEnabled ? '🔊' : '🔇'}
                                </button>
                            )}
                            {notifications.some((n) => !n.read) && (
                                <button
                                    type="button"
                                    className="notification-bell__mark-all"
                                    onClick={handleMarkAll}
                                >
                                    Marcar todas como lidas
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="notification-bell__list">
                        {notifications.length === 0 ? (
                            <div className="notification-bell__empty">
                                Nenhuma notificação no momento.
                            </div>
                        ) : (
                            notifications.map((notification) => {
                                const copy = NOTIFICATION_COPY[notification.type] || NOTIFICATION_COPY.CASE_COMPLETED;
                                return (
                                    <button
                                        key={notification.id}
                                        type="button"
                                        className={`notification-bell__item ${notification.read ? 'notification-bell__item--read' : 'notification-bell__item--unread'}`}
                                        onClick={() => handleNotificationClick(notification)}
                                    >
                                        <div className="notification-bell__item-dot" aria-hidden="true" />
                                        <div className="notification-bell__item-content">
                                            <div className="notification-bell__item-title">
                                                {notification.title || copy.fallbackTitle}
                                            </div>
                                            <div className="notification-bell__item-message">
                                                {notification.message || copy.fallbackMessage}
                                            </div>
                                            <div className="notification-bell__item-time">
                                                {timeAgo(notification.createdAt)}
                                            </div>
                                        </div>
                                        {!notification.read && (
                                            <span className="notification-bell__item-unread-badge" aria-hidden="true">
                                                Não lida
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
