import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import ScoreBar from '../../ui/components/ScoreBar/ScoreBar';
import SocialLinks from '../../ui/components/SocialLinks/SocialLinks';
import EnrichmentPipeline from '../../ui/components/EnrichmentPipeline/EnrichmentPipeline';
import Modal from '../../ui/components/Modal/Modal';
import { useAuth } from '../../core/auth/useAuth';
import {
    DEFAULT_ANALYSIS_CONFIG,
    callConcludeCaseByAnalyst,
    callReturnCaseToClient,
    callRerunEnrichmentPhase,
    callSaveCaseDraftByAnalyst,
    callSetAiDecisionByAnalyst,
    getEnabledPhases,
    getTenantSettings,
    savePublicReport,
    subscribeToCaseDoc,
    callRerunAiAnalysis,
} from '../../core/firebase/firestoreService';
import { MOCK_CASE_DETAILS, MOCK_CASES } from '../../data/mockData';
import { buildCaseReportHtml } from '../../core/reportBuilder';
import { getOverallEnrichmentStatus } from '../../core/enrichmentStatus';
import { extractErrorMessage, getUserFriendlyMessage } from '../../core/errorUtils';

function formatFullCpf(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '';
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
import './CasoPage.css';

const LEGACY_PHASES = Object.keys(DEFAULT_ANALYSIS_CONFIG);

const CRIMINAL_OPTIONS = [
    'NEGATIVE',
    'NEGATIVE_PARTIAL',
    'POSITIVE',
    'INCONCLUSIVE',
    'INCONCLUSIVE_HOMONYM',
    'INCONCLUSIVE_LOW_COVERAGE',
    'NOT_FOUND',
];
const LABOR_OPTIONS = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];
const WARRANT_OPTIONS = ['NEGATIVE', 'POSITIVE', 'INCONCLUSIVE', 'NOT_FOUND'];
const SEVERITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH'];
const OSINT_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];
const SOCIAL_OPTIONS = ['APPROVED', 'NEUTRAL', 'CONCERN', 'CONTRAINDICATED'];
const DIGITAL_OPTIONS = ['CLEAN', 'ALERT', 'CRITICAL', 'NOT_CHECKED'];
const CONFLICT_OPTIONS = ['YES', 'NO', 'UNKNOWN'];
const VERDICT_OPTIONS = ['FIT', 'ATTENTION', 'NOT_RECOMMENDED'];

const CORRECTION_REASONS = [
    'CPF incorreto',
    'Nome divergente',
    'Redes sociais invalidas',
    'Dados incompletos',
    'Outro',
];

function getAiHomonymDecisionLabel(value) {
    return {
        LIKELY_MATCH: 'Provavel mesmo individuo',
        LIKELY_HOMONYM: 'Provavel homonimo',
        UNCERTAIN: 'Inconclusivo',
    }[value] || (value || 'N/A');
}

function getAiHomonymActionLabel(value) {
    return {
        KEEP: 'Manter achado',
        DISCARD: 'Descartar achado',
        MANUAL_REVIEW: 'Revisao manual',
    }[value] || (value || 'N/A');
}

function getAiHomonymRiskLabel(value) {
    return {
        HIGH: 'Alto',
        MEDIUM: 'Medio',
        LOW: 'Baixo',
        NONE: 'Nenhum',
    }[value] || (value || 'N/A');
}

function getCoverageLabel(value) {
    return {
        HIGH_COVERAGE: 'Cobertura alta',
        PARTIAL_COVERAGE: 'Cobertura parcial',
        LOW_COVERAGE: 'Cobertura reduzida',
    }[value] || (value || 'N/A');
}

function getEvidenceQualityLabel(value) {
    return {
        HARD_FACT: 'Fato duro confirmado',
        MIXED_STRONG_AND_WEAK: 'Fato duro com ruido por nome',
        WEAK_NAME_ONLY: 'Somente evidencia fraca',
        LOW_COVERAGE_ONLY: 'Cobertura insuficiente',
        NEGATIVE_WITH_PARTIAL_COVERAGE: 'Negativo com cobertura parcial',
        CONFIRMED_NEGATIVE: 'Negativo com boa cobertura',
        LOW_RISK_ROLE_ONLY: 'Somente papel de baixo risco',
        NO_PROVIDER_RESPONSE: 'Sem resposta aproveitavel',
    }[value] || (value || 'N/A');
}

function getNegativePartialSafetyNetReasonLabel(value) {
    return {
        LOW_COVERAGE: 'Cobertura reduzida nas fontes principais.',
        HIGH_PROVIDER_DIVERGENCE: 'Alta divergencia entre os providers consultados.',
        JUDIT_ZERO_PROCESS: 'A Judit nao retornou processos aproveitaveis.',
        NAME_SEARCH_SKIPPED_HOMONYMS: 'A busca por nome foi evitada por risco alto de homonimos.',
        NAME_SEARCH_ONLY_RESULT: 'Os achados da Judit dependeram de busca por nome.',
        MANUAL_REVIEW_RECOMMENDED: 'A classificacao ja recomenda revisao manual.',
    }[value] || (value || 'N/A');
}

function createInitialForm(caseData) {
    return {
        criminalFlag: caseData?.criminalFlag || '',
        criminalSeverity: caseData?.criminalSeverity || '',
        criminalNotes: caseData?.criminalNotes || '',
        laborFlag: caseData?.laborFlag || '',
        laborSeverity: caseData?.laborSeverity || '',
        laborNotes: caseData?.laborNotes || '',
        warrantFlag: caseData?.warrantFlag || '',
        warrantNotes: caseData?.warrantNotes || '',
        osintLevel: caseData?.osintLevel || '',
        osintVectors: caseData?.osintVectors || [],
        osintNotes: caseData?.osintNotes || '',
        socialStatus: caseData?.socialStatus || '',
        socialReasons: caseData?.socialReasons || [],
        socialNotes: caseData?.socialNotes || '',
        digitalFlag: caseData?.digitalFlag || '',
        digitalVectors: caseData?.digitalVectors || [],
        digitalNotes: caseData?.digitalNotes || '',
        conflictInterest: caseData?.conflictInterest || '',
        conflictNotes: caseData?.conflictNotes || '',
        finalVerdict: caseData?.finalVerdict && caseData.finalVerdict !== 'PENDING' ? caseData.finalVerdict : '',
        analystComment: caseData?.analystComment || '',
    };
}

function calculateRisk(form, enabledPhases) {
    const scores = {
        NEGATIVE: 0,
        NEGATIVE_PARTIAL: 18,
        NOT_FOUND: 5,
        INCONCLUSIVE: 40,
        INCONCLUSIVE_HOMONYM: 45,
        INCONCLUSIVE_LOW_COVERAGE: 38,
        POSITIVE: 90,
        LOW: 0,
        UNKNOWN: 20,
        MEDIUM: 50,
        HIGH: 90,
        APPROVED: 0,
        NEUTRAL: 10,
        CONCERN: 50,
        CONTRAINDICATED: 90,
        CLEAN: 0,
        NOT_CHECKED: 10,
        ALERT: 45,
        CRITICAL: 85,
        NO: 0,
        YES: 60,
    };

    const ep = enabledPhases || LEGACY_PHASES;
    const phaseScores = [];
    if (ep.includes('criminal')) {
        let criminalScore = scores[form.criminalFlag] || 0;
        if (form.criminalFlag === 'POSITIVE') {
            if (form.criminalSeverity === 'HIGH') criminalScore = 95;
            else if (form.criminalSeverity === 'LOW') criminalScore = 75;
        }
        phaseScores.push(criminalScore);
    }
    if (ep.includes('labor')) phaseScores.push(scores[form.laborFlag] || 0);
    if (ep.includes('warrant')) phaseScores.push(scores[form.warrantFlag] || 0);
    if (ep.includes('osint')) phaseScores.push(scores[form.osintLevel] || 0);
    if (ep.includes('social')) phaseScores.push(scores[form.socialStatus] || 0);
    if (ep.includes('digital')) phaseScores.push(scores[form.digitalFlag] || 0);
    if (ep.includes('conflictInterest')) phaseScores.push(scores[form.conflictInterest] || 0);
    let riskScore = Math.max(...phaseScores, 0);

    const yellowSignals = [
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE',
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE_HOMONYM',
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE_LOW_COVERAGE',
        ep.includes('criminal') && form.criminalFlag === 'NEGATIVE_PARTIAL',
        ep.includes('labor') && form.laborFlag === 'INCONCLUSIVE',
        ep.includes('warrant') && form.warrantFlag === 'INCONCLUSIVE',
        ep.includes('osint') && form.osintLevel === 'MEDIUM',
        ep.includes('social') && form.socialStatus === 'CONCERN',
        ep.includes('digital') && form.digitalFlag === 'ALERT',
    ].filter(Boolean).length;

    if (yellowSignals >= 2) {
        riskScore = Math.min(100, riskScore + 15);
    }

    let riskLevel = 'GREEN';
    if (phaseScores.some((s) => s >= 80)) {
        riskLevel = 'RED';
    } else if (riskScore >= 30) {
        riskLevel = 'YELLOW';
    }

    let suggestedVerdict = 'FIT';
    if (riskScore >= 70) {
        suggestedVerdict = 'NOT_RECOMMENDED';
    } else if (riskScore >= 30) {
        suggestedVerdict = 'ATTENTION';
    }

    return { riskLevel, riskScore, suggestedVerdict };
}

export default function CasoPage() {
    const { caseId } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const [caseData, setCaseData] = useState(null);
    const [caseError, setCaseError] = useState(null);
    const [loadingCase, setLoadingCase] = useState(true);
    const [activeStep, setActiveStep] = useState(0);
    const [form, setForm] = useState(createInitialForm(null));
    const [concluded, setConcluded] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [retryingPhase, setRetryingPhase] = useState(null);
    const formatPendingJuditPhases = (phases = []) => phases
        .map((phase) => ({
            warrant: 'mandados',
            execution: 'execucao penal',
            lawsuits: 'processos',
        }[phase] || phase))
        .join(' e ');
    const [enabledPhases, setEnabledPhases] = useState(LEGACY_PHASES);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [returnNotes, setReturnNotes] = useState('');
    const [returning, setReturning] = useState(false);
    const [returnError, setReturnError] = useState(null);
    const dirtyFieldsRef = useRef(new Set());
    const initializedCaseIdRef = useRef(null);
    const autoSaveTimerRef = useRef(null);

    // Track which fields the analyst has manually edited
    const updateWithDirty = (field, value) => {
        dirtyFieldsRef.current.add(field);
        setForm((previous) => ({ ...previous, [field]: value }));
    };

    // Auto-save dirty fields as draft when switching steps
    const saveDraft = useCallback(async () => {
        if (isDemoMode || !caseData?.id || dirtyFieldsRef.current.size === 0 || concluded) return;
        const dirty = dirtyFieldsRef.current;
        const payload = {};
        for (const field of dirty) {
            if (form[field] !== undefined) payload[field] = form[field];
        }
        if (Object.keys(payload).length === 0) return;
        try {
            await callSaveCaseDraftByAnalyst({
                caseId: caseData.id,
                payload,
            });
            dirtyFieldsRef.current = new Set();
        } catch (err) {
            console.warn('Auto-save draft failed:', err.message);
        }
    }, [caseData?.id, form, isDemoMode, concluded]);

    const handleRetryPhase = useCallback(async (phase) => {
        if (isDemoMode || !caseData?.id) return;

        try {
            setRetryingPhase(phase);
            setSaveError(null);
            if (phase === 'ai') {
                await callRerunAiAnalysis(caseData.id);
            } else {
                await callRerunEnrichmentPhase(caseData.id, phase);
            }
        } catch (err) {
            setSaveError(extractErrorMessage(err, 'Erro ao reexecutar fase.'));
        } finally {
            setRetryingPhase(null);
        }
    }, [caseData?.id, isDemoMode]);

    useEffect(() => {
        if (isDemoMode) {
            const demoCase = MOCK_CASES.find((currentCase) => currentCase.id === caseId) || null;
            setCaseData(demoCase);
            setLoadingCase(false);
            if (!demoCase) setCaseError('Caso demo nao encontrado.');
            return;
        }

        setLoadingCase(true);
        setCaseError(null);
        setConcluded(false);
        setSaveError(null);
        dirtyFieldsRef.current = new Set();

        const unsubscribe = subscribeToCaseDoc(caseId, (nextCase, error) => {
            if (error) {
                console.error('Error subscribing to case:', error);
                setCaseError(extractErrorMessage(error, 'Nao foi possivel carregar este caso agora.'));
                setLoadingCase(false);
                return;
            }

            if (!nextCase) {
                setCaseData(null);
                setCaseError('Caso nao encontrado no ambiente real.');
                setLoadingCase(false);
                return;
            }

            setCaseData(nextCase);

            // Merge enrichment data into form without overwriting dirty (analyst-edited) fields
            setForm((prevForm) => {
                const merged = { ...prevForm };
                const enrichableFields = [
                    'criminalFlag', 'criminalSeverity', 'criminalNotes',
                    'laborFlag', 'laborSeverity', 'laborNotes',
                    'warrantFlag', 'warrantNotes',
                ];
                for (const field of enrichableFields) {
                    if (!dirtyFieldsRef.current.has(field) && nextCase[field] != null && nextCase[field] !== '') {
                        merged[field] = nextCase[field];
                    }
                }
                return merged;
            });

            setLoadingCase(false);
        });

        return () => unsubscribe();
    }, [caseId, isDemoMode]);

    // Warn user about unsaved data when closing/refreshing
    useEffect(() => {
        const handler = (e) => {
            if (dirtyFieldsRef.current.size > 0 && !concluded) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [concluded]);

    // Auto-save draft when analyst switches steps
    useEffect(() => {
        saveDraft();
    }, [activeStep]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (caseId !== initializedCaseIdRef.current && caseData) {
            // New case loaded — reset form, step and dirty tracking
            initializedCaseIdRef.current = caseId;
            setForm(createInitialForm(caseData));
            setActiveStep(0);
            dirtyFieldsRef.current = new Set();
        }
        // Always sync phases when caseData arrives or changes
        if (caseData?.enabledPhases) {
            setEnabledPhases(caseData.enabledPhases);
        } else if (caseData?.tenantId) {
            getTenantSettings(caseData.tenantId).then((settings) => {
                setEnabledPhases(getEnabledPhases(settings.analysisConfig));
            }).catch(() => {});
        } else if (caseData) {
            setEnabledPhases(LEGACY_PHASES);
        }
    }, [caseData, caseId]);

    const steps = useMemo(() => {
        const result = [{ key: 'identification', label: 'Identificacao' }];
        if (enabledPhases.includes('criminal')) result.push({ key: 'criminal', label: 'Criminal' });
        if (enabledPhases.includes('labor')) result.push({ key: 'labor', label: 'Trabalhista' });
        if (enabledPhases.includes('warrant')) result.push({ key: 'warrant', label: 'Mandado de Prisao' });
        const hasOsint = enabledPhases.includes('osint');
        const hasSocial = enabledPhases.includes('social');
        if (hasOsint || hasSocial) {
            result.push({ key: 'osint_social', label: hasOsint && hasSocial ? 'OSINT e Social' : hasOsint ? 'OSINT' : 'Social' });
        }
        const hasDigital = enabledPhases.includes('digital');
        const hasConflict = enabledPhases.includes('conflictInterest');
        if (hasDigital || hasConflict) {
            result.push({ key: 'digital', label: hasDigital ? 'Perfil Digital' : 'Conflito de Interesse' });
        }
        result.push({ key: 'review', label: 'Revisao' });
        return result;
    }, [enabledPhases]);

    const currentStepKey = steps[activeStep]?.key;

    const update = (field, value) => {
        dirtyFieldsRef.current.add(field);
        setForm((previous) => ({ ...previous, [field]: value }));
    };

    const toggleVector = (field, value) => {
        dirtyFieldsRef.current.add(field);
        setForm((previous) => {
            const current = Array.isArray(previous[field]) ? previous[field] : [];
            return {
                ...previous,
                [field]: current.includes(value)
                    ? current.filter((currentValue) => currentValue !== value)
                    : [...current, value],
            };
        });
    };

    const risk = useMemo(() => calculateRisk(form, enabledPhases), [form, enabledPhases]);

    const checklist = [
        enabledPhases.includes('criminal') && { label: 'Criminal definido', ok: Boolean(form.criminalFlag) },
        enabledPhases.includes('labor') && { label: 'Trabalhista definido', ok: Boolean(form.laborFlag) },
        enabledPhases.includes('warrant') && { label: 'Mandado de prisao definido', ok: !!form.warrantFlag && form.warrantFlag !== 'NOT_FOUND' },
        enabledPhases.includes('osint') && { label: 'OSINT definido', ok: Boolean(form.osintLevel) },
        enabledPhases.includes('social') && { label: 'Social definido', ok: Boolean(form.socialStatus) },
        enabledPhases.includes('digital') && { label: 'Perfil digital definido', ok: Boolean(form.digitalFlag) },
        enabledPhases.includes('conflictInterest') && { label: 'Conflito de interesse definido', ok: Boolean(form.conflictInterest) },
        { label: 'Veredito final definido', ok: Boolean(form.finalVerdict) },
    ].filter(Boolean);
    const allOk = checklist.every((item) => item.ok);
    const detail = isDemoMode && caseData ? MOCK_CASE_DETAILS[caseData.id] : null;
    const aiHomonymStructured = caseData?.aiHomonymStructured || null;
    const aiHomonymVisible = Boolean(caseData?.aiHomonymTriggered || aiHomonymStructured || caseData?.aiHomonymError);
    const aiHomonymHardFacts = useMemo(() => {
        if (!caseData) return [];
        const facts = [];
        if ((caseData.juditActiveWarrantCount || 0) > 0) facts.push('Mandado ativo encontrado na Judit');
        if (caseData.juditExecutionFlag === 'POSITIVE') facts.push('Execução penal positiva');
        if (caseData.juditRoleSummary?.some((role) => role?.hasExactCpfMatch)) facts.push('CPF exato encontrado em parte da Judit');
        if (caseData.escavadorProcessos?.some((processo) => processo?.hasExactCpfMatch)) facts.push('CPF exato encontrado em processo do Escavador');
        return facts;
    }, [caseData]);
    const aiHomonymDivergesFromHardFacts = Boolean(
        aiHomonymStructured &&
        (aiHomonymStructured.decision === 'LIKELY_HOMONYM' || aiHomonymStructured.recommendedAction === 'DISCARD') &&
        aiHomonymHardFacts.length > 0
    );

    // Enrichment helpers
    const overallEnrichmentStatus = getOverallEnrichmentStatus(caseData);
    const isEnriched = overallEnrichmentStatus === 'DONE' || overallEnrichmentStatus === 'PARTIAL';
    const enrichmentRunning = overallEnrichmentStatus === 'RUNNING';
    const enrichmentBlocked = overallEnrichmentStatus === 'BLOCKED';
    const enrichedPhase = (phase) => caseData?.enrichmentSources?.[phase] && !caseData.enrichmentSources[phase].error;

    const ApiBadge = ({ field }) => {
        if (!isEnriched) return null;
        const originals = caseData?.enrichmentOriginalValues || {};
        if (!(field in originals)) return null;
        // Show "via API" if field still matches the original enriched value
        if (form[field] === originals[field]) {
            return <span className="caso-api-badge">via API</span>;
        }
        return <span className="caso-api-badge caso-api-badge--edited">editado</span>;
    };

    // Determine if a stepper step was auto-filled by enrichment
    const isStepAutoFilled = (stepKey) => {
        if (!isEnriched) return false;
        const phaseMap = { criminal: 'criminal', labor: 'labor', warrant: 'warrant' };
        return phaseMap[stepKey] ? enrichedPhase(phaseMap[stepKey]) : false;
    };

    const handleReturn = async () => {
        if (!caseData || !returnReason || returning) return;
        setReturnError(null);

        if (isDemoMode) {
            setShowReturnModal(false);
            return;
        }

        if (!user) {
            setReturnError('Sessao indisponivel.');
            return;
        }

        setReturning(true);
        try {
            await callReturnCaseToClient({
                caseId: caseData.id,
                reason: returnReason,
                notes: returnNotes,
            });
            setCaseData((prev) => ({ ...prev, status: 'CORRECTION_NEEDED', correctionReason: returnReason, correctionNotes: returnNotes }));
            setShowReturnModal(false);
            setReturnReason('');
            setReturnNotes('');
        } catch (err) {
            console.error('Error returning case:', err);
            setReturnError(getUserFriendlyMessage(err, 'devolver o caso'));
        } finally {
            setReturning(false);
        }
    };

    const isCorrectionNeeded = caseData?.status === 'CORRECTION_NEEDED';

    const handleConclude = async () => {
        if (!caseData || !allOk || saving) {
            return;
        }

        setSaveError(null);

        if (isDemoMode) {
            setConcluded(true);
            return;
        }

        if (!user) {
            setSaveError('Sua sessao nao esta disponivel para concluir o caso.');
            return;
        }

        setSaving(true);

        try {
            await callConcludeCaseByAnalyst({
                caseId: caseData.id,
                payload: {
                assigneeId: caseData.assigneeId || user.uid,
                criminalFlag: form.criminalFlag,
                criminalSeverity: form.criminalSeverity || null,
                criminalNotes: form.criminalNotes,
                laborFlag: form.laborFlag || null,
                laborSeverity: form.laborSeverity || null,
                laborNotes: form.laborNotes,
                warrantFlag: form.warrantFlag || null,
                warrantNotes: form.warrantNotes,
                osintLevel: form.osintLevel,
                osintVectors: form.osintVectors,
                osintNotes: form.osintNotes,
                socialStatus: form.socialStatus,
                socialReasons: form.socialReasons,
                socialNotes: form.socialNotes,
                digitalFlag: form.digitalFlag,
                digitalVectors: form.digitalVectors,
                digitalNotes: form.digitalNotes,
                conflictInterest: form.conflictInterest,
                conflictNotes: form.conflictNotes,
                finalVerdict: form.finalVerdict,
                analystComment: form.analystComment,
                riskLevel: risk.riskLevel,
                riskScore: risk.riskScore,
                enabledPhases: caseData.enabledPhases || enabledPhases,
                hasNotes: Boolean(
                    form.criminalNotes
                    || form.laborNotes
                    || form.warrantNotes
                    || form.osintNotes
                    || form.socialNotes
                    || form.digitalNotes
                    || form.conflictNotes
                    || form.analystComment
                ),
                },
            });

            setCaseData((currentCase) => ({
                ...currentCase,
                ...form,
                status: 'DONE',
                assigneeId: currentCase.assigneeId || user.uid,
                riskLevel: risk.riskLevel,
                riskScore: risk.riskScore,
                hasNotes: true,
            }));
            setConcluded(true);
        } catch (error) {
            console.error('Error concluding case:', error);
            setSaveError(getUserFriendlyMessage(error, 'concluir o caso'));
        } finally {
            setSaving(false);
        }
    };

    if (loadingCase) {
        return (
            <div className="caso-page">
                <div className="caso-section">
                    <h3>Carregando caso</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Estamos sincronizando os dados reais deste caso.</p>
                </div>
            </div>
        );
    }

    if (caseError || !caseData) {
        return (
            <div className="caso-page">
                <div className="caso-section">
                    <h3>Caso indisponivel</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>{caseError || 'Nao foi possivel localizar este caso.'}</p>
                    <div className="caso-step-nav">
                        <div />
                        <button className="caso-btn caso-btn--primary" onClick={() => navigate('/ops/casos')}>
                            Voltar para casos
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (concluded) {
        return (
            <div className="caso-page">
                <div className="caso-success animate-scaleIn">
                    <span style={{ fontSize: '3rem' }}>OK</span>
                    <h2>Caso concluido com sucesso</h2>
                    <p>O resultado foi salvo e ja pode ser consultado no portal correspondente.</p>
                    <button className="caso-btn caso-btn--primary" onClick={() => navigate('/ops/fila')}>
                        Voltar para a fila
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="caso-page">
            <div className="caso-header">
                <div className="caso-header__info">
                    <h2>{caseData.candidateName}</h2>
                    <div className="caso-header__meta">
                        <StatusBadge status={caseData.status} />
                        <span className="caso-header__id">{caseData.id}</span>
                        <span className="caso-header__cpf">{formatFullCpf(caseData.cpf) || caseData.cpfMasked}</span>
                        <span className="caso-header__tenant" style={{ fontSize: '.75rem', padding: '2px 6px', background: 'var(--gray-200)', borderRadius: '4px', fontWeight: 600 }}>
                            {caseData.tenantName}
                        </span>
                    </div>
                </div>
                <div className="caso-header__actions">
                    <button className="caso-btn caso-btn--ghost" onClick={() => navigate('/ops/fila')}>Voltar</button>
                    {!isCorrectionNeeded && caseData.status !== 'DONE' && (
                        <button className="caso-btn caso-btn--warning" onClick={() => setShowReturnModal(true)}>Devolver ao cliente</button>
                    )}
                    {caseData.status === 'DONE' && (
                        <button className="caso-btn caso-btn--ghost" onClick={async () => {
                            const html = buildCaseReportHtml(caseData);
                            try {
                                const token = await savePublicReport(html, { type: 'single', candidateName: caseData.candidateName || '', tenantId: caseData.tenantId || '' });
                                window.open(`/r/${token}`, '_blank');
                            } catch (err) {
                                setSaveError(extractErrorMessage(err, 'Erro ao gerar link do relatorio.'));
                            }
                        }}>🖨️ Relatório</button>
                    )}
                    <button className="caso-btn caso-btn--primary" disabled={!allOk || saving || isCorrectionNeeded} onClick={handleConclude}>
                        {saving ? 'Salvando...' : 'Concluir'}
                    </button>
                </div>
            </div>

            {/* Enrichment Pipeline — vertical provider status */}
            <EnrichmentPipeline
                caseData={caseData}
                onRetryPhase={handleRetryPhase}
                retryingPhase={retryingPhase}
            />

            <div className="stepper">
                {steps.map((step, index) => (
                    <button
                        key={step.key}
                        className={`stepper__step ${index === activeStep ? 'stepper__step--active' : ''} ${index < activeStep ? 'stepper__step--done' : ''} ${isStepAutoFilled(step.key) ? 'stepper__step--autofilled' : ''}`}
                        onClick={() => setActiveStep(index)}
                    >
                        <span className="stepper__number">{index < activeStep ? 'OK' : isStepAutoFilled(step.key) ? '✦' : index + 1}</span>
                        <span className="stepper__label">{step.label}</span>
                    </button>
                ))}
            </div>

            {overallEnrichmentStatus === 'RUNNING' && (
                <div className="caso-enrichment-banner caso-enrichment-banner--running">
                    <span className="caso-enrichment-spinner" />
                    Enriquecimento automatico em andamento... Os campos serao preenchidos automaticamente.
                </div>
            )}
            {overallEnrichmentStatus === 'DONE' && (
                <div className="caso-enrichment-banner caso-enrichment-banner--done">
                    Enriquecimento concluido. Revise os campos preenchidos automaticamente (marcados com <span className="caso-api-badge caso-api-badge--inline">via API</span>).
                </div>
            )}
            {overallEnrichmentStatus === 'PARTIAL' && (
                <div className="caso-enrichment-banner caso-enrichment-banner--partial">
                    {Array.isArray(caseData.juditPendingAsyncPhases) && caseData.juditPendingAsyncPhases.length > 0
                        ? `Enriquecimento parcial. A Judit ainda esta processando ${formatPendingJuditPhases(caseData.juditPendingAsyncPhases)} em modo assincrono e os resultados serao incorporados automaticamente.`
                        : 'Enriquecimento parcial. Algumas consultas falharam. Revise os campos disponiveis e preencha os demais manualmente.'}
                    {(caseData.juditError || caseData.enrichmentError) && <span className="caso-enrichment-error"> ({extractErrorMessage(caseData.juditError || caseData.enrichmentError, 'Erro no enriquecimento.')})</span>}
                </div>
            )}
            {overallEnrichmentStatus === 'FAILED' && (
                <div className="caso-enrichment-banner caso-enrichment-banner--failed">
                    Falha no enriquecimento automatico. Preencha os campos manualmente.
                    {(caseData.juditError || caseData.enrichmentError) && <span className="caso-enrichment-error"> ({extractErrorMessage(caseData.juditError || caseData.enrichmentError, 'Erro no enriquecimento.')})</span>}
                </div>
            )}
            {overallEnrichmentStatus === 'BLOCKED' && (
                <div className="caso-enrichment-banner caso-enrichment-banner--blocked">
                    Gate de identidade: enriquecimento bloqueado.
                    {(caseData.juditGateResult?.reason || caseData.enrichmentGateResult?.reason) && (
                        <span className="caso-enrichment-error"> {caseData.juditGateResult?.reason || caseData.enrichmentGateResult?.reason}</span>
                    )}
                    {(caseData.juditGateResult?.nameSimilarity ?? caseData.enrichmentGateResult?.nameSimilarity) != null && (
                        <span className="caso-enrichment-error"> (Similaridade: {((caseData.juditGateResult?.nameSimilarity ?? caseData.enrichmentGateResult?.nameSimilarity) * 100).toFixed(0)}%)</span>
                    )}
                </div>
            )}

            {saveError && (
                <div className="caso-alert caso-alert--warning" style={{ marginBottom: '16px' }}>
                    {saveError}
                </div>
            )}

            {isCorrectionNeeded && (
                <div className="caso-alert" style={{ marginBottom: '16px', background: 'var(--red-50)', border: '1px solid var(--red-200)', color: 'var(--red-700)' }}>
                    <strong>Caso devolvido ao cliente para correcao.</strong>
                    {caseData.correctionReason && <span> Motivo: {caseData.correctionReason}.</span>}
                    {caseData.correctionNotes && <span> Obs: {caseData.correctionNotes}</span>}
                </div>
            )}

            <div className="caso-step-content animate-fadeInUp">
                {currentStepKey === 'identification' && (
                    <div className="caso-section">
                        <h3>Identificacao do candidato</h3>
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Nome</label>
                                <input className="caso-input caso-input--readonly" value={caseData.candidateName} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>CPF</label>
                                <input className="caso-input caso-input--readonly" value={formatFullCpf(caseData.cpf) || caseData.cpfMasked} readOnly />
                            </div>
                            <div className="caso-field">
                                <label>Cargo</label>
                                <input className="caso-input caso-input--readonly" value={caseData.candidatePosition} readOnly />
                            </div>
                            {caseData.hiringUf && (
                                <div className="caso-field">
                                    <label>UF de contratacao</label>
                                    <input className="caso-input caso-input--readonly" value={caseData.hiringUf} readOnly />
                                </div>
                            )}
                            <div className="caso-field">
                                <label>Data da solicitacao</label>
                                <input className="caso-input caso-input--readonly" value={caseData.createdAt} readOnly />
                            </div>
                        </div>

                        <h4 style={{ marginTop: 20 }}>Redes sociais fornecidas</h4>
                        <SocialLinks profiles={caseData.socialProfiles || {}} size="md" showEmpty />

                        {caseData.juditIdentity && (
                            <div className="caso-identity-block">
                                <h4>Dados Cadastrais (Judit) <span className="caso-api-badge">via API</span></h4>
                                <div className="caso-grid">
                                    {caseData.juditIdentity.name && (
                                        <div className="caso-field">
                                            <label>Nome</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditIdentity.name} readOnly />
                                        </div>
                                    )}
                                    <div className="caso-field">
                                        <label>CPF ativo</label>
                                        <input className="caso-input caso-input--readonly" value={caseData.juditIdentity.cpfActive ? 'SIM' : 'NAO'} readOnly />
                                    </div>
                                    {caseData.juditIdentity.birthDate && (
                                        <div className="caso-field">
                                            <label>Data de nascimento</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditIdentity.birthDate} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditIdentity.gender && (
                                        <div className="caso-field">
                                            <label>Genero</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditIdentity.gender} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditIdentity.nationality && (
                                        <div className="caso-field">
                                            <label>Nacionalidade</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditIdentity.nationality} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditIdentity.motherName && (
                                        <div className="caso-field">
                                            <label>Nome da mae</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditIdentity.motherName} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditPrimaryUf && (
                                        <div className="caso-field">
                                            <label>UF principal</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditPrimaryUf} readOnly />
                                        </div>
                                    )}
                                </div>
                                {caseData.juditIdentity.consultedAt && (
                                    <p className="caso-identity-consulted">Consultado em: {new Date(caseData.juditIdentity.consultedAt).toLocaleString('pt-BR')}</p>
                                )}
                            </div>
                        )}

                        {caseData.enrichmentIdentity && (
                            <div className="caso-identity-block">
                                <h4>Dados da Receita Federal {caseData.juditIdentity ? <span className="caso-api-badge caso-api-badge--muted">fallback</span> : <span className="caso-api-badge">via API</span>}</h4>
                                <div className="caso-grid">
                                    {caseData.enrichmentIdentity.name && (
                                        <div className="caso-field">
                                            <label>Nome (RF)</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentIdentity.name} readOnly />
                                        </div>
                                    )}
                                    {caseData.enrichmentIdentity.cpfStatus && (
                                        <div className="caso-field">
                                            <label>Situacao cadastral</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentIdentity.cpfStatus} readOnly />
                                        </div>
                                    )}
                                    {caseData.enrichmentIdentity.birthDate && (
                                        <div className="caso-field">
                                            <label>Data de nascimento</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentIdentity.birthDate} readOnly />
                                        </div>
                                    )}
                                    {caseData.enrichmentIdentity.hasDeathRecord && (
                                        <div className="caso-field">
                                            <label>Registro de obito</label>
                                            <input className="caso-input caso-input--readonly" style={{ color: 'var(--red-600)', fontWeight: 600 }} value={`SIM${caseData.enrichmentIdentity.deathYear ? ` (${caseData.enrichmentIdentity.deathYear})` : ''}`} readOnly />
                                        </div>
                                    )}
                                </div>
                                {caseData.enrichmentIdentity.consultedAt && (
                                    <p className="caso-identity-consulted">Consultado em: {new Date(caseData.enrichmentIdentity.consultedAt).toLocaleString('pt-BR')}</p>
                                )}
                            </div>
                        )}

                        {caseData.enrichmentContact && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Dados Cadastrais (FonteData) <span className="caso-api-badge caso-api-badge--muted">FonteData</span></h4>
                                <div className="caso-grid">
                                    {caseData.enrichmentContact.motherName && (
                                        <div className="caso-field">
                                            <label>Nome da mae</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentContact.motherName} readOnly />
                                        </div>
                                    )}
                                    {caseData.enrichmentContact.gender && (
                                        <div className="caso-field">
                                            <label>Sexo</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentContact.gender} readOnly />
                                        </div>
                                    )}
                                    {caseData.enrichmentContact.age && (
                                        <div className="caso-field">
                                            <label>Idade</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentContact.age} readOnly />
                                        </div>
                                    )}
                                    {caseData.enrichmentContact.estimatedIncome && (
                                        <div className="caso-field">
                                            <label>Renda estimada</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.enrichmentContact.estimatedIncome} readOnly />
                                        </div>
                                    )}
                                </div>
                                {caseData.enrichmentContact.phones?.length > 0 && (
                                    <div className="caso-field" style={{ marginTop: 12 }}>
                                        <label>Telefones</label>
                                        <div className="caso-contact-list">
                                            {caseData.enrichmentContact.phones.map((phone, i) => (
                                                <span key={i} className="caso-contact-chip">{phone}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {caseData.enrichmentContact.emails?.length > 0 && (
                                    <div className="caso-field" style={{ marginTop: 8 }}>
                                        <label>Emails</label>
                                        <div className="caso-contact-list">
                                            {caseData.enrichmentContact.emails.map((email, i) => (
                                                <span key={i} className="caso-contact-chip">{email}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {caseData.enrichmentContact.addresses?.length > 0 && (
                                    <div className="caso-field" style={{ marginTop: 8 }}>
                                        <label>Enderecos</label>
                                        <div className="caso-contact-list caso-contact-list--vertical">
                                            {caseData.enrichmentContact.addresses.map((addr, i) => (
                                                <span key={i} className="caso-contact-chip caso-contact-chip--address">{addr}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(caseData.juditGateResult || caseData.enrichmentGateResult) && (() => {
                            const gate = caseData.juditGateResult || caseData.enrichmentGateResult;
                            const source = gate.source === 'fontedata-fallback' ? ' (FonteData fallback)' : gate.source === 'judit-entity' ? ' (Judit)' : '';
                            return (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Gate de Identidade{source} <span className={`caso-api-badge ${gate.passed ? 'caso-api-badge--green' : 'caso-api-badge--red'}`}>{gate.passed ? 'APROVADO' : 'BLOQUEADO'}</span></h4>
                                <div className="caso-grid">
                                    <div className="caso-field">
                                        <label>Nome informado</label>
                                        <input className="caso-input caso-input--readonly" value={gate.nameProvided || ''} readOnly />
                                    </div>
                                    <div className="caso-field">
                                        <label>Nome encontrado</label>
                                        <input className="caso-input caso-input--readonly" value={gate.nameFound || ''} readOnly />
                                    </div>
                                    <div className="caso-field">
                                        <label>Similaridade</label>
                                        <input className="caso-input caso-input--readonly" value={`${((gate.nameSimilarity || 0) * 100).toFixed(0)}%`} readOnly />
                                    </div>
                                    <div className="caso-field">
                                        <label>CPF ativo</label>
                                        <input className="caso-input caso-input--readonly" value={gate.cpfActive != null ? (gate.cpfActive ? 'SIM' : 'NAO') : (gate.cpfStatus || '')} readOnly />
                                    </div>
                                </div>
                                {gate.reason && (
                                    <p style={{ fontSize: '.8125rem', color: 'var(--red-600)', marginTop: 8 }}>Motivo: {gate.reason}</p>
                                )}
                            </div>
                            );
                        })()}

                        {(caseData.coverageLevel || caseData.criminalEvidenceQuality || caseData.coverageNotes?.length > 0 || caseData.ambiguityNotes?.length > 0) && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <div className="caso-section-header">
                                    <h4>Leitura de Cobertura e Evidencia</h4>
                                    {caseData.reviewRecommended && <span className="caso-section-header__note">Revisao manual recomendada</span>}
                                </div>
                                <div className="ai-structured-card">
                                    <div className="ai-structured-card__chips">
                                        {caseData.coverageLevel && (
                                            <span className="ai-structured-card__chip">
                                                Cobertura: <RiskChip value={caseData.coverageLevel} size="sm" />
                                            </span>
                                        )}
                                        {caseData.providerDivergence && caseData.providerDivergence !== 'NONE' && (
                                            <span className="ai-structured-card__chip">Divergencia: {caseData.providerDivergence}</span>
                                        )}
                                        {caseData.criminalEvidenceQuality && (
                                            <span className="ai-structured-card__chip">
                                                Evidencia criminal: {getEvidenceQualityLabel(caseData.criminalEvidenceQuality)}
                                            </span>
                                        )}
                                    </div>
                                    {caseData.coverageNotes?.length > 0 && (
                                        <div className="ai-structured-card__section ai-structured-card__section--muted">
                                            <strong>Notas de cobertura</strong>
                                            <ul>{caseData.coverageNotes.map((item, i) => <li key={`coverage-${i}`}>{item}</li>)}</ul>
                                        </div>
                                    )}
                                    {caseData.ambiguityNotes?.length > 0 && (
                                        <div className="ai-structured-card__section">
                                            <strong>Achados ambiguos</strong>
                                            <ul>{caseData.ambiguityNotes.map((item, i) => <li key={`ambiguity-${i}`}>{item}</li>)}</ul>
                                        </div>
                                    )}
                                    {(caseData.negativePartialSafetyNetTriggered || caseData.negativePartialSafetyNetEligible) && (
                                        <div className={`ai-structured-card__section ${caseData.negativePartialSafetyNetTriggered ? 'ai-structured-card__section--alert' : 'ai-structured-card__section--muted'}`}>
                                            <strong>Safety net de cobertura parcial</strong>
                                            <p>
                                                {caseData.negativePartialSafetyNetTriggered
                                                    ? 'Validacao adicional acionada automaticamente para revisar este negativo parcial antes da conclusao.'
                                                    : 'Caso elegivel para validacao adicional se a operacao decidir aprofundar este negativo parcial.'}
                                            </p>
                                            {caseData.negativePartialSafetyNetAction && caseData.negativePartialSafetyNetAction !== 'NONE' && (
                                                <p>Acao prevista: {caseData.negativePartialSafetyNetAction === 'RUN_ESCAVADOR' ? 'Rodar Escavador' : caseData.negativePartialSafetyNetAction}</p>
                                            )}
                                            {caseData.negativePartialSafetyNetReasons?.length > 0 && (
                                                <ul>{caseData.negativePartialSafetyNetReasons.map((item, i) => <li key={`safety-${i}`}>{getNegativePartialSafetyNetReasonLabel(item)}</li>)}</ul>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {aiHomonymVisible && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <div className="caso-section-header">
                                    <h4>
                                        Analise de Homonimos por IA <span className="caso-api-badge">{caseData.aiModel || 'GPT-5.4-nano'}</span>
                                        <span className="caso-api-badge caso-api-badge--purple" style={{ marginLeft: 4 }}>consultiva</span>
                                        {caseData.aiHomonymStructuredOk && <span className="caso-api-badge caso-api-badge--green" style={{ marginLeft: 4 }}>JSON ok</span>}
                                        {caseData.aiHomonymFromCache && <span className="caso-api-badge" style={{ marginLeft: 4, background: 'var(--gray-100)', color: 'var(--gray-600)' }}>Cache</span>}
                                    </h4>
                                    <span className="caso-section-header__note">Avalia apenas evidencia ambigua; fatos duros prevalecem</span>
                                </div>

                                {aiHomonymStructured && caseData.aiHomonymStructuredOk ? (
                                    <div className="ai-structured-card ai-structured-card--homonym">
                                        <div className="ai-structured-card__chips">
                                            <span className="ai-structured-card__chip">Decisao: {getAiHomonymDecisionLabel(aiHomonymStructured.decision)}</span>
                                            {aiHomonymStructured.confidence && (
                                                <span className="ai-structured-card__chip">
                                                    Confianca: <RiskChip value={aiHomonymStructured.confidence} size="sm" />
                                                </span>
                                            )}
                                            <span className="ai-structured-card__chip">Risco de homonimo: {getAiHomonymRiskLabel(aiHomonymStructured.homonymRisk)}</span>
                                            <span className="ai-structured-card__chip">Acao sugerida: {getAiHomonymActionLabel(aiHomonymStructured.recommendedAction)}</span>
                                        </div>

                                        {aiHomonymStructured.justification && (
                                            <div className="ai-structured-card__section">
                                                <strong>Justificativa</strong>
                                                <p>{aiHomonymStructured.justification}</p>
                                            </div>
                                        )}
                                        {aiHomonymStructured.evidenceFor?.length > 0 && (
                                            <div className="ai-structured-card__section">
                                                <strong>Evidencias a favor do vinculo</strong>
                                                <ul>{aiHomonymStructured.evidenceFor.map((item, i) => <li key={`for-${i}`}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        {aiHomonymStructured.evidenceAgainst?.length > 0 && (
                                            <div className="ai-structured-card__section">
                                                <strong>Evidencias contra o vinculo</strong>
                                                <ul>{aiHomonymStructured.evidenceAgainst.map((item, i) => <li key={`against-${i}`}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        {aiHomonymStructured.unknowns?.length > 0 && (
                                            <div className="ai-structured-card__section ai-structured-card__section--muted">
                                                <strong>Incertezas</strong>
                                                <ul>{aiHomonymStructured.unknowns.map((item, i) => <li key={`unknown-${i}`}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        {aiHomonymStructured.processAssessments?.length > 0 && (
                                            <div className="ai-structured-card__section">
                                                <strong>Leitura por processo</strong>
                                                <div className="ai-homonym-process-list">
                                                    {aiHomonymStructured.processAssessments.map((item, i) => (
                                                        <div key={`assessment-${i}`} className="ai-homonym-process-item">
                                                            <div className="ai-homonym-process-item__head">
                                                                <span className="ai-homonym-process-item__cnj">{item.cnj || 'Sem CNJ'}</span>
                                                                <span className="ai-homonym-process-item__decision">{getAiHomonymDecisionLabel(item.decision)}</span>
                                                            </div>
                                                            <p>{item.reason}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {aiHomonymDivergesFromHardFacts && (
                                            <div className="ai-structured-card__section ai-structured-card__section--alert">
                                                <strong>Atencao</strong>
                                                <p>A IA sugere homonimia ou descarte, mas existem fatos duros confirmados no caso.</p>
                                                <ul>{aiHomonymHardFacts.map((fact, i) => <li key={`fact-${i}`}>{fact}</li>)}</ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.5, background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)', maxHeight: 260, overflow: 'auto' }}>{caseData.aiHomonymRawResponse || 'Analise especializada nao retornou JSON estruturado.'}</pre>
                                )}

                                {caseData.aiHomonymCostUsd != null && (
                                    <p style={{ fontSize: '.75rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                                        Custo IA homonimos: ${caseData.aiHomonymCostUsd.toFixed(4)} USD
                                        {caseData.aiHomonymTokens && ` (${caseData.aiHomonymTokens.input} in / ${caseData.aiHomonymTokens.output} out tokens)`}
                                    </p>
                                )}
                                {caseData.aiHomonymError && (
                                    <p style={{ fontSize: '.75rem', color: 'var(--red-600)', marginTop: 4 }}>Erro IA homonimos: {extractErrorMessage(caseData.aiHomonymError, 'Falha na análise de homônimos.')}</p>
                                )}
                            </div>
                        )}

                        {(caseData.aiRawResponse || caseData.aiAnalysis || caseData.aiStructured) && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                    <h4>Análise de IA <span className="caso-api-badge">{caseData.aiModel || 'GPT-5.4-nano'}</span>
                                        {caseData.aiStructuredOk && <span className="caso-api-badge caso-api-badge--green" style={{ marginLeft: 4 }}>JSON ✓</span>}
                                        {caseData.aiStructuredOk === false && <span className="caso-api-badge" style={{ marginLeft: 4, background: 'var(--yellow-100)', color: 'var(--yellow-800)' }}>Texto</span>}
                                        {caseData.aiFromCache && <span className="caso-api-badge" style={{ marginLeft: 4, background: 'var(--gray-100)', color: 'var(--gray-600)' }}>Cache</span>}
                                    </h4>
                                    <button
                                        className="caso-btn caso-btn--ghost"
                                        style={{ fontSize: '.75rem', padding: '4px 10px' }}
                                        disabled={saving || retryingPhase === 'ai'}
                                        onClick={() => handleRetryPhase('ai')}
                                    >
                                        {retryingPhase === 'ai' ? 'Reexecutando...' : '🔄 Re-analisar'}
                                    </button>
                                </div>

                                {/* Structured AI output */}
                                {caseData.aiStructured && caseData.aiStructuredOk ? (
                                    <div className="ai-structured-card">
                                        {caseData.aiStructured.resumo && (
                                            <div className="ai-structured-card__section">
                                                <strong>Resumo Executivo</strong>
                                                <p>{caseData.aiStructured.resumo}</p>
                                            </div>
                                        )}
                                        {caseData.aiStructured.inconsistencias?.length > 0 && (
                                            <div className="ai-structured-card__section">
                                                <strong>⚠️ Inconsistências</strong>
                                                <ul>{caseData.aiStructured.inconsistencias.map((item, i) => <li key={i}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        {caseData.aiStructured.evidencias?.length > 0 && (
                                            <div className="ai-structured-card__section">
                                                <strong>Evidencias utilizadas</strong>
                                                <ul>{caseData.aiStructured.evidencias.map((item, i) => <li key={`e-${i}`}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        {caseData.aiStructured.evidenciasAmbiguas?.length > 0 && (
                                            <div className="ai-structured-card__section ai-structured-card__section--muted">
                                                <strong>Evidencias ambiguas</strong>
                                                <ul>{caseData.aiStructured.evidenciasAmbiguas.map((item, i) => <li key={`ea-${i}`}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        <div className="ai-structured-card__chips">
                                            {caseData.aiStructured.riscoHomonimo && (
                                                <span className="ai-structured-card__chip">
                                                    Homonímia: <RiskChip value={caseData.aiStructured.riscoHomonimo} size="sm" />
                                                </span>
                                            )}
                                            {caseData.aiStructured.confianca && (
                                                <span className="ai-structured-card__chip">
                                                    Confiança: <RiskChip value={caseData.aiStructured.confianca} size="sm" />
                                                </span>
                                            )}
                                            {caseData.aiStructured.cobertura && (
                                                <span className="ai-structured-card__chip">
                                                    Cobertura: <RiskChip value={caseData.aiStructured.cobertura} size="sm" />
                                                </span>
                                            )}
                                            {typeof caseData.aiStructured.revisaoManualSugerida === 'boolean' && (
                                                <span className="ai-structured-card__chip">
                                                    Revisao manual: {caseData.aiStructured.revisaoManualSugerida ? 'Sim' : 'Nao'}
                                                </span>
                                            )}
                                        </div>
                                        {caseData.aiStructured.sugestaoScore != null && (
                                            <div className="ai-structured-card__section">
                                                <strong>Sugestão IA</strong>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                                    <ScoreBar score={caseData.aiStructured.sugestaoScore} />
                                                    {caseData.aiStructured.sugestaoVeredito && <RiskChip value={caseData.aiStructured.sugestaoVeredito} size="md" bold />}
                                                </div>
                                            </div>
                                        )}
                                        {caseData.aiStructured.justificativa && (
                                            <div className="ai-structured-card__section">
                                                <strong>Justificativa</strong>
                                                <p>{caseData.aiStructured.justificativa}</p>
                                            </div>
                                        )}
                                        {caseData.aiStructured.incertezas?.length > 0 && (
                                            <div className="ai-structured-card__section ai-structured-card__section--muted">
                                                <strong>Incertezas</strong>
                                                <ul>{caseData.aiStructured.incertezas.map((item, i) => <li key={`u-${i}`}>{item}</li>)}</ul>
                                            </div>
                                        )}
                                        {caseData.aiStructured.alertas?.length > 0 && (
                                            <div className="ai-structured-card__section ai-structured-card__section--alert">
                                                <strong>🚨 Alertas</strong>
                                                <ul>{caseData.aiStructured.alertas.map((a, i) => <li key={i}>{a}</li>)}</ul>
                                            </div>
                                        )}

                                        {/* Review buttons: accept / adjust / ignore AI suggestion */}
                                        {caseData.aiStructured.sugestaoScore != null && caseData.status !== 'DONE' && (
                                            <div className="ai-structured-card__actions">
                                                <button className="caso-btn caso-btn--primary" style={{ fontSize: '.75rem', padding: '6px 14px' }} onClick={() => {
                                                    setForm(f => ({
                                                        ...f,
                                                        ...(caseData.aiStructured.sugestaoVeredito && { finalVerdict: caseData.aiStructured.sugestaoVeredito }),
                                                    }));
                                                    callSetAiDecisionByAnalyst({ caseId: caseData.id, decision: 'ACCEPTED' }).catch((err) => setSaveError(extractErrorMessage(err, 'Falha ao registrar decisao IA.')));
                                                }}>✓ Aceitar sugestão</button>
                                                <button className="caso-btn caso-btn--ghost" style={{ fontSize: '.75rem', padding: '6px 14px' }} onClick={() => {
                                                    setForm(f => ({
                                                        ...f,
                                                        ...(caseData.aiStructured.sugestaoVeredito && { finalVerdict: caseData.aiStructured.sugestaoVeredito }),
                                                    }));
                                                    callSetAiDecisionByAnalyst({ caseId: caseData.id, decision: 'ADJUSTED' }).catch((err) => setSaveError(extractErrorMessage(err, 'Falha ao registrar decisao IA.')));
                                                }}>✏️ Ajustar</button>
                                                <button className="caso-btn caso-btn--ghost" style={{ fontSize: '.75rem', padding: '6px 14px' }} onClick={() => {
                                                    callSetAiDecisionByAnalyst({ caseId: caseData.id, decision: 'IGNORED' }).catch((err) => setSaveError(extractErrorMessage(err, 'Falha ao registrar decisao IA.')));
                                                }}>Ignorar</button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Fallback: raw text */
                                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.5, background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)', maxHeight: 300, overflow: 'auto' }}>{caseData.aiRawResponse || caseData.aiAnalysis}</pre>
                                )}

                                {caseData.aiCostUsd != null && (
                                    <p style={{ fontSize: '.75rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                                        Custo IA: ${caseData.aiCostUsd.toFixed(4)} USD
                                        {caseData.aiTokens && ` (${caseData.aiTokens.input} in / ${caseData.aiTokens.output} out tokens)`}
                                        {caseData.aiProvidersIncluded?.length > 0 && ` · Providers: ${caseData.aiProvidersIncluded.join(', ')}`}
                                    </p>
                                )}
                                {caseData.aiError && (
                                    <p style={{ fontSize: '.75rem', color: 'var(--red-600)', marginTop: 4 }}>Erro IA: {extractErrorMessage(caseData.aiError, 'Falha na análise de IA.')}</p>
                                )}
                            </div>
                        )}

                        {/* Escavador enrichment display */}
                        {caseData.escavadorEnrichmentStatus === 'RUNNING' && (
                            <div className="caso-enrichment-banner caso-enrichment-banner--running" style={{ marginTop: 16 }}>
                                <span className="caso-enrichment-spinner" /> Escavador: consulta em andamento...
                            </div>
                        )}
                        {(caseData.escavadorEnrichmentStatus === 'DONE' || caseData.escavadorEnrichmentStatus === 'PARTIAL') && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>
                                    Escavador <span className="caso-api-badge">via API</span>
                                    {caseData.escavadorCriminalFlag === 'POSITIVE' && <span className="caso-api-badge caso-api-badge--red" style={{ marginLeft: 6 }}>CRIMINAL</span>}
                                </h4>
                                <div className="caso-grid">
                                    <div className="caso-field">
                                        <label>Total de processos</label>
                                        <input className="caso-input caso-input--readonly" value={caseData.escavadorProcessTotal ?? '—'} readOnly />
                                    </div>
                                    <div className="caso-field">
                                        <label>Criminal</label>
                                        <input className="caso-input caso-input--readonly" style={caseData.escavadorCriminalFlag === 'POSITIVE' ? { color: 'var(--red-600)', fontWeight: 600 } : {}} value={caseData.escavadorCriminalFlag || 'NEGATIVE'} readOnly />
                                    </div>
                                    {caseData.escavadorCriminalCount > 0 && (
                                        <div className="caso-field">
                                            <label>Processos criminais</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.escavadorCriminalCount} readOnly />
                                        </div>
                                    )}
                                </div>
                                {caseData.escavadorNotes && (
                                    <div className="caso-field" style={{ marginTop: 8 }}>
                                        <label>Resumo Escavador</label>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.4, background: caseData.escavadorCriminalFlag === 'POSITIVE' ? 'var(--red-50)' : 'var(--gray-50)', padding: 10, borderRadius: 6, border: `1px solid ${caseData.escavadorCriminalFlag === 'POSITIVE' ? 'var(--red-200)' : 'var(--border-light)'}`, maxHeight: 250, overflow: 'auto' }}>{caseData.escavadorNotes}</pre>
                                    </div>
                                )}
                                {caseData.escavadorProcessos?.length > 0 && (
                                    <details style={{ marginTop: 10 }}>
                                        <summary style={{ fontSize: '.8125rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                            Ver {caseData.escavadorProcessos.length} processo(s) detalhado(s)
                                        </summary>
                                        <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
                                            <table className="data-table" style={{ fontSize: '.75rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th className="data-table__th">CNJ</th>
                                                        <th className="data-table__th">Area</th>
                                                        <th className="data-table__th">Classe</th>
                                                        <th className="data-table__th">Polo</th>
                                                        <th className="data-table__th">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {caseData.escavadorProcessos.map((proc, i) => (
                                                        <tr key={i} className="data-table__row">
                                                            <td className="data-table__td" style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{proc.numeroCnj || '—'}</td>
                                                            <td className="data-table__td">{proc.area || '—'}</td>
                                                            <td className="data-table__td">{proc.classe || '—'}</td>
                                                            <td className="data-table__td">
                                                                {proc.polo || '—'}
                                                                {proc.tipoNormalizado && <span style={{ fontSize: '.6875rem', color: 'var(--text-tertiary)', marginLeft: 4 }}>({proc.tipoNormalizado})</span>}
                                                            </td>
                                                            <td className="data-table__td">{proc.status || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                )}
                                {caseData.escavadorError && (
                                    <p style={{ fontSize: '.75rem', color: 'var(--red-600)', marginTop: 6 }}>Erro: {extractErrorMessage(caseData.escavadorError, 'Falha na consulta Escavador.')}</p>
                                )}
                            </div>
                        )}
                        {caseData.escavadorEnrichmentStatus === 'FAILED' && (
                            <div className="caso-enrichment-banner caso-enrichment-banner--failed" style={{ marginTop: 16 }}>
                                Escavador: falha na consulta.
                                {caseData.escavadorError && <span className="caso-enrichment-error"> ({extractErrorMessage(caseData.escavadorError, 'Falha na consulta Escavador.')})</span>}
                            </div>
                        )}

                        {/* Judit enrichment display */}
                        {caseData.juditEnrichmentStatus === 'RUNNING' && (
                            <div className="caso-enrichment-banner caso-enrichment-banner--running" style={{ marginTop: 16 }}>
                                <span className="caso-enrichment-spinner" /> Judit: consulta em andamento...
                            </div>
                        )}
                        {(caseData.juditEnrichmentStatus === 'DONE' || caseData.juditEnrichmentStatus === 'PARTIAL') && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>
                                    Judit <span className="caso-api-badge">via API</span>
                                    {caseData.juditWarrantFlag === 'POSITIVE' && <span className="caso-api-badge caso-api-badge--red" style={{ marginLeft: 6 }}>MANDADO ATIVO</span>}
                                    {caseData.juditCriminalFlag === 'POSITIVE' && <span className="caso-api-badge caso-api-badge--red" style={{ marginLeft: 6 }}>CRIMINAL</span>}
                                    {caseData.juditHomonymFlag && <span className="caso-api-badge" style={{ marginLeft: 6, background: 'var(--yellow-100)', color: 'var(--yellow-800)' }}>HOMONIMO</span>}
                                </h4>

                                {Array.isArray(caseData.juditPendingAsyncPhases) && caseData.juditPendingAsyncPhases.length > 0 && (
                                    <div className="caso-enrichment-banner caso-enrichment-banner--running" style={{ marginBottom: 12 }}>
                                        <span className="caso-enrichment-spinner" />
                                        Judit aguardando callback assincrono para: {formatPendingJuditPhases(caseData.juditPendingAsyncPhases)}.
                                    </div>
                                )}

                                <div className="caso-grid">
                                    {caseData.juditProcessTotal != null && (
                                        <div className="caso-field">
                                            <label>Total de processos</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditProcessTotal} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditActiveCount != null && caseData.juditActiveCount > 0 && (
                                        <div className="caso-field">
                                            <label>Processos ativos</label>
                                            <input className="caso-input caso-input--readonly" value={caseData.juditActiveCount} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditCriminalCount > 0 && (
                                        <div className="caso-field">
                                            <label>Processos criminais</label>
                                            <input className="caso-input caso-input--readonly" style={{ color: 'var(--red-600)', fontWeight: 600 }} value={caseData.juditCriminalCount} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditActiveWarrantCount > 0 && (
                                        <div className="caso-field">
                                            <label>Mandados ativos</label>
                                            <input className="caso-input caso-input--readonly" style={{ color: 'var(--red-600)', fontWeight: 600 }} value={caseData.juditActiveWarrantCount} readOnly />
                                        </div>
                                    )}
                                    {caseData.juditHomonymCount > 0 && (
                                        <div className="caso-field">
                                            <label>Possiveis homonimos</label>
                                            <input className="caso-input caso-input--readonly" style={{ color: 'var(--yellow-700)' }} value={caseData.juditHomonymCount} readOnly />
                                        </div>
                                    )}
                                </div>

                                {caseData.juditWarrants?.length > 0 && (
                                    <div style={{ marginTop: 10, padding: 10, background: 'var(--red-50)', borderRadius: 8, border: '1px solid var(--red-200)' }}>
                                        <p style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--red-700)', marginBottom: 6 }}>Mandados de Prisao (BNMP)</p>
                                        {caseData.juditWarrants.map((w, i) => (
                                            <div key={i} style={{ fontSize: '.75rem', marginBottom: 6, paddingBottom: 6, borderBottom: i < caseData.juditWarrants.length - 1 ? '1px solid var(--red-200)' : 'none' }}>
                                                <span style={{ fontWeight: 600 }}>{w.warrantType || w.arrestType || 'Mandado'}</span>
                                                {w.court && <span> — {w.court}</span>}
                                                {w.status && <span> — Status: <strong>{w.status}</strong></span>}
                                                {w.issueDate && <span> — Expedido: {w.issueDate}</span>}
                                                {w.regime && <span> — Regime: {w.regime}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {caseData.juditRoleSummary?.length > 0 && (
                                    <details style={{ marginTop: 10 }}>
                                        <summary style={{ fontSize: '.8125rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                            Papeis nos processos ({caseData.juditRoleSummary.length})
                                        </summary>
                                        <div className="caso-contact-list" style={{ marginTop: 6, flexWrap: 'wrap' }}>
                                            {Object.entries(
                                                caseData.juditRoleSummary.reduce((acc, r) => {
                                                    const key = r.personType || 'Desconhecido';
                                                    acc[key] = (acc[key] || 0) + 1;
                                                    return acc;
                                                }, {}),
                                            ).map(([tipo, count]) => (
                                                <span key={tipo} className="caso-contact-chip" style={/testemunha|informante/i.test(tipo) ? { background: 'var(--gray-100)', color: 'var(--text-tertiary)' } : {}}>
                                                    {tipo}: {count}
                                                </span>
                                            ))}
                                        </div>
                                    </details>
                                )}

                                {caseData.juditWarrantNotes && (
                                    <div className="caso-field" style={{ marginTop: 8 }}>
                                        <label>Detalhes mandados (Judit)</label>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.4, background: 'var(--red-50)', padding: 10, borderRadius: 6, border: '1px solid var(--red-200)', maxHeight: 200, overflow: 'auto' }}>{caseData.juditWarrantNotes}</pre>
                                    </div>
                                )}

                                {caseData.juditNotes && (
                                    <div className="caso-field" style={{ marginTop: 8 }}>
                                        <label>Resumo Judit</label>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.4, background: caseData.juditCriminalFlag === 'POSITIVE' ? 'var(--red-50)' : 'var(--gray-50)', padding: 10, borderRadius: 6, border: `1px solid ${caseData.juditCriminalFlag === 'POSITIVE' ? 'var(--red-200)' : 'var(--border-light)'}`, maxHeight: 250, overflow: 'auto' }}>{caseData.juditNotes}</pre>
                                    </div>
                                )}

                                {caseData.juditError && (
                                    <p style={{ fontSize: '.75rem', color: 'var(--red-600)', marginTop: 6 }}>Erro: {extractErrorMessage(caseData.juditError, 'Falha na consulta Judit.')}</p>
                                )}
                            </div>
                        )}
                        {caseData.juditEnrichmentStatus === 'FAILED' && (
                            <div className="caso-enrichment-banner caso-enrichment-banner--failed" style={{ marginTop: 16 }}>
                                Judit: falha na consulta.
                                {caseData.juditError && <span className="caso-enrichment-error"> ({extractErrorMessage(caseData.juditError, 'Falha na consulta Judit.')})</span>}
                            </div>
                        )}

                        {enrichmentRunning && (
                            <div className="caso-enrichment-skeleton">
                                <div className="caso-skeleton-line" />
                                <div className="caso-skeleton-line caso-skeleton-line--short" />
                            </div>
                        )}

                        <div className="caso-step-nav">
                            <div />
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {showReturnModal && (
                    <Modal
                        open={showReturnModal}
                        onClose={() => setShowReturnModal(false)}
                        title="Devolver ao cliente"
                        maxWidth={480}
                        footer={(
                            <>
                                <button type="button" className="btn-secondary" onClick={() => setShowReturnModal(false)}>Cancelar</button>
                                <button type="button" className="btn-primary" disabled={!returnReason || returning} onClick={handleReturn}>
                                    {returning ? 'Devolvendo...' : 'Devolver caso'}
                                </button>
                            </>
                        )}
                    >
                                <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                                    O caso sera devolvido ao cliente para correcao dos dados. As analises ja preenchidas serao mantidas.
                                </p>
                                {returnError && (
                                    <div role="alert" style={{ color: 'var(--red-600)', background: 'var(--red-50)', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
                                        {returnError}
                                    </div>
                                )}
                                <div className="form-group">
                                    <label style={{ fontWeight: 600, fontSize: '.875rem' }}>Motivo *</label>
                                    <select className="form-input" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}>
                                        <option value="">Selecione o motivo...</option>
                                        {CORRECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label style={{ fontWeight: 600, fontSize: '.875rem' }}>Observacao</label>
                                    <textarea
                                        className="caso-textarea"
                                        value={returnNotes}
                                        onChange={(e) => setReturnNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Descreva o que precisa ser corrigido..."
                                    />
                                </div>
                    </Modal>
                )}

                {currentStepKey === 'criminal' && (
                    <div className="caso-section">
                        <h3>Analise criminal {enrichedPhase('criminal') && <ApiBadge field="criminalFlag" />}</h3>
                        {enrichmentRunning && <div className="caso-enrichment-skeleton"><div className="caso-skeleton-line" /><div className="caso-skeleton-line caso-skeleton-line--short" /></div>}
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Resultado <span className="caso-req">*</span></label>
                                <div className="caso-select-group">
                                    {CRIMINAL_OPTIONS.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            className={`caso-select-btn ${form.criminalFlag === option ? 'caso-select-btn--active' : ''}`}
                                            onClick={() => update('criminalFlag', option)}
                                        >
                                            <RiskChip value={option} size="sm" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.criminalFlag === 'POSITIVE' && (
                                <div className="caso-field">
                                    <label>Gravidade</label>
                                    <div className="caso-select-group">
                                        {SEVERITY_OPTIONS.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                className={`caso-select-btn ${form.criminalSeverity === option ? 'caso-select-btn--active' : ''}`}
                                                onClick={() => update('criminalSeverity', option)}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / notas <ApiBadge field="criminalNotes" /></label>
                            <textarea
                                className="caso-textarea"
                                value={form.criminalNotes}
                                onChange={(event) => update('criminalNotes', event.target.value)}
                                rows={4}
                                placeholder="Descreva os achados desta etapa."
                            />
                        </div>

                        {/* Consolidated process summary from all sources */}
                        {(caseData.escavadorProcessTotal > 0 || caseData.juditProcessTotal > 0 || caseData.processTotal > 0) && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Resumo consolidado de processos</h4>
                                <div className="caso-grid caso-grid--3">
                                    {caseData.juditProcessTotal > 0 && (
                                        <div className="caso-stat-card">
                                            <span className="caso-stat-card__label">Judit</span>
                                            <span className="caso-stat-card__value">{caseData.juditProcessTotal} processos</span>
                                            {caseData.juditCriminalCount > 0 && <span className="caso-stat-card__flag caso-stat-card__flag--red">{caseData.juditCriminalCount} criminais</span>}
                                            {caseData.juditHomonymCount > 0 && <span className="caso-stat-card__flag caso-stat-card__flag--yellow">{caseData.juditHomonymCount} homonimos</span>}
                                        </div>
                                    )}
                                    {caseData.escavadorProcessTotal > 0 && (
                                        <div className="caso-stat-card">
                                            <span className="caso-stat-card__label">Escavador</span>
                                            <span className="caso-stat-card__value">{caseData.escavadorProcessTotal} processos</span>
                                            {caseData.escavadorCriminalCount > 0 && <span className="caso-stat-card__flag caso-stat-card__flag--red">{caseData.escavadorCriminalCount} criminais</span>}
                                            {caseData.escavadorActiveCount > 0 && <span className="caso-stat-card__flag caso-stat-card__flag--yellow">{caseData.escavadorActiveCount} ativos</span>}
                                        </div>
                                    )}
                                    {caseData.processTotal > 0 && caseData.enrichmentStatus && caseData.enrichmentStatus !== 'PENDING' && (
                                        <div className="caso-stat-card">
                                            <span className="caso-stat-card__label">FonteData</span>
                                            <span className="caso-stat-card__value">{caseData.processTotal} processos</span>
                                            {caseData.criminalFlag === 'POSITIVE' && <span className="caso-stat-card__flag caso-stat-card__flag--red">Criminal</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {caseData.processNotes && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Resumo de processos <span className="caso-api-badge">FonteData</span></h4>
                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.5, background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)' }}>{caseData.processNotes}</pre>
                            </div>
                        )}

                        {/* Escavador processes table */}
                        {caseData.escavadorProcessos?.length > 0 && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Processos detalhados <span className="caso-api-badge">Escavador</span></h4>
                                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: '.75rem' }}>
                                        <thead>
                                            <tr>
                                                <th className="data-table__th">CNJ</th>
                                                <th className="data-table__th">Area</th>
                                                <th className="data-table__th">Classe</th>
                                                <th className="data-table__th">Polo</th>
                                                <th className="data-table__th">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {caseData.escavadorProcessos.map((proc, i) => (
                                                <tr key={i} className={`data-table__row ${/penal|criminal/i.test(proc.area || '') ? 'data-table__row--criminal' : ''}`}>
                                                    <td className="data-table__td" style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{proc.numeroCnj || '—'}</td>
                                                    <td className="data-table__td">{proc.area || '—'}</td>
                                                    <td className="data-table__td">{proc.classe || proc.assuntoPrincipal || '—'}</td>
                                                    <td className="data-table__td">{proc.polo || '—'}</td>
                                                    <td className="data-table__td">{proc.status || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Judit lawsuits table */}
                        {caseData.juditRoleSummary?.length > 0 && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>
                                    Processos detalhados <span className="caso-api-badge">Judit</span>
                                    {caseData.juditHomonymFlag && <span className="caso-api-badge" style={{ marginLeft: 6, background: 'var(--yellow-100)', color: 'var(--yellow-800)' }}>HOMONIMOS DETECTADOS</span>}
                                </h4>
                                <div style={{ maxHeight: 300, overflow: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: '.75rem' }}>
                                        <thead>
                                            <tr>
                                                <th className="data-table__th">CNJ</th>
                                                <th className="data-table__th">Area</th>
                                                <th className="data-table__th">Tribunal</th>
                                                <th className="data-table__th">Tipo parte</th>
                                                <th className="data-table__th">Status</th>
                                                <th className="data-table__th">Flags</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {caseData.juditRoleSummary.map((r, i) => (
                                                <tr key={i} className={`data-table__row ${r.isCriminal ? 'data-table__row--criminal' : ''} ${r.isWitness ? 'data-table__row--witness' : ''}`}>
                                                    <td className="data-table__td" style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{r.code || '—'}</td>
                                                    <td className="data-table__td">{r.area || '—'}</td>
                                                    <td className="data-table__td">{r.tribunalAcronym || '—'}</td>
                                                    <td className="data-table__td">{r.personType || '—'}</td>
                                                    <td className="data-table__td">{r.status || '—'}</td>
                                                    <td className="data-table__td">
                                                        {r.isCriminal && <span className="caso-flag-chip caso-flag-chip--red">Criminal</span>}
                                                        {r.isPossibleHomonym && <span className="caso-flag-chip caso-flag-chip--yellow">Homonimo?</span>}
                                                        {r.isWitness && <span className="caso-flag-chip caso-flag-chip--gray">Testemunha</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Judit execution detail */}
                        {caseData.juditExecutionFlag === 'POSITIVE' && (
                            <div className="caso-identity-block" style={{ marginTop: 16, background: 'var(--red-50)', border: '1px solid var(--red-200)', borderRadius: 8, padding: 12 }}>
                                <h4 style={{ color: 'var(--red-700)' }}>Execucao Penal <span className="caso-api-badge caso-api-badge--red">Judit</span></h4>
                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.4 }}>{caseData.juditExecutionNotes}</pre>
                            </div>
                        )}

                        {caseData.escalation?.triggered && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Escalonamento <span className="caso-api-badge caso-api-badge--red">ATIVADO</span></h4>
                                <p style={{ fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                                    Motivos: {caseData.escalation.reasons?.join(', ') || 'N/A'}
                                </p>
                                {caseData.processosCompletaNotes && (
                                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.5, background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--border-light)', marginTop: 8, maxHeight: 300, overflow: 'auto' }}>{caseData.processosCompletaNotes}</pre>
                                )}
                            </div>
                        )}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'labor' && (
                    <div className="caso-section">
                        <h3>Analise trabalhista {enrichedPhase('labor') && <ApiBadge field="laborFlag" />}</h3>
                        {enrichmentRunning && <div className="caso-enrichment-skeleton"><div className="caso-skeleton-line" /><div className="caso-skeleton-line caso-skeleton-line--short" /></div>}
                        <div className="caso-grid">
                            <div className="caso-field">
                                <label>Resultado <span className="caso-req">*</span></label>
                                <div className="caso-select-group">
                                    {LABOR_OPTIONS.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            className={`caso-select-btn ${form.laborFlag === option ? 'caso-select-btn--active' : ''}`}
                                            onClick={() => update('laborFlag', option)}
                                        >
                                            <RiskChip value={option} size="sm" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(form.laborFlag === 'POSITIVE' || form.laborFlag === 'INCONCLUSIVE') && (
                                <div className="caso-field">
                                    <label>Gravidade</label>
                                    <div className="caso-select-group">
                                        {SEVERITY_OPTIONS.map((option) => (
                                            <button
                                                key={option}
                                                type="button"
                                                className={`caso-select-btn ${form.laborSeverity === option ? 'caso-select-btn--active' : ''}`}
                                                onClick={() => update('laborSeverity', option)}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / notas <ApiBadge field="laborNotes" /></label>
                            <textarea
                                className="caso-textarea"
                                value={form.laborNotes}
                                onChange={(event) => update('laborNotes', event.target.value)}
                                rows={4}
                                placeholder="Descreva os achados trabalhistas."
                            />
                        </div>

                        {/* Labor process details from Escavador */}
                        {caseData.escavadorProcessos?.some((p) => /trabalh/i.test(p.area || '')) && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Processos trabalhistas <span className="caso-api-badge">Escavador</span></h4>
                                <div style={{ maxHeight: 250, overflow: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: '.75rem' }}>
                                        <thead>
                                            <tr>
                                                <th className="data-table__th">CNJ</th>
                                                <th className="data-table__th">Tribunal</th>
                                                <th className="data-table__th">Classe</th>
                                                <th className="data-table__th">Polo</th>
                                                <th className="data-table__th">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {caseData.escavadorProcessos.filter((p) => /trabalh/i.test(p.area || '')).map((proc, i) => (
                                                <tr key={i} className="data-table__row">
                                                    <td className="data-table__td" style={{ fontFamily: 'monospace' }}>{proc.numeroCnj || '—'}</td>
                                                    <td className="data-table__td">{proc.tribunalSigla || '—'}</td>
                                                    <td className="data-table__td">{proc.classe || '—'}</td>
                                                    <td className="data-table__td">{proc.polo || '—'}</td>
                                                    <td className="data-table__td">{proc.status || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Labor from Judit */}
                        {caseData.juditRoleSummary?.some((r) => /trabalh/i.test(r.area || '')) && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Processos trabalhistas <span className="caso-api-badge">Judit</span></h4>
                                <div style={{ maxHeight: 250, overflow: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: '.75rem' }}>
                                        <thead>
                                            <tr>
                                                <th className="data-table__th">CNJ</th>
                                                <th className="data-table__th">Tribunal</th>
                                                <th className="data-table__th">Tipo parte</th>
                                                <th className="data-table__th">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {caseData.juditRoleSummary.filter((r) => /trabalh/i.test(r.area || '')).map((r, i) => (
                                                <tr key={i} className="data-table__row">
                                                    <td className="data-table__td" style={{ fontFamily: 'monospace' }}>{r.code || '—'}</td>
                                                    <td className="data-table__td">{r.tribunalAcronym || '—'}</td>
                                                    <td className="data-table__td">{r.personType || '—'}</td>
                                                    <td className="data-table__td">{r.status || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'warrant' && (
                    <div className="caso-section">
                        <h3>Mandado de prisao {enrichedPhase('warrant') && <ApiBadge field="warrantFlag" />}</h3>
                        {caseData.juditWarrants?.length > 0 && !['POSITIVE', 'INCONCLUSIVE'].includes(form.warrantFlag) && (
                            <div className="caso-enrichment-banner caso-enrichment-banner--failed" style={{ marginBottom: 12 }}>
                                Atenção: a Judit encontrou {caseData.juditActiveWarrantCount || caseData.juditWarrants.length} mandado(s) ativo(s), mas o resultado selecionado é &ldquo;{form.warrantFlag || 'não definido'}&rdquo;. Revise o campo abaixo.
                            </div>
                        )}
                        {enrichmentRunning && <div className="caso-enrichment-skeleton"><div className="caso-skeleton-line" /><div className="caso-skeleton-line caso-skeleton-line--short" /></div>}
                        <div className="caso-field">
                            <label>Resultado <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {WARRANT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.warrantFlag === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('warrantFlag', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resumo / notas <ApiBadge field="warrantNotes" /></label>
                            <textarea
                                className="caso-textarea"
                                value={form.warrantNotes}
                                onChange={(event) => update('warrantNotes', event.target.value)}
                                rows={4}
                                placeholder="Informacoes sobre mandado de prisao."
                            />
                        </div>

                        {/* Judit warrant details */}
                        {caseData.juditWarrants?.length > 0 && (
                            <div className="caso-identity-block" style={{ marginTop: 16, background: 'var(--red-50)', borderRadius: 8, border: '1px solid var(--red-200)', padding: 12 }}>
                                <h4 style={{ color: 'var(--red-700)', marginBottom: 8 }}>Mandados encontrados <span className="caso-api-badge caso-api-badge--red">Judit BNMP</span></h4>
                                {caseData.juditWarrants.map((w, i) => (
                                    <div key={i} className="caso-warrant-card">
                                        <div className="caso-grid caso-grid--3">
                                            <div className="caso-field">
                                                <label>Tipo</label>
                                                <span className="caso-field-value">{w.warrantType || w.arrestType || 'Mandado'}</span>
                                            </div>
                                            <div className="caso-field">
                                                <label>Status</label>
                                                <span className={`caso-field-value ${/pendente/i.test(w.status || '') ? 'caso-field-value--danger' : ''}`}>
                                                    {w.status || '—'}
                                                </span>
                                            </div>
                                            <div className="caso-field">
                                                <label>Tribunal</label>
                                                <span className="caso-field-value">{w.court || w.tribunalAcronym || '—'}</span>
                                            </div>
                                            {w.issueDate && (
                                                <div className="caso-field">
                                                    <label>Data de emissao</label>
                                                    <span className="caso-field-value">{w.issueDate}</span>
                                                </div>
                                            )}
                                            {w.code && (
                                                <div className="caso-field">
                                                    <label>Processo vinculado</label>
                                                    <span className="caso-field-value" style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{w.code}</span>
                                                </div>
                                            )}
                                            {w.regime && (
                                                <div className="caso-field">
                                                    <label>Regime</label>
                                                    <span className="caso-field-value">{w.regime}</span>
                                                </div>
                                            )}
                                        </div>
                                        {w.judgementSummary && (
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.75rem', lineHeight: 1.4, marginTop: 8, background: 'var(--red-100)', padding: 8, borderRadius: 4 }}>{w.judgementSummary}</pre>
                                        )}
                                        {i < caseData.juditWarrants.length - 1 && <hr style={{ border: 'none', borderTop: '1px solid var(--red-200)', margin: '12px 0' }} />}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Execution details */}
                        {caseData.juditExecutionFlag === 'POSITIVE' && (
                            <div className="caso-identity-block" style={{ marginTop: 16, background: 'var(--red-50)', borderRadius: 8, border: '1px solid var(--red-200)', padding: 12 }}>
                                <h4 style={{ color: 'var(--red-700)' }}>Execucao Penal <span className="caso-api-badge caso-api-badge--red">Judit</span></h4>
                                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.8125rem', lineHeight: 1.4 }}>{caseData.juditExecutionNotes}</pre>
                            </div>
                        )}

                        {/* FonteData warrant info */}
                        {caseData.enrichmentSources?.warrant && !caseData.enrichmentSources.warrant.error && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Consulta CNJ Mandados <span className="caso-api-badge">FonteData</span></h4>
                                <p style={{ fontSize: '.8125rem', color: 'var(--text-secondary)' }}>
                                    {caseData.warrantFlag === 'POSITIVE' ? 'Mandado detectado via FonteData cnj-mandados-prisao.' : 'Nenhum mandado encontrado via FonteData.'}
                                </p>
                            </div>
                        )}
                        {caseData.enrichmentSources?.warrant?.error && (
                            <div className="caso-enrichment-banner caso-enrichment-banner--failed" style={{ marginTop: 16 }}>
                                FonteData cnj-mandados: falha na consulta.{' '}
                                <span className="caso-enrichment-error">({/aborted|timeout|ECONNRESET|ETIMEDOUT/i.test(caseData.enrichmentSources.warrant.error) ? 'Tempo limite excedido na consulta.' : caseData.enrichmentSources.warrant.error})</span>
                            </div>
                        )}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'osint_social' && (
                    <div className="caso-section">
                        {enabledPhases.includes('osint') && (<>
                        <h3>OSINT</h3>
                        <div className="caso-field">
                            <label>Nivel <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {OSINT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.osintLevel === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('osintLevel', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Vetores encontrados</label>
                            <div className="caso-checkbox-group">
                                {['Vazamento de dados', 'Exposicao publica alta', 'Mencoes sensiveis', 'Inconsistencia de identidade'].map((value) => (
                                    <label key={value} className="caso-checkbox">
                                        <input type="checkbox" checked={form.osintVectors.includes(value)} onChange={() => toggleVector('osintVectors', value)} />
                                        {value}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo OSINT</label>
                            <textarea className="caso-textarea" value={form.osintNotes} onChange={(event) => update('osintNotes', event.target.value)} rows={3} />
                        </div>
                        </>)}

                        {enabledPhases.includes('osint') && enabledPhases.includes('social') && (
                            <hr className="caso-divider" />
                        )}

                        {enabledPhases.includes('social') && (<>
                        <h3>Analise social</h3>
                        <div className="caso-field">
                            <label>Status <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {SOCIAL_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.socialStatus === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('socialStatus', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Motivos</label>
                            <div className="caso-checkbox-group">
                                {['Postura incompativel', 'Discurso agressivo', 'Exposicao indevida', 'Conteudo sensivel', 'Inconsistencia de identidade'].map((value) => (
                                    <label key={value} className="caso-checkbox">
                                        <input type="checkbox" checked={form.socialReasons.includes(value)} onChange={() => toggleVector('socialReasons', value)} />
                                        {value}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo social</label>
                            <textarea className="caso-textarea" value={form.socialNotes} onChange={(event) => update('socialNotes', event.target.value)} rows={3} />
                        </div>
                        </>)}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'digital' && (
                    <div className="caso-section">
                        {enabledPhases.includes('digital') && (<>
                        <h3>Perfil digital</h3>
                        <div className="caso-field">
                            <label>Perfis informados</label>
                            <SocialLinks profiles={caseData.socialProfiles || {}} size="md" showEmpty />
                        </div>

                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Resultado <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {DIGITAL_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.digitalFlag === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('digitalFlag', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Vetores encontrados</label>
                            <div className="caso-checkbox-group">
                                {['Inconsistencia de identidade', 'Conteudo improprio', 'Perfil falso', 'Exposicao indevida'].map((value) => (
                                    <label key={value} className="caso-checkbox">
                                        <input type="checkbox" checked={form.digitalVectors.includes(value)} onChange={() => toggleVector('digitalVectors', value)} />
                                        {value}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Resumo da analise digital</label>
                            <textarea className="caso-textarea" value={form.digitalNotes} onChange={(event) => update('digitalNotes', event.target.value)} rows={4} />
                        </div>
                        </>)}

                        {enabledPhases.includes('conflictInterest') && (<>
                        <div className="caso-field" style={{ marginTop: 16 }}>
                            <label>Conflito de interesse <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {CONFLICT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn ${form.conflictInterest === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('conflictInterest', option)}
                                    >
                                        <RiskChip value={option} size="sm" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Notas de conflito</label>
                            <textarea className="caso-textarea" value={form.conflictNotes} onChange={(event) => update('conflictNotes', event.target.value)} rows={3} />
                        </div>
                        </>)}

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary" onClick={() => setActiveStep(activeStep + 1)}>Proximo</button>
                        </div>
                    </div>
                )}

                {currentStepKey === 'review' && (
                    <div className="caso-section">
                        <h3>Revisao e conclusao</h3>

                        <div className="caso-risk-summary">
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Nivel de risco</span>
                                <RiskChip value={risk.riskLevel} size="lg" bold />
                            </div>
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Score</span>
                                <ScoreBar score={risk.riskScore} />
                            </div>
                            <div className="caso-risk-item">
                                <span className="caso-risk-label">Veredito sugerido</span>
                                <RiskChip value={risk.suggestedVerdict} size="lg" bold />
                            </div>
                        </div>

                        {/* Enrichment provenance summary */}
                        {isEnriched && (
                            <div className="caso-identity-block" style={{ marginTop: 16 }}>
                                <h4>Fontes de dados consultadas</h4>
                                <div className="caso-provenance-grid">
                                    <div className={`caso-provenance-item ${caseData.enrichmentStatus === 'DONE' ? 'caso-provenance-item--ok' : ['PARTIAL', 'PENDING'].includes(caseData.enrichmentStatus) ? 'caso-provenance-item--warn' : 'caso-provenance-item--fail'}`}>
                                        <span className="caso-provenance-item__label">FonteData</span>
                                        <span className="caso-provenance-item__status">{caseData.enrichmentStatus}</span>
                                    </div>
                                    {caseData.escavadorEnrichmentStatus && (
                                        <div className={`caso-provenance-item ${caseData.escavadorEnrichmentStatus === 'DONE' ? 'caso-provenance-item--ok' : caseData.escavadorEnrichmentStatus === 'PARTIAL' ? 'caso-provenance-item--warn' : 'caso-provenance-item--fail'}`}>
                                            <span className="caso-provenance-item__label">Escavador</span>
                                            <span className="caso-provenance-item__status">{caseData.escavadorEnrichmentStatus}</span>
                                            {caseData.escavadorProcessTotal > 0 && <span className="caso-provenance-item__detail">{caseData.escavadorProcessTotal} processos</span>}
                                        </div>
                                    )}
                                    {caseData.juditEnrichmentStatus && (
                                        <div className={`caso-provenance-item ${caseData.juditEnrichmentStatus === 'DONE' ? 'caso-provenance-item--ok' : caseData.juditEnrichmentStatus === 'PARTIAL' ? 'caso-provenance-item--warn' : 'caso-provenance-item--fail'}`}>
                                            <span className="caso-provenance-item__label">Judit</span>
                                            <span className="caso-provenance-item__status">{caseData.juditEnrichmentStatus}</span>
                                            {caseData.juditProcessTotal > 0 && <span className="caso-provenance-item__detail">{caseData.juditProcessTotal} processos</span>}
                                            {caseData.juditActiveWarrantCount > 0 && <span className="caso-provenance-item__detail caso-provenance-item__detail--red">{caseData.juditActiveWarrantCount} mandado(s)</span>}
                                        </div>
                                    )}
                                    {caseData.aiAnalysis && (
                                        <div className="caso-provenance-item caso-provenance-item--ok">
                                            <span className="caso-provenance-item__label">IA ({caseData.aiModel || 'GPT'})</span>
                                            <span className="caso-provenance-item__status">Analisado</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Auto-classification summary */}
                        {caseData.autoClassifiedAt && (
                            <div className="caso-identity-block" style={{ marginTop: 16, background: 'var(--blue-50)', border: '1px solid var(--blue-200)', borderRadius: 8, padding: 12 }}>
                                <h4>Classificacao automatica <span className="caso-api-badge">auto</span></h4>
                                <div className="caso-grid caso-grid--3">
                                    <div className="caso-field">
                                        <label>Criminal</label>
                                        <RiskChip value={caseData.enrichmentOriginalValues?.criminalFlag || form.criminalFlag} size="sm" />
                                    </div>
                                    <div className="caso-field">
                                        <label>Mandado {caseData.enrichmentOriginalValues?.warrantFlag && caseData.juditWarrantFlag && caseData.enrichmentOriginalValues.warrantFlag !== caseData.juditWarrantFlag && (<span className="caso-api-badge" style={{ background: 'var(--yellow-100)', color: 'var(--yellow-800)', marginLeft: 4 }}>desatualizado</span>)}</label>
                                        <RiskChip value={caseData.enrichmentOriginalValues?.warrantFlag || form.warrantFlag} size="sm" />
                                    </div>
                                    <div className="caso-field">
                                        <label>Trabalhista</label>
                                        <RiskChip value={caseData.enrichmentOriginalValues?.laborFlag || form.laborFlag} size="sm" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {detail?.executiveSummary && (
                            <div className="caso-alert" style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', color: 'var(--text-secondary)' }}>
                                {detail.executiveSummary}
                            </div>
                        )}

                        <div className="caso-checklist">
                            <h4>Checklist de conclusao</h4>
                            {checklist.map((item) => (
                                <div
                                    key={item.label}
                                    className={`caso-checklist__item ${item.ok ? 'caso-checklist__item--ok' : 'caso-checklist__item--missing'}`}
                                >
                                    <span>{item.ok ? 'OK' : 'X'}</span>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <div className="caso-field">
                            <label>Veredito final <span className="caso-req">*</span></label>
                            <div className="caso-select-group">
                                {VERDICT_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        className={`caso-select-btn caso-select-btn--lg ${form.finalVerdict === option ? 'caso-select-btn--active' : ''}`}
                                        onClick={() => update('finalVerdict', option)}
                                    >
                                        <RiskChip value={option} size="md" bold />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="caso-field">
                            <label>Comentario final</label>
                            <textarea
                                className="caso-textarea"
                                value={form.analystComment}
                                onChange={(event) => update('analystComment', event.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="caso-step-nav">
                            <button className="caso-btn caso-btn--ghost" onClick={() => setActiveStep(activeStep - 1)}>Anterior</button>
                            <button className="caso-btn caso-btn--primary caso-btn--conclude" disabled={!allOk || saving || isCorrectionNeeded} onClick={handleConclude}>
                                {saving ? 'Salvando...' : 'Concluir caso'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
