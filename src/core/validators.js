/**
 * Validators — Domain validation functions for ComplianceHub.
 * Extracted from NovaSolicitacaoPage for reuse and testability.
 */

export function validateCpf(cpf) {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;
    for (let t = 9; t < 11; t++) {
        let sum = 0;
        for (let i = 0; i < t; i++) sum += Number(digits[i]) * (t + 1 - i);
        const remainder = (sum * 10) % 11;
        if ((remainder === 10 ? 0 : remainder) !== Number(digits[t])) return false;
    }
    return true;
}

export function validateUrl(url) {
    if (!url) return true;
    if (url.startsWith('@')) return true;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}
