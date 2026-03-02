import './StatusBadge.css';

const STATUS_MAP = {
    PENDING: { label: 'Pendente', color: 'yellow' },
    IN_PROGRESS: { label: 'Em Análise', color: 'blue' },
    WAITING_INFO: { label: 'Aguardando Info', color: 'orange' },
    DONE: { label: 'Concluído', color: 'green' },
    ARCHIVED: { label: 'Arquivado', color: 'gray' },
};

export default function StatusBadge({ status }) {
    const cfg = STATUS_MAP[status] || { label: status, color: 'gray' };
    return (
        <span className={`status-badge status-badge--${cfg.color}`}>
            <span className="status-badge__dot" />
            {cfg.label}
        </span>
    );
}
