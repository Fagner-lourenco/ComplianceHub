const crypto = require('crypto');

const V2_OPERATIONAL_ARTIFACTS_VERSION = 'v2-operational-artifacts-2026-04-21';

const PROVIDER_SOURCE_SPECS = [
    { provider: 'bigdatacorp', moduleKey: 'identity_pf', dataset: 'basic_data', path: ['bigdatacorpSources', 'basicData'] },
    { provider: 'bigdatacorp', moduleKey: 'judicial', dataset: 'processes', path: ['bigdatacorpSources', 'processes'] },
    { provider: 'bigdatacorp', moduleKey: 'kyc', dataset: 'kyc', path: ['bigdatacorpSources', 'kyc'] },
    { provider: 'bigdatacorp', moduleKey: 'identity_pf', dataset: 'occupation_data', path: ['bigdatacorpSources', 'occupation'] },
    { provider: 'judit', moduleKey: 'identity_pf', dataset: 'entity', path: ['juditSources', 'entity'] },
    { provider: 'judit', moduleKey: 'judicial', dataset: 'lawsuits', path: ['juditSources', 'lawsuits'] },
    { provider: 'judit', moduleKey: 'judicial', dataset: 'lawsuits_by_name', path: ['juditSources', 'lawsuits_by_name'] },
    { provider: 'judit', moduleKey: 'warrants', dataset: 'warrant', path: ['juditSources', 'warrant'] },
    { provider: 'judit', moduleKey: 'criminal', dataset: 'execution', path: ['juditSources', 'execution'] },
    { provider: 'escavador', moduleKey: 'judicial', dataset: 'processos', path: ['escavadorSources'] },
    { provider: 'djen', moduleKey: 'judicial', dataset: 'comunicacoes', path: ['djenSources'] },
    { provider: 'fontedata', moduleKey: 'identity_pf', dataset: 'gate', path: ['enrichmentSources', 'gate'] },
    { provider: 'fontedata', moduleKey: 'identity_pf', dataset: 'identity', path: ['enrichmentSources', 'identity'] },
    { provider: 'fontedata', moduleKey: 'criminal', dataset: 'criminal', path: ['enrichmentSources', 'criminal'] },
    { provider: 'fontedata', moduleKey: 'labor', dataset: 'labor', path: ['enrichmentSources', 'labor'] },
    { provider: 'fontedata', moduleKey: 'warrants', dataset: 'warrant', path: ['enrichmentSources', 'warrant'] },
    { provider: 'fontedata', moduleKey: 'judicial', dataset: 'processos_completa', path: ['enrichmentSources', 'processos-completa'] },
];

const POSITIVE_VALUES = new Set([
    'POSITIVE',
    'YES',
    'ALERT',
    'CRITICAL',
    'HIGH',
    'CONCERN',
    'CONTRAINDICATED',
    'INCONCLUSIVE',
    'INCONCLUSIVE_HOMONYM',
    'INCONCLUSIVE_LOW_COVERAGE',
    'NEGATIVE_PARTIAL',
]);

function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function getByPath(source, path = []) {
    return path.reduce((current, key) => {
        if (!current || typeof current !== 'object') return undefined;
        return current[key];
    }, source);
}

function stableStringify(value) {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashValue(value, length = 16) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, length);
}

function safeIdPart(value, maxLength = 80) {
    return String(value || 'unknown')
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, maxLength);
}

function stripUndefined(value) {
    if (Array.isArray(value)) return value.map(stripUndefined).filter((item) => item !== undefined);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, entryValue]) => entryValue !== undefined)
            .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    );
}

const LARGE_PAYLOAD_THRESHOLD = 500 * 1024; // 500KB - Firestore limit is 1MB, we use 500KB for safety

function hasMeaningfulValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
}

function handlePayloadStorage(id, payload) {
    if (!payload) return { payload: null, payloadRef: null, payloadSize: 0 };
    const stringified = JSON.stringify(payload);
    const size = stringified.length;

    if (size > LARGE_PAYLOAD_THRESHOLD) {
        return {
            payload: null,
            payloadRef: `raw_snapshots/${id}.json`,
            payloadSize: size,
            isLargePayload: true,
            storagePayload: payload,
        };
    }

    return {
        payload,
        payloadRef: null,
        payloadSize: size,
        isLargePayload: false,
    };
}

function isPositiveLike(value) {
    return POSITIVE_VALUES.has(String(value || '').toUpperCase());
}

function numberValue(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) return number;
    }
    return 0;
}

function extractRequestId(source) {
    if (!source) return null;
    if (typeof source === 'string') return source;
    if (typeof source !== 'object') return null;
    return source.requestId
        || source.request_id
        || source.id
        || source.uuid
        || source._request?.requestId
        || null;
}

function extractObservedAt(source, caseData) {
    if (!source || typeof source !== 'object') {
        return caseData.bigdatacorpQueryDate || null;
    }
    return source.consultedAt
        || source.queriedAt
        || source.timestamp
        || source.date
        || source._request?.startedAt
        || caseData.bigdatacorpQueryDate
        || null;
}

function resolveProviderStatus(source, caseData, provider) {
    if (source && typeof source === 'object') {
        if (source.error) return 'failed';
        const rawStatus = String(source.status || source.providerStatus || '').toUpperCase();
        if (['FAILED', 'ERROR'].includes(rawStatus)) return 'failed';
        if (['RUNNING', 'PENDING', 'PROCESSING'].includes(rawStatus)) return 'running';
        if (['SKIPPED'].includes(rawStatus)) return 'skipped';
    }

    const statusFields = {
        bigdatacorp: caseData.bigdatacorpEnrichmentStatus,
        judit: caseData.juditEnrichmentStatus,
        escavador: caseData.escavadorEnrichmentStatus,
        djen: caseData.djenEnrichmentStatus,
        fontedata: caseData.enrichmentStatus,
    };
    const rawStatus = String(statusFields[provider] || '').toUpperCase();
    if (['DONE', 'PARTIAL', 'COMPLETED'].includes(rawStatus)) return 'succeeded';
    if (['FAILED', 'BLOCKED'].includes(rawStatus)) return 'failed';
    if (['RUNNING', 'PENDING'].includes(rawStatus)) return 'running';
    if (['SKIPPED'].includes(rawStatus)) return 'skipped';
    return hasMeaningfulValue(source) ? 'succeeded' : 'unknown';
}

function buildProviderRequestId(caseId, provider, dataset, source) {
    const requestId = extractRequestId(source);
    const hash = hashValue({ provider, dataset, requestId, source }, 12);
    return `${safeIdPart(caseId)}_${safeIdPart(provider, 24)}_${safeIdPart(dataset, 36)}_${hash}`;
}

function buildProviderRequestsForCase({ caseId, caseData = {} } = {}) {
    const tenantId = caseData.tenantId || null;
    const productKey = caseData.productKey || caseData.requestedProductKey || 'dossier_pf_basic';

    return PROVIDER_SOURCE_SPECS
        .map((spec) => {
            const source = getByPath(caseData, spec.path);
            if (!hasMeaningfulValue(source)) {
                const errorField = {
                    bigdatacorp: 'bigdatacorpError',
                    judit: 'juditError',
                    escavador: 'escavadorError',
                    djen: 'djenError',
                    fontedata: 'enrichmentError',
                }[spec.provider];

                if (errorField && caseData[errorField]) {
                    const id = buildProviderRequestId(caseId, spec.provider, spec.dataset, { error: caseData[errorField] });
                    return stripUndefined({
                        id,
                        tenantId,
                        caseId,
                        subjectId: caseData.subjectId || null,
                        productKey,
                        moduleKey: spec.moduleKey,
                        provider: spec.provider,
                        datasets: [spec.dataset],
                        requestHash: null,
                        idempotencyKey: `${tenantId || 'no-tenant'}:${caseId}:${spec.provider}:${spec.dataset}:failed_early`,
                        status: 'failed',
                        errorCode: String(caseData[errorField]).slice(0, 140),
                        sourceKind: 'legacy_provider_source',
                        sourceRef: spec.path.join('.'),
                        sourceRequestId: null,
                        createdFrom: 'v2_transition_adapter',
                        version: V2_OPERATIONAL_ARTIFACTS_VERSION,
                    });
                }
                return null;
            }

            const id = buildProviderRequestId(caseId, spec.provider, spec.dataset, source);
            const requestId = extractRequestId(source);
            const idempotencyKey = `${tenantId || 'no-tenant'}:${caseId}:${spec.provider}:${spec.dataset}:${requestId || hashValue(source, 16)}`;

            return stripUndefined({
                id,
                tenantId,
                caseId,
                subjectId: caseData.subjectId || null,
                productKey,
                moduleKey: spec.moduleKey,
                provider: spec.provider,
                datasets: [spec.dataset],
                requestHash: hashValue({ provider: spec.provider, dataset: spec.dataset, source }, 24),
                idempotencyKey,
                status: resolveProviderStatus(source, caseData, spec.provider),
                startedAt: extractObservedAt(source, caseData),
                finishedAt: extractObservedAt(source, caseData),
                errorCode: source?.error ? String(source.error).slice(0, 140) : null,
                sourceKind: 'legacy_provider_source',
                sourceRef: spec.path.join('.'),
                sourceRequestId: requestId,
                createdFrom: 'v2_transition_adapter',
                version: V2_OPERATIONAL_ARTIFACTS_VERSION,
            });
        })
        .filter(Boolean);
}

function providerRequestIdsForModule(providerRequests, moduleKey) {
    return providerRequests
        .filter((request) => request.moduleKey === moduleKey)
        .map((request) => request.id);
}

function firstProviderRequestId(providerRequests, moduleKey, fallbackModuleKey = null) {
    return providerRequestIdsForModule(providerRequests, moduleKey)[0]
        || (fallbackModuleKey ? providerRequestIdsForModule(providerRequests, fallbackModuleKey)[0] : null)
        || null;
}

function createEvidence({ caseId, caseData, providerRequests, moduleKey, kind, summary, severity = 'low', visibility = 'internal', status = null, providerModuleKey = null }) {
    if (!hasMeaningfulValue(summary)) return null;
    const providerRequestId = firstProviderRequestId(providerRequests, providerModuleKey || moduleKey, moduleKey === 'criminal' || moduleKey === 'labor' ? 'judicial' : null);
    const id = `${safeIdPart(caseId)}_${safeIdPart(moduleKey, 36)}_${safeIdPart(kind, 48)}_${hashValue(summary, 12)}`;
    const evidenceStatus = status || (['high', 'critical'].includes(severity) ? 'needs_review' : 'auto_created');

    return stripUndefined({
        id,
        tenantId: caseData.tenantId || null,
        caseId,
        subjectId: caseData.subjectId || null,
        moduleKey,
        providerRequestId,
        providerRecordId: null,
        rawSnapshotId: null,
        kind,
        summary: String(summary).slice(0, 700),
        severity,
        visibility,
        status: evidenceStatus,
        reviewedBy: null,
        reviewedAt: null,
        sourceTimestamp: caseData.bigdatacorpQueryDate || null,
        createdFrom: 'v2_transition_adapter',
        version: V2_OPERATIONAL_ARTIFACTS_VERSION,
    });
}

function buildEvidenceItemsForCase({ caseId, caseData = {}, providerRequests = [] } = {}) {
    const evidence = [];
    const identityName = caseData.bigdatacorpName || caseData.enrichmentIdentity?.name || caseData.juditIdentity?.name || caseData.candidateName;
    const cpfStatus = caseData.bigdatacorpCpfStatus || caseData.enrichmentIdentity?.cpfStatus || caseData.juditIdentity?.cpfStatus;
    if (identityName || cpfStatus) {
        evidence.push(createEvidence({
            caseId,
            caseData,
            providerRequests,
            moduleKey: 'identity_pf',
            kind: 'identity_check',
            summary: `Identidade consultada${identityName ? `: ${identityName}` : ''}${cpfStatus ? `, CPF ${cpfStatus}` : ''}.`,
            severity: cpfStatus && String(cpfStatus).toUpperCase() !== 'REGULAR' ? 'medium' : 'low',
            visibility: 'internal',
        }));
    }

    const processTotal = numberValue(
        caseData.juditProcessTotal,
        caseData.bigdatacorpProcessTotal,
        caseData.escavadorProcessTotal,
        caseData.djenConfirmedTotal,
    );
    if (processTotal > 0 || hasMeaningfulValue(caseData.processHighlights)) {
        evidence.push(createEvidence({
            caseId,
            caseData,
            providerRequests,
            moduleKey: 'judicial',
            kind: 'judicial_processes',
            summary: processTotal > 0
                ? `${processTotal} processo(s)/comunicacao(oes) judicial(is) identificado(s) nas fontes consultadas.`
                : 'Fontes judiciais retornaram destaques processuais relevantes.',
            severity: processTotal > 0 ? 'medium' : 'low',
            visibility: 'internal',
        }));
    }

    const criminalCount = numberValue(
        caseData.juditCriminalCount,
        caseData.bigdatacorpCriminalProcessCount,
        caseData.bigdatacorpCriminalCount,
        caseData.escavadorCriminalCount,
        caseData.djenCriminalCount,
    );
    if (hasMeaningfulValue(caseData.criminalFlag) || criminalCount > 0 || hasMeaningfulValue(caseData.juditExecutionFlag)) {
        const positive = isPositiveLike(caseData.criminalFlag) || criminalCount > 0 || isPositiveLike(caseData.juditExecutionFlag);
        evidence.push(createEvidence({
            caseId,
            caseData,
            providerRequests,
            moduleKey: 'criminal',
            kind: 'criminal_finding',
            summary: positive
                ? `Sinal criminal/processual penal identificado${criminalCount > 0 ? ` (${criminalCount} registro(s))` : ''}.`
                : 'Analise criminal sem apontamento positivo nas fontes consultadas.',
            severity: positive ? 'high' : 'low',
            visibility: 'internal',
        }));
    }

    const laborCount = numberValue(caseData.juditLaborCount, caseData.bigdatacorpLaborProcessCount);
    if (hasMeaningfulValue(caseData.laborFlag) || laborCount > 0) {
        const positive = isPositiveLike(caseData.laborFlag) || laborCount > 0;
        evidence.push(createEvidence({
            caseId,
            caseData,
            providerRequests,
            moduleKey: 'labor',
            kind: 'labor_finding',
            summary: positive
                ? `Sinal trabalhista identificado${laborCount > 0 ? ` (${laborCount} registro(s))` : ''}.`
                : 'Analise trabalhista sem apontamento positivo nas fontes consultadas.',
            severity: positive ? 'medium' : 'low',
            visibility: 'internal',
        }));
    }

    const warrantCount = numberValue(
        caseData.juditActiveWarrantCount,
        caseData.bigdatacorpActiveWarrantCount,
        asArray(caseData.bigdatacorpActiveWarrants).length,
        asArray(caseData.juditWarrants).length,
    );
    if (hasMeaningfulValue(caseData.warrantFlag) || warrantCount > 0 || caseData.bigdatacorpHasArrestWarrant === true) {
        const positive = isPositiveLike(caseData.warrantFlag) || warrantCount > 0 || caseData.bigdatacorpHasArrestWarrant === true;
        evidence.push(createEvidence({
            caseId,
            caseData,
            providerRequests,
            moduleKey: 'warrants',
            kind: 'warrant_finding',
            summary: positive
                ? `Mandado/alerta critico identificado${warrantCount > 0 ? ` (${warrantCount} registro(s))` : ''}.`
                : 'Consulta de mandados sem apontamento positivo nas fontes consultadas.',
            severity: positive ? 'critical' : 'low',
            visibility: 'internal',
        }));
    }

    if (caseData.bigdatacorpIsPep === true || caseData.bigdatacorpIsSanctioned === true || caseData.bigdatacorpWasSanctioned === true) {
        const markers = [
            caseData.bigdatacorpIsPep === true ? 'PEP' : null,
            caseData.bigdatacorpIsSanctioned === true ? 'sancao atual' : null,
            caseData.bigdatacorpWasSanctioned === true ? 'historico de sancao' : null,
        ].filter(Boolean).join(', ');
        evidence.push(createEvidence({
            caseId,
            caseData,
            providerRequests,
            moduleKey: 'kyc',
            kind: 'kyc_screening',
            summary: `Screening KYC com marcador(es): ${markers}.`,
            severity: caseData.bigdatacorpIsSanctioned === true ? 'high' : 'medium',
            visibility: 'internal',
        }));
    }

    return evidence.filter(Boolean);
}

function createRiskSignal({ caseId, caseData, moduleKey, kind, severity, scoreImpact, reason, supportingEvidenceIds }) {
    if (!supportingEvidenceIds || supportingEvidenceIds.length === 0) return null;
    const id = `${safeIdPart(caseId)}_${safeIdPart(moduleKey, 36)}_${safeIdPart(kind, 48)}_${hashValue({ reason, supportingEvidenceIds }, 12)}`;
    return stripUndefined({
        id,
        tenantId: caseData.tenantId || null,
        caseId,
        subjectId: caseData.subjectId || null,
        moduleKey,
        kind,
        severity,
        scoreImpact,
        reason,
        supportingEvidenceIds,
        status: 'preliminary',
        reviewPolicyResult: ['high', 'critical'].includes(severity) ? 'requires_human_review' : 'review_if_used_in_decision',
        reviewedBy: null,
        createdFrom: 'v2_transition_adapter',
        version: V2_OPERATIONAL_ARTIFACTS_VERSION,
    });
}

function buildRiskSignalsForCase({ caseId, caseData = {}, evidenceItems = [] } = {}) {
    const evidenceByModule = evidenceItems.reduce((acc, evidence) => {
        acc[evidence.moduleKey] = acc[evidence.moduleKey] || [];
        acc[evidence.moduleKey].push(evidence);
        return acc;
    }, {});
    const signals = [];

    if (isPositiveLike(caseData.criminalFlag) || numberValue(caseData.juditCriminalCount, caseData.bigdatacorpCriminalProcessCount, caseData.bigdatacorpCriminalCount) > 0) {
        signals.push(createRiskSignal({
            caseId,
            caseData,
            moduleKey: 'criminal',
            kind: 'criminal_risk',
            severity: 'high',
            scoreImpact: 35,
            reason: 'Achado criminal ou processual penal exige revisao analitica.',
            supportingEvidenceIds: asArray(evidenceByModule.criminal).map((evidence) => evidence.id),
        }));
    }

    if (isPositiveLike(caseData.laborFlag) || numberValue(caseData.juditLaborCount, caseData.bigdatacorpLaborProcessCount) > 0) {
        signals.push(createRiskSignal({
            caseId,
            caseData,
            moduleKey: 'labor',
            kind: 'labor_risk',
            severity: 'medium',
            scoreImpact: 18,
            reason: 'Achado trabalhista pode impactar a decisao conforme produto/contrato.',
            supportingEvidenceIds: asArray(evidenceByModule.labor).map((evidence) => evidence.id),
        }));
    }

    if (isPositiveLike(caseData.warrantFlag) || numberValue(caseData.juditActiveWarrantCount, caseData.bigdatacorpActiveWarrantCount, asArray(caseData.bigdatacorpActiveWarrants).length, asArray(caseData.juditWarrants).length) > 0 || caseData.bigdatacorpHasArrestWarrant === true) {
        signals.push(createRiskSignal({
            caseId,
            caseData,
            moduleKey: 'warrants',
            kind: 'warrant_risk',
            severity: 'critical',
            scoreImpact: 50,
            reason: 'Mandado ou alerta critico requer revisao humana e normalmente aprovacao senior.',
            supportingEvidenceIds: asArray(evidenceByModule.warrants).map((evidence) => evidence.id),
        }));
    }

    if (caseData.bigdatacorpIsPep === true || caseData.bigdatacorpIsSanctioned === true || caseData.bigdatacorpWasSanctioned === true) {
        signals.push(createRiskSignal({
            caseId,
            caseData,
            moduleKey: 'kyc',
            kind: 'kyc_risk',
            severity: caseData.bigdatacorpIsSanctioned === true ? 'high' : 'medium',
            scoreImpact: caseData.bigdatacorpIsSanctioned === true ? 35 : 16,
            reason: 'Screening KYC retornou marcador que exige revisao conforme politica.',
            supportingEvidenceIds: asArray(evidenceByModule.kyc).map((evidence) => evidence.id),
        }));
    }

    return signals.filter(Boolean);
}

function groupIdsByModule(items) {
    return items.reduce((acc, item) => {
        if (!item.moduleKey || !item.id) return acc;
        acc[item.moduleKey] = acc[item.moduleKey] || [];
        acc[item.moduleKey].push(item.id);
        return acc;
    }, {});
}

function buildRawSnapshotsForCase({ caseId, caseData = {}, providerRequests = [] } = {}) {
    return providerRequests
        .map((request) => {
            const source = getByPath(caseData, request.sourceRef.split('.'));
            if (!hasMeaningfulValue(source)) return null;

            const id = `snap_${request.id}`;
            const { payload, payloadRef, payloadSize, isLargePayload, storagePayload } = handlePayloadStorage(id, source);

            return stripUndefined({
                id,
                tenantId: request.tenantId,
                caseId: request.caseId,
                providerRequestId: request.id,
                moduleKey: request.moduleKey,
                provider: request.provider,
                dataset: request.datasets[0],
                payloadHash: hashValue(source, 24),
                payload,
                payloadRef,
                payloadSize,
                isLargePayload,
                storagePayload,
                retentionPolicy: 'raw_payload_180d',
                visibility: 'restricted_raw',
                createdAt: request.finishedAt || request.startedAt || new Date().toISOString(),
                version: V2_OPERATIONAL_ARTIFACTS_VERSION,
            });
        })
        .filter(Boolean);
}

function buildProviderRecordsForCase({ rawSnapshots = [] } = {}) {
    const records = [];
    rawSnapshots.forEach((snap) => {
        if (!snap.payload) return;
        let items = [];
        if (snap.moduleKey === 'judicial' && Array.isArray(snap.payload.processes)) {
            items = snap.payload.processes;
        } else if (snap.moduleKey === 'warrants' && Array.isArray(snap.payload)) {
            items = snap.payload;
        } else if (snap.moduleKey === 'criminal' && Array.isArray(snap.payload)) {
            items = snap.payload;
        }
        
        items.forEach((item, index) => {
            const id = `rec_${snap.id}_${index}`;
            records.push(stripUndefined({
                id,
                tenantId: snap.tenantId,
                caseId: snap.caseId,
                rawSnapshotId: snap.id,
                providerRequestId: snap.providerRequestId,
                moduleKey: snap.moduleKey,
                provider: snap.provider,
                dataset: snap.dataset,
                recordHash: hashValue(item, 24),
                data: item,
                createdAt: snap.createdAt,
                version: V2_OPERATIONAL_ARTIFACTS_VERSION,
            }));
        });
    });
    return records;
}

function buildOperationalArtifactsForCase({ caseId, caseData = {}, moduleRuns = [] } = {}) {
    const providerRequests = buildProviderRequestsForCase({ caseId, caseData });
    const rawSnapshots = buildRawSnapshotsForCase({ caseId, caseData, providerRequests });
    const providerRecords = buildProviderRecordsForCase({ rawSnapshots });
    const evidenceItems = buildEvidenceItemsForCase({ caseId, caseData, providerRequests });
    const riskSignals = buildRiskSignalsForCase({ caseId, caseData, evidenceItems });
    const providerIdsByModule = groupIdsByModule(providerRequests);
    const rawSnapshotIdsByModule = groupIdsByModule(rawSnapshots);
    const providerRecordIdsByModule = groupIdsByModule(providerRecords);
    const evidenceIdsByModule = groupIdsByModule(evidenceItems);
    const riskSignalIdsByModule = groupIdsByModule(riskSignals);
    const activeModuleKeys = unique([
        ...moduleRuns.map((run) => run.moduleKey),
        ...Object.keys(providerIdsByModule),
        ...Object.keys(rawSnapshotIdsByModule),
        ...Object.keys(providerRecordIdsByModule),
        ...Object.keys(evidenceIdsByModule),
        ...Object.keys(riskSignalIdsByModule),
    ]);

    const artifactIdsByModule = Object.fromEntries(activeModuleKeys.map((moduleKey) => [moduleKey, {
        providerRequestIds: providerIdsByModule[moduleKey] || [],
        rawSnapshotIds: rawSnapshotIdsByModule[moduleKey] || [],
        providerRecordIds: providerRecordIdsByModule[moduleKey] || [],
        evidenceIds: evidenceIdsByModule[moduleKey] || [],
        riskSignalIds: riskSignalIdsByModule[moduleKey] || [],
    }]));

    return {
        providerRequests,
        rawSnapshots,
        providerRecords,
        evidenceItems,
        riskSignals,
        artifactIdsByModule,
        summary: {
            providerRequestCount: providerRequests.length,
            rawSnapshotCount: rawSnapshots.length,
            providerRecordCount: providerRecords.length,
            evidenceCount: evidenceItems.length,
            riskSignalCount: riskSignals.length,
        },
        version: V2_OPERATIONAL_ARTIFACTS_VERSION,
    };
}

module.exports = {
    V2_OPERATIONAL_ARTIFACTS_VERSION,
    buildEvidenceItemsForCase,
    buildOperationalArtifactsForCase,
    buildProviderRequestsForCase,
    buildRiskSignalsForCase,
    buildRawSnapshotsForCase,
    buildProviderRecordsForCase,
};
