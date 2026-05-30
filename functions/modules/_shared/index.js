/**
 * Módulo _shared — utilitários compartilhados entre todos os módulos
 * Extraído do monolito index.js durante refatoração Phase C
 */

/**
 * Retorna o valor de uma métrica de caso para ordenação
 * @param {Object} caseData
 * @param {string} field
 * @returns {number}
 */
function getMetricCaseDate(caseData, field) {
    const val = caseData[field];
    if (!val) return 0;
    const date = val.toDate ? val.toDate() : new Date(val);
    return isNaN(date.getTime()) ? 0 : date.getTime();
}

/**
 * Compara dois casos para ordenação no portal ops
 * @param {Object} left
 * @param {Object} right
 * @param {string} sortField
 * @param {'asc'|'desc'} sortDir
 * @returns {number}
 */
function compareOpsCases(left, right, sortField, sortDir) {
    const dir = sortDir === 'desc' ? -1 : 1;
    const a = left[sortField];
    const b = right[sortField];

    if (sortField === 'createdAt' || sortField === 'updatedAt' || sortField === 'concludedAt') {
        const da = getMetricCaseDate(left, sortField);
        const db = getMetricCaseDate(right, sortField);
        return (da - db) * dir;
    }

    if (typeof a === 'number' && typeof b === 'number') {
        return (a - b) * dir;
    }

    const sa = String(a ?? '').toLowerCase();
    const sb = String(b ?? '').toLowerCase();
    return sa.localeCompare(sb) * dir;
}

/**
 * Compara dois casos para ordenação no portal cliente
 * @param {Object} left
 * @param {Object} right
 * @param {string} sortField
 * @param {'asc'|'desc'} sortDir
 * @returns {number}
 */
function compareClientCases(left, right, sortField, sortDir) {
    const dir = sortDir === 'desc' ? -1 : 1;
    const a = left[sortField];
    const b = right[sortField];

    if (sortField === 'createdAt' || sortField === 'updatedAt') {
        const da = getMetricCaseDate(left, sortField);
        const db = getMetricCaseDate(right, sortField);
        return (da - db) * dir;
    }

    if (typeof a === 'number' && typeof b === 'number') {
        return (a - b) * dir;
    }

    const sa = String(a ?? '').toLowerCase();
    const sb = String(b ?? '').toLowerCase();
    return sa.localeCompare(sb) * dir;
}

/**
 * Verifica se perfil pode atribuir casos
 * @param {Object} profile
 * @returns {boolean}
 */
function canAssignCases(profile = {}) {
    return ['supervisor', 'admin', 'owner'].includes(profile.role);
}

/**
 * Garante que o perfil pode atribuir casos
 * @param {Object} profile
 * @throws {functions.https.HttpsError}
 */
function assertCanAssignCase(profile) {
    const { canAssignCases: canAssign } = require('./index.js');
    if (!canAssign(profile)) {
        const { functions } = require('firebase-functions/v2');
        throw new functions.https.HttpsError('permission-denied', 'Apenas supervisor, admin ou owner podem atribuir casos.');
    }
}

/**
 * Garante acesso do ops a um caso
 * @param {Object} profile
 * @param {Object} caseData
 * @param {string} caseId
 * @throws {functions.https.HttpsError}
 */
function assertOpsCanAccessCase(profile, caseData, caseId) {
    const { functions } = require('firebase-functions/v2');

    if (profile.role === 'owner') return;
    if (profile.role === 'admin' && caseData.tenantId === profile.tenantId) return;
    if (['analyst', 'supervisor'].includes(profile.role) && caseData.tenantId === profile.tenantId) return;

    throw new functions.https.HttpsError('permission-denied', `Acesso negado ao caso ${caseId}.`);
}

module.exports = {
    getMetricCaseDate,
    compareOpsCases,
    compareClientCases,
    canAssignCases,
    assertCanAssignCase,
    assertOpsCanAccessCase,
};
