import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import {
    ANALYSIS_PHASE_LABELS,
    callCreateOpsClientUser,
    DEFAULT_ANALYSIS_CONFIG,
    fetchClients,
    getTenantSettings,
} from '../../core/firebase/firestoreService';
import { extractErrorMessage } from '../../core/errorUtils';
import Modal from '../../ui/components/Modal/Modal';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import './ClientesPage.css';

function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const array = new Uint32Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (v) => chars.charAt(v % chars.length)).join('');
}

function buildTenantRows(clients) {
    const map = new Map();
    clients.forEach((c) => {
        if (!c.tenantId) return;
        if (!map.has(c.tenantId)) {
            map.set(c.tenantId, {
                tenantId: c.tenantId,
                tenantName: c.tenantName || c.tenantId,
                users: [],
                createdAt: c.createdAt,
            });
        }
        const row = map.get(c.tenantId);
        row.users.push({
            uid: c.uid,
            displayName: c.displayName,
            email: c.email,
            role: c.role,
            status: c.status,
        });
        // Keep earliest createdAt
        if (c.createdAt && (!row.createdAt || c.createdAt < row.createdAt)) {
            row.createdAt = c.createdAt;
        }
    });
    return [...map.values()];
}

export default function ClientesPage() {
    const { user } = useAuth();
    const { selectedTenantId } = useTenant();
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [form, setForm] = useState({ tenantName: '', displayName: '', email: '', existingTenantId: '' });
    const [tempPassword, setTempPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const successTimerRef = useRef(null);

    const [tenantConfigs, setTenantConfigs] = useState({});
    const [tenantConfigErrors, setTenantConfigErrors] = useState(new Set());

    const loadClients = async () => {
        setLoading(true);
        setLoadError(null);

        try {
            const data = await fetchClients();
            setClients(data);

            const uniqueTenantIds = [...new Set(data.map((c) => c.tenantId).filter(Boolean))];
            const configs = {};
            const configErrors = new Set();
            await Promise.all(uniqueTenantIds.map(async (tid) => {
                try {
                    const settings = await getTenantSettings(tid);
                    configs[tid] = settings.analysisConfig;
                } catch {
                    configErrors.add(tid);
                }
            }));
            setTenantConfigs(configs);
            setTenantConfigErrors(configErrors);
        } catch (loadError) {
            console.error('Error fetching clients:', loadError);
            setClients([]);
            setLoadError(extractErrorMessage(loadError, 'Nao foi possivel carregar a lista de clientes agora. Tente novamente em alguns instantes.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            void loadClients();
        }
    }, [user]);

    useEffect(() => {
        return () => { clearTimeout(successTimerRef.current); };
    }, []);

    const handleOpenModal = () => {
        // CLI-OPS-007: Preselect tenant if one is selected in context
        const preselectedTenantId = selectedTenantId && selectedTenantId !== ALL_TENANTS_ID ? selectedTenantId : '';
        const preselectedTenant = preselectedTenantId ? existingTenants.find((t) => t.id === preselectedTenantId) : null;
        setForm({
            tenantName: preselectedTenant ? preselectedTenant.name : '',
            displayName: '',
            email: '',
            existingTenantId: preselectedTenantId || '',
        });
        setTempPassword(generatePassword());
        setShowPassword(false);
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

    const tenantRows = useMemo(() => buildTenantRows(clients), [clients]);

    const handleTenantSelect = (value) => {
        if (value === '__new__') {
            setForm((prev) => ({ ...prev, existingTenantId: '', tenantName: '' }));
        } else {
            const tenant = existingTenants.find((t) => t.id === value);
            setForm((prev) => ({ ...prev, existingTenantId: value, tenantName: tenant?.name || value }));
        }
    };

    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(tempPassword);
        } catch {
            // Fallback silently
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
            await Promise.race([
                callCreateOpsClientUser({
                    email: form.email,
                    password: tempPassword,
                    displayName: form.displayName,
                    tenantName: form.tenantName,
                    tenantId: form.existingTenantId || null,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Firebase nao respondeu em 15 segundos.')), timeoutMs)),
            ]);

            setModalOpen(false);
            // CLI-OPS-004: Do not expose password in toast
            setSuccessMessage(`Gestor criado com sucesso. Email: ${form.email}`);
            clearTimeout(successTimerRef.current);
            successTimerRef.current = setTimeout(() => setSuccessMessage(null), 12000);
            await loadClients();
        } catch (submitError) {
            console.error('Error creating client:', submitError);
            setFormError(extractErrorMessage(submitError, 'Erro ao criar cliente.'));
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = useMemo(() => {
        let result = [...tenantRows];

        if (selectedTenantId && selectedTenantId !== ALL_TENANTS_ID) {
            result = result.filter((row) => row.tenantId === selectedTenantId);
        }

        if (!searchTerm) {
            return result;
        }

        const normalizedTerm = searchTerm.toLowerCase();
        return result.filter((row) => (
            row.tenantName?.toLowerCase().includes(normalizedTerm)
            || row.users.some((u) => u.displayName?.toLowerCase().includes(normalizedTerm))
            || row.users.some((u) => u.email?.toLowerCase().includes(normalizedTerm))
        ));
    }, [tenantRows, searchTerm, selectedTenantId]);

    return (
        <PageShell size="default" className="clientes-page">
            <PageHeader
                eyebrow="Administração"
                title="Clientes"
                description="Cadastre empresas, gestores e acompanhe configurações de acesso."
                actions={
                    <button className="btn-primary" onClick={handleOpenModal}>+ Novo gestor</button>
                }
            />
            <div className="clientes-toolbar">
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
            </div>

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
            <MobileDataCardList
                items={filtered}
                loading={loading}
                emptyMessage="Nenhum cliente encontrado."
                renderCard={(row) => {
                    const config = tenantConfigs[row.tenantId];
                    const hasConfigError = tenantConfigErrors.has(row.tenantId);
                    const enabledKeys = config
                        ? Object.entries(config).filter(([, v]) => v?.enabled).map(([k]) => k)
                        : [];
                    return (
                        <>
                            <div className="mobile-card__title">{row.tenantName}</div>
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item">{row.users.length} usuario(s)</span>
                                <span className="mobile-card__meta-item" style={{ color: 'var(--text-secondary)' }}>
                                    {row.users.map((u) => u.displayName).join(', ')}
                                </span>
                            </div>
                            {hasConfigError ? (
                                <div className="mobile-card__badges">
                                    <span className="phase-badge phase-badge--error">Configuracao indisponivel</span>
                                </div>
                            ) : enabledKeys.length > 0 ? (
                                <div className="mobile-card__badges">
                                    {enabledKeys.map((key) => (
                                        <span key={key} className="phase-badge">{ANALYSIS_PHASE_LABELS[key]}</span>
                                    ))}
                                </div>
                            ) : null}
                            <div className="mobile-card__actions">
                                <button
                                    className="btn-config"
                                    onClick={() => navigate(`/ops/tenant-settings/${row.tenantId}`)}
                                >
                                    Configurar
                                </button>
                            </div>
                        </>
                    );
                }}
            >
                <div className="data-table-wrapper" style={{ overflowX: 'auto', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                    <table className="data-table" aria-label="Lista de clientes">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">Empresa</th>
                                <th className="data-table__th" scope="col">Gestores</th>
                                <th className="data-table__th" scope="col">Usuarios</th>
                                <th className="data-table__th" scope="col">Fases de analise</th>
                                <th className="data-table__th" scope="col">Data de cadastro</th>
                                <th className="data-table__th" scope="col" style={{ width: 90 }}>Acoes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && Array.from({ length: 4 }, (_, i) => (
                                <tr key={`sk-${i}`} aria-hidden="true">
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: `${50 + (i % 3) * 15}%` }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 90 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 60 }} /></td>
                                    <td className="data-table__td"><div className="skeleton" style={{ width: 56, height: 20, borderRadius: 10 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 70 }} /></td>
                                    <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 50 }} /></td>
                                </tr>
                            ))}
                            {!loading && filtered.map((row) => {
                                const config = tenantConfigs[row.tenantId];
                                const hasConfigError = tenantConfigErrors.has(row.tenantId);
                                const enabledKeys = config
                                    ? Object.entries(config).filter(([, v]) => v?.enabled).map(([k]) => k)
                                    : [];
                                return (
                                    <tr key={row.tenantId} className="data-table__row">
                                        <td className="data-table__td" style={{ fontWeight: 500 }}>{row.tenantName}</td>
                                        <td className="data-table__td">
                                            {row.users.filter((u) => u.role === 'client_manager').map((u) => u.displayName).join(', ') || '—'}
                                        </td>
                                        <td className="data-table__td" style={{ color: 'var(--text-secondary)' }}>
                                            {row.users.length}
                                        </td>
                                        <td className="data-table__td">
                                            {hasConfigError ? (
                                                <span className="phase-badge phase-badge--error">Configuracao indisponivel</span>
                                            ) : (
                                                <div className="phase-badges">
                                                    {enabledKeys.map((key) => (
                                                        <span key={key} className="phase-badge">{ANALYSIS_PHASE_LABELS[key]}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="data-table__td" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{row.createdAt}</td>
                                        <td className="data-table__td">
                                            <button
                                                className="btn-config"
                                                onClick={() => navigate(`/ops/tenant-settings/${row.tenantId}`)}
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
            </MobileDataCardList>

            {isModalOpen && (
                <Modal
                    open={isModalOpen}
                    onClose={() => setModalOpen(false)}
                    title={form.existingTenantId ? 'Adicionar gestor à empresa' : 'Nova empresa'}
                    footer={(
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button type="submit" form="clientes-create-form" className="btn-primary" disabled={submitting}>
                                {submitting ? 'Criando...' : 'Criar gestor'}
                            </button>
                        </>
                    )}
                >
                    <form id="clientes-create-form" onSubmit={handleSubmit}>
                        {formError && (
                            <div role="alert" style={{ color: 'var(--red-600)', background: 'var(--red-50)', padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
                                {formError}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="tenant-select">Empresa *</label>
                            <select
                                id="tenant-select"
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
                                <label htmlFor="tenant-name">Nome da empresa *</label>
                                <input
                                    id="tenant-name"
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
                            <label htmlFor="display-name">Nome do responsavel *</label>
                            <input
                                id="display-name"
                                required
                                type="text"
                                className="form-input"
                                value={form.displayName}
                                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                                placeholder="Ex: Joao Silva (RH)"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">Email corporativo *</label>
                            <input
                                id="email"
                                required
                                type="email"
                                className="form-input"
                                value={form.email}
                                onChange={(event) => setForm({ ...form, email: event.target.value })}
                                placeholder="joao@empresa.com.br"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="temp-password">Senha provisoria</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                    id="temp-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input pwd"
                                    value={tempPassword}
                                    readOnly
                                    style={{ flex: 1 }}
                                />
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowPassword((p) => !p)}
                                >
                                    {showPassword ? 'Ocultar' : 'Mostrar'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={copyPassword}
                                >
                                    Copiar
                                </button>
                            </div>
                            <small style={{ color: 'var(--text-tertiary)', display: 'block', marginTop: 4 }}>
                                Entregue essa senha ao cliente para o primeiro acesso.
                            </small>
                        </div>
                    </form>
                </Modal>
            )}

        </PageShell>
    );
}
