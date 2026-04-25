import { useMediaQuery } from '../../../hooks/useMediaQuery';
import './MobileDataCardList.css';

/**
 * Renders a responsive data list: cards on mobile, passes through to table on desktop.
 *
 * Props:
 * - items: array of data objects
 * - renderCard: (item, index) => ReactNode — renders a single mobile card
 * - children: the desktop table (rendered above breakpoint)
 * - breakpoint: number (default 768) — width below which cards are shown
 * - emptyMessage: string — shown when items is empty
 * - loading: boolean
 * - className: optional wrapper className
 */
export default function MobileDataCardList({
    items = [],
    renderCard,
    children,
    breakpoint = 768,
    emptyMessage = 'Nenhum registro encontrado',
    loading = false,
    className = '',
}) {
    const isMobile = useMediaQuery(`(max-width: ${breakpoint}px)`);

    if (!isMobile) {
        return children || null;
    }

    if (loading) {
        return (
            <div className={`mobile-card-list ${className}`}>
                <div className="mobile-card-list__loading">
                    <div className="mobile-card-list__spinner" />
                    Carregando...
                </div>
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className={`mobile-card-list ${className}`}>
                <div className="mobile-card-list__empty">{emptyMessage}</div>
            </div>
        );
    }

    return (
        <div className={`mobile-card-list ${className}`}>
            {items.map((item, index) => (
                <div className="mobile-card-list__item" key={item.id || index}>
                    {renderCard(item, index)}
                </div>
            ))}
        </div>
    );
}
