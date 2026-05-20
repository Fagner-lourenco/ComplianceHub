/**
 * SLA calculation utilities for cases.
 *
 * Each case has:
 *   - createdAt: ISO string or Firestore Timestamp
 *   - slaHours: number (default 48)
 *   - status: 'PENDING' | 'IN_PROGRESS' | 'WAITING_INFO' | 'DONE' | 'CORRECTION_NEEDED'
 *   - concludedAt: ISO string or null
 *   - turnaroundHours: number or null
 */

const DEFAULT_SLA_HOURS = 48;
const WARNING_THRESHOLD = 0.75; // last 25% of SLA triggers warning

function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        return value.toDate();
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDuration(totalMinutes) {
    const isNegative = totalMinutes < 0;
    const minutes = Math.abs(Math.round(totalMinutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (h === 0) {
        return `${isNegative ? '-' : ''}${m}min`;
    }
    if (m === 0) {
        return `${isNegative ? '-' : ''}${h}h`;
    }
    return `${isNegative ? '-' : ''}${h}h ${m}min`;
}

/**
 * Calculate the SLA deadline for a case.
 * @param {object} caseData
 * @returns {Date|null}
 */
export function getSlaDeadline(caseData) {
    const created = parseDate(caseData?.createdAt);
    if (!created) return null;
    const slaHours = caseData?.slaHours ?? DEFAULT_SLA_HOURS;
    return new Date(created.getTime() + slaHours * 60 * 60 * 1000);
}

/**
 * Get the full SLA status for a case.
 * @param {object} caseData
 * @param {Date} [now] — optional reference time (useful for tests)
 * @returns {{
 *   state: 'on_time'|'warning'|'overdue'|'completed_on_time'|'completed_late'|'no_sla',
 *   remainingMs: number,
 *   remainingText: string,
 *   percentElapsed: number,
 *   deadline: Date|null,
 *   slaHours: number,
 * }}
 */
export function getSlaStatus(caseData, now = new Date()) {
    const slaHours = caseData?.slaHours ?? DEFAULT_SLA_HOURS;
    const deadline = getSlaDeadline(caseData);

    if (!deadline) {
        return {
            state: 'no_sla',
            remainingMs: 0,
            remainingText: '—',
            percentElapsed: 0,
            deadline: null,
            slaHours,
        };
    }

    const isDone = caseData?.status === 'DONE';
    const totalMs = slaHours * 60 * 60 * 1000;

    if (isDone) {
        const concluded = parseDate(caseData?.concludedAt);
        const created = parseDate(caseData?.createdAt);
        const elapsedMs = concluded && created
            ? concluded.getTime() - created.getTime()
            : (caseData?.turnaroundHours ?? 0) * 60 * 60 * 1000;
        const onTime = elapsedMs <= totalMs;
        return {
            state: onTime ? 'completed_on_time' : 'completed_late',
            remainingMs: totalMs - elapsedMs,
            remainingText: onTime
                ? `Concluído em ${formatDuration(elapsedMs / 60000)}`
                : `Atrasado ${formatDuration((elapsedMs - totalMs) / 60000)}`,
            percentElapsed: Math.max(0, (elapsedMs / totalMs) * 100),
            deadline,
            slaHours,
        };
    }

    const remainingMs = deadline.getTime() - now.getTime();
    const elapsedMs = totalMs - remainingMs;
    const percentElapsed = Math.max(0, (elapsedMs / totalMs) * 100);

    if (remainingMs < 0) {
        return {
            state: 'overdue',
            remainingMs,
            remainingText: `Vencido há ${formatDuration(-remainingMs / 60000)}`,
            percentElapsed,
            deadline,
            slaHours,
        };
    }

    if (percentElapsed >= WARNING_THRESHOLD * 100) {
        return {
            state: 'warning',
            remainingMs,
            remainingText: formatDuration(remainingMs / 60000),
            percentElapsed,
            deadline,
            slaHours,
        };
    }

    return {
        state: 'on_time',
        remainingMs,
        remainingText: formatDuration(remainingMs / 60000),
        percentElapsed,
        deadline,
        slaHours,
    };
}

/**
 * Get a CSS color token suffix for the SLA state.
 */
export function getSlaColor(state) {
    switch (state) {
        case 'on_time':
        case 'completed_on_time':
            return 'green';
        case 'warning':
            return 'yellow';
        case 'overdue':
        case 'completed_late':
            return 'red';
        default:
            return 'gray';
    }
}
