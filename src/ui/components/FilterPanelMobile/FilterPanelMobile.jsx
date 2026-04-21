import { useState } from 'react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import './FilterPanelMobile.css';

/**
 * Responsive filter panel: on mobile, shows search visible + collapsible advanced filters.
 * On desktop, renders children as-is (passthrough).
 *
 * Props:
 * - children: the full filter bar (rendered on desktop, or inside collapsible on mobile)
 * - searchElement: ReactNode — the search input to keep always visible on mobile
 * - activeFilterCount: number — badge count of active filters
 * - breakpoint: number (default 768)
 */
export default function FilterPanelMobile({
    children,
    searchElement,
    activeFilterCount = 0,
    breakpoint = 768,
}) {
    const isMobile = useMediaQuery(`(max-width: ${breakpoint}px)`);
    const [isOpen, setIsOpen] = useState(false);

    if (!isMobile) {
        return children || null;
    }

    return (
        <div className="filter-panel-mobile">
            <div className="filter-panel-mobile__top">
                {searchElement}
                <button
                    className="filter-panel-mobile__toggle"
                    onClick={() => setIsOpen((prev) => !prev)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Fechar filtros' : 'Abrir filtros'}
                    type="button"
                >
                    <span className="filter-panel-mobile__toggle-icon">{isOpen ? '✕' : '⚙'}</span>
                    <span>Filtros</span>
                    {activeFilterCount > 0 && (
                        <span className="filter-panel-mobile__badge">{activeFilterCount}</span>
                    )}
                </button>
            </div>

            {isOpen && (
                <div className="filter-panel-mobile__panel">
                    {children}
                </div>
            )}
        </div>
    );
}
