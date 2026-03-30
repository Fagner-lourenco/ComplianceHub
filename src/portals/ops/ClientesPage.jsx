import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import {
    ANALYSIS_PHASE_LABELS,
    createClientUser,
    DEFAULT_ANALYSIS_CONFIG,
    fetchClients,
    getTenantSettings,
    logAuditEvent,
    updateTenantSettings,
} from '../../core/firebase/firestoreService';
import './ClientesPage.css';

function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (v) => chars.charAt(v % chars.length)).join('');
}

export default function ClientesPage() {
    const { user } = useAuth();
    const { selectedTenantId } = useTenant();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [form, setForm] = useState({ tenantName: '', displayName: '', email: '', existingTenantId: '' });
    const [tempPassword, setTempPassword] = useState('');
    const [successMessage, setSuccessMessage] = useState(null);
    const successTimerRef = useRef(null);

    // Tenant settings config modal
    const [configTenantId, setConfigTenantId] = useState(null);
    const [configTenantName, setConfigTenantName] = useState('');
    const [configPhases, setConfigPhases] = useState(null);
    const [configLimits, setConfigLimits] = useState({ dailyLimit: '', monthlyLimit: '' });
    const [configSaving, setConfigSaving] = useState(false);
    const [tenantConfigs, setTenantConfigs] = useState({});

    useEffect(() => {
        return () => { clearTimeout(successTimerRef.current); };
    }, []);

    const loadClients = async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const data = await fetchClients();
            setClients(data);

            // Load tenant settings for unique tenants
            const uniqueTenantIds = [...new Set(data.map((c) => c.tenantId).filter(Boolean))];
            const configs = {};
            await Promise.all(uniqueTenantIds.map(async (tid) => {
                try {
                    const settings = await getTenantSettings(tid);
                    configs[tid] = settings.analysisConfig;
                } catch {
                    configs[tid] = { ...DEFAULT_ANALYSIS_CONFIG };
                }
            }));
            setTenantConfigs(configs);
        } catch (loadError) {
            console.error('Error fetching clients:', loadError);
            setClients([]);
            setLoadError('Nao foi possivel carregar a lista de clientes agora. Tente novamente em alguns instantes.');
        } finally {
            setLoading(false);
        }
    };

    const loadClientsOnSessionReady = useEffectEvent(() => {
        void loadClients();
    });

    useEffect(() => {
        if (user) {
            loadClientsOnSessionReady();
        }
    }, [user]);

    const handleOpenModal = () => {
        setForm({ tenantName: '', displayName: '', email: '', existingTenantId: '' });
        setTempPassword(generatePassword());
        setFormError(null);
        setModalOpen(true);
    };

    const existingTenants = useMemo(() => {
        const map = new Map();
        clients.forEach((c) => {
            if (c.tenantId && !map.has(c.tenantId)) {
                map.set(c.tenantId, c.tenantName || c.tenantId);
            }
        });
        return [...map.entries()].map(([id, name]) => ({ id, name }));
    }, [clients]);

    const handleTenantSelect = (value) => {
        if (value === '__new__') {
            setForm((prev) => ({ ...prev, existingTenantId: '', tenantName: '' }));
        } else {
            const tenant = existingTenants.find((t) => t.id === value);
            setForm((prev) => ({ ...prev, existingTenantId: value, tenantName: tenant?.name || value }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.tenantName || !form.displayName || !form.email) {
            setFormError('Preencha todos os campos obrigatorios.');
            return;
        }

        if (!user) {
            setFormError('Sessao do operador indisponivel.');
            return;
        }

        setSubmitting(true);
        setFormError(null);

        try {
            const timeoutMs = 15000;
            const result = await Promise.race([
                createClientUser({
                    email: form.email,
                    password: tempPassword,
                    displayName: form.displayName,
                    tenantName: form.tenantName,
                    tenantId: form.existingTenantId || null,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Firebase nao respondeu em 15 segundos.')), timeoutMs)),
            ]);

            await logAuditEvent({
                tenantId: null,
                userId: user.uid,
                userEmail: user.email,
                action: 'USER_CREATED',
                target: result.uid,
                detail: `Cliente criado: ${form.tenantName} (${form.email})`,
            });

            setModalOpen(false);
            setSuccessMessage(`Cliente criado com sucesso. Email: ${form.email} — Senha provisoria: ${tempPassword}`);
            clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => setSuccessMessage(null), 12000);
            await loadClients();
        } catch (submitError) {
            console.error('Error creating client:', submitError);
            setFormError(submitError.message || 'Erro ao criar cliente.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenConfig = async (tenantId, tenantName) => {
        setConfigTenantId(tenantId);
        setConfigTenantName(tenantName);
        setConfigSaving(false);
        try {
            const settings = await getTenantSettings(tenantId);
            setConfigPhases({ ...DEFAULT_ANALYSIS_CONFIG, ...settings.analysisConfig });
            setConfigLimits({
                dailyLimit: settings.dailyLimit ?? '',
                monthlyLimit: settings.monthlyLimit ?? '',
            });
        } catch {
            setConfigPhases({ ...DEFAULT_ANALYSIS_CONFIG });
            setConfigLimits({ dailyLimit: '', monthlyLimit: '' });
        }
    };

    const handleSaveConfig = async () => {
        if (!configTenantId || !configPhases) return;
        setConfigSaving(true);
        try {
            const rawDaily = configLimits.dailyLimit === '' ? null : Number(configLimits.dailyLimit);
            const rawMonthly = configLimits.monthlyLimit === '' ? null : Number(configLimits.monthlyLimit);
            const limits = {
                dailyLimit: rawDaily !== null && (isNaN(rawDaily) || rawDaily < 0) ? null : rawDaily,
                monthlyLimit: rawMonthly !== null && (isNaN(rawMonthly) || rawMonthly < 0) ? null : rawMonthly,
            };
            await updateTenantSettings(configTenantId, configPhases, limits);
            await logAuditEvent({
                tenantId: configTenantId,
                userId: user.uid,
                userEmail: user.email,
                action: 'TENANT_CONFIG_UPDATED',
                target: configTenantId,
                detail: `Configuracoes atualizadas para ${configTenantName}`,
            });
            setTenantConfigs((prev) => ({ ...prev, [configTenantId]: configPhases }));
            setConfigTenantId(null);
            setConfigPhases(null);
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setConfigSaving(false);
        }
    };

    const filtered = useMemo(() => {
        let result = [...clients];

        if (selectedTenantId && selectedTenantId !== ALL_TENANTS_ID) {
            result = result.filter((client) => client.tenantId === selectedTenantId);
        }

        if (!searchTerm) {
            return result;
        }

        const normalizedTerm = searchTerm.toLowerCase();
        return result.filter((client) => (
            client.tenantName?.toLowerCase().includes(normalizedTerm)
            || client.displayName?.toLowerCase().includes(normalizedTerm)
            || client.email?.toLowerCase().includes(normalizedTerm)
        ));
    }, [clients, searchTerm, selectedTenantId]);

    return (
        <div className="clientes-page">
            <div className="clientes-header">
                <h2>Gestao de clientes</h2>
                <div className="clientes-actions">
                    <div className="filter-bar__search">
                        <span className="filter-bar__search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        </span>
                        <input
                            type="text"
                            className="filter-bar__search-input"
                            placeholder="Buscar empresa, nome ou email..."
                            aria-label="Buscar clientes"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>
                    <button className="btn-primary" onClick={handleOpenModal}>+ Novo cliente</button>
                </div>
            </div>

            <div className="data-table-wrapper" style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                {successMessage && (
                    <div className="clientes-success-toast" role="status">
                        {successMessage}
                        <button className="clientes-success-toast__close" onClick={() => setSuccessMessage(null)} aria-label="Fechar">&times;</button>
                    </div>
                )}
                {loadError && (
                    <div className="clientes-load-error" role="alert">
                        {loadError}
                    </div>
                )}
                <table className="data-table" aria-label="Lista de clientes">
                    <thead>
                        <tr>
                            <th className="data-table__th" scope="col">Empresa (tenant)</th>
                            <th className="data-table__th" scope="col">Responsavel</th>
                            <th className="data-table__th" scope="col">Email</th>
                            <th className="data-table__th" scope="col">Fases de analise</th>
                            <th className="data-table__th" scope="col">Data de cadastro</th>
                            <th className="data-table__th" scope="col" style={{ width: 90 }}>Acoes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={6} className="data-table__empty">Carregando...</td></tr>}
                        {!loading && filtered.map((client) => {
                            const config = tenantConfigs[client.tenantId] || DEFAULT_ANALYSIS_CONFIG;
                            const enabledKeys = Object.entries(config).filter(([, v]) => v?.enabled).map(([k]) => k);
                            return (
                                <tr key={client.uid} className="data-table__row">
                                    <td className="data-table__td" style={{ fontWeight: 500 }}>{client.tenantName}</td>
                                    <td className="data-table__td">{client.displayName}</td>
                                    <td className="data-table__td" style={{ color: 'var(--text-secondary)' }}>{client.email}</td>
                                    <td className="data-table__td">
                                        <div className="phase-badges">
                                            {enabledKeys.map((key) => (
                                                <span key={key} className="phase-badge">{ANALYSIS_PHASE_LABELS[key]}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="data-table__td" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{client.createdAt}</td>
                                    <td className="data-table__td">
                                        <button
                                            className="btn-config"
                                            onClick={() => handleOpenConfig(client.tenantId, client.tenantName)}
                                        >
                                            Configurar
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && filtered.length === 0 && (
                            <tr><td colSpan={6} className="data-table__empty">Nenhum cliente encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Novo cliente</h3>
                            <button className="modal-close" onClick={() => setModalOpen(false)} aria-label="Fechar">X</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {formError && (
                                    <div role="alert" style={{ color: 'var(--red-600)', background: 'var(--red-50)', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
                                        {formError}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Empresa *</label>
                                    <select
                                        className="form-input"
                                        value={form.existingTenantId || '__new__'}
                                        onChange={(event) => handleTenantSelect(event.target.value)}
                                    >
                                        <option value="__new__">+ Nova empresa</option>
                                        {existingTenants.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {!form.existingTenantId && (
                                    <div className="form-group">
                                        <label>Nome da empresa (tenant) *</label>
                                        <input
                                            required
                                            type="text"
                                            className="form-input"
                                            value={form.tenantName}
                                            onChange={(event) => setForm({ ...form, tenantName: event.target.value })}
                                            placeholder="Ex: Madero Industria S.A."
                                        />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Nome do responsavel *</label>
                                    <input
                                        required
                                        type="text"
                                        className="form-input"
                                        value={form.displayName}
                                        onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                                        placeholder="Ex: Joao Silva (RH)"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email corporativo *</label>
                                    <input
                                        required
                                        type="email"
                                        className="form-input"
                                        value={form.email}
                                        onChange={(event) => setForm({ ...form, email: event.target.value })}
                                        placeholder="joao@empresa.com.br"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Senha provisoria</label>
                                    <input type="text" className="form-input pwd" value={tempPassword} readOnly />
                                    <small style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}>
                                        Entregue essa senha ao cliente para o primeiro acesso.
                                    </small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Criando...' : 'Criar cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {configPhases && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>Configurar fases — {configTenantName}</h3>
                            <button className="modal-close" onClick={() => { setConfigTenantId(null); setConfigPhases(null); }} aria-label="Fechar">X</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                                Habilite ou desabilite as fases de analise para esta franquia. Isso afeta o formulario operacional e a tabela do cliente.
                            </p>
                            {Object.entries(ANALYSIS_PHASE_LABELS).map(([key, label]) => (
                                <div key={key} className="config-toggle-row">
                                    <span className="config-toggle-label">{label}</span>
                                    <button
                                        type="button"
                                        className={`config-toggle ${configPhases[key]?.enabled ? 'config-toggle--on' : 'config-toggle--off'}`}
                                        onClick={() => setConfigPhases((prev) => ({
                                            ...prev,
                                            [key]: { enabled: !prev[key]?.enabled },
                                        }))}
                                        aria-label={`${configPhases[key]?.enabled ? 'Desabilitar' : 'Habilitar'} ${label}`}
                                    >
                                        <span className="config-toggle__knob" />
                                    </button>
                                </div>
                            ))}
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '20px 0' }} />
                            <p style={{ fontSize: '.875rem', fontWeight: 600, marginBottom: 12 }}>Limites de consultas</p>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: '.8125rem' }}>Limite diario (vazio = ilimitado)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="form-input"
                                    placeholder="Ilimitado"
                                    value={configLimits.dailyLimit}
                                    onChange={(e) => setConfigLimits((prev) => ({ ...prev, dailyLimit: e.target.value }))}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '.8125rem' }}>Limite mensal (vazio = ilimitado)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="form-input"
                                    placeholder="Ilimitado"
                                    value={configLimits.monthlyLimit}
                                    onChange={(e) => setConfigLimits((prev) => ({ ...prev, monthlyLimit: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-secondary" onClick={() => { setConfigTenantId(null); setConfigPhases(null); }}>Cancelar</button>
                            <button type="button" className="btn-primary" disabled={configSaving} onClick={handleSaveConfig}>
                                {configSaving ? 'Salvando...' : 'Salvar configuracao'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
