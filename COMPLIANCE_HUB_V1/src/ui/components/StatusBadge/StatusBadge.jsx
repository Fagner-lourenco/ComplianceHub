import './StatusBadge.css';

const STATUS_MAP = {
    PENDING: { label: 'Pendente', color: 'yellow' },
    IN_PROGRESS: { label: 'Em Analise', color: 'blue' },
    WAITING_INFO: { label: 'Aguardando Info', color: 'orange' },
    CORRECTION_NEEDED: { label: 'Correcao Necessaria', color: 'red' },
    DONE: { label: 'Concluido', color: 'green' },
    READY: { label: 'Registrada', color: 'blue' },
    ARCHIVED: { label: 'Arquivado', color: 'gray' },
};

export default function StatusBadge({ status }) {
    const cfg = STATUS_MAP[status] || { label: status, color: 'gray' };

    return (
        <span className={`status-badge status-badge--${cfg.color}`} aria-label={`Status: ${cfg.label}`}>
            <span className="status-badge__dot" aria-hidden="true" />
            {cfg.label}
        </span>
    );
}
