const PUBLIC_RESULT_FIELDS = [
    'candidateName', 'cpfMasked', 'candidatePosition', 'hiringUf', 'tenantId', 'createdAt',
    'criminalFlag', 'criminalSeverity', 'criminalNotes',
    'laborFlag', 'laborSeverity', 'laborNotes',
    'warrantFlag', 'warrantNotes',
    'osintLevel', 'osintVectors', 'osintNotes',
    'socialStatus', 'socialReasons', 'socialNotes',
    'digitalFlag', 'digitalVectors', 'digitalNotes',
    'conflictInterest', 'conflictNotes',
    'riskScore', 'riskLevel', 'finalVerdict', 'analystComment',
    'enabledPhases',
];

export const CLIENT_STATUS_LABELS = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em andamento',
    WAITING_INFO: 'Aguardando informacoes',
    CORRECTION_NEEDED: 'Correcao solicitada',
    DONE: 'Concluido',
};

export const CLIENT_STATUS_DESCRIPTIONS = {
    PENDING: 'Solicitacao registrada e aguardando inicio do processamento.',
    IN_PROGRESS: 'Analise em execucao com validacao automatica e revisao operacional.',
    WAITING_INFO: 'Analise pausada aguardando complemento de informacoes do cliente.',
    CORRECTION_NEEDED: 'Dados essenciais precisam ser corrigidos para retomada do caso.',
    DONE: 'Analise concluida e pronta para consulta e compartilhamento.',
};

export const CLIENT_STATUS_TONES = {
    PENDING: 'var(--text-secondary)',
    IN_PROGRESS: 'var(--brand-600)',
    WAITING_INFO: 'var(--yellow-700)',
    CORRECTION_NEEDED: 'var(--red-600)',
    DONE: 'var(--green-600)',
};

const ATTENTION_REASON_RULES = [
    {
        label: 'Antecedentes criminais',
        match: (caseData) => ['POSITIVE', 'INCONCLUSIVE'].includes(caseData.criminalFlag),
    },
    {
        label: 'Processos trabalhistas',
        match: (caseData) => ['POSITIVE', 'INCONCLUSIVE'].includes(caseData.laborFlag),
    },
    {
        label: 'Mandados de prisao',
        match: (caseData) => caseData.warrantFlag === 'POSITIVE',
    },
    {
        label: 'Exposicao OSINT',
        match: (caseData) => ['MEDIUM', 'HIGH'].includes(caseData.osintLevel),
    },
    {
        label: 'Redes sociais',
        match: (caseData) => ['CONCERN', 'CONTRAINDICATED'].includes(caseData.socialStatus),
    },
    {
        label: 'Perfil digital',
        match: (caseData) => ['ALERT', 'CRITICAL'].includes(caseData.digitalFlag),
    },
    {
        label: 'Conflito de interesse',
        match: (caseData) => caseData.conflictInterest === 'YES',
    },
];

function parseDate(value) {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffHours(startValue, endValue) {
    const start = parseDate(startValue);
    const end = parseDate(endValue);
    if (!start || !end) return null;
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return diff >= 0 ? diff : null;
}

function summarizeSource(caseData) {
    if (caseData?.sourceSummary) return caseData.sourceSummary;
    const sources = Object.entries(caseData?.enrichmentSources || {})
        .map(([phase, sourceData]) => {
            if (!sourceData?.source) return null;
            return `${phase}: ${sourceData.source}`;
        })
        .filter(Boolean);
    return sources.length > 0 ? sources.join(' | ') : 'Fontes automatizadas e revisao analitica.';
}

export function sanitizeCaseForClient(caseData) {
    if (!caseData) return null;

    const sanitized = {};

    PUBLIC_RESULT_FIELDS.forEach((field) => {
        const value = caseData[field];
        if (value !== undefined && value !== null && value !== '') {
            sanitized[field] = value;
        }
    });

    if (!sanitized.enabledPhases && Array.isArray(caseData.enabledPhases)) {
        sanitized.enabledPhases = caseData.enabledPhases;
    }

    if (caseData.concludedAt) sanitized.concludedAt = caseData.concludedAt;
    if (caseData.updatedAt) sanitized.updatedAt = caseData.updatedAt;
    if (caseData.reportReady !== undefined) sanitized.reportReady = caseData.reportReady;

    return sanitized;
}

export function getCaseTimeline(caseData) {
    if (!caseData) return [];
    if (Array.isArray(caseData.timelineEvents) && caseData.timelineEvents.length > 0) {
        return caseData.timelineEvents;
    }

    const events = [
        caseData.createdAt && {
            type: 'created',
            status: 'done',
            title: 'Solicitacao enviada',
            description: 'Caso criado no portal do cliente.',
            at: caseData.createdAt,
        },
        caseData.analysisStartedAt && {
            type: 'analysis_started',
            status: 'done',
            title: 'Processamento iniciado',
            description: 'Pipeline automatizado iniciado com validacao de identidade.',
            at: caseData.analysisStartedAt,
        },
        caseData.correctedAt && {
            type: 'corrected',
            status: 'done',
            title: 'Caso corrigido e reenviado',
            description: 'Cliente atualizou os dados solicitados pela operacao.',
            at: caseData.correctedAt,
        },
        caseData.concludedAt && {
            type: 'concluded',
            status: 'done',
            title: 'Analise concluida',
            description: 'Resultado publicado para o cliente.',
            at: caseData.concludedAt,
        },
    ].filter(Boolean);

    return events;
}

export function resolveClientCaseView(caseData, publicResult) {
    if (!caseData) return null;

    const resolvedPublicResult = publicResult || caseData.publicResultMock || sanitizeCaseForClient(caseData);
    const reportReady = caseData.status === 'DONE' && caseData.reportReady !== false;

    return {
        ...caseData,
        ...resolvedPublicResult,
        publicResult: resolvedPublicResult,
        reportReady,
        statusLabel: CLIENT_STATUS_LABELS[caseData.status] || caseData.status || 'Sem status',
        statusSummary: caseData.statusSummary || CLIENT_STATUS_DESCRIPTIONS[caseData.status] || '',
        sourceSummary: summarizeSource(caseData),
        keyFindings: Array.isArray(caseData.keyFindings) ? caseData.keyFindings : [],
        nextSteps: Array.isArray(caseData.nextSteps) ? caseData.nextSteps : [],
        clientNotes: caseData.clientNotes || '',
        timelineEvents: getCaseTimeline(caseData),
    };
}

export function buildCaseReportPath(caseData, isDemoMode, token) {
    if (!caseData) return null;
    if (isDemoMode) return `/demo/r/${caseData.id}`;
    return token ? `/r/${token}` : null;
}

export function getReportAvailability(caseData, publicResult) {
    if (!caseData) {
        return {
            available: false,
            state: 'unavailable',
            message: 'Selecione um caso para visualizar o relatorio.',
        };
    }

    if (caseData.status !== 'DONE') {
        return {
            available: false,
            state: 'unavailable',
            message: 'Relatorio liberado somente apos a conclusao da analise.',
        };
    }

    const resolved = resolveClientCaseView(caseData, publicResult);
    if (!resolved?.reportReady) {
        return {
            available: false,
            state: 'pending',
            message: 'O relatorio ainda esta sendo preparado.',
        };
    }

    return {
        available: true,
        state: 'ready',
        message: 'Relatorio pronto para abertura e compartilhamento.',
    };
}

function countCasesByMonth(cases, monthKey) {
    return cases.filter((caseData) => String(caseData.createdAt || '').startsWith(monthKey)).length;
}

function countCompletedCasesByMonth(cases, monthKey) {
    return cases.filter((caseData) => (
        String(caseData.createdAt || '').startsWith(monthKey)
        && caseData.status === 'DONE'
    )).length;
}

function getAttentionReasons(cases) {
    const counts = {};
    const flaggedCases = cases.filter((caseData) => (
        caseData.finalVerdict === 'ATTENTION' || caseData.finalVerdict === 'NOT_RECOMMENDED'
    ));

    flaggedCases.forEach((caseData) => {
        ATTENTION_REASON_RULES.forEach((rule) => {
            if (rule.match(caseData)) {
                counts[rule.label] = (counts[rule.label] || 0) + 1;
            }
        });
    });

    return Object.entries(counts)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count }));
}

export function getClientDashboardMetrics(cases) {
    const total = cases.length;
    const doneCases = cases.filter((caseData) => caseData.status === 'DONE');
    const inProgressCases = cases.filter((caseData) => ['IN_PROGRESS', 'WAITING_INFO'].includes(caseData.status));
    const pendingCases = cases.filter((caseData) => caseData.status === 'PENDING');
    const correctionCases = cases.filter((caseData) => caseData.status === 'CORRECTION_NEEDED');

    const verdicts = {
        FIT: doneCases.filter((caseData) => caseData.finalVerdict === 'FIT').length,
        ATTENTION: doneCases.filter((caseData) => caseData.finalVerdict === 'ATTENTION').length,
        NOT_RECOMMENDED: doneCases.filter((caseData) => caseData.finalVerdict === 'NOT_RECOMMENDED').length,
    };

    const turnaroundHours = doneCases
        .map((caseData) => caseData.turnaroundHours ?? diffHours(caseData.createdAt, caseData.concludedAt || caseData.updatedAt))
        .filter((value) => typeof value === 'number' && Number.isFinite(value));

    const avgTurnaroundHours = turnaroundHours.length > 0
        ? turnaroundHours.reduce((accumulator, value) => accumulator + value, 0) / turnaroundHours.length
        : null;

    const now = new Date();
    const months = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
        const currentMonth = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
        months.push({
            key,
            label: currentMonth.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            count: countCasesByMonth(cases, key),
            doneCount: countCompletedCasesByMonth(cases, key),
        });
    }

    const maxMonthCount = Math.max(...months.map((month) => month.count), 1);

    const recentCompletedCases = [...doneCases]
        .sort((left, right) => String(right.concludedAt || right.updatedAt || '').localeCompare(String(left.concludedAt || left.updatedAt || '')))
        .slice(0, 4);

    return {
        total,
        done: doneCases.length,
        inProgress: inProgressCases.length,
        pending: pendingCases.length,
        corrections: correctionCases.length,
        completionRate: total > 0 ? Math.round((doneCases.length / total) * 100) : 0,
        avgTurnaroundHours,
        verdicts,
        months,
        maxMonthCount,
        topFlags: getAttentionReasons(doneCases),
        recentCompletedCases,
    };
}
