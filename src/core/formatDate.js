const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDate(value) {
    if (!value) return '—';
    if (value instanceof Date) return dateFormatter.format(value);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return dateFormatter.format(parsed);
}
