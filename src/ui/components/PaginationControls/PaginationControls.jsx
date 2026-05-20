import { memo } from 'react';
import './PaginationControls.css';

function PaginationControls({ page, pageSize = 50, totalItems, onPageChange, itemLabel = 'itens' }) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);

    if (totalItems <= pageSize) return null;

    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, totalItems);

    return (
        <nav className="pagination-controls" aria-label="Paginação">
            <span className="pagination-controls__summary">
                Mostrando {start}-{end} de {totalItems} {itemLabel}
            </span>
            <div className="pagination-controls__actions">
                <button
                    type="button"
                    className="btn-secondary pagination-controls__button"
                    onClick={() => onPageChange(safePage - 1)}
                    disabled={safePage <= 1}
                >
                    Anterior
                </button>
                <span className="pagination-controls__page" aria-live="polite">
                    Página {safePage} de {totalPages}
                </span>
                <button
                    type="button"
                    className="btn-secondary pagination-controls__button"
                    onClick={() => onPageChange(safePage + 1)}
                    disabled={safePage >= totalPages}
                >
                    Próxima
                </button>
            </div>
        </nav>
    );
}

export default memo(PaginationControls);
