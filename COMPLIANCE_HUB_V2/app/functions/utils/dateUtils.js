/**
 * Date utilities for Brazilian timezone formatting and parsing.
 */

function formatDateKey(date, timeZone = 'America/Sao_Paulo') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return year && month && day ? `${year}-${month}-${day}` : null;
}

function formatMonthKey(date, timeZone = 'America/Sao_Paulo') {
    const dayKey = formatDateKey(date, timeZone);
    return dayKey ? dayKey.slice(0, 7) : null;
}

function previousMonthKey(date = new Date(), timeZone = 'America/Sao_Paulo') {
    const currentMonth = formatMonthKey(date, timeZone);
    if (!currentMonth) return null;
    const [year, month] = currentMonth.split('-').map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 15, 12, 0, 0));
    return formatMonthKey(previous, timeZone);
}

function asDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string') {
        // Handle DD/MM/YYYY or DD/MM/YYYY HH:mm (Brazilian format from FonteData/DJEN)
        const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (brMatch) {
            const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
            const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
    formatDateKey,
    formatMonthKey,
    previousMonthKey,
    asDate,
};
