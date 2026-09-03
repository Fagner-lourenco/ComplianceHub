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
// DEPONIMENTO era typo (palavra inexistente): o tier so disparava por
// intimacao/notificacao/provas/citacao, e carta precatoria de mera oitiva
// passava como processo criminal. Mantido por retrocompatibilidade de dado.
const CARTA_PRECATORIA_NOISE_PATTERN = /\b(INTIMACAO|NOTIFICACAO|DEPOIMENTO|DEPONIMENTO|OITIVA|INQUIRICAO|PROVAS|CITACAO)\b/i;

// Consumer / cobranca / civil disfarçado de criminal pela API do Escavador2.
//
// Com a inversao da politica de crime (2026-09), esta lista deixou de ser um
// filtro auxiliar e passou a ser a PRINCIPAL defesa contra o rotulo errado da
// API: como area=CRIMINAL agora basta para contar como crime, tudo que for
// materia civel precisa estar aqui. Por isso o bloco de familia/sucessoes e
// procedimentos civeis abaixo. O desempate continua sendo o
// CRIMINAL_INDICATOR_PATTERN: crime real que cita termo civel nao eh excluido.
const CONSUMER_CIVIL_NOISE_PATTERN = /\b(DIREITO\s+DO\s+CONSUMIDOR|RESPONSABILIDADE\s+CIVIL|INDENIZACAO\s+POR\s+DANO|DANOS?\s+MORAIS|ACIDENTE\s+DE\s+TRANSITO|CARTAO\s+DE\s+CREDITO|INCLUSAO\s+INDEVIDA|ALUGUEIS|DESPEJO|OBRAS\s+SOCIAIS|PATRIMONIO\s+CULTURAL|NOTA\s+PROMISSORIA|COBRANCA|COMPRA\s+E\s+VENDA|JUIZADO\s+ESPECIAL\s+CIVEL|PROCEDIMENTO\s+COMUM\s+CIVEL|DIREITO\s+CIVIL|DUPLICATA|TITULO\s+EXTRAJUDICIAL|EXECUCAO\s+DE\s+TITULO|OBRIGACOES|ADIANTAMENTO\s+A\s+DEPOSITARIO|REINTEGRACAO\s+DE\s+POSSE|CONDOMINIO|REVISIONAL|EXECUCAO\s+FISCAL|ALIENACAO\s+FIDUCIARIA|BUSCA\s+E\s+APREENSAO|PRISAO\s+CIVIL|PETICAO\s+CIVEL|CUMPRIMENTO\s+PROVISORIO|IPTU|PENSAO\s+ALIMENTICIA|TARIFAS|ALIMENTOS\s+-|DIREITO\s+PROCESSUAL\s+CIVIL|PROCEDIMENTO\s+DO\s+JUIZADO\s+ESPECIAL\s+CIVEL|ALVARA\s+JUDICIAL|INVENTARIO|PARTILHA|ARROLAMENTO|TESTAMENTO|LEVANTAMENTO\s+DE\s+VALOR|DIVORCIO|SEPARACAO\s+CONSENSUAL|GUARDA(\s+DE\s+MENOR|\s+COMPARTILHADA)?|REGULAMENTACAO\s+DE\s+VISITAS|INVESTIGACAO\s+DE\s+PATERNIDADE|INTERDICAO|CURATELA|TUTELA\s+E\s+CURATELA|ADOCAO|USUCAPIAO|MONITORIA|CONSIGNACAO\s+EM\s+PAGAMENTO|RETIFICACAO\s+DE\s+REGISTRO|PREVIDENCIARIO|BENEFICIO\s+ASSISTENCIAL|MANDADO\s+DE\s+SEGURANCA|DPVAT|PLANO\s+DE\s+SAUDE|ENERGIA\s+ELETRICA|TELEFONIA|EMPRESTIMO\s+CONSIGNADO|FINANCIAMENTO)\b/i;

// Palavras-chave que CONFIRMAM que um processo eh criminal.
//
// MUDANCA DE POLITICA (2026-09): esta lista NAO eh mais o portao de entrada do
// que conta como crime. A regra passou a ser "crime eh tudo que a fonte
// classifica como criminal, EXCETO as exclusoes taxativas" — uma lista branca
// nunca fica completa, e cada termo faltando virava falso negativo silencioso.
//
// O papel que sobrou para ela eh de DESEMPATE: quando o texto do processo casa
// com o ruido civel/consumo, um indicador criminal canonico aqui impede que um
// crime de verdade seja engolido pela exclusao (ex.: "Estelionato / Cartao de
// Credito", "Apropriacao Indebita / Cobranca").
const CRIMINAL_INDICATOR_PATTERN = /\b(ACAO\s+PENAL|INQUERITO\s+POLICIAL|PROCESSO\s+CRIMINAL|TERMO\s+CIRCUNSTANCIADO|FLAGRANTE|ESTUPRO|ROUBO|FURTO|TRAFICO|DROGAS|HOMICIDIO|VIOLENCIA\s+DOMESTICA|MARIA\s+DA\s+PENHA|LEI\s+ANTITOXICOS|LEI\s*11\s*343|LESAO\s+CORPORAL|AMEACA|CONSTRANGIMENTO|PERSEGUIM|EXECUCAO\s+PENAL|EXECUCAO\s+DA\s+PENA|PENA\s+PRIVATIVA|PENA\s+DE\s+MULTA|REGIME\s+(INICIAL|SEMIABERTO|ABERTO|FECHADO)|CONTRAVENCOES?\s+PENAIS?|RECEPTACAO|DESACATO|DESOBEDIENCIA|RESISTENCIA|ESTELIONATO|INJURIA|CALUNIA|DIFAMACAO|EXTORSAO|CRIMES?\s+CONTRA|PROCEDIMENTO\s+DO\s+JUIZADO\s+ESPECIAL\s+CRIMINAL|AUTO\s+DE\s+PRISAO|MANDADO\s+DE\s+PRISAO|PRISAO\s+PREVENTIVA|PRISAO\s+TEMPORARIA|RELAXAMENTO\s+DE\s+PRISAO|MEDIDAS\s+PROTETIVAS|APELACAO\s+CRIMINAL|RECURSO\s+EM\s+SENTIDO\s+ESTRITO|REVISAO\s+CRIMINAL|HABEAS\s+CORPUS|APROPRIACAO\s+INDEBITA|FALSIDADE|FALSIFICACAO|USO\s+DE\s+DOCUMENTO\s+FALSO|PECULATO|CORRUPCAO|LAVAGEM|ORGANIZACAO\s+CRIMINOSA|ASSOCIACAO\s+CRIMINOSA|QUADRILHA|PORTE\s+(ILEGAL\s+)?DE\s+ARMA|POSSE\s+(ILEGAL\s+)?DE\s+ARMA|ARMA\s+DE\s+FOGO|LATROCINIO|FEMINICIDIO|SEQUESTRO|CARCERE\s+PRIVADO|MAUS\s+TRATOS|ABANDONO\s+DE\s+INCAPAZ|IMPORTUNACAO\s+SEXUAL|ATO\s+OBSCENO|SONEGACAO|DESCAMINHO|CONTRABANDO|DANO\s+QUALIFICADO|ADULTERACAO)\b/i;

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

    // Consumer/civil com flag criminal erronea do Escavador2.
    // Indicador criminal canonico presente = crime real cuja modalidade cita
    // termo de consumo (ex.: "Estelionato / Cartao de Credito") — NAO excluir,
    // mesmo racional do override de homicidio acima.
    if (CONSUMER_CIVIL_NOISE_PATTERN.test(text) && !CRIMINAL_INDICATOR_PATTERN.test(text)) {
        return CONSUMER_CIVIL_NOISE;
    }

    return null;
}

function hasIdentifiableClassOrSubject(process = {}) {
    const classe = getClasseText(process);
    const assunto = getAssuntoText(process);
    if (classe === 'PROCESSO' && (assunto === 'SEM ASSUNTO' || assunto === '')) return false;
    return classe !== '' || assunto !== '';
}

function hasCriminalIndicator(process = {}) {
    const text = buildProcessText(process);
    if (!text) return false;
    return CRIMINAL_INDICATOR_PATTERN.test(text);
}

module.exports = {
    isExcludedCrimeType,
    hasIdentifiableClassOrSubject,
    hasCriminalIndicator,
    buildProcessText,
    TRANSITO,
    AMBIENTAL,
    HTE,
    CARTA_PRECATORIA_NOISE,
    CONSUMER_CIVIL_NOISE,
};
