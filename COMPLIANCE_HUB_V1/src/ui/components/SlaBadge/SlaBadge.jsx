import { memo, useEffect, useState } from 'react';
import { getSlaStatus, getSlaColor } from '../../../core/caseSla';
import { formatDateTimeBR } from '../../../core/formatDate';
import './SlaBadge.css';

/* =========================================================
   Shared clock — one interval for all SlaBadge instances
   ========================================================= */

let intervalId = null;
const listeners = new Set();

function notifyListeners() {
    listeners.forEach((fn) => fn());
}

function subscribeToClock(callback) {
    listeners.add(callback);
    if (listeners.size === 1) {
        intervalId = window.setInterval(notifyListeners, 60_000);
    }
    return () => {
        listeners.delete(callback);
        if (listeners.size === 0 && intervalId !== null) {
            window.clearInterval(intervalId);
            intervalId = null;
        }
    };
}

/**
 * Indicador de prazo que mostra tempo restante / atraso de uma solicitação.
 * Auto-refreshes every minute for pending cases.
 */
function SlaBadge({ caseData, size = 'sm', audience = 'client' }) {
    const [, setTick] = useState(0);

    const isPending = !['DONE', 'ARCHIVED'].includes(caseData?.status);

    useEffect(() => {
        if (!isPending) return undefined;
        return subscribeToClock(() => setTick((t) => t + 1));
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
