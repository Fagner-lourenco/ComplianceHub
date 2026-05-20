import { memo } from 'react';
import './StatusBadge.css';

const STATUS_MAP_CLIENT = {
    PENDING: { label: 'Recebida', color: 'yellow' },
    IN_PROGRESS: { label: 'Em análise', color: 'blue' },
    WAITING_INFO: { label: 'Aguardando informações', color: 'orange' },
    CORRECTION_NEEDED: { label: 'Correção necessária', color: 'red' },
    DONE: { label: 'Concluída', color: 'green' },
    READY: { label: 'Registrada', color: 'blue' },
    ARCHIVED: { label: 'Arquivada', color: 'gray' },
};

const STATUS_MAP_OPS = {
    PENDING: { label: 'Na fila', color: 'yellow' },
    IN_PROGRESS: { label: 'Em análise', color: 'blue' },
    WAITING_INFO: { label: 'Aguardando informações do cliente', color: 'orange' },
    CORRECTION_NEEDED: { label: 'Devolvida para correção', color: 'red' },
    DONE: { label: 'Concluída', color: 'green' },
    READY: { label: 'Registrada', color: 'blue' },
    ARCHIVED: { label: 'Arquivada', color: 'gray' },
};

function StatusBadge({ status, audience = 'client' }) {
    const map = audience === 'ops' ? STATUS_MAP_OPS : STATUS_MAP_CLIENT;
    const cfg = map[status] || { label: status, color: 'gray' };

    return (
        <span className={`status-badge status-badge--${cfg.color}`} aria-label={`Status: ${cfg.label}`}>
            <span className="status-badge__dot" aria-hidden="true" />
            {cfg.label}
        </span>
    );
}

export default memo(StatusBadge);
