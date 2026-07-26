/**
 * creditRestriction.js — Normalizer da fase automática "Crédito e Restrições".
 *
 * Entrada: resultado de adapters/bigdatacorp.queryMarketplaceCredit
 *   (Quod dados restritivos + Quantum score rotativo, com ok por dataset).
 * Saída: campos flat credit* para o doc do caso + _sources no padrão dos
 *   demais normalizers BDC ({ provider, dataset, found, consultedAt }).
 *
 * Regra do semáforo (creditRestrictionFlag):
 *   RESTRICTED  — restrição ATIVA: HasNegativeIndicator, negativação ativa ou protesto
 *   ATTENTION   — sem restrição ativa, mas com histórico (negativação inativa/apontamento judicial)
 *   CLEAN       — nada encontrado
 *   NOT_AVAILABLE — dataset Quod falhou/sem dados
 * TotalIndebtednessValue NÃO pinta vermelho (quase todo adulto tem dívida ativa);
 * fica registrado em details/summary como informativo.
 */

const QUOD_DATASET = 'partner_quod_credit_risk_details_person';
const QUANTUM_DATASET = 'partner_quantum_score_person';

// Data sentinela da Quod para "sem negativação"
const QUOD_EMPTY_DATE = '0001-01-01T00:00:00';

function toCount(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function deriveCreditRestrictionFlag(quodData) {
    if (!quodData || typeof quodData !== 'object') return 'NOT_AVAILABLE';
    const activeNegative = toCount(quodData.TotalActiveNegativeAppointments);
    const protests = toCount(quodData.TotalRegisteredProtests);
    if (quodData.HasNegativeIndicator === true || activeNegative > 0 || protests > 0) {
        return 'RESTRICTED';
    }
    const inactiveNegative = toCount(quodData.TotalInactiveNegativeAppointments);
    const lawsuits = toCount(quodData.TotalLawsuitsAppointments);
    if (inactiveNegative > 0 || lawsuits > 0) {
        return 'ATTENTION';
    }
    return 'CLEAN';
}

function normalizeQuantumScore(rawScore) {
    if (rawScore === null || rawScore === undefined) return null;
    const str = String(rawScore).trim();
    if (str === '' || !/^\d+$/.test(str)) return null;
    return Number(str);
}

function formatBRL(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatRefDate(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/**
 * Frases com o detalhamento das restricoes (maior debito e acoes judiciais),
 * quando a Quod devolve as listas NegativeAppointmentsDetails/LawsuitsAppointmentsDetails.
 */
function describeAppointments(details) {
    const lines = [];

    const negatives = Array.isArray(details?.negativeAppointments) ? details.negativeAppointments : [];
    if (negatives.length > 0) {
        const top = negatives[0];
        const amount = formatBRL(top.amount);
        const when = formatRefDate(top.referenceDate);
        if (amount) {
            lines.push(`Maior débito negativado: ${amount}${top.nature ? ` (natureza ${top.nature})` : ''}${when ? ` desde ${when}` : ''}.`);
        }
    }

    const lawsuits = Array.isArray(details?.lawsuitAppointments) ? details.lawsuitAppointments : [];
    if (lawsuits.length > 0) {
        const described = lawsuits.slice(0, 3).map((item) => {
            const pieces = [item.processType || 'Ação judicial'];
            if (item.author) pieces.push(`autor: ${item.author}`);
            const when = formatRefDate(item.referenceDate);
            if (when) pieces.push(when);
            return pieces.join(' — ');
        });
        lines.push(`Ações judiciais de cobrança: ${described.join('; ')}.`);
    }

    const lastNegative = formatRefDate(details?.lastNegativeAppointmentDate);
    if (lastNegative) lines.push(`Última negativação registrada em ${lastNegative}.`);

    return lines;
}

function buildCreditRestrictionSummary(flag, details, quantumScore) {
    const parts = [];
    if (flag === 'NOT_AVAILABLE') {
        parts.push('Consulta de crédito/restrições indisponível na base Quod.');
    } else if (flag === 'RESTRICTED') {
        const items = [];
        if (toCount(details?.activeNegativeAppointments) > 0) items.push(`${details.activeNegativeAppointments} negativação(ões) ativa(s)`);
        if (toCount(details?.registeredProtests) > 0) items.push(`${details.registeredProtests} protesto(s) registrado(s)`);
        parts.push(`Restrições de crédito ativas${items.length ? `: ${items.join(', ')}` : ''}.`);
        const debt = formatBRL(details?.indebtednessValue);
        if (debt) parts.push(`Dívidas pendentes: ${debt}.`);
        parts.push(...describeAppointments(details));
    } else if (flag === 'ATTENTION') {
        const items = [];
        if (toCount(details?.inactiveNegativeAppointments) > 0) items.push(`${details.inactiveNegativeAppointments} negativação(ões) inativa(s)`);
        if (toCount(details?.lawsuitsAppointments) > 0) items.push(`${details.lawsuitsAppointments} apontamento(s) judicial(is)`);
        parts.push(`Sem restrições ativas; histórico encontrado${items.length ? `: ${items.join(', ')}` : ''}.`);
        parts.push(...describeAppointments(details));
    } else {
        parts.push('Sem restrições de crédito ativas na base Quod.');
    }
    if (quantumScore !== null && quantumScore !== undefined) {
        parts.push(`Score de crédito rotativo Quantum: ${quantumScore} (0-999, menor = maior risco).`);
    }
    return parts.join(' ');
}

// Maximo de itens detalhados persistidos por lista (evita doc gigante no caso)
const MAX_DETAIL_ITEMS = 5;

function buildNegativeAppointments(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            nature: item.Nature || null,
            amount: Number(item.Amount) || 0,
            status: item.Status || null,
            referenceDate: item.ReferenceDate && item.ReferenceDate !== QUOD_EMPTY_DATE ? item.ReferenceDate : null,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, MAX_DETAIL_ITEMS);
}

function buildLawsuitAppointments(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            processType: item.ProcessType || null,
            author: item.ProcessAuthor || null,
            justiceType: item.JusticeType || null,
            amount: Number(item.Amount) || 0,
            referenceDate: item.ReferenceDate && item.ReferenceDate !== QUOD_EMPTY_DATE ? item.ReferenceDate : null,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, MAX_DETAIL_ITEMS);
}

function buildDetails(quodData) {
    if (!quodData || typeof quodData !== 'object') return null;
    const lastNegative = quodData.LastNegativeAppointmentDate;
    return {
        negativeAppointments: buildNegativeAppointments(quodData.NegativeAppointmentsDetails),
        lawsuitAppointments: buildLawsuitAppointments(quodData.LawsuitsAppointmentsDetails),
        hasMinRegister: quodData.HasMinRegister === true,
        hasNegativeIndicator: quodData.HasNegativeIndicator === true,
        hasInquiryIndicator: quodData.HasInquiryIndicator === true,
        activeNegativeAppointments: toCount(quodData.TotalActiveNegativeAppointments),
        inactiveNegativeAppointments: toCount(quodData.TotalInactiveNegativeAppointments),
        lawsuitsAppointments: toCount(quodData.TotalLawsuitsAppointments),
        registeredProtests: toCount(quodData.TotalRegisteredProtests),
        indebtednessValue: Number(quodData.TotalIndebtednessValue) || 0,
        lastNegativeAppointmentDate: lastNegative && lastNegative !== QUOD_EMPTY_DATE ? lastNegative : null,
        inquiriesLast30Days: toCount(quodData.TotalInquiriesLast30Days),
        inquiriesLast60Days: toCount(quodData.TotalInquiriesLast60Days),
        inquiriesLast90Days: toCount(quodData.TotalInquiriesLast90Days),
        inquiriesMore90Days: toCount(quodData.TotalInquiriesMore90Days),
    };
}

function normalizeCreditRestriction(marketplaceResult = {}) {
    const quodRisk = marketplaceResult.quodRisk || { ok: false, data: null };
    const quantum = marketplaceResult.quantumScore || { ok: false, score: null };
    const consultedAt = new Date().toISOString();

    const quodOk = quodRisk.ok === true && quodRisk.data;
    const details = quodOk ? buildDetails(quodRisk.data) : null;
    const flag = quodOk ? deriveCreditRestrictionFlag(quodRisk.data) : 'NOT_AVAILABLE';
    const score = quantum.ok === true ? normalizeQuantumScore(quantum.score) : null;

    return {
        creditRestrictionFlag: flag,
        creditQuantumScore: score,
        creditRestrictionSummary: buildCreditRestrictionSummary(flag, details, score),
        creditRestrictionDetails: details,
        _sources: {
            quodRisk: {
                provider: 'bigdatacorp',
                dataset: QUOD_DATASET,
                found: Boolean(quodOk),
                consultedAt,
            },
            quantumScore: {
                provider: 'bigdatacorp',
                dataset: QUANTUM_DATASET,
                found: score !== null,
                consultedAt,
            },
        },
    };
}

module.exports = {
    deriveCreditRestrictionFlag,
    normalizeQuantumScore,
    buildCreditRestrictionSummary,
    normalizeCreditRestriction,
};
