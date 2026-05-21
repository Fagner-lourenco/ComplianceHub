const { normalizeLegalText } = require('./roleClassifier');

const CRIMINAL_AREA = /\b(DIREITO\s+PENAL|DIREITO\s+PROCESSUAL\s+PENAL|DIREITO\s+PENAL\s+MILITAR|CRIMINAL|PENAL|ESPECIAL\s+CRIMINAL)\b/;
const LABOR_AREA = /\b(DIREITO\s+DO\s+TRABALHO|TRABALHISTA|TRABALHO)\b/;
const AMBIGUOUS_PROCEDURAL_LABOR = /DIREITO\s+PROCESSUAL\s+CIVIL\s+E\s+DO\s+TRABALHO/;

const CRIMINAL_PROCEDURE = /\b(ACAO\s+PENAL|APELACAO\s+CRIMINAL|CARTA\s+PRECATORIA\s+CRIMINAL|TERMO\s+CIRCUNSTANCIADO|INQUERITO\s+POLICIAL|AUTO\s+DE\s+PRISAO\s+EM\s+FLAGRANTE|MEDIDAS\s+PROTETIVAS.*CRIMINAL|HABEAS\s+CORPUS\s+CRIMINAL|EXECUCAO\s+DA\s+PENA|EXECUCAO\s+PROVISORIA|REPRESENTACAO\s+CRIMINAL|NOTICIA\s+DE\s+CRIME|PETICAO\s+CRIMINAL|PROCEDIMENTO\s+INVESTIGATORIO\s+CRIMINAL|PIC\s+MP)\b/;
const LABOR_PROCEDURE = /\b(ACAO\s+TRABALHISTA|RECURSO\s+ORDINARIO\s+TRABALHISTA|RECURSO\s+ORDINARIO\s+RITO\s+SUMARISSIMO|RITO\s+ORDINARIO|RITO\s+SUMARISSIMO|AGRAVO\s+DE\s+INSTRUMENTO\s+EM\s+RECURSO\s+DE\s+REVISTA|RECLAMACAO\s+TRABALHISTA|DISSIDIO)\b/;

const CRIMINAL_SUBJECT = /\b(ROUBO|FURTO|TRAFICO\s+DE\s+DROGAS|HOMICIDIO|AMEACA|ESTELIONATO|VIOLENCIA\s+DOMESTICA|MARIA\s+DA\s+PENHA|CONTRA\s+A\s+MULHER|POSSE\s+DE\s+DROGAS|RECEPTACAO|DESACATO|CALUNIA|INJURIA|EXTORSAO|PENA\s+PRIVATIVA\s+DE\s+LIBERDADE|PENA\s+RESTRITIVA\s+DE\s+DIREITOS|PRISAO\s+EM\s+FLAGRANTE|CRIMES?\s+DE\s+TRANSITO|CRIMES?\s+DO\s+SISTEMA\s+NACIONAL\s+DE\s+ARMAS|CONTRAVENCOES?\s+PENAIS?)\b/;
const LABOR_SUBJECT = /\b(HORAS\s+EXTRAS|ADICIONAL\s+DE\s+INSALUBRIDADE|ADICIONAL\s+DE\s+PERICULOSIDADE|FGTS|RESCISAO\s+INDIRETA|VERBAS\s+RESCISORIAS|ACUMULO\s+DE\s+FUNCAO|DESVIO\s+DE\s+FUNCAO|DOENCA\s+OCUPACIONAL|ASSEDIO\s+MORAL|RECONHECIMENTO\s+DE\s+RELACAO\s+DE\s+EMPREGO|VALE\s+TRANSPORTE|AVISO\s+PREVIO|MULTA\s+DO\s+ARTIGO\s+477\s+DA\s+CLT)\b/;

const WEAK_GENERIC_TERMS = /^(INTIMACAO|CITACAO|LEVE|GRAVE|CARTA\s+PRECATORIA|PETICAO|INDEFINIDO|NOTIFICACAO)$/;

function normalizeList(values) {
    return (Array.isArray(values) ? values : [values])
        .filter((value) => value !== undefined && value !== null)
        .map(normalizeLegalText)
        .filter(Boolean);
}

function classifyProcessArea(input = {}) {
    const tags = input.tags || {};
    const values = normalizeList([
        input.area,
        input.courtType,
        input.broadSubject,
        input.cnjBroadSubject,
        input.subject,
        input.cnjSubject,
        input.procedure,
        input.cnjProcedure,
        input.className,
        input.classe,
        input.tribunal,
        input.justice,
        ...(input.subjects || []),
        ...(input.classifications || []),
        ...(input.procedures || []),
    ]);
    const joined = values.join(' | ');
    const reasons = [];

    if (tags.criminal === true) {
        return { area: 'CRIMINAL', confidence: 'HIGH', reasons: ['TAG_CRIMINAL'] };
    }

    if (values.some((value) => CRIMINAL_AREA.test(value))) reasons.push('CRIMINAL_AREA');
    if (values.some((value) => CRIMINAL_PROCEDURE.test(value))) reasons.push('CRIMINAL_PROCEDURE');
    if (values.some((value) => CRIMINAL_SUBJECT.test(value) && !WEAK_GENERIC_TERMS.test(value))) reasons.push('CRIMINAL_SUBJECT');

    if (values.some((value) => LABOR_AREA.test(value) && !AMBIGUOUS_PROCEDURAL_LABOR.test(value))) reasons.push('LABOR_AREA');
    if (values.some((value) => LABOR_PROCEDURE.test(value))) reasons.push('LABOR_PROCEDURE');
    if (values.some((value) => LABOR_SUBJECT.test(value))) reasons.push('LABOR_SUBJECT');
    if (values.some((value) => /\b(TRT\d*|TST)\b/.test(value))) reasons.push('LABOR_COURT');

    const criminalReasons = reasons.filter((reason) => reason.startsWith('CRIMINAL'));
    const laborReasons = reasons.filter((reason) => reason.startsWith('LABOR'));

    if (criminalReasons.length > 0 && laborReasons.length === 0) {
        return { area: 'CRIMINAL', confidence: criminalReasons.includes('CRIMINAL_AREA') || criminalReasons.includes('CRIMINAL_PROCEDURE') ? 'HIGH' : 'MEDIUM', reasons: criminalReasons };
    }

    if (laborReasons.length > 0 && criminalReasons.length === 0) {
        return { area: 'LABOR', confidence: laborReasons.includes('LABOR_AREA') || laborReasons.includes('LABOR_PROCEDURE') || laborReasons.includes('LABOR_COURT') ? 'HIGH' : 'MEDIUM', reasons: laborReasons };
    }

    if (criminalReasons.length > 0 && laborReasons.length > 0) {
        return { area: 'UNKNOWN', confidence: 'LOW', reasons: ['MIXED_SIGNALS', ...reasons] };
    }

    if (/\b(CIVEL|DIREITO\s+CIVIL|CONSUMIDOR|PREVIDENCIARIO|TRIBUTARIO|ELEITORAL|FAZENDA)\b/.test(joined)) {
        return { area: 'CIVIL', confidence: 'MEDIUM', reasons: ['NON_CRIMINAL_NON_LABOR_AREA'] };
    }

    return { area: 'UNKNOWN', confidence: 'LOW', reasons: [] };
}

module.exports = {
    classifyProcessArea,
    normalizeList,
};
