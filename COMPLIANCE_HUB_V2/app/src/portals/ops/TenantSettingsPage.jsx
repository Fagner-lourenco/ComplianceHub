import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ANALYSIS_PHASE_LABELS,
    callUpdateTenantSettingsByAnalyst,
    callGetTenantEntitlementsByAnalyst,
    callUpdateTenantEntitlementsByAnalyst,
    callGetTenantBillingOverview,
    callCloseTenantBillingPeriod,
    callGetTenantBillingSettlement,
    DEFAULT_ANALYSIS_CONFIG,
    getTenantSettings,
    getTenantUsage,
} from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import { QuotaSummaryCard } from '../../ui/components/QuotaBar/QuotaBar';
import {
    listContractProducts,
    listContractModules,
    listContractCapabilities,
} from '../../core/productLabels';
import './TenantSettingsPage.css';

const DEFAULT_ENRICHMENT = {
    enabled: false,
    phases: { identity: true, criminal: true, warrant: true, labor: true },
    escalation: { enabled: true, triggers: ['criminal', 'warrant', 'highProcessCount'], processCountThreshold: 5 },
    filters: { uf: '' },
    gate: { minNameSimilarity: 0.7 },
    ai: { enabled: false },
    bigdatacorp: { enabled: true, phases: { basicData: true, processes: true, kyc: true, occupation: true }, processLimit: 100 },
    escavador: { enabled: false, phases: { processos: true }, filters: { incluirHomonimos: true } },
    judit: { enabled: true, phases: { entity: false, lawsuits: true, warrant: true, execution: false }, filters: { useAsync: false } },
    djen: { enabled: true, phases: { comunicacoes: true }, searchStrategy: 'hybrid', maxPages: 3, filters: { siglaTribunal: '' } },
};

const COST_TABLE = {
    bigdatacorp: { basicData: 0.03, processes: 0.07, kyc: 0.05, occupation: 0.05 },
    judit: { entity: 0.12, lawsuits: 0.50, warrant: 1.00, execution: 0.50 },
    escavador: 3.00,
    fontedata: { identity: 0.24, criminal: 1.65, warrant: 1.08, labor: 0.54 },
    djen: 0,
    ai: 0.01,
};

const CONTRACT_PRODUCTS = listContractProducts();
const CONTRACT_MODULES = listContractModules();
const CONTRACT_CAPABILITIES = listContractCapabilities();

const DEFAULT_ENTITLEMENT_FORM = {
    tier: 'basic',
    status: 'active',
    presetKey: 'start',
    billingModel: 'postpaid',
    maxCasesPerMonth: '',
    enabledProducts: {},
    enabledModules: {},
    enabledCapabilities: {},
    policyOverrides: {
        reviewPolicy: 'operational',
        seniorApproval: 'critical',
        snapshotReuse: true,
    },
};

function computeEstimatedCost(enrichment) {
    const bdc = enrichment.bigdatacorp?.enabled
        ? Object.entries(COST_TABLE.bigdatacorp).reduce((sum, [key, cost]) => sum + (enrichment.bigdatacorp?.phases?.[key] !== false ? cost : 0), 0)
        : 0;
    const judit = enrichment.judit?.enabled
        ? Object.entries(COST_TABLE.judit).reduce((sum, [key, cost]) => sum + (enrichment.judit?.phases?.[key] ? cost : 0), 0)
        : 0;
    const escavador = enrichment.escavador?.enabled ? COST_TABLE.escavador : 0;
    const djen = 0; // DJEN is free
    const fontedata = Object.entries(COST_TABLE.fontedata).reduce((sum, [key, cost]) => sum + (enrichment.phases?.[key] ? cost : 0), 0);
    const ai = enrichment.ai?.enabled ? COST_TABLE.ai : 0;
    return { bigdatacorp: bdc, judit, escavador, djen, fontedata, ai, total: bdc + judit + fontedata + ai };
}

function normalizeEnabledMap(value) {
    if (Array.isArray(value)) {
        return value.reduce((acc, key) => ({ ...acc, [key]: true }), {});
    }
    return value && typeof value === 'object' ? { ...value } : {};
}

function buildEntitlementForm(entitlements = null, resolved = null) {
    const source = entitlements || resolved || {};
    return {
        ...DEFAULT_ENTITLEMENT_FORM,
        tier: source.tier || DEFAULT_ENTITLEMENT_FORM.tier,
        status: source.status || DEFAULT_ENTITLEMENT_FORM.status,
        presetKey: source.presetKey || DEFAULT_ENTITLEMENT_FORM.presetKey,
        billingModel: source.billingModel || DEFAULT_ENTITLEMENT_FORM.billingModel,
        maxCasesPerMonth: source.maxCasesPerMonth ?? '',
        enabledProducts: normalizeEnabledMap(source.enabledProducts),
        enabledModules: normalizeEnabledMap(source.enabledModules),
        enabledCapabilities: normalizeEnabledMap(source.enabledCapabilities || source.featureOverrides),
        policyOverrides: {
            ...DEFAULT_ENTITLEMENT_FORM.policyOverrides,
            ...(source.policyOverrides || {}),
        },
    };
}

function buildEntitlementPayload(form) {
    const maxCases = form.maxCasesPerMonth === '' ? null : Number(form.maxCasesPerMonth);
    return {
        tier: form.tier,
        status: form.status,
        presetKey: form.presetKey,
        billingModel: form.billingModel,
        maxCasesPerMonth: Number.isFinite(maxCases) ? maxCases : null,
        enabledProducts: form.enabledProducts,
        enabledModules: form.enabledModules,
        enabledCapabilities: form.enabledCapabilities,
        policyOverrides: form.policyOverrides,
    };
}

function mergeEnrichment(saved) {
    if (!saved) return { ...DEFAULT_ENRICHMENT };
    return {
        ...DEFAULT_ENRICHMENT,
        ...saved,
        phases: { ...DEFAULT_ENRICHMENT.phases, ...(saved.phases || {}) },
        escalation: { ...DEFAULT_ENRICHMENT.escalation, ...(saved.escalation || {}) },
        filters: { ...DEFAULT_ENRICHMENT.filters, ...(saved.filters || {}) },
        gate: { ...DEFAULT_ENRICHMENT.gate, ...(saved.gate || {}) },
        ai: { ...DEFAULT_ENRICHMENT.ai, ...(saved.ai || {}) },
        bigdatacorp: {
            ...DEFAULT_ENRICHMENT.bigdatacorp,
            ...(saved.bigdatacorp || {}),
            phases: { ...DEFAULT_ENRICHMENT.bigdatacorp.phases, ...(saved.bigdatacorp?.phases || {}) },
        },
        escavador: {
            ...DEFAULT_ENRICHMENT.escavador,
            ...(saved.escavador || {}),
            phases: { ...DEFAULT_ENRICHMENT.escavador.phases, ...(saved.escavador?.phases || {}) },
            filters: { ...DEFAULT_ENRICHMENT.escavador.filters, ...(saved.escavador?.filters || {}) },
        },
        judit: {
            ...DEFAULT_ENRICHMENT.judit,
            ...(saved.judit || {}),
            phases: { ...DEFAULT_ENRICHMENT.judit.phases, ...(saved.judit?.phases || {}) },
            filters: { ...DEFAULT_ENRICHMENT.judit.filters, ...(saved.judit?.filters || {}) },
        },
        djen: {
            ...DEFAULT_ENRICHMENT.djen,
            ...(saved.djen || {}),
            phases: { ...DEFAULT_ENRICHMENT.djen.phases, ...(saved.djen?.phases || {}) },
            filters: { ...DEFAULT_ENRICHMENT.djen.filters, ...(saved.djen?.filters || {}) },
        },
    };
}

export default function TenantSettingsPage() {
    const { tenantId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tenantName, setTenantName] = useState('');
    const [phases, setPhases] = useState(null);
    const [limits, setLimits] = useState({ dailyLimit: '', monthlyLimit: '', allowDailyExceedance: true, allowMonthlyExceedance: false });
    const [enrichment, setEnrichment] = useState({ ...DEFAULT_ENRICHMENT });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [quota, setQuota] = useState(null);

    // Entitlements V2 State
    const [entitlementsData, setEntitlementsData] = useState(null);
    const [entitlementsError, setEntitlementsError] = useState(null);
    const [entitlementForm, setEntitlementForm] = useState(DEFAULT_ENTITLEMENT_FORM);
    const [savingEntitlements, setSavingEntitlements] = useState(false);
    const [billingOverview, setBillingOverview] = useState(null);
    const [billingSettlement, setBillingSettlement] = useState(null);
    const [billingError, setBillingError] = useState(null);
    const [closingBilling, setClosingBilling] = useState(false);

    useEffect(() => {
        if (!tenantId) return;
        setLoading(true);
        setError(null);
        setEntitlementsError(null);
        setBillingError(null);

        callGetTenantEntitlementsByAnalyst({ tenantId })
            .then(data => {
                setEntitlementsData(data);
                setEntitlementForm(buildEntitlementForm(data?.entitlements, data?.resolvedEntitlements));
            })
            .catch(err => {
                setEntitlementsError(extractErrorMessage(err, 'Nao foi possivel carregar dados contratuais'));
            });

        const currentMonthKey = new Date().toISOString().slice(0, 7);
        callGetTenantBillingOverview({ tenantId, monthKey: currentMonthKey })
            .then((data) => setBillingOverview(data))
            .catch((err) => {
                setBillingError(extractErrorMessage(err, 'Nao foi possivel carregar consumo V2'));
                setBillingOverview(null);
            });
        callGetTenantBillingSettlement({ tenantId, monthKey: currentMonthKey })
            .then((data) => setBillingSettlement(data?.settlement || null))
            .catch(() => setBillingSettlement(null));

        getTenantSettings(tenantId)
            .then((settings) => {
                setTenantName(settings.tenantName || tenantId);
                setPhases({ ...DEFAULT_ANALYSIS_CONFIG, ...settings.analysisConfig });
                setLimits({
                    dailyLimit: settings.dailyLimit ?? '',
                    monthlyLimit: settings.monthlyLimit ?? '',
                    allowDailyExceedance: settings.allowDailyExceedance !== false,
                    allowMonthlyExceedance: settings.allowMonthlyExceedance === true,
                });
                setEnrichment(mergeEnrichment(settings.enrichmentConfig));
                // Load usage counters from tenantUsage collection
                if (settings.dailyLimit || settings.monthlyLimit) {
                    getTenantUsage(tenantId).then((usage) => {
                        const now = new Date();
                        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                        const monthKey = todayKey.slice(0, 7);
                        setQuota({
                            hasLimits: true,
                            dailyLimit: settings.dailyLimit || null,
                            monthlyLimit: settings.monthlyLimit || null,
                            dailyCount: usage?.dayKey === todayKey ? (usage.dailyCount || 0) : 0,
                            monthlyCount: usage?.monthKey === monthKey ? (usage.monthlyCount || 0) : 0,
                            allowDailyExceedance: settings.allowDailyExceedance !== false,
                            allowMonthlyExceedance: settings.allowMonthlyExceedance === true,
                        });
                    }).catch(() => {});
                }
            })
            .catch((err) => {
                setPhases({ ...DEFAULT_ANALYSIS_CONFIG });
                setEnrichment({ ...DEFAULT_ENRICHMENT });
                setError(extractErrorMessage(err, 'Nao foi possivel carregar a configuracao. Exibindo valores padrao.'));
            })
            .finally(() => setLoading(false));
    }, [tenantId]);

    const handleSave = async () => {
        if (!tenantId || !phases) return;
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            const rawDaily = limits.dailyLimit === '' ? null : Number(limits.dailyLimit);
            const rawMonthly = limits.monthlyLimit === '' ? null : Number(limits.monthlyLimit);
            await callUpdateTenantSettingsByAnalyst({
                tenantId,
                analysisConfig: phases,
                limits: {
                    dailyLimit: rawDaily !== null && (isNaN(rawDaily) || rawDaily < 0) ? null : rawDaily,
                    monthlyLimit: rawMonthly !== null && (isNaN(rawMonthly) || rawMonthly < 0) ? null : rawMonthly,
                    allowDailyExceedance: limits.allowDailyExceedance,
                    allowMonthlyExceedance: limits.allowMonthlyExceedance,
                },
                enrichmentConfig: enrichment,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(extractErrorMessage(err, 'Nao foi possivel salvar. Tente novamente.'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEntitlements = async () => {
        if (!tenantId) return;
        setSavingEntitlements(true);
        try {
            const payload = buildEntitlementPayload(entitlementForm);
            await callUpdateTenantEntitlementsByAnalyst({
                tenantId,
                entitlements: payload,
            });
            // Update local state to reflect change
            setEntitlementsData(prev => prev ? {
                ...prev,
                entitlements: { ...(prev.entitlements || {}), ...payload },
                resolvedEntitlements: { ...(prev.resolvedEntitlements || {}), ...payload }
            } : null);
        } catch (err) {
            setEntitlementsError(extractErrorMessage(err, 'Erro ao salvar contrato V2.'));
        } finally {
            setSavingEntitlements(false);
        }
    };

    const updateEntitlementMap = (field, key, value) => {
        setEntitlementForm((prev) => ({
            ...prev,
            [field]: {
                ...(prev[field] || {}),
                [key]: value,
            },
        }));
    };

    const handleCloseBilling = async () => {
        if (!tenantId || !billingOverview?.monthKey) return;
        setClosingBilling(true);
        setBillingError(null);
        try {
            const result = await callCloseTenantBillingPeriod({ tenantId, monthKey: billingOverview.monthKey });
            setBillingSettlement({
                id: result.settlementId,
                tenantId,
                monthKey: billingOverview.monthKey,
                summary: result.summary,
                itemCount: result.itemCount,
                status: result.status,
                source: 'usageMeters',
            });
        } catch (err) {
            setBillingError(extractErrorMessage(err, 'Nao foi possivel fechar o consumo V2.'));
        } finally {
            setClosingBilling(false);
        }
    };

    if (loading) {
        return (
            <div className="ts-page">
                <p className="ts-page__loading">Carregando configuracoes...</p>
            </div>
        );
    }

    return (
        <div className="ts-page">
            <div className="ts-page__header">
                <button type="button" className="ts-page__back" onClick={() => navigate('/ops/clientes')}>&larr; Voltar</button>
                <div>
                    <h2 className="ts-page__title">Configuracoes do Tenant</h2>
                    <p className="ts-page__subtitle">{tenantName || tenantId}</p>
                </div>
                <div className="ts-page__actions">
                    <button type="button" className="ts-btn ts-btn--primary" disabled={saving} onClick={handleSave}>
                        {saving ? 'Salvando...' : 'Salvar configuracao'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="ts-alert ts-alert--error" role="alert">{error}</div>
            )}
            {saved && (
                <div className="ts-alert ts-alert--success" role="status">Configuracao salva com sucesso.</div>
            )}

            {entitlementsError && (
                <div className="ts-alert ts-alert--error" role="alert">{entitlementsError}</div>
            )}
            {billingError && (
                <div className="ts-alert ts-alert--error" role="alert">{billingError}</div>
            )}

            <div className="ts-grid">
                {/* ─── Entitlements V2 (Contrato) ─── */}
                <section className="ts-card">
                    <div className="ts-card__header">
                        <h3 className="ts-card__title">Contrato e Entitlements V2</h3>
                    </div>
                    <div className="ts-card__body">
                        {entitlementsData ? (
                            <>
                                <p style={{ fontSize: '.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                    Fonte atual: <strong data-testid="entitlement-source">
                                        {entitlementsData.source === 'legacyTenantSettingsFallback' ? 'Configuracao operacional (fallback)' :
                                         entitlementsData.source === 'tenantEntitlements' ? 'Contrato V2' : entitlementsData.source}
                                    </strong>
                                </p>

                                <div className="ts-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    <div className="ts-field">
                                        <label htmlFor="tierForm" className="ts-field__label">Tier do Contrato</label>
                                        <select
                                            id="tierForm"
                                            data-testid="edit-tier"
                                            className="ts-input"
                                            value={entitlementForm.tier}
                                            onChange={(e) => setEntitlementForm((prev) => ({ ...prev, tier: e.target.value }))}
                                        >
                                            <option value="basic">Basico</option>
                                            <option value="standard">Standard</option>
                                            <option value="professional">Profissional</option>
                                            <option value="premium">Premium</option>
                                        </select>
                                    </div>
                                    <div className="ts-field">
                                        <label htmlFor="statusForm" className="ts-field__label">Status contratual</label>
                                        <select
                                            id="statusForm"
                                            data-testid="edit-status"
                                            className="ts-input"
                                            value={entitlementForm.status}
                                            onChange={(e) => setEntitlementForm((prev) => ({ ...prev, status: e.target.value }))}
                                        >
                                            <option value="active">Ativo</option>
                                            <option value="inactive">Inativo</option>
                                            <option value="suspended">Suspenso</option>
                                        </select>
                                    </div>
                                    <div className="ts-field">
                                        <label htmlFor="billingModel" className="ts-field__label">Modelo de billing</label>
                                        <select
                                            id="billingModel"
                                            data-testid="edit-billing-model"
                                            className="ts-input"
                                            value={entitlementForm.billingModel}
                                            onChange={(e) => setEntitlementForm((prev) => ({ ...prev, billingModel: e.target.value }))}
                                        >
                                            <option value="prepaid">Pre-pago</option>
                                            <option value="postpaid">Pos-pago</option>
                                            <option value="hybrid">Hibrido</option>
                                        </select>
                                    </div>
                                    <div className="ts-field">
                                        <label htmlFor="maxCases" className="ts-field__label">Casos/mes</label>
                                        <input
                                            id="maxCases"
                                            data-testid="edit-max-cases"
                                            className="ts-input"
                                            type="number"
                                            min="0"
                                            value={entitlementForm.maxCasesPerMonth}
                                            onChange={(e) => setEntitlementForm((prev) => ({ ...prev, maxCasesPerMonth: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="ts-field" style={{ marginTop: '1rem' }}>
                                    <span className="ts-field__label">Produtos habilitados</span>
                                    {CONTRACT_PRODUCTS.map((product) => (
                                        <label key={product.key} className="ts-checkbox-row">
                                            <input
                                                type="checkbox"
                                                data-testid={`product-${product.key}`}
                                                checked={entitlementForm.enabledProducts?.[product.key] === true}
                                                onChange={(event) => updateEntitlementMap('enabledProducts', product.key, event.target.checked)}
                                            />
                                            <span>{product.label}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="ts-field" style={{ marginTop: '1rem' }}>
                                    <span className="ts-field__label">Modulos habilitados</span>
                                    {CONTRACT_MODULES.map((module) => (
                                        <label key={module.key} className="ts-checkbox-row">
                                            <input
                                                type="checkbox"
                                                data-testid={`module-${module.key}`}
                                                checked={entitlementForm.enabledModules?.[module.key] === true}
                                                onChange={(event) => updateEntitlementMap('enabledModules', module.key, event.target.checked)}
                                            />
                                            <span>{module.label}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="ts-field" style={{ marginTop: '1rem' }}>
                                    <span className="ts-field__label">Capabilities</span>
                                    {CONTRACT_CAPABILITIES.map((capability) => (
                                        <label key={capability.key} className="ts-checkbox-row">
                                            <input
                                                type="checkbox"
                                                data-testid={`capability-${capability.key}`}
                                                checked={entitlementForm.enabledCapabilities?.[capability.key] === true}
                                                onChange={(event) => updateEntitlementMap('enabledCapabilities', capability.key, event.target.checked)}
                                            />
                                            <span>{capability.label}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="ts-field" style={{ marginTop: '1rem' }}>
                                    <label htmlFor="seniorPolicy" className="ts-field__label">Senior approval</label>
                                    <select
                                        id="seniorPolicy"
                                        data-testid="edit-senior-approval"
                                        className="ts-input"
                                        value={entitlementForm.policyOverrides?.seniorApproval || 'critical'}
                                        onChange={(e) => setEntitlementForm((prev) => ({
                                            ...prev,
                                            policyOverrides: { ...prev.policyOverrides, seniorApproval: e.target.value },
                                        }))}
                                    >
                                        <option value="critical">Apenas critico</option>
                                        <option value="high_risk">Alto risco</option>
                                        <option value="negative">Veredito negativo</option>
                                        <option value="always">Sempre</option>
                                    </select>
                                </div>

                                <div style={{ margin: '1rem 0' }}>
                                    <button
                                        type="button"
                                        className="ts-btn ts-btn--primary"
                                        data-testid="save-entitlements"
                                        disabled={savingEntitlements}
                                        onClick={handleSaveEntitlements}
                                    >
                                        {savingEntitlements ? 'Salvando...' : 'Salvar Contrato V2'}
                                    </button>
                                </div>

                                <div className="ts-field" style={{ marginTop: '1rem' }}>
                                    <span className="ts-field__label">Resumo Resolvido:</span>
                                    <ul style={{ fontSize: '.875rem', paddingLeft: '20px' }}>
                                        <li>Tier: <strong data-testid="entitlement-tier">{entitlementsData.resolvedEntitlements?.tier === 'professional' ? 'Profissional' : entitlementsData.resolvedEntitlements?.tier}</strong></li>
                                        <li>Max Casos/mes: <strong data-testid="entitlement-max-cases">{entitlementsData.resolvedEntitlements?.maxCasesPerMonth || 'Ilimitado'}</strong></li>
                                        <li>Modulos: <span data-testid="entitlement-modules">{Object.keys(entitlementsData.resolvedEntitlements?.enabledModules || {}).join(', ') || 'Nenhum'}</span></li>
                                        <li>Produtos: <span data-testid="entitlement-products">{Object.keys(normalizeEnabledMap(entitlementsData.resolvedEntitlements?.enabledProducts || {})).join(', ') || 'Nenhum'}</span></li>
                                        <li data-testid="entitlement-flags">Flags: {Object.entries(entitlementsData.resolvedEntitlements?.featureOverrides || entitlementsData.resolvedEntitlements?.enabledCapabilities || {}).map(([k, v]) => `${k}: ${v ? 'sim' : 'nao'}`).join(' | ') || 'Nenhuma'}</li>
                                    </ul>
                                </div>
                            </>
                        ) : (
                            <p style={{ fontSize: '.875rem', color: 'var(--text-tertiary)' }}>Carregando dados de contrato...</p>
                        )}
                    </div>
                </section>

                {/* ─── Fases de Analise ─── */}
                <section className="ts-card">
                    <div className="ts-card__header">
                        <h3 className="ts-card__title">Consumo V2</h3>
                    </div>
                    <div className="ts-card__body">
                        {billingOverview ? (
                            <>
                                <p style={{ fontSize: '.875rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                    Mes: <strong>{billingOverview.monthKey}</strong> · Fonte: <strong data-testid="billing-source">{billingOverview.source === 'usageMeters' ? 'usageMeters' : 'billingEntries fallback'}</strong>
                                </p>
                                <ul style={{ fontSize: '.875rem', paddingLeft: '20px' }}>
                                    <li>Total de unidades: <strong data-testid="billing-total-quantity">{billingOverview.overview?.totalQuantity ?? 0}</strong></li>
                                    <li>Unidades faturaveis: <strong data-testid="billing-billable-quantity">{billingOverview.overview?.commercialBillableQuantity ?? 0}</strong></li>
                                    <li>Custo interno estimado: <strong data-testid="billing-internal-cost">R$ {(billingOverview.overview?.totalInternalCostBrl ?? 0).toFixed(2)}</strong></li>
                                    <li>Itens usageMeters: <strong>{billingOverview.usageMeterCount ?? 0}</strong></li>
                                </ul>
                                <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)' }}>
                                    Fechamento: <strong data-testid="billing-settlement-status">{billingSettlement?.status || 'Nao fechado'}</strong>
                                </p>
                                <button
                                    type="button"
                                    className="ts-btn ts-btn--secondary"
                                    data-testid="close-billing-period"
                                    disabled={closingBilling || billingOverview.source !== 'usageMeters'}
                                    onClick={handleCloseBilling}
                                >
                                    {closingBilling ? 'Fechando...' : 'Fechar periodo V2'}
                                </button>
                                {billingOverview.fallbackUsed && (
                                    <p className="ts-hint" data-testid="billing-fallback-hint">Fallback legado ativo: nenhum usageMeter encontrado para o periodo.</p>
                                )}
                            </>
                        ) : (
                            <p style={{ fontSize: '.875rem', color: 'var(--text-tertiary)' }}>Carregando consumo V2...</p>
                        )}
                    </div>
                </section>

                <section className="ts-card">
                    <h3 className="ts-card__title">Fases de Analise</h3>
                    <p className="ts-card__desc">Habilite ou desabilite as fases de analise para esta franquia.</p>
                    {phases && Object.entries(ANALYSIS_PHASE_LABELS).map(([key, label]) => (
                        <div key={key} className="ts-toggle-row">
                            <span className="ts-toggle-label">{label}</span>
                            <button
                                type="button"
                                className={`ts-toggle ${phases[key]?.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                onClick={() => setPhases((prev) => ({ ...prev, [key]: { enabled: !prev[key]?.enabled } }))}
                                aria-label={`${phases[key]?.enabled ? 'Desabilitar' : 'Habilitar'} ${label}`}
                            >
                                <span className="ts-toggle__knob" />
                            </button>
                        </div>
                    ))}
                </section>

                {/* ─── Limites de Consultas ─── */}
                <section className="ts-card">
                    <h3 className="ts-card__title">Limites de Consultas</h3>
                    <p className="ts-card__desc">Defina limites diarios e mensais. Vazio = ilimitado.</p>
                    <div className="ts-form-group">
                        <label className="ts-label">Limite diario</label>
                        <input
                            type="number"
                            min="0"
                            className="ts-input"
                            placeholder="Ilimitado"
                            value={limits.dailyLimit}
                            onChange={(e) => setLimits((prev) => ({ ...prev, dailyLimit: e.target.value }))}
                        />
                    </div>
                    <div className="ts-form-group">
                        <label className="ts-label">Limite mensal</label>
                        <input
                            type="number"
                            min="0"
                            className="ts-input"
                            placeholder="Ilimitado"
                            value={limits.monthlyLimit}
                            onChange={(e) => setLimits((prev) => ({ ...prev, monthlyLimit: e.target.value }))}
                        />
                    </div>

                    <hr className="ts-divider" />
                    <p className="ts-card__desc" style={{ fontWeight: 600, marginBottom: 8 }}>Politica de excedencia</p>

                    <div className="ts-toggle-row">
                        <span className="ts-toggle-label">Permitir excedente diario <span className="ts-hint">(registra como &ldquo;excedente do dia&rdquo;)</span></span>
                        <button
                            type="button"
                            className={`ts-toggle ${limits.allowDailyExceedance ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                            onClick={() => setLimits((prev) => ({ ...prev, allowDailyExceedance: !prev.allowDailyExceedance }))}
                            aria-label="Toggle excedente diario"
                        >
                            <span className="ts-toggle__knob" />
                        </button>
                    </div>
                    <div className="ts-toggle-row">
                        <span className="ts-toggle-label">Permitir excedente mensal <span className="ts-hint">(faturavel no proximo ciclo)</span></span>
                        <button
                            type="button"
                            className={`ts-toggle ${limits.allowMonthlyExceedance ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                            onClick={() => setLimits((prev) => ({ ...prev, allowMonthlyExceedance: !prev.allowMonthlyExceedance }))}
                            aria-label="Toggle excedente mensal"
                        >
                            <span className="ts-toggle__knob" />
                        </button>
                    </div>

                    {quota?.hasLimits && (
                        <>
                            <hr className="ts-divider" />
                            <QuotaSummaryCard quota={quota} />
                        </>
                    )}
                </section>

                {/* ─── Pipeline de Enriquecimento ─── */}
                <section className="ts-card ts-card--full">
                    <h3 className="ts-card__title">Pipeline de Enriquecimento</h3>
                    <p className="ts-card__desc">
                        Consultas externas executadas automaticamente ao criar uma solicitacao. Providers rodam em paralelo.
                    </p>

                    <div className="ts-toggle-row">
                        <span className="ts-toggle-label" style={{ fontWeight: 600 }}>Habilitado</span>
                        <button
                            type="button"
                            className={`ts-toggle ${enrichment.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                            onClick={() => setEnrichment((prev) => ({ ...prev, enabled: !prev.enabled }))}
                            aria-label="Toggle enriquecimento"
                        >
                            <span className="ts-toggle__knob" />
                        </button>
                    </div>

                    {enrichment.enabled && (() => {
                        const cost = computeEstimatedCost(enrichment);
                        return (
                            <>
                                {/* Gate global */}
                                <div className="ts-gate-card">
                                    <div className="ts-gate-card__row">
                                        <div>
                                            <label className="ts-label">Gate de identidade — similaridade minima do nome</label>
                                            <p className="ts-hint" style={{ margin: 0 }}>
                                                Nomes abaixo deste limiar bloqueiam o enriquecimento do provider. Aplica-se a BigDataCorp e Judit.
                                            </p>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            className="ts-input ts-input--sm"
                                            value={enrichment.gate?.minNameSimilarity ?? 0.7}
                                            onChange={(e) => setEnrichment((prev) => ({
                                                ...prev,
                                                gate: { ...prev.gate, minNameSimilarity: parseFloat(e.target.value) || 0 },
                                            }))}
                                        />
                                    </div>
                                </div>

                                {/* Custo estimado */}
                                <div className="ts-cost-card">
                                    <span className="ts-cost-card__label">Custo estimado por caso</span>
                                    <div className="ts-cost-card__items">
                                        {cost.bigdatacorp > 0 && <span className="ts-cost-card__item">BDC R${cost.bigdatacorp.toFixed(2)}</span>}
                                        {cost.judit > 0 && <span className="ts-cost-card__item">Judit R${cost.judit.toFixed(2)}</span>}
                                        {cost.fontedata > 0 && <span className="ts-cost-card__item">FonteData R${cost.fontedata.toFixed(2)}</span>}
                                        {cost.ai > 0 && <span className="ts-cost-card__item">IA R${cost.ai.toFixed(2)}</span>}
                                        {cost.escavador > 0 && <span className="ts-cost-card__item ts-cost-card__item--conditional">Escavador +R${cost.escavador.toFixed(2)} <span className="ts-hint">(condicional)</span></span>}
                                    </div>
                                    <span className="ts-cost-card__total">
                                        Total: R${cost.total.toFixed(2)}
                                        {cost.escavador > 0 && <span className="ts-hint"> (ate R${(cost.total + cost.escavador).toFixed(2)} c/ Escavador)</span>}
                                    </span>
                                </div>

                                <div className="ts-enrichment-grid">
                                    {/* 1. BigDataCorp */}
                                    <div className="ts-enrichment-section">
                                        <h4 className="ts-enrichment-title"><span className="ts-provider-number">1</span> BigDataCorp</h4>
                                        <p className="ts-hint" style={{ marginBottom: 8 }}>
                                            Provider primario. Valida CPF, busca processos judiciais e faz screening KYC (PEP, sancoes, mandados).
                                        </p>
                                        <div className="ts-toggle-row">
                                            <span className="ts-toggle-label" style={{ fontWeight: 500 }}>Habilitado</span>
                                            <button
                                                type="button"
                                                className={`ts-toggle ${enrichment.bigdatacorp?.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                onClick={() => setEnrichment((prev) => ({ ...prev, bigdatacorp: { ...prev.bigdatacorp, enabled: !prev.bigdatacorp?.enabled } }))}
                                                aria-label="Toggle BigDataCorp"
                                            >
                                                <span className="ts-toggle__knob" />
                                            </button>
                                        </div>
                                        {enrichment.bigdatacorp?.enabled && (
                                            <div className="ts-sub-section">
                                                <div className="ts-toggle-row ts-toggle-row--locked">
                                                    <span className="ts-toggle-label">&#128274; Dados Cadastrais <span className="ts-hint">(R$ 0,03 — gate, sempre ativo)</span></span>
                                                    <button type="button" className="ts-toggle ts-toggle--on ts-toggle--disabled" disabled aria-label="Gate sempre ativo">
                                                        <span className="ts-toggle__knob" />
                                                    </button>
                                                </div>
                                                {[
                                                    { key: 'processes', label: 'Processos judiciais', cost: 'R$ 0,07' },
                                                    { key: 'kyc', label: 'KYC / Sancoes / PEP', cost: 'R$ 0,05' },
                                                    { key: 'occupation', label: 'Perfil profissional', cost: 'R$ 0,05' },
                                                ].map(({ key, label, cost }) => (
                                                    <div key={key} className="ts-toggle-row">
                                                        <span className="ts-toggle-label">{label} <span className="ts-hint">({cost})</span></span>
                                                        <button
                                                            type="button"
                                                            className={`ts-toggle ${enrichment.bigdatacorp?.phases?.[key] !== false ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                            onClick={() => setEnrichment((prev) => ({
                                                                ...prev,
                                                                bigdatacorp: { ...prev.bigdatacorp, phases: { ...prev.bigdatacorp?.phases, [key]: prev.bigdatacorp?.phases?.[key] === false } },
                                                            }))}
                                                            aria-label={`Toggle ${label}`}
                                                        >
                                                            <span className="ts-toggle__knob" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Judit */}
                                    <div className="ts-enrichment-section">
                                        <h4 className="ts-enrichment-title"><span className="ts-provider-number">2</span> Judit</h4>
                                        <p className="ts-hint" style={{ marginBottom: 8 }}>
                                            Complemento judicial. Processos detalhados com partes, mandados de prisao (BNMP) e execucoes penais.
                                        </p>
                                        <div className="ts-toggle-row">
                                            <span className="ts-toggle-label" style={{ fontWeight: 500 }}>Habilitado</span>
                                            <button
                                                type="button"
                                                className={`ts-toggle ${enrichment.judit?.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                onClick={() => setEnrichment((prev) => ({ ...prev, judit: { ...prev.judit, enabled: !prev.judit?.enabled } }))}
                                                aria-label="Toggle Judit"
                                            >
                                                <span className="ts-toggle__knob" />
                                            </button>
                                        </div>
                                        {enrichment.judit?.enabled && (
                                            <div className="ts-sub-section">
                                                <div className="ts-toggle-row">
                                                    <span className="ts-toggle-label">Gate Cadastral <span className="ts-hint">(R$ 0,12 — backup, BDC e principal)</span></span>
                                                    <button
                                                        type="button"
                                                        className={`ts-toggle ${enrichment.judit?.phases?.entity ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                        onClick={() => setEnrichment((prev) => ({
                                                            ...prev,
                                                            judit: { ...prev.judit, phases: { ...prev.judit?.phases, entity: !prev.judit?.phases?.entity } },
                                                        }))}
                                                        aria-label="Toggle Gate Cadastral Judit"
                                                    >
                                                        <span className="ts-toggle__knob" />
                                                    </button>
                                                </div>
                                                {[
                                                    { key: 'lawsuits', label: 'Processos judiciais (datalake)', cost: 'R$ 0,50' },
                                                    { key: 'warrant', label: 'Mandados de Prisao (BNMP)', cost: 'R$ 1,00' },
                                                    { key: 'execution', label: 'Execucoes Penais', cost: 'R$ 0,50' },
                                                ].map(({ key, label, cost }) => (
                                                    <div key={key} className="ts-toggle-row">
                                                        <span className="ts-toggle-label">{label} <span className="ts-hint">({cost})</span></span>
                                                        <button
                                                            type="button"
                                                            className={`ts-toggle ${enrichment.judit?.phases?.[key] ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                            onClick={() => setEnrichment((prev) => ({
                                                                ...prev,
                                                                judit: { ...prev.judit, phases: { ...prev.judit?.phases, [key]: !prev.judit?.phases?.[key] } },
                                                            }))}
                                                            aria-label={`Toggle ${label}`}
                                                        >
                                                            <span className="ts-toggle__knob" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Escavador */}
                                    <div className="ts-enrichment-section">
                                        <h4 className="ts-enrichment-title"><span className="ts-provider-number">3</span> Escavador</h4>
                                        <p className="ts-hint" style={{ marginBottom: 8 }}>
                                            Cross-validation. Roda sob demanda quando detectado criminal, mandado, execucao ou &ge;5 processos. R$ 3,00/consulta.
                                        </p>
                                        <div className="ts-toggle-row">
                                            <span className="ts-toggle-label" style={{ fontWeight: 500 }}>Habilitado <span className="ts-hint">(condicional)</span></span>
                                            <button
                                                type="button"
                                                className={`ts-toggle ${enrichment.escavador?.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                onClick={() => setEnrichment((prev) => ({
                                                    ...prev,
                                                    escavador: { ...prev.escavador, enabled: !prev.escavador?.enabled },
                                                }))}
                                                aria-label="Toggle Escavador"
                                            >
                                                <span className="ts-toggle__knob" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 3.5 DJEN */}
                                    <div className="ts-enrichment-section">
                                        <h4 className="ts-enrichment-title">
                                            <span className="ts-provider-number" style={{ background: 'var(--green-100, #dcfce7)', color: 'var(--green-700, #15803d)' }}>✦</span>
                                            {' '}DJEN
                                            <span style={{ fontSize: '.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'var(--green-100, #dcfce7)', color: 'var(--green-700, #15803d)', marginLeft: 8, verticalAlign: 'middle' }}>GRÁTIS</span>
                                        </h4>
                                        <p className="ts-hint" style={{ marginBottom: 8 }}>
                                            Diário de Justiça Eletrônico Nacional — comunicações judiciais (intimações, citações, editais). API pública, sem custo por consulta.
                                        </p>
                                        <div className="ts-toggle-row">
                                            <span className="ts-toggle-label" style={{ fontWeight: 500 }}>Habilitado</span>
                                            <button
                                                type="button"
                                                className={`ts-toggle ${enrichment.djen?.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                onClick={() => setEnrichment((prev) => ({
                                                    ...prev,
                                                    djen: { ...prev.djen, enabled: !prev.djen?.enabled },
                                                }))}
                                                aria-label="Toggle DJEN"
                                            >
                                                <span className="ts-toggle__knob" />
                                            </button>
                                        </div>
                                        {enrichment.djen?.enabled && (
                                            <>
                                                <div className="ts-form-group" style={{ marginTop: 8 }}>
                                                    <label className="ts-label">Estratégia de busca</label>
                                                    <select
                                                        className="ts-input"
                                                        value={enrichment.djen?.searchStrategy || 'hybrid'}
                                                        onChange={(e) => setEnrichment((prev) => ({
                                                            ...prev,
                                                            djen: { ...prev.djen, searchStrategy: e.target.value },
                                                        }))}
                                                    >
                                                        <option value="hybrid">Híbrida (processo + nome) — recomendado</option>
                                                        <option value="byProcess">Somente por nº de processo</option>
                                                        <option value="byName">Somente por nome</option>
                                                    </select>
                                                </div>
                                                <div className="ts-form-group" style={{ marginTop: 8 }}>
                                                    <label className="ts-label">Máx. páginas por busca por nome <span className="ts-hint">(1-10, 100 itens/pág.)</span></label>
                                                    <input
                                                        type="number"
                                                        className="ts-input"
                                                        min={1}
                                                        max={10}
                                                        value={enrichment.djen?.maxPages || 3}
                                                        onChange={(e) => setEnrichment((prev) => ({
                                                            ...prev,
                                                            djen: { ...prev.djen, maxPages: Math.min(10, Math.max(1, Number(e.target.value) || 3)) },
                                                        }))}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* 4. FonteData */}
                                    <div className="ts-enrichment-section">
                                        <details>
                                            <summary className="ts-enrichment-title" style={{ cursor: 'pointer' }}><span className="ts-provider-number ts-provider-number--muted">4</span> FonteData <span className="ts-hint">(legado / fallback)</span></summary>
                                            <p className="ts-hint" style={{ marginBottom: 8, marginTop: 4 }}>
                                                APIs legadas. Usadas como fonte complementar ou sob demanda manual.
                                            </p>
                                            {[
                                                { key: 'identity', label: 'Dados Cadastrais (PF Basica)', cost: 'R$ 0,24' },
                                                { key: 'criminal', label: 'Criminal / Processos Agrupada', cost: 'R$ 1,65' },
                                                { key: 'warrant', label: 'Mandados de Prisao (CNJ)', cost: 'R$ 1,08' },
                                                { key: 'labor', label: 'Processos Trabalhistas (TRT)', cost: 'R$ 0,54/regiao' },
                                            ].map(({ key, label, cost }) => (
                                                <div key={key} className="ts-toggle-row">
                                                    <span className="ts-toggle-label">{label} <span className="ts-hint">({cost})</span></span>
                                                    <button
                                                        type="button"
                                                        className={`ts-toggle ${enrichment.phases?.[key] ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                        onClick={() => setEnrichment((prev) => ({
                                                            ...prev,
                                                            phases: { ...prev.phases, [key]: !prev.phases?.[key] },
                                                        }))}
                                                        aria-label={`Toggle ${label}`}
                                                    >
                                                        <span className="ts-toggle__knob" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="ts-form-group" style={{ marginTop: 8 }}>
                                                <label className="ts-label">Filtrar por UF do TRT <span className="ts-hint">(vazio = nacional)</span></label>
                                                <input
                                                    type="text"
                                                    className="ts-input"
                                                    placeholder="Ex: SP, RJ, MG"
                                                    value={enrichment.filters?.uf || ''}
                                                    onChange={(e) => setEnrichment((prev) => ({
                                                        ...prev,
                                                        filters: { ...prev.filters, uf: e.target.value },
                                                    }))}
                                                />
                                            </div>
                                        </details>
                                    </div>

                                    {/* 5. IA */}
                                    <div className="ts-enrichment-section">
                                        <h4 className="ts-enrichment-title"><span className="ts-provider-number">5</span> Analise de IA</h4>
                                        <p className="ts-hint" style={{ marginBottom: 8 }}>
                                            Detecta homonimos, resolve ambiguidades e gera resumo executivo com recomendacao.
                                        </p>
                                        <div className="ts-toggle-row">
                                            <span className="ts-toggle-label" style={{ fontWeight: 500 }}>Habilitar IA</span>
                                            <button
                                                type="button"
                                                className={`ts-toggle ${enrichment.ai?.enabled ? 'ts-toggle--on' : 'ts-toggle--off'}`}
                                                onClick={() => setEnrichment((prev) => ({ ...prev, ai: { ...prev.ai, enabled: !prev.ai?.enabled } }))}
                                                aria-label="Toggle IA"
                                            >
                                                <span className="ts-toggle__knob" />
                                            </button>
                                        </div>
                                        {enrichment.ai?.enabled && (
                                            <div className="ts-form-group" style={{ marginTop: 8 }}>
                                                <label className="ts-label">Orcamento mensal IA (USD) <span className="ts-hint">(0 = ilimitado)</span></label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    className="ts-input ts-input--sm"
                                                    value={enrichment.ai?.monthlyBudgetUsd ?? 0}
                                                    onChange={(e) => setEnrichment((prev) => ({
                                                        ...prev,
                                                        ai: { ...prev.ai, monthlyBudgetUsd: parseFloat(e.target.value) || 0 },
                                                    }))}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </section>
            </div>
        </div>
    );
}
