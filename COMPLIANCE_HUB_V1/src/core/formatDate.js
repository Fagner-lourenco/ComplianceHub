const TIMEZONE = 'America/Sao_Paulo';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: TIMEZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: TIMEZONE,
});

function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value) {
    const d = toDate(value);
    return d ? dateFormatter.format(d) : '—';
}

export function formatDateTimeBR(value) {
    const d = toDate(value);
    return d ? dateTimeFormatter.format(d) : '—';
}
