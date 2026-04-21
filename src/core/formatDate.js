const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatDate(value) {
    if (!value) return '—';
    if (value instanceof Date) return dateFormatter.format(value);
    // Firestore Timestamp objects: {seconds, nanoseconds} or with toDate()
    if (typeof value === 'object' && typeof value.toDate === 'function') return dateFormatter.format(value.toDate());
    if (typeof value === 'object' && typeof value.seconds === 'number') return dateFormatter.format(new Date(value.seconds * 1000));
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return dateFormatter.format(parsed);
}
