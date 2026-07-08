/**
 * Tom de revisão criminal por processo — fonte única para o chip da tabela
 * (CasoPage) e o callout do ProcessInspectionModal.
 *
 * Espelha a política de functions/helpers/criminalMateriality.js:
 * baixo risco (vítima/testemunha) → exclusões (trânsito/ambiental/carta
 * precatória) → papel material → papel neutro (revisão).
 */

function normalizeReviewText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

const CRIMINAL_SUBJECT_PATTERN = /\b(CRIM|PENAL|HOMICIDIO|ROUBO|FURTO|TRAFICO|AMEACA|ESTELIONATO|RECEPTACAO|ESTUPRO|LESAO CORPORAL)/;
const LOW_RISK_ROLE_PATTERN = /\b(VITIMA|OFENDID|PREJUDICAD|AGRAVIAD|LESAD|TESTEMUNHA|INFORMANTE|ADVOGAD)/;
const EXCLUDED_SUBJECT_PATTERN = /\b(TRANSITO|CTB|EMBRIAGUEZ|DIRECAO|AMBIENTAL|MEIO AMBIENTE|CARTA PRECATORIA)/;
const MATERIAL_ROLE_PATTERN = /\b(REU|INVESTIGAD|AVERIGUAD|ACUSAD|INDICIAD|AUTOR DO FATO|EXECUTAD|DENUNCIAD|CONDENAD|FLAGRANTEAD|SENTENCIAD|PASSIVO)\b/;

export function getProcessReviewTone(process = {}) {
    const roleText = normalizeReviewText(process.specificRole || process.personType || process.tipoPrincipal || process.tipoNormalizado || process.partyType || process.roleCategory || process.polo);
    const subjectText = normalizeReviewText([
        process.assunto,
        process.cnjSubject,
        process.cnjBroadSubject,
        process.classe,
        process.courtType,
        process.area,
    ].filter(Boolean).join(' '));

    const isCriminal = process.isCriminal === true
        || (process.isCriminal !== false && CRIMINAL_SUBJECT_PATTERN.test(subjectText));
    if (!isCriminal) {
        return { level: 'neutral', label: 'Sem alerta criminal', className: 'caso-flag-chip--neutral', message: null };
    }

    if (process.isVictim || process.isWitness || LOW_RISK_ROLE_PATTERN.test(roleText)) {
        return {
            level: 'low',
            label: 'Baixo risco',
            className: 'caso-flag-chip--gray',
            message: 'O candidato aparece em papel de vítima, testemunha ou outro papel não material.',
        };
    }

    if (EXCLUDED_SUBJECT_PATTERN.test(subjectText)) {
        return {
            level: 'review',
            label: 'Revisar papel',
            className: 'caso-flag-chip--yellow',
            message: 'Achado criminal de trânsito/ambiental ou ato processual — não material por política. Revisar antes da conclusão.',
        };
    }

    if (process.isDefendant || process.isMaterialRisk || MATERIAL_ROLE_PATTERN.test(roleText)) {
        return {
            level: 'material',
            label: 'Material',
            className: 'caso-flag-chip--red',
            message: 'Papel processual sugere participação material. Validar assunto, status e duplicidade antes da conclusão.',
        };
    }

    return {
        level: 'review',
        label: 'Revisar papel',
        className: 'caso-flag-chip--yellow',
        message: 'Achado criminal confirmado, mas o papel processual é neutro ou indeterminado. Não conclua como negativo sem revisão humana.',
    };
}
