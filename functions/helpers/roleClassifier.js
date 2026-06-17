/**
 * Classificador de papéis para cálculo de risco
 * 
 * REGRAS (perspectiva da empresa contratante):
 * 
 * Criminal:
 *   - Alto: Réu, Indiciado, Autor do Fato (cometeu crime)
 *   - Baixo: Vítima, Ofendido
 *   - Ignorar: Advogado, Testemunha, Autoridade
 * 
 * Trabalhista:
 *   - Alto: Autor, Reclamante (processou empregadores → pode processar nossa empresa)
 *   - Baixo: Réu, Reclamado (foi processado pelo empregado)
 *   - Ignorar: Advogado, Testemunha
 * 
 * Cível:
 *   - Médio: Réu, Passivo, Executado
 *   - Baixo: Autor, Ativo
 *   - Ignorar: Advogado
 */

function normalizeLegalText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[()]/g, ' ')
        .replace(/\./g, '')
        .replace(/\//g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Normaliza valores crus de lado/polo para os termos esperados pelo fallback.
 * Valores desconhecidos são retornados sem alteração (passthrough), permitindo
 * que o chamador decida como tratá-los.
 * @param {string|null|undefined} rawSide
 * @returns {string|null}
 */
function normalizeSideForClassifier(rawSide) {
    const normalized = normalizeLegalText(rawSide).replace(/^POLO\s+/, '');
    const withoutPrincipal = normalized.replace(/\s+PRINCIPAL$/, '');
    if (!withoutPrincipal) return null;
    if (/^(P|PASSIV[OA]?|PASSI|PASSIVE)$/.test(withoutPrincipal)) return 'Passive';
    if (/^(A|ATIV[OA]?|ACTIVE|AUTHOR|PLAINTIFF)$/.test(withoutPrincipal)) return 'Active';
    return rawSide;
}

// Roles que cometem crime ou são processados criminalmente
const HIGH_RISK_CRIMINAL_ROLES = /^(REU|RE\s*$|REU\s+(RE|S|\d+[º°]?|A)|INDICIAD[OA](?:\s+A)?|INVESTIGAD[OA](?:\s+A)?|AUTOR\s*(?:A)?\s+DO\s+FATO|AUTOR\s+FATO|CONDENAD[OA]|ACUSAD[OA](?:\s+A)?|AVERIGUAD[OA]|EXECUTADO|EXECTD[OA]|EXECD[OA]|REEDUCANDO|BENEFICIARIO|SUJE?TO|AGENTE|DENUNCIAD[OA](?:\s+A)?|NOTICIAD[OA]|AUTUAD[OA]|FLAGRANTEAD[OA]|FLAGRANTEADO\s*\(?A\)?|SENTENCIAD[OA]|EM\s+APURACAO|POLO\s+PASSIVO|PASSIVO|PACIENTE|PROMOVIDO|DEPRECAD[OA](?:\s+A)?|INFRATOR|CORREU|REQUERIDO|REQUERIDA|APELANTE|APELADA|APELADO|RECORRENTE|RECORRIDA|RECORRIDO\s+A|RECORRIDO|AGRAVANTE|AGRAVADO\s+A|AGRAVADO|EMBARGADO|EMBARGANTE|OFENSOR)$/i;

// Roles que processaram empregadores (trabalhista) - ALTO RISCO para nova empresa
const HIGH_RISK_LABOR_PLAINTIFF = /^(AUTOR(?:\s+A)?|AUTORA(?:\s+A)?|RECLAMANTE|EXEQUENTE|EXEQTE|REQTE|QUERELANTE|IMPETRANTE|REQUERENTE(?:S)?|RECORRENTE|RECORRIDO|AGRAVANTE|AGRAVADO(?:\s+A)?|APELANTE|APELADO|POLO\s+ATIVO|POLO\s+ATIVO\s+PRINCIPAL|RECTE|PROMOVENTE|DEMANDANTE)$/i;

// Roles que foram processados pelo empregado (trabalhista) - BAIXO RISCO
const LOW_RISK_LABOR_DEFENDANT = /^(RECLAMADO|REU\s+TRABALHISTA|REU(?:\s+(RE|S|\d+|A))?|EXECUTADO|REQUERIDO|POLO\s+PASSIVO|REQDO|REQDA|EXECTDO|EXECTDA|EXECDO|EXECDA|DEMANDADO(?:\s+A)?|PASSIVO)$/i;

// Vítimas - sempre baixo risco
const VICTIM_ROLES = /^(VITIMA|V\b|VITIMA\s+DO\s+FATO|OFENDIDO|OFENDIDA|OFENDIDO\s+DO\s+FATO|OFENDIDA\s+DO\s+FATO|PREJUDICADO|LESADO|DAMNIFICADO|AGRAVIADO|PREJUDICADA|LESADA|DAMNIFICADA|AGRAVIADA|AUTOR\s+DO\s+FATO\s+VITIMA)$/i;

// Profissionais - ignorar
const LAWYER_ROLES = /^(ADVOGAD[OA]S?\b.*|LAWYER|PROCURADOR|DEFENSOR|PROCURADORIA|DEFENSORIA|PATRONO|REPRESENTANTE\s+LEGAL|DOUTOR[A]?)$/i;

// Testemunhas - ignorar
const WITNESS_ROLES = /^(TESTEMUNHA|TESTEMUNHA\s+DO\s+JUIZO|TESTEMUNHA\s+POLO\s+ATIVO|TESTEMUNHA\s+POLO\s+PASSIVO|TESTEMUNHA\s+DE\s+ACUSACAO|TESTEMUNHA\s+PARTE\s+ATIVA|TESTEMUNHA\s+PARTE\s+PASSIVO|INFORMANTE|INFORMADO|INFORMADA)$/i;

// Instituições - ignorar
const AUTHORITY_ROLES = /^(AUTORIDADE|MINISTERIO\s+PUBLICO|MP|JUSTICA|DELEGACIA|ORGAO|INSTITUICAO|JUIZO|VARA|TRIBUNAL|FAZENDA|UNIAO|ESTADO|MUNICIPIO|INSS|RECEITA\s+FEDERAL|CAIXA|BANCO|INSTITUTO|PREFEITURA|SECRETARIA|DEPRECANTE|CONFRONTANTE|COMUNICANTE|JUIZO\s+RECORRENTE|ARROLANTE)$/i;

// Lados/polo passive e active para fallback
const PASSIVE_SIDE_VALUES = /^(P|PASSIV[OA]?|PASSI|PASSIVE)$/i;
const ACTIVE_SIDE_VALUES = /^(A|ATIV[OA]?|ACTIVE|AUTHOR|PLAINTIFF)$/i;

// Outros neutros
const OTHER_NEUTRAL_ROLES = /^(OUTRO|OUTROS(\s+PARTICIPANTES?)?|DESCONHECIDO|NAO\s+INFORMADO|TERCEIRO|INTERESSAD[OA](?:S)?|CONSIGNATARIO|REPRESENTANTE\b.*|ASSISTENCIA|CURADOR|TUTOR|PUPILO|SUCESSOR|TERCEIRO\s+INTERESSADO|NAO\s+APLICAVEL|N\s*A|INDEFINIDO|HERDEIRO|INVENTARIANTE|ESPOLIO(?:\s+REQUERIDO)?|ALIMENTADO|PARTES|TERINTCER|INTERESSADO\s+PGM|REPRESENTANTE\s+REU)$/i;

// Autor/Querelante em processo criminal - BAIXO RISCO
const CRIMINAL_PLAINTIFF_ROLES = /^(AUTOR(?:\s+A)?|AUTORA(?:\s+A)?|REQUERENTE(?:S)?|IMPETRANTE|QUERELANTE|ATIVO|POLO\s+ATIVO(?:\s+PRINCIPAL)?|EXEQUENTE|EXEQTE|REQTE|DEMANDANTE|PROMOVENTE|PARTE\s+AUTORA|RECTE)$/i;

/**
 * Classifica um papel em uma categoria de risco
 * @param {string} role - Papel do candidato (ex: "REU", "RECLAMANTE")
 * @param {string} area - Área do processo (ex: "CRIMINAL", "TRABALHISTA", "CIVEL")
 * @param {string} [side] - Lado/polo do candidato. Aceita valores crus como 'P', 'A',
 *   'Passive', 'Active', 'PASSIVE', 'ACTIVE', 'POLO PASSIVO', 'POLO ATIVO PRINCIPAL',
 *   'Neutral', etc. Valores desconhecidos são ignorados.
 * @returns {Object} { category, riskLevel, reason }
 */
function classifyRole(role, area = '', side = '') {
    const normalizedRole = normalizeLegalText(role);
    const normalizedArea = normalizeLegalText(area);
    const normalizedSide = normalizeLegalText(side);

    if (!normalizedRole) {
        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao informado' };
    }

    // Verificar ignorar primeiro
    if (WITNESS_ROLES.test(normalizedRole)) {
        return { category: 'WITNESS', riskLevel: 'IGNORE', reason: 'Testemunha - nao indica risco' };
    }

    if (LAWYER_ROLES.test(normalizedRole)) {
        return { category: 'LAWYER', riskLevel: 'IGNORE', reason: 'Advogado - papel profissional' };
    }

    if (AUTHORITY_ROLES.test(normalizedRole)) {
        return { category: 'AUTHORITY', riskLevel: 'IGNORE', reason: 'Instituicao/Autoridade' };
    }

    if (OTHER_NEUTRAL_ROLES.test(normalizedRole)) {
        return { category: 'OTHER', riskLevel: 'IGNORE', reason: 'Papel neutro ou desconhecido' };
    }

    // Verificar vitima
    if (VICTIM_ROLES.test(normalizedRole)) {
        return { category: 'VICTIM', riskLevel: 'LOW', reason: 'Vitima do crime/ofensa' };
    }

    // Lógica específica por área
    if (normalizedArea.includes('CRIM') || normalizedArea.includes('PENAL')) {
        // Criminal: Réu/Indiciado/Autor do Fato = ALTO
        if (HIGH_RISK_CRIMINAL_ROLES.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'HIGH', reason: 'Reu/Indiciado em processo criminal' };
        }
        // Autor em criminal (não "autor do fato") = geralmente querelante/vitima = BAIXO
        if (CRIMINAL_PLAINTIFF_ROLES.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Autor/Querelante em processo criminal' };
        }

        // Fallback por lado/polo quando papel não foi reconhecido
        if (normalizedSide && PASSIVE_SIDE_VALUES.test(normalizedSide)) {
            return { category: 'DEFENDANT', riskLevel: 'HIGH', reason: 'Papel nao classificado, lado passivo em processo criminal' };
        }
        if (normalizedSide && ACTIVE_SIDE_VALUES.test(normalizedSide)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Papel nao classificado, lado ativo em processo criminal' };
        }

        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao classificado em processo criminal' };
    }

    if (normalizedArea.includes('TRAB') || normalizedArea.includes('TRABALHISTA')) {
        // Trabalhista: Autor/Reclamante (processou empregador) = ALTO RISCO
        if (HIGH_RISK_LABOR_PLAINTIFF.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Autor/Reclamante em acao trabalhista (processou empregador)' };
        }
        // Trabalhista: Reclamado/Réu (foi processado pelo empregado) = BAIXO RISCO
        if (LOW_RISK_LABOR_DEFENDANT.test(normalizedRole) || /^(PASSIVO|DEFENDANT)$/.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'LOW', reason: 'Reclamado/Reu em acao trabalhista (processado pelo empregado)' };
        }

        // Fallback por lado/polo
        if (normalizedSide && PASSIVE_SIDE_VALUES.test(normalizedSide)) {
            return { category: 'DEFENDANT', riskLevel: 'LOW', reason: 'Papel nao classificado, lado passivo em processo trabalhista' };
        }
        if (normalizedSide && ACTIVE_SIDE_VALUES.test(normalizedSide)) {
            return { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Papel nao classificado, lado ativo em processo trabalhista' };
        }

        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao classificado em processo trabalhista' };
    }

    // Cível e outras áreas (quando area é desconhecida, ser conservador)
    if (normalizedArea) {
        // Réu/Passivo/Executado = MEDIO
        if (/^(REU|PASSIVO|DEFENDANT|EXECUTADO|REQUERIDO|POLO\s+PASSIVO)$/.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'MEDIUM', reason: 'Reu/Passivo em processo cível' };
        }
        // Autor/Ativo = BAIXO
        if (/^(AUTOR|ATIVO|ACTIVE|REQUERENTE|POLO\s+ATIVO)$/.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Autor/Ativo em processo cível' };
        }
    }

    return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel nao classificado' };
}

/**
 * Retorna o impacto no score baseado no papel e área
 * @param {string} role - Papel do candidato
 * @param {string} area - Área do processo
 * @param {string} [side] - Lado/polo do candidato
 * @returns {Object} { include, score, flag, reason }
 */
function getRoleScoreImpact(role, area, side = '') {
    const classification = classifyRole(role, area, side);
    const areaUpper = String(area || '').toUpperCase();

    if (classification.riskLevel === 'IGNORE') {
        return { include: false, score: 0, flag: 'NEGATIVE', reason: classification.reason };
    }

    if (classification.riskLevel === 'LOW') {
        return { include: true, score: 0, flag: 'NEGATIVE', reason: classification.reason };
    }

    if (classification.riskLevel === 'MEDIUM') {
        return { include: true, score: 50, flag: 'INCONCLUSIVE', reason: classification.reason };
    }

    if (classification.riskLevel === 'HIGH') {
        if (areaUpper.includes('CRIM') || areaUpper.includes('PENAL')) {
            return { include: true, score: 90, flag: 'POSITIVE', reason: classification.reason };
        }
        if (areaUpper.includes('TRAB')) {
            return { include: true, score: 90, flag: 'POSITIVE', reason: classification.reason };
        }
        return { include: true, score: 70, flag: 'POSITIVE', reason: classification.reason };
    }

    return { include: true, score: 30, flag: 'INCONCLUSIVE', reason: classification.reason };
}

/**
 * Verifica se um papel é de baixo risco (para filtros)
 * @param {string} role - Papel do candidato
 * @param {string} area - Área do processo
 * @param {string} [side] - Lado/polo do candidato
 * @returns {boolean}
 */
function isLowRiskRole(role, area, side = '') {
    const classification = classifyRole(role, area, side);
    return classification.riskLevel === 'LOW' || classification.riskLevel === 'IGNORE';
}

/**
 * Verifica se um papel é de alto risco
 * @param {string} role - Papel do candidato
 * @param {string} area - Área do processo
 * @param {string} [side] - Lado/polo do candidato
 * @returns {boolean}
 */
function isHighRiskRole(role, area, side = '') {
    const classification = classifyRole(role, area, side);
    return classification.riskLevel === 'HIGH';
}

module.exports = {
    classifyRole,
    getRoleScoreImpact,
    isLowRiskRole,
    isHighRiskRole,
    normalizeLegalText,
    normalizeSideForClassifier,
    HIGH_RISK_CRIMINAL_ROLES,
    CRIMINAL_PLAINTIFF_ROLES,
    HIGH_RISK_LABOR_PLAINTIFF,
    LOW_RISK_LABOR_DEFENDANT,
    VICTIM_ROLES,
    LAWYER_ROLES,
    WITNESS_ROLES,
    AUTHORITY_ROLES,
    OTHER_NEUTRAL_ROLES,
};
