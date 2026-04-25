import { useEffect, useId, useRef } from 'react';
import './Modal.css';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container) {
    if (!container) return [];
    return [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
}

export default function Modal({
    open,
    onClose,
    title,
    footer = null,
    children,
    maxWidth = 640,
}) {
    const titleId = useId();
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const previousFocusRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        previousFocusRef.current = document.activeElement;
        const timer = window.setTimeout(() => {
            const focusable = getFocusableElements(dialogRef.current);
            (focusable[0] || closeRef.current)?.focus();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        if (!open) {
            if (previousFocusRef.current?.focus) {
                previousFocusRef.current.focus();
            }
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose?.();
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = getFocusableElements(dialogRef.current);
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey) {
                if (active === first || !dialogRef.current?.contains(active)) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="app-modal__overlay" onMouseDown={onClose}>
            <div
                ref={dialogRef}
                className="app-modal__content"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={{ maxWidth }}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="app-modal__header">
                    <h3 id={titleId} className="app-modal__title">{title}</h3>
                    <button
                        ref={closeRef}
                        type="button"
                        className="app-modal__close"
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        X
                    </button>
                </div>
                <div className="app-modal__body">{children}</div>
                {footer ? <div className="app-modal__footer">{footer}</div> : null}
            </div>
        </div>
    );
}
