/**
 * reportEngine.js — Funções puras de geração e sanitização de relatórios
 * Extraído do monolito index.js durante refatoração Phase C
 */

const { stripUndefined, sanitizePublicStructuredValue, asDate, normalizeTenantSlug, sanitizeStructuredList, hasBenignNoProcessCoverage } = require('../helpers/normalize');
const { sanitizeAiOutput } = require('./_shared/sanitizers');

// Guardrails de narrativa segura
const SAFE_NARRATIVE_TEXTS = {
    criminalNegative: 'Nao foram identificados apontamentos criminais materiais associados ao candidato nas etapas analisadas.',
    criminalInconclusive: 'Ha indicios que exigem validacao operacional antes de uma conclusao definitiva sobre o apontamento criminal.',
    criminalPositive: 'Foram identificados apontamentos criminais materiais que exigem avaliacao de risco antes da continuidade do processo.',
    laborNegative: 'Nao foram identificados processos trabalhistas materiais associados ao candidato nas etapas analisadas.',
    laborPositive: 'Foram identificados apontamentos trabalhistas materiais que exigem avaliacao antes da continuidade do processo.',
    warrantNegative: 'Nenhum mandado de prisao ativo foi identificado nas etapas analisadas.',
    warrantPositive: 'Foi identificado mandado de prisao ativo ou registro equivalente que exige tratativa operacional imediata.',
};

function normalizedNarrativeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function narrativeMatches(value, patterns) {
    const text = normalizedNarrativeText(Array.isArray(value) ? value.join('\n') : value);
    return patterns.some((pattern) => pattern.test(text));
}

function buildSafeNarrativeReplacement(field, caseData = {}) {
    if (field === 'criminalNotes') {
        if (caseData.criminalFlag === 'POSITIVE') return SAFE_NARRATIVE_TEXTS.criminalPositive;
        if (caseData.criminalFlag === 'INCONCLUSIVE') return SAFE_NARRATIVE_TEXTS.criminalInconclusive;
        return SAFE_NARRATIVE_TEXTS.criminalNegative;
    }
    if (field === 'laborNotes') {
        return caseData.laborFlag === 'POSITIVE' ? SAFE_NARRATIVE_TEXTS.laborPositive : SAFE_NARRATIVE_TEXTS.laborNegative;
    }
    if (field === 'warrantNotes') {
        return caseData.warrantFlag === 'POSITIVE' ? SAFE_NARRATIVE_TEXTS.warrantPositive : SAFE_NARRATIVE_TEXTS.warrantNegative;
    }
    return '';
}

function sanitizeNarrativesForFlags(caseData = {}, narratives = {}) {
    const clean = { ...(narratives || {}) };
    const warnings = [];
    const pushWarning = (field, reason) => warnings.push({ field, reason });

    if (caseData.criminalFlag === 'NEGATIVE' && narrativeMatches(clean.criminalNotes, [/inconclusiv/, /cobertura insuficiente/, /baixa cobertura/, /apontamento criminal/, /processo\(s\) criminal/, /processo criminal/, /comunicacoes judiciais de natureza criminal localizadas/, /comunicacao judicial criminal/, /comunicacoes criminais localizadas/, /achado criminal complementar/, /condenacao criminal/, /execucao penal/])) {
        clean.criminalNotes = buildSafeNarrativeReplacement('criminalNotes', caseData);
        pushWarning('criminalNotes', 'Texto criminal substituido por versao segura compativel com flag NEGATIVE.');
    }
    if (caseData.criminalFlag === 'POSITIVE' && !narrativeMatches(clean.criminalNotes, [/apontamento/, /criminal/, /processo/, /condenacao/, /execucao penal/])) {
        clean.criminalNotes = buildSafeNarrativeReplacement('criminalNotes', caseData);
        pushWarning('criminalNotes', 'Texto criminal positivo estava pouco explicito e recebeu fallback seguro.');
    }
    if (caseData.laborFlag === 'NEGATIVE' && narrativeMatches(clean.laborNotes, [/trabalhista positivo/, /processo\(s\) trabalhista/, /processo trabalhista/, /comunicacoes judiciais de natureza trabalhista localizadas/, /comunicacao judicial trabalhista/, /comunicacoes trabalhistas localizadas/, /achado trabalhista complementar/, /acao trabalhista/])) {
        clean.laborNotes = buildSafeNarrativeReplacement('laborNotes', caseData);
        pushWarning('laborNotes', 'Texto trabalhista substituido por versao segura compativel com flag NEGATIVE.');
    }
    if (caseData.laborFlag === 'POSITIVE' && !narrativeMatches(clean.laborNotes, [/trabalhista/, /processo/, /apontamento/])) {
        clean.laborNotes = buildSafeNarrativeReplacement('laborNotes', caseData);
        pushWarning('laborNotes', 'Texto trabalhista positivo estava pouco explicito e recebeu fallback seguro.');
    }
    if (caseData.warrantFlag === 'NEGATIVE' && narrativeMatches(clean.warrantNotes, [/mandado ativo/, /mandado detectado/, /pendente de cumprimento/, /prisao pendente/])) {
        clean.warrantNotes = buildSafeNarrativeReplacement('warrantNotes', caseData);
        pushWarning('warrantNotes', 'Texto de mandado substituido por versao segura compativel com flag NEGATIVE.');
    }
    if (caseData.warrantFlag === 'POSITIVE' && !narrativeMatches(clean.warrantNotes, [/mandado/, /prisao/])) {
        clean.warrantNotes = buildSafeNarrativeReplacement('warrantNotes', caseData);
        pushWarning('warrantNotes', 'Texto de mandado positivo estava pouco explicito e recebeu fallback seguro.');
    }

    return { narratives: clean, warnings };
}

function resolvePublicReportStatus(reportData, now = new Date()) {
    const expiresAt = asDate(reportData?.expiresAt);
    const active = reportData?.active !== false;

    if (!active) return 'REVOKED';
    if (expiresAt && expiresAt < now) return 'EXPIRED';
    return 'ACTIVE';
}

function serializeManagedPublicReport(docSnap) {
    const reportData = docSnap.data() || {};
    const createdAt = asDate(reportData.createdAt);
    const expiresAt = asDate(reportData.expiresAt);

    return {
        id: docSnap.id,
        token: docSnap.id,
        caseId: reportData.caseId || null,
        tenantId: reportData.tenantId || null,
        candidateName: String(reportData.candidateName || '').slice(0, 160),
        active: reportData.active !== false,
        status: resolvePublicReportStatus(reportData),
        createdAt: createdAt ? createdAt.toISOString() : null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        reportBuildVersion: reportData.reportBuildVersion || null,
        publicSnapshotHash: reportData.publicSnapshotHash || null,
    };
}

function hasPublicReportMinimumContent(caseData, publicSnapshot = null) {
    const data = publicSnapshot || caseData || {};
    if (!data.candidateName) return false;
    const hasSummary = !!data.executiveSummary || (Array.isArray(data.keyFindings) && data.keyFindings.length > 0);
    const hasVerdict = !!data.finalVerdict;
    return hasSummary && hasVerdict;
}

function computePublicSnapshotHash(publicSnapshot) {
    const crypto = require('crypto');
    const canonical = JSON.stringify(publicSnapshot, Object.keys(publicSnapshot).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function buildSourceSummary(caseData) {
    if (caseData.status === 'DONE') return 'Analise automatizada e revisao operacional concluidas.';
    if (caseData.status === 'CORRECTION_NEEDED') return 'Analise pausada para correcao cadastral.';
    return 'Analise automatizada e revisao operacional em andamento.';
}

function buildStatusSummary(caseData) {
    if (caseData.status === 'CORRECTION_NEEDED') {
        return 'Analise pausada aguardando correcao de dados pelo cliente.';
    }
    if (caseData.status !== 'DONE') {
        return 'Analise em andamento com validacao automatica e revisao operacional.';
    }

    if (caseData.finalVerdict === 'NOT_RECOMMENDED') {
        return 'Analise concluida com indicacao de nao recomendacao diante dos apontamentos materiais identificados.';
    }
    if (caseData.finalVerdict === 'ATTENTION') {
        return 'Analise concluida com pontos de atencao que exigem validacoes complementares ou aprovacao condicionada.';
    }
    if (caseData.finalVerdict === 'FIT') {
        return 'Analise concluida sem impeditivos materiais para continuidade do fluxo interno.';
    }
    return 'Analise concluida e pronta para consulta e compartilhamento.';
}

function buildNextSteps(caseData) {
    if (Array.isArray(caseData.nextSteps) && caseData.nextSteps.length > 0) {
        return sanitizeStructuredList(caseData.nextSteps, 6, 220);
    }

    if (caseData.status === 'CORRECTION_NEEDED') {
        return [
            'Corrigir os dados sinalizados pela operacao antes de retomar a analise.',
            'Reenviar o caso para nova validacao assim que as informacoes forem atualizadas.',
        ];
    }

    if (caseData.finalVerdict === 'NOT_RECOMMENDED') {
        return [
            'Submeter o caso a alcada responsavel antes de qualquer continuidade.',
            'Registrar formalmente os apontamentos materiais no fluxo interno de risco.',
        ];
    }
    if (caseData.finalVerdict === 'ATTENTION') {
        return [
            'Prosseguir apenas com validacoes complementares aderentes aos apontamentos do relatorio.',
            'Registrar as condicoes de aprovacao e os pontos de monitoramento no processo interno.',
        ];
    }
    if (caseData.finalVerdict === 'FIT') {
        return [
            'Prosseguir com a proxima etapa do fluxo interno.',
            'Arquivar o relatorio no dossie do candidato para consulta controlada.',
        ];
    }
    return [];
}

function buildReportSlug(caseId, caseData) {
    const nameSlug = normalizeTenantSlug(caseData.candidateName || caseData.candidatePosition || caseId || 'caso');
    const suffix = String(caseId || 'caso').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(-8);
    return [nameSlug || 'caso', suffix].filter(Boolean).join('-').slice(0, 80);
}

function buildTimelineEvents(caseData, options = {}) {
    const existing = Array.isArray(caseData.timelineEvents)
        ? caseData.timelineEvents
            .filter(Boolean)
            .map((event) => stripUndefined({
                type: event.type || null,
                status: event.status || null,
                title: event.title || event.type || 'Evento',
                description: event.description || null,
                at: event.at || null,
            }))
        : [];

    const ensured = [...existing];
    const existingTypes = new Set(existing.map((event) => event.type).filter(Boolean));
    const pushIfMissing = (event) => {
        if (!event || !event.type || existingTypes.has(event.type)) return;
        ensured.push(event);
        existingTypes.add(event.type);
    };

    const concludedAt = options.concludedAtOverride || caseData.concludedAt || caseData.updatedAt || null;

    pushIfMissing(caseData.createdAt && {
        type: 'created',
        status: 'done',
        title: 'Solicitacao enviada',
        description: 'Caso criado para triagem e validacao operacional.',
        at: caseData.createdAt,
    });
    pushIfMissing(caseData.analysisStartedAt && {
        type: 'analysis_started',
        status: 'done',
        title: 'Processamento iniciado',
        description: 'Pipeline automatizado executado com coleta de evidencias e validacao inicial.',
        at: caseData.analysisStartedAt,
    });
    pushIfMissing(caseData.correctedAt && {
        type: 'corrected',
        status: 'done',
        title: 'Caso corrigido e reenviado',
        description: 'Dados atualizados pelo cliente para continuidade da analise.',
        at: caseData.correctedAt,
    });
    pushIfMissing(concludedAt && {
        type: 'concluded',
        status: 'done',
        title: 'Analise concluida',
        description: buildStatusSummary({ ...caseData, status: 'DONE' }),
        at: concludedAt,
    });

    return ensured
        .filter((event) => event.at)
        .sort((left, right) => {
            const leftTime = asDate(left.at)?.getTime() || 0;
            const rightTime = asDate(right.at)?.getTime() || 0;
            return leftTime - rightTime;
        });
}

function calculateTurnaroundHours(caseData, concludedAtOverride = null) {
    const createdAt = asDate(caseData.createdAt);
    const concludedAt = asDate(concludedAtOverride) || asDate(caseData.concludedAt);
    if (!createdAt || !concludedAt) return null;
    const diffHours = (concludedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (!Number.isFinite(diffHours) || diffHours < 0) return null;
    return Number(diffHours.toFixed(2));
}

function buildKeyFindings(caseData, formPayload) {
    const findings = [];
    const aiEvidencias = (caseData.aiStructured?.evidencias || []).slice(0, 5);
    findings.push(...aiEvidencias.filter((e) => typeof e === 'string'));
    if ((caseData.juditActiveWarrantCount || 0) > 0)
        findings.push(`${caseData.juditActiveWarrantCount} mandado(s) de prisao pendente(s) de cumprimento.`);
    const criminalFlag = formPayload?.criminalFlag || caseData.criminalFlag;
    if (criminalFlag === 'POSITIVE' && (caseData.juditCriminalCount || 0) > 0)
        findings.push(`${caseData.juditCriminalCount} processo(s) criminal(is) confirmado(s).`);
    return [...new Set(findings)].slice(0, 7);
}

function buildExecutiveSummary(caseData) {
    if (caseData.aiDecision === 'IGNORED') return null;
    return caseData.aiStructured?.resumo || null;
}

function buildExpandedKeyFindings(caseData, formPayload) {
    const findings = buildKeyFindings(caseData, formPayload);

    if (caseData.coverageLevel === 'LOW_COVERAGE' && !hasBenignNoProcessCoverage(caseData)) {
        findings.push('Parte da leitura depende de validacao manual por cobertura reduzida das fontes consultadas.');
    }
    if (caseData.providerDivergence === 'HIGH') {
        findings.push('Ha divergencia material entre as fontes consultadas e o caso exige leitura cautelosa.');
    }
    if ((caseData.juditHomonymCount || 0) > 0 || caseData.aiHomonymRecommendedAction === 'MANUAL_REVIEW') {
        findings.push('Existe indicacao de possivel homonimia em ao menos um apontamento e a vinculacao exige revisao manual.');
    }
    if ((caseData.escavadorCriminalCount || 0) > (caseData.juditCriminalCount || 0) && (formPayload?.criminalFlag || caseData.criminalFlag) === 'POSITIVE') {
        findings.push(`${caseData.escavadorCriminalCount} registro(s) criminal(is) identificado(s) em bases complementares.`);
    }
    if (caseData.cpfPendingRegularization === true || caseData.enrichmentGateResult?.cpfPendingRegularization === true || caseData.bigdatacorpGateResult?.cpfPendingRegularization === true || caseData.juditGateResult?.cpfPendingRegularization === true) {
        findings.push('CPF com situacao cadastral pendente de regularizacao na Receita Federal.');
    }

    return [...new Set(findings)].slice(0, 7);
}

function buildExecutiveSummaryFallback(caseData) {
    const aiSummary = buildExecutiveSummary(caseData);
    if (aiSummary) return aiSummary;

    const parts = [];
    const verdict = caseData.finalVerdict;
    if (verdict === 'NOT_RECOMMENDED') {
        parts.push('Analise concluida com indicacao de nao recomendacao diante dos apontamentos materiais identificados.');
    } else if (verdict === 'ATTENTION') {
        parts.push('Analise concluida com pontos de atencao que exigem validacoes complementares antes de qualquer decisao final.');
    } else if (verdict === 'FIT') {
        parts.push('Analise concluida sem impeditivos materiais para continuidade do fluxo interno, observados os limites das fontes consultadas.');
    }

    if ((caseData.juditActiveWarrantCount || 0) > 0 || caseData.warrantFlag === 'POSITIVE') {
        parts.push(`Foi identificado pelo menos ${caseData.juditActiveWarrantCount || 1} mandado relevante em bases judiciais.`);
    }
    if ((caseData.juditCriminalCount || 0) > 0 || caseData.criminalFlag === 'POSITIVE') {
        const processCount = caseData.juditCriminalCount || caseData.escavadorCriminalCount || 1;
        parts.push(`As consultas judiciais retornaram ${processCount} apontamento(s) criminal(is) ou penal(is) relevante(s).`);
    }
    if (caseData.laborFlag === 'POSITIVE') {
        parts.push('Tambem houve retorno positivo para processos trabalhistas relevantes.');
    }
    if (caseData.coverageLevel === 'LOW_COVERAGE' && !hasBenignNoProcessCoverage(caseData)) {
        parts.push('A cobertura das fontes foi parcial e parte da leitura ainda depende de verificacao manual.');
    }
    if (caseData.providerDivergence === 'HIGH') {
        parts.push('As fontes consultadas apresentaram divergencia relevante de escopo ou quantidade.');
    }

    return parts.join(' ') || null;
}

function hasMeaningfulValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

function resolveNarrativeField(merged, payload, field, options = {}) {
    const { fallbackValue, defaultValue, prefillKey } = options;

    const resolve = (val) => {
        if (typeof val === 'string') return sanitizeAiOutput(val);
        if (Array.isArray(val)) return val.map((item) => typeof item === 'string' ? sanitizeAiOutput(item) : item);
        return val;
    };

    if (hasMeaningfulValue(payload?.[field])) return resolve(payload[field]);
    if (hasMeaningfulValue(merged?.[field])) return resolve(merged[field]);
    if (prefillKey && hasMeaningfulValue(merged?.[prefillKey])) return resolve(merged[prefillKey]);
    if (fallbackValue) {
        const fb = typeof fallbackValue === 'function' ? fallbackValue() : fallbackValue;
        if (hasMeaningfulValue(fb)) return resolve(fb);
    }
    return defaultValue !== undefined ? defaultValue : null;
}

function buildSanitizedPublicResultSnapshot(caseId, caseData, payload = {}, options = {}) {
    const merged = { ...(caseData || {}), ...(payload || {}) };
    const snapshot = {};
    const concludedAtFallback = options.concludedAtOverride || merged.concludedAt || merged.updatedAt || null;

    merged.executiveSummary = resolveNarrativeField(merged, payload, 'executiveSummary', {
        fallbackValue: () => buildExecutiveSummaryFallback(merged),
    });
    merged.keyFindings = resolveNarrativeField(merged, payload, 'keyFindings', {
        fallbackValue: () => buildExpandedKeyFindings(merged, merged),
        defaultValue: [],
    });
    merged.criminalNotes = resolveNarrativeField(merged, payload, 'criminalNotes');
    merged.laborNotes = resolveNarrativeField(merged, payload, 'laborNotes');
    merged.warrantNotes = resolveNarrativeField(merged, payload, 'warrantNotes');
    merged.osintNotes = resolveNarrativeField(merged, payload, 'osintNotes');
    merged.socialNotes = resolveNarrativeField(merged, payload, 'socialNotes');
    merged.digitalNotes = resolveNarrativeField(merged, payload, 'digitalNotes');
    merged.conflictNotes = resolveNarrativeField(merged, payload, 'conflictNotes');
    merged.analystComment = resolveNarrativeField(merged, payload, 'analystComment', {
        prefillKey: 'finalJustification',
    });

    const narrativeConsistency = sanitizeNarrativesForFlags(merged, {
        criminalNotes: merged.criminalNotes,
        laborNotes: merged.laborNotes,
        warrantNotes: merged.warrantNotes,
    });
    merged.criminalNotes = narrativeConsistency.narratives.criminalNotes;
    merged.laborNotes = narrativeConsistency.narratives.laborNotes;
    merged.warrantNotes = narrativeConsistency.narratives.warrantNotes;
    if (narrativeConsistency.warnings.length > 0) {
        merged.narrativeConsistencyWarnings = [
            ...(Array.isArray(merged.narrativeConsistencyWarnings) ? merged.narrativeConsistencyWarnings : []),
            ...narrativeConsistency.warnings,
        ];
    }

    if (!hasMeaningfulValue(merged.sourceSummary)) {
        merged.sourceSummary = buildSourceSummary(merged);
    }
    if (!hasMeaningfulValue(merged.statusSummary)) {
        merged.statusSummary = buildStatusSummary(merged);
    }
    if (!Array.isArray(merged.nextSteps) || merged.nextSteps.length === 0) {
        merged.nextSteps = buildNextSteps(merged);
    }
    merged.timelineEvents = buildTimelineEvents(merged, { concludedAtOverride: concludedAtFallback });
    if (!hasMeaningfulValue(merged.reportSlug)) {
        merged.reportSlug = buildReportSlug(caseId, merged);
    }
    if (!hasMeaningfulValue(merged.concludedAt) && concludedAtFallback) {
        merged.concludedAt = concludedAtFallback;
    }
    if (!hasMeaningfulValue(merged.turnaroundHours)) {
        const turnaroundHours = calculateTurnaroundHours(merged, concludedAtFallback);
        if (turnaroundHours != null) merged.turnaroundHours = turnaroundHours;
    }
    if (merged.reportReady === undefined) {
        merged.reportReady = hasMeaningfulValue(merged.finalVerdict) &&
            (
                hasMeaningfulValue(merged.executiveSummary)
                || (Array.isArray(merged.keyFindings) && merged.keyFindings.length > 0)
                || hasMeaningfulValue(merged.analystComment)
            );
    }

    const PUBLIC_RESULT_FIELDS = [
        'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'createdAt',
        'requestedBy', 'requestedByName', 'requestedByEmail',
        'slaHours',
        'bigdatacorpName',
        'bigdatacorpCpfStatus',
        'bigdatacorpBirthDate',
        'bigdatacorpAge',
        'bigdatacorpGender',
        'bigdatacorpHasDeathRecord',
        'criminalFlag', 'criminalSeverity', 'criminalNotes',
        'laborFlag', 'laborSeverity', 'laborNotes',
        'warrantFlag', 'warrantNotes',
        'osintLevel', 'osintVectors', 'osintNotes',
        'socialStatus', 'socialReasons', 'socialNotes',
        'digitalFlag', 'digitalVectors', 'digitalNotes',
        'conflictInterest', 'conflictNotes',
        'creditRestrictionFlag', 'creditQuantumScore', 'creditRestrictionSummary', 'creditRestrictionDetails',
        'riskScore', 'riskLevel', 'suggestedVerdict', 'finalVerdict', 'analystComment',
        'enabledPhases',
        'keyFindings',
        'executiveSummary',
        'publicReportToken',
        'cpfPendingRegularization',
        'cpfPendingNotes',
        'statusSummary',
        'sourceSummary',
        'nextSteps',
        'timelineEvents',
        'socialProfiles',
        'reportReady',
        'reportSlug',
        'concludedAt',
        'turnaroundHours',
    ];
    for (const field of PUBLIC_RESULT_FIELDS) {
        const value = merged[field];
        if (value !== undefined && value !== null && value !== '') {
            snapshot[field] = sanitizePublicStructuredValue(value);
        }
    }

    if (caseId) snapshot.id = caseId;

    return stripUndefined(snapshot);
}

function sanitizePublicReportHtml(rawHtml) {
    if (!rawHtml || typeof rawHtml !== 'string') return '';
    // Remove event handlers, scripts, and dangerous tags
    const sanitized = rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
        .replace(/on\w+\s*=\s*'[^']*'/gi, '')
        .replace(/javascript:/gi, '');
    return sanitized.trim();
}

module.exports = {
    SAFE_NARRATIVE_TEXTS,
    normalizedNarrativeText,
    narrativeMatches,
    buildSafeNarrativeReplacement,
    resolvePublicReportStatus,
    serializeManagedPublicReport,
    hasPublicReportMinimumContent,
    computePublicSnapshotHash,
    buildSourceSummary,
    buildStatusSummary,
    buildNextSteps,
    buildReportSlug,
    buildTimelineEvents,
    calculateTurnaroundHours,
    buildKeyFindings,
    buildExecutiveSummary,
    buildExpandedKeyFindings,
    buildExecutiveSummaryFallback,
    buildSanitizedPublicResultSnapshot,
    sanitizePublicReportHtml,
    hasMeaningfulValue,
    resolveNarrativeField,
    sanitizeNarrativesForFlags,
};
