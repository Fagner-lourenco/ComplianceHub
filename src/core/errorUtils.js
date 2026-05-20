/**
 * Firebase callable error code → user-friendly fallback (PT-BR).
 * These are used only when error.message is empty or too generic.
 */
const FIREBASE_CODE_MAP = {
    'invalid-argument':    'Dados enviados sao invalidos. Revise os campos e tente novamente.',
    'not-found':           'O registro solicitado nao foi encontrado.',
    'permission-denied':   'Voce nao tem permissao para esta acao.',
    'unauthenticated':     'Sua sessao expirou. Faca login novamente.',
    'resource-exhausted':  'Limite de uso atingido. Tente novamente mais tarde.',
    'failed-precondition': 'Esta acao nao pode ser realizada no estado atual do registro.',
    'already-exists':      'Este registro ja existe.',
    'internal':            'Ocorreu um erro interno no servidor. Tente novamente em alguns instantes.',
    'unavailable':         'Servico temporariamente indisponivel. Tente novamente em alguns instantes.',
    'deadline-exceeded':   'O servidor demorou para responder. Tente novamente.',
};

/**
 * Patterns that indicate the raw message should NOT be surfaced to the user.
 */
const UNSAFE_PATTERNS = [
    /at\s+\w+\s*\(/i,       // stack trace line
    /\/node_modules\//i,     // internal path
    /ECONNREFUSED/i,         // low-level network
    /ENOTFOUND/i,
    /ERR_/i,
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,  // IP addresses
];

function isSafeForUser(message) {
    if (typeof message !== 'string') return false;
    if (UNSAFE_PATTERNS.some((pattern) => pattern.test(message))) return false;
    // Single-word ASCII messages (e.g. "timeout", "forbidden") are technical, not user-friendly
    if (/^[a-z_-]+$/i.test(message)) return false;
    return true;
}

function cleanMessage(raw) {
    if (typeof raw !== 'string') return raw;
    return raw
        .replace(/^FirebaseError:\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .trim();
}

/**
 * Extract a human-readable message from any error object.
 * Backwards-compatible — same signature as before.
 */
export function extractErrorMessage(error, defaultMessage = 'Ocorreu um erro inesperado.') {
    if (!error) return defaultMessage;

    // 0. Handle plain strings (backend stores provider errors as raw strings in Firestore)
    if (typeof error === 'string') {
        const cleaned = cleanMessage(error);
        return (cleaned && isSafeForUser(cleaned)) ? cleaned : defaultMessage;
    }

    // 1. Try the raw message / details
    let message = error.message || error.details || '';
    message = cleanMessage(message);

    // 2. If the raw message looks unsafe (stack traces, IPs), fall through to code map
    if (!message || !isSafeForUser(message)) {
        message = '';
    }

    // 3. If no usable message so far, try Firebase error code fallback
    if (!message && error.code) {
        const codeKey = String(error.code).replace(/^functions\//, '');
        message = FIREBASE_CODE_MAP[codeKey] || '';
    }

    return message || defaultMessage;
}

/**
 * Classify an error into a category to allow components to react differently
 * (e.g. show "retry" button for transient errors).
 */
export function classifyError(error) {
    if (!error) return { type: 'unknown', message: '', retryable: false };

    const message = extractErrorMessage(error);
    const code = String(error.code || '').replace(/^functions\//, '');

    if (code === 'unauthenticated' || code === 'permission-denied') {
        return { type: 'auth', message, retryable: false };
    }
    if (code === 'resource-exhausted') {
        return { type: 'limit', message, retryable: false };
    }
    if (code === 'invalid-argument' || code === 'failed-precondition' || code === 'already-exists') {
        return { type: 'validation', message, retryable: false };
    }
    if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'internal') {
        return { type: 'server', message, retryable: true };
    }
    if (error.message && /network|timeout|conexao|ECONNREFUSED|ENOTFOUND/i.test(error.message)) {
        return { type: 'network', message, retryable: true };
    }

    return { type: 'unknown', message, retryable: false };
}

/**
 * Build a context-aware, user-friendly error message.
 *
 * @param {Error} error           - The caught error
 * @param {string} operationLabel - What the user was trying to do (e.g. "reenviar o caso")
 * @returns {string}
 */
export function getUserFriendlyMessage(error, operationLabel) {
    const { type, message, retryable } = classifyError(error);

    const prefix = operationLabel
        ? `Nao foi possivel ${operationLabel}`
        : 'A operacao falhou';

    // For auth errors, be direct
    if (type === 'auth') {
        return message;
    }

    // For limit errors, the backend message is already descriptive
    if (type === 'limit') {
        return message;
    }

    // For validation errors, show the backend detail
    if (type === 'validation') {
        return `${prefix}: ${message}`;
    }

    // For network/server errors, add a retry hint
    if (retryable) {
        return `${prefix}. Verifique sua conexao e tente novamente.`;
    }

    // Fallback: combine prefix with detail if available
    if (message && message !== prefix) {
        return `${prefix}: ${message}`;
    }

    return `${prefix}. Tente novamente.`;
}
