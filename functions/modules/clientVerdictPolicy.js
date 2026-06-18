const { HttpsError } = require('firebase-functions/v2/https');
const {
    normalizePartyName,
    isSamePersonName,
    isActiveLaborParty,
    getProcessParties,
    resolveCounterpartyNames,
    selectTopProcessos,
    isLowRiskCriminalProcess,
} = require('../helpers/reportHelpers');

const CLIENT_VERDICT_POLICY_EFFECTIVE_AT = new Date('2026-05-27T00:00:00.000Z');
const CLIENT_VERDICT_RANK = { FIT: 0, ATTENTION: 1, NOT_RECOMMENDED: 2 };
const CLIENT_VERDICT_LABELS = {
    FIT: 'Apto',
    ATTENTION: 'Atencao',
    NOT_RECOMMENDED: 'Nao recomendado',
};
const CLIENT_CRIMINAL_TRAFFIC_ENV_AREAS = new Set(['TRAFFIC', 'ENVIRONMENTAL']);

function normalizeVerdict(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'FIT' || normalized === 'ATTENTION' || normalized === 'NOT_RECOMMENDED') return normalized;
    return null;
}

function isVerdictAtLeast(submittedVerdict, requiredVerdict) {
    const submitted = normalizeVerdict(submittedVerdict);
    const required = normalizeVerdict(requiredVerdict) || 'FIT';
    return (CLIENT_VERDICT_RANK[submitted] ?? -1) >= CLIENT_VERDICT_RANK[required];
}

function toDateOrNull(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function shouldEnforceClientVerdictPolicy(caseData = {}) {
    if (caseData.status === 'DONE') return false;
    const createdAt = toDateOrNull(caseData.createdAt || caseData.submittedAt || caseData.requestedAt);
    if (!createdAt) return true;
    return createdAt >= CLIENT_VERDICT_POLICY_EFFECTIVE_AT;
}

function getProcessRoleText(process = {}) {
    return normalizePartyName(process.specificRole || process.polo || process.role || process.personType || '');
}

function isCandidateActiveLaborProcess(process = {}, candidateName = '') {
    if (!process.isTrabalhista) return false;
    const role = getProcessRoleText(process);
    if (/RECLAMANTE|AUTOR|REQUERENTE|EXEQUENTE|RECORRENTE|POLO ATIVO|ATIVO/.test(role)) return true;
    if (/RECLAMAD|REU|REQUERID|EXECUTAD|POLO PASSIVO|PASSIVO|RECORRIDO/.test(role)) return false;

    const parties = getProcessParties(process);
    return parties.some((party) => isSamePersonName(party?.name, candidateName) && isActiveLaborParty(party));
}

function classifyClientCriminalCategory(process = {}) {
    const text = normalizePartyName([
        process.area,
        process.classe,
        process.assunto,
        process.subject,
        process.cnjSubject,
        process.cnjBroadSubject,
    ].filter(Boolean).join(' '));
    if (/TRANSITO|CTB|EMBRIAGUEZ|DIRECAO|DIRIGIR/.test(text)) return 'TRAFFIC';
    if (/AMBIENTAL|MEIO AMBIENTE|LEI 9605|CRIME AMBIENT/.test(text)) return 'ENVIRONMENTAL';
    return 'OTHER';
}

function isClientMaterialCriminalProcess(process = {}) {
    if (!process.isCriminal || isLowRiskCriminalProcess(process)) return false;
    const role = getProcessRoleText(process);
    return process.isDefendant === true || /REU|INVESTIGAD|ACUSAD|INDICIAD|AUTOR DO FATO|EXECUTAD|DENUNCIAD/.test(role);
}

function buildClientVerdictPolicy(caseData = {}) {
    const reasons = [];
    const evidence = [];
    let requiredVerdict = 'FIT';
    const requireVerdict = (verdict, reason, item = {}) => {
        if (CLIENT_VERDICT_RANK[verdict] > CLIENT_VERDICT_RANK[requiredVerdict]) requiredVerdict = verdict;
        reasons.push(reason);
        evidence.push({ verdict, reason, ...item });
    };

    const topProcessos = selectTopProcessos(caseData, 50);
    const activeLaborProcesses = topProcessos.filter((process) => isCandidateActiveLaborProcess(process, caseData.candidateName));
    const counterpartyNames = new Set();
    let hasMaderoLabor = false;

    for (const process of activeLaborProcesses) {
        const counterparty = resolveCounterpartyNames(process, caseData.candidateName);
        for (const name of counterparty.names) {
            const normalized = normalizePartyName(name);
            if (!normalized) continue;
            counterpartyNames.add(normalized);
            if (/MADERO/.test(normalized)) hasMaderoLabor = true;
        }
    }

    if (hasMaderoLabor) {
        requireVerdict('NOT_RECOMMENDED', 'Processo trabalhista contra Madero exige Nao recomendado.', { area: 'labor' });
    } else if (counterpartyNames.size >= 2) {
        requireVerdict('NOT_RECOMMENDED', 'Dois ou mais processos trabalhistas contra empresas diferentes exigem Nao recomendado.', { area: 'labor' });
    } else if (activeLaborProcesses.length >= 1) {
        requireVerdict('ATTENTION', 'Processo trabalhista do candidato como autor/reclamante exige Atencao.', { area: 'labor' });
    }

    const criminalCategories = topProcessos
        .filter(isClientMaterialCriminalProcess)
        .map(classifyClientCriminalCategory);
    const uniqueCriminalCategories = new Set(criminalCategories);
    if (criminalCategories.length > 0) {
        const onlyTraffic = uniqueCriminalCategories.size === 1 && uniqueCriminalCategories.has('TRAFFIC');
        const onlyEnvironmental = uniqueCriminalCategories.size === 1 && uniqueCriminalCategories.has('ENVIRONMENTAL');
        if (onlyTraffic || onlyEnvironmental) {
            requireVerdict('ATTENTION', 'Processo criminal material somente de transito ou ambiental exige Atencao.', { area: 'criminal' });
        } else {
            requireVerdict('NOT_RECOMMENDED', 'Processo criminal material diferente de transito/ambiental isolado exige Nao recomendado.', { area: 'criminal' });
        }
    }

    return { requiredVerdict, reasons, evidence };
}

function hasValidClientVerdictOverride(override) {
    return override?.confirmed === true && typeof override.justification === 'string' && override.justification.trim().length >= 20;
}

function validateClientVerdictPolicy({ submittedVerdict, policy, override } = {}) {
    const requiredVerdict = normalizeVerdict(policy?.requiredVerdict) || 'FIT';
    if (isVerdictAtLeast(submittedVerdict, requiredVerdict)) return;
    if (hasValidClientVerdictOverride(override)) return;

    const requiredLabel = CLIENT_VERDICT_LABELS[requiredVerdict] || requiredVerdict;
    throw new HttpsError(
        'failed-precondition',
        `A politica do cliente exige veredito minimo: ${requiredLabel}. Confirme o override e informe justificativa para concluir com veredito inferior.`,
        {
            code: 'CLIENT_VERDICT_OVERRIDE_REQUIRED',
            requiredVerdict,
            requiredLabel,
            submittedVerdict: normalizeVerdict(submittedVerdict),
            reasons: policy?.reasons || [],
        },
    );
}

module.exports = {
    CLIENT_VERDICT_POLICY_EFFECTIVE_AT,
    CLIENT_VERDICT_RANK,
    CLIENT_VERDICT_LABELS,
    CLIENT_CRIMINAL_TRAFFIC_ENV_AREAS,
    normalizeVerdict,
    isVerdictAtLeast,
    toDateOrNull,
    shouldEnforceClientVerdictPolicy,
    getProcessRoleText,
    isCandidateActiveLaborProcess,
    classifyClientCriminalCategory,
    isClientMaterialCriminalProcess,
    buildClientVerdictPolicy,
    hasValidClientVerdictOverride,
    validateClientVerdictPolicy,
};
