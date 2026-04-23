import './EmptyState.css';

/**
 * Shared empty/loading/error state. Variant controls color + icon hint.
 * Keeps pages from reinventing "Carregando..." / "Nenhum item" / "Erro".
 */
export default function EmptyState({
    variant = 'empty',
    title,
    message,
    action,
    testId,
}) {
    const glyph = variant === 'loading' ? '⏳' : variant === 'error' ? '!' : '·';

    return (
        <div
            className={`empty-state empty-state--${variant}`}
            role={variant === 'error' ? 'alert' : 'status'}
            aria-live={variant === 'loading' ? 'polite' : 'off'}
            data-testid={testId}
        >
            <span className="empty-state__glyph" aria-hidden="true">{glyph}</span>
            {title && <h3 className="empty-state__title">{title}</h3>}
            {message && <p className="empty-state__message">{message}</p>}
            {action && <div className="empty-state__action">{action}</div>}
        </div>
    );
}
