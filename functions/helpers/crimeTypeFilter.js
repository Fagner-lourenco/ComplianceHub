/**
 * crimeTypeFilter.js — Single source of truth for excluded crime types
 * and consumer/civil noise.
 *
 * These categories do NOT change the case verdict. They were documented in
 * the audit script `correct-verdicts-after-escavador2-audit.cjs` and must
 * be applied uniformly across normalizers, dedup, and classifiers.
 */

const { normalizeLegalText } = require('./roleClassifier');

const TRANSITO = 'TRANSITO';
const AMBIENTAL = 'AMBIENTAL';
const HTE = 'HTE';
const CARTA_PRECATORIA_NOISE = 'CARTA_PRECATORIA_NOISE';
const CONSUMER_CIVIL_NOISE = 'CONSUMER_CIVIL_NOISE';

// Lei 9.503/97 (CTB), embriaguez, direcao perigosa.
// Nao inclui art. 28 / posse para uso pessoal; para este projeto, esse
// apontamento permanece material conforme decisao operacional registrada.
// NAO inclui "Acidente de Transito" (que eh consumer/civil — classificado em CONSUMER_CIVIL_NOISE).
const TRANSITO_PATTERN = /\b(CRIMES?\s+DE\s+TRANSITO|INFRACAO\s+DE\s+TRANSITO|LEI\s*9\.503|EMBRIAGUEZ\s+AO\s+VOLANTE|DIRECAO\s+PERIGOSA|ART\.?\s*306\b|ART\.?\s*302\b|ART\.?\s*303\b)\b/i;
// Homicidio no transito nao eh "transito comum" — deve ser criminal material
const HOMICIDIO_PATTERN = /\bHOMICIDIO\b/i;

// Lei 9.605/98 (meio ambiente), IBAMA, fiscalizacao.
// Regex aplicado a texto NORMALIZADO (sem pontos/vírgulas) — por isso "9 605" sem ponto.
const AMBIENTAL_PATTERN = /\b(AMBIENTAL|MEIO\s+AMBIENTE|LEI\s*9\s*605|CRIME\s+AMBIENT|IBAMA|FISCALIZACAO\s+AMBIENTAL)\b/i;

// Homologacao de Transacao Extrajudicial (acordo homologado — nao muda veredito)
const HTE_PATTERN = /\b(HOMOLOGACAO\s+DA?\s+TRANSACAO|HOMOLOGACAO\s+DE\s+TRANSACAO|HTE)\b/i;

// Carta precatoria criminal de mera intimacao/citacao/depoimento (nao eh caso criminal)
const CARTA_PRECATORIA_PATTERN = /\bCARTA\s+PRECATORIA\s+CRIMINAL\b/i;
const CARTA_PRECATORIA_NOISE_PATTERN = /\b(INTIMACAO|NOTIFICACAO|DEPONIMENTO|PROVAS|CITACAO)\b/i;

// Consumer / cobranca / civil disfarçado de criminal pela API do Escavador2
const CONSUMER_CIVIL_NOISE_PATTERN = /\b(DIREITO\s+DO\s+CONSUMIDOR|RESPONSABILIDADE\s+CIVIL|INDENIZACAO\s+POR\s+DANO|ACIDENTE\s+DE\s+TRANSITO|CARTAO\s+DE\s+CREDITO|INCLUSAO\s+INDEVIDA|ALUGUEIS|DESPEJO|OBRAS\s+SOCIAIS|PATRIMONIO\s+CULTURAL|NOTA\s+PROMISSORIA|COBRANCA|COMPRA\s+E\s+VENDA|JUIZADO\s+ESPECIAL\s+CIVEL|PROCEDIMENTO\s+COMUM\s+CIVEL|DIREITO\s+CIVIL|DUPLICATA|TITULO\s+EXTRAJUDICIAL|EXECUCAO\s+DE\s+TITULO|OBRIGACOES|ADIANTAMENTO\s+A\s+DEPOSITARIO|REINTEGRACAO\s+DE\s+POSSE|CONDOMINIO|REVISIONAL)\b/i;

function buildProcessText(process) {
    if (!process) return '';
    return normalizeLegalText([
        process.area,
        process.classe,
        process.tipo,
        process.natureza,
        process.assunto,
        process.assuntoPrincipal,
        process.subject,
        process.cnjSubject,
        process.cnjBroadSubject,
        Array.isArray(process.subjects) ? process.subjects.join(' ') : '',
        Array.isArray(process.classifications) ? process.classifications.join(' ') : '',
    ].filter(Boolean).join(' '));
}

function getClasseText(process) {
    if (!process) return '';
    if (Array.isArray(process.classifications) && process.classifications.length > 0) {
        return normalizeLegalText(process.classifications.join(' | '));
    }
    return normalizeLegalText(process.classe || process.tipo || process.natureza || '');
}

function getAssuntoText(process) {
    if (!process) return '';
    if (Array.isArray(process.subjects) && process.subjects.length > 0) {
        return normalizeLegalText(process.subjects.join(' | '));
    }
    return normalizeLegalText(
        process.assunto || process.assuntoPrincipal || process.subject || process.cnjSubject || process.cnjBroadSubject || ''
    );
}

function isExcludedCrimeType(process = {}) {
    const text = buildProcessText(process);

    // Homicidio no transito eh crime grave — NAO excluir
    if (HOMICIDIO_PATTERN.test(text)) {
        return null;
    }

    if (AMBIENTAL_PATTERN.test(text)) return AMBIENTAL;
    if (HTE_PATTERN.test(text)) return HTE;
    if (TRANSITO_PATTERN.test(text)) return TRANSITO;

    // Carta precatoria: so excluir se for mero ato processual (intimacao/citacao/depoimento)
    if (CARTA_PRECATORIA_PATTERN.test(text) && CARTA_PRECATORIA_NOISE_PATTERN.test(text)) {
        return CARTA_PRECATORIA_NOISE;
    }

    // Consumer/civil com flag criminal erronea do Escavador2
    if (CONSUMER_CIVIL_NOISE_PATTERN.test(text)) return CONSUMER_CIVIL_NOISE;

    return null;
}

function hasIdentifiableClassOrSubject(process = {}) {
    const classe = getClasseText(process);
    const assunto = getAssuntoText(process);
    if (classe === 'PROCESSO' && (assunto === 'SEM ASSUNTO' || assunto === '')) return false;
    return classe !== '' || assunto !== '';
}

module.exports = {
    isExcludedCrimeType,
    hasIdentifiableClassOrSubject,
    buildProcessText,
    TRANSITO,
    AMBIENTAL,
    HTE,
    CARTA_PRECATORIA_NOISE,
    CONSUMER_CIVIL_NOISE,
};
