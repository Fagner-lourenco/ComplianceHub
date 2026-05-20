/**
 * Classificador de papéis para cálculo de risco - Frontend (ES Module)
 * Mirror de functions/helpers/roleClassifier.js
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

// Roles que cometem crime ou são processados criminalmente
const HIGH_RISK_CRIMINAL_ROLES = /^(reu|indiciado|autor\s+do\s+fato|condenado|acusado|investigado|averiguado|executado|reeducando|beneficiario|suje?to|agente)$/i;

// Roles que processaram empregadores (trabalhista) - ALTO RISCO para nova empresa
const HIGH_RISK_LABOR_PLAINTIFF = /^(autor|reclamante|exequente|querelante|impetrante|requerente)$/i;

// Roles que foram processados pelo empregado (trabalhista) - BAIXO RISCO
const LOW_RISK_LABOR_DEFENDANT = /^(reclamado|reu\s+trabalhista|executado|requerido)$/i;

// Vítimas - sempre baixo risco
const VICTIM_ROLES = /^(vitima|ofendido|prejudicado|lesado|damnificado|agraviado|ofendida|prejudicada)$/i;

// Profissionais - ignorar
const LAWYER_ROLES = /^(advogad[oa]|lawyer|procurador|defensor|procuradoria|defensoria|patrono|representante\s+legal|doutor[a]?)$/i;

// Testemunhas - ignorar
const WITNESS_ROLES = /^(testemunha|informante|informado|informada)$/i;

// Instituições - ignorar
const AUTHORITY_ROLES = /^(autoridade|ministerio\s+publico|mp|justica|delegacia|orgao|instituicao|instituicao|juizo|vara|tribunal|fazenda|uniao|estado|municipio|inss|receita\s+federal|caixa|banco|instituto|prefeitura|secretaria)$/i;

// Outros neutros
const OTHER_NEUTRAL_ROLES = /^(outro|outros|desconhecido|nao\s+informado|terceiro|interessado|assistencia|curador|tutor|pupilo|sucessor|terceiro\s+interessado|nao\s+aplicavel|n\/a|indefinido)$/i;

/**
 * Classifica um papel em uma categoria de risco
 * @param {string} role - Papel do candidato (ex: "REU", "RECLAMANTE")
 * @param {string} area - Área do processo (ex: "CRIMINAL", "TRABALHISTA", "CIVEL")
 * @returns {Object} { category, riskLevel, reason }
 */
export function classifyRole(role, area = '') {
    const normalizedRole = String(role || '').trim().toUpperCase();
    const normalizedArea = String(area || '').trim().toUpperCase();

    if (!normalizedRole) {
        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel não informado' };
    }

    // Verificar ignorar primeiro
    if (WITNESS_ROLES.test(normalizedRole)) {
        return { category: 'WITNESS', riskLevel: 'IGNORE', reason: 'Testemunha - não indica risco' };
    }

    if (LAWYER_ROLES.test(normalizedRole)) {
        return { category: 'LAWYER', riskLevel: 'IGNORE', reason: 'Advogado - papel profissional' };
    }

    if (AUTHORITY_ROLES.test(normalizedRole)) {
        return { category: 'AUTHORITY', riskLevel: 'IGNORE', reason: 'Instituição/Autoridade' };
    }

    if (OTHER_NEUTRAL_ROLES.test(normalizedRole)) {
        return { category: 'OTHER', riskLevel: 'IGNORE', reason: 'Papel neutro ou desconhecido' };
    }

    // Verificar vítima
    if (VICTIM_ROLES.test(normalizedRole)) {
        return { category: 'VICTIM', riskLevel: 'LOW', reason: 'Vítima do crime/ofensa' };
    }

    // Lógica específica por área
    if (normalizedArea.includes('CRIM') || normalizedArea.includes('PENAL')) {
        // Criminal: Réu/Indiciado/Autor do Fato = ALTO
        if (HIGH_RISK_CRIMINAL_ROLES.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'HIGH', reason: 'Réu/Indiciado em processo criminal' };
        }
        // Autor em criminal (não "autor do fato") = geralmente querelante/vítima = BAIXO
        if (/^AUTOR$/.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Autor/Querelante em processo criminal' };
        }
        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel não classificado em processo criminal' };
    }

    if (normalizedArea.includes('TRAB') || normalizedArea.includes('TRABALHISTA')) {
        // Trabalhista: Autor/Reclamante (processou empregador) = ALTO RISCO
        if (HIGH_RISK_LABOR_PLAINTIFF.test(normalizedRole)) {
            return { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Autor/Reclamante em ação trabalhista (processou empregador)' };
        }
        // Trabalhista: Reclamado/Réu (foi processado pelo empregado) = BAIXO RISCO
        if (LOW_RISK_LABOR_DEFENDANT.test(normalizedRole) || /^(REU|PASSIVO|DEFENDANT)$/.test(normalizedRole)) {
            return { category: 'DEFENDANT', riskLevel: 'LOW', reason: 'Reclamado/Réu em ação trabalhista (processado pelo empregado)' };
        }
        return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel não classificado em processo trabalhista' };
    }

    // Cível e outras áreas
    // Réu/Passivo/Executado = MEDIO
    if (/^(REU|PASSIVO|DEFENDANT|EXECUTADO|REQUERIDO)$/.test(normalizedRole)) {
        return { category: 'DEFENDANT', riskLevel: 'MEDIUM', reason: 'Réu/Passivo em processo cível' };
    }
    // Autor/Ativo = BAIXO
    if (/^(AUTOR|ATIVO|ACTIVE|REQUERENTE)$/.test(normalizedRole)) {
        return { category: 'PLAINTIFF', riskLevel: 'LOW', reason: 'Autor/Ativo em processo cível' };
    }

    return { category: 'UNKNOWN', riskLevel: 'NEUTRAL', reason: 'Papel não classificado' };
}

/**
 * Retorna o impacto no score baseado no papel e área
 * @param {string} role - Papel do candidato
 * @param {string} area - Área do processo
 * @returns {Object} { include, score, flag, reason }
 */
export function getRoleScoreImpact(role, area) {
    const classification = classifyRole(role, area);
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
 * Verifica se um papel é de baixo risco
 * @param {string} role - Papel do candidato
 * @param {string} area - Área do processo
 * @returns {boolean}
 */
export function isLowRiskRole(role, area) {
    const classification = classifyRole(role, area);
    return classification.riskLevel === 'LOW' || classification.riskLevel === 'IGNORE';
}

/**
 * Verifica se um papel é de alto risco
 * @param {string} role - Papel do candidato
 * @param {string} area - Área do processo
 * @returns {boolean}
 */
export function isHighRiskRole(role, area) {
    const classification = classifyRole(role, area);
    return classification.riskLevel === 'HIGH';
}