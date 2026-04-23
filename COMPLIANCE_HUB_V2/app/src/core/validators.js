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

export function validateCnpj(cnpj) {
    const digits = String(cnpj || '').replace(/\D/g, '');
    if (digits.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(digits)) return false;

    const calcCheck = (length) => {
        let sum = 0;
        let weight = length - 7;
        for (let i = 0; i < length; i++) {
            sum += Number(digits[i]) * weight;
            weight = weight === 2 ? 9 : weight - 1;
        }
        const remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    };

    if (calcCheck(12) !== Number(digits[12])) return false;
    if (calcCheck(13) !== Number(digits[13])) return false;
    return true;
}

export function formatCnpj(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
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
