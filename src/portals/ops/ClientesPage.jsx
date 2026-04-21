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
    const [successMessage, setSuccessMessage] = useState(null);
    const successTimerRef = useRef(null);

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
            setLoadError(extractErrorMessage(loadError, 'Nao foi possivel carregar a lista de clientes agora. Tente novamente em alguns instantes.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            void loadClients();
        }
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

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
            setSuccessMessage(`Cliente criado com sucesso. Email: ${form.email} — Senha provisoria: ${tempPassword}`);
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
                renderCard={(client) => {
                    const config = tenantConfigs[client.tenantId] || DEFAULT_ANALYSIS_CONFIG;
                    const enabledKeys = Object.entries(config).filter(([, v]) => v?.enabled).map(([k]) => k);
                    return (
                        <>
                            <div className="mobile-card__title">{client.tenantName}</div>
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item">👤 {client.displayName}</span>
                                <span className="mobile-card__meta-item" style={{ color: 'var(--text-secondary)' }}>{client.email}</span>
                            </div>
                            {enabledKeys.length > 0 && (
                                <div className="mobile-card__badges">
                                    {enabledKeys.map((key) => (
                                        <span key={key} className="phase-badge">{ANALYSIS_PHASE_LABELS[key]}</span>
                                    ))}
                                </div>
                            )}
                            <div className="mobile-card__actions">
                                <button
                                    className="btn-config"
                                    onClick={() => navigate(`/ops/tenant-settings/${client.tenantId}`)}
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
                                                onClick={() => navigate(`/ops/tenant-settings/${client.tenantId}`)}
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
                    title="Novo cliente"
                    footer={(
                        <>
                            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button type="submit" form="clientes-create-form" className="btn-primary" disabled={submitting}>
                                {submitting ? 'Criando...' : 'Criar cliente'}
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
                    </form>
                </Modal>
            )}

        </div>
    );
}
