import { memo, useEffect, useState } from 'react';
import { getSlaStatus, getSlaColor } from '../../../core/caseSla';
import { formatDateTimeBR } from '../../../core/formatDate';
import './SlaBadge.css';

/**
 * Indicador de prazo que mostra tempo restante / atraso de uma solicitação.
 * Auto-refreshes every minute for pending cases.
 */
function SlaBadge({ caseData, size = 'sm', audience = 'client' }) {
    const [, setTick] = useState(0);

    const isPending = !['DONE', 'ARCHIVED'].includes(caseData?.status);

    useEffect(() => {
        if (!isPending) return undefined;
        const id = setInterval(() => setTick((t) => t + 1), 60_000);
        return () => clearInterval(id);
    }, [isPending]);

    const status = getSlaStatus(caseData);
    const color = getSlaColor(status.state);

    const isOps = audience === 'ops';
    const slaWord = isOps ? 'Prazo combinado' : 'Prazo';

    const tooltip = status.deadline
        ? `Prazo: ${formatDateTimeBR(status.deadline)}\n${slaWord}: ${status.slaHours}h`
        : `Prazo não definido`;

    return (
        <span
            className={`sla-badge sla-badge--${color} sla-badge--${size}`}
            title={tooltip}
            aria-label={`${slaWord}: ${status.remainingText}`}
        >
            <span className="sla-badge__dot" aria-hidden="true" />
            <span className="sla-badge__label">{status.remainingText}</span>
        </span>
    );
}

export default memo(SlaBadge);
