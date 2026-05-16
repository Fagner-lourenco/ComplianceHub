import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { subscribeToTenantAuditLogs } from '../core/firebase/firestoreService';

const LIVE_QUERY_TIMEOUT_MS = 10_000;
const EMPTY_LOGS = [];

const MOCK_TENANT_AUDIT_LOGS = [
    {
        id: 'TAL-001',
        eventId: 'audit-demo-001',
        tenantId: 'TEN-001',
        timestamp: '14/04/2026 09:12',
        action: 'SOLICITATION_CREATED',
        category: 'CASE',
        actor: { displayName: 'Carla Mendes', email: 'carla@cliente.com' },
        entity: { type: 'CASE', id: 'CASE-001', label: 'João Carlos Mendes' },
        clientSummary: 'Nova solicitação criada para João Carlos Mendes',
        searchText: 'carla cliente joao carlos mendes solicitacao criada case-001',
    },
    {
        id: 'TAL-002',
        eventId: 'audit-demo-002',
        tenantId: 'TEN-001',
        timestamp: '14/04/2026 14:30',
        action: 'CASE_CONCLUDED',
        category: 'CASE',
        actor: { displayName: 'Operação ComplianceHub', email: 'ops@compliancehub.com' },
        entity: { type: 'CASE', id: 'CASE-001', label: 'João Carlos Mendes' },
        clientSummary: 'Análise concluída - Veredito: APTO',
        searchText: 'operacao compliancehub joao carlos mendes concluido apto case-001',
    },
    {
        id: 'TAL-003',
        eventId: 'audit-demo-003',
        tenantId: 'TEN-001',
        timestamp: '12/04/2026 16:03',
        action: 'EXPORT_CREATED',
        category: 'EXPORT',
        actor: { displayName: 'Ana Beatriz Souza', email: 'ana@cliente.com' },
        entity: { type: 'EXPORT', id: 'EXP-20260412', label: 'Exportação CSV' },
        clientSummary: 'Exportação CSV gerada com 15 casos',
        searchText: 'ana beatriz exportacao csv exp-20260412',
    },
    {
        id: 'TAL-004',
        eventId: 'audit-demo-004',
        tenantId: 'TEN-001',
        timestamp: '12/04/2026 09:10',
        action: 'TENANT_USER_CREATED',
        category: 'TENANT_ADMIN',
        actor: { displayName: 'Carla Mendes', email: 'carla@cliente.com' },
        entity: { type: 'USER', id: 'USR-007', label: 'Ana Beatriz Souza' },
        clientSummary: 'Novo usuário adicionado ao tenant',
        searchText: 'carla ana beatriz usuario criado tenant admin',
    },
    {
        id: 'TAL-005',
        eventId: 'audit-demo-005',
        tenantId: 'TEN-001',
        timestamp: '10/04/2026 17:50',
        action: 'PUBLIC_REPORT_CREATED',
        category: 'REPORT_PUBLIC',
        actor: { displayName: 'Carla Mendes', email: 'carla@cliente.com' },
        entity: { type: 'REPORT_PUBLIC', id: 'rpt-abc123', label: 'Lucas Ferreira' },
        clientSummary: 'Relatório público gerado para Lucas Ferreira',
        searchText: 'carla relatorio publico lucas ferreira rpt abc123',
    },
];

/**
 * Hook for client-facing tenant audit logs (reads from tenantAuditLogs collection).
 *
 * @param {string|null} tenantId
 * @param {string|null} category - optional category filter
 * @returns {{ logs: Array, loading: boolean, error: Error|null }}
 */
export function useTenantAuditLogs(tenantId, category = null) {
    const { user } = useAuth();
    const [state, setState] = useState({ logs: [], error: null, key: null });

    const key = tenantId ? `${tenantId}:${category || 'all'}` : null;
    const demoLogs = useMemo(() => (
        category
            ? MOCK_TENANT_AUDIT_LOGS.filter((log) => log.category === category)
            : MOCK_TENANT_AUDIT_LOGS
    ), [category]);
    const demoResult = useMemo(() => ({ logs: demoLogs, loading: false, error: null }), [demoLogs]);
    const missingTenantResult = useMemo(() => ({ logs: EMPTY_LOGS, loading: false, error: null }), []);
    const liveResult = useMemo(() => {
        const isCurrentScope = state.key === key;
        return {
            logs: isCurrentScope ? state.logs : EMPTY_LOGS,
            loading: !isCurrentScope,
            error: isCurrentScope ? state.error : null,
        };
    }, [key, state.error, state.key, state.logs]);

    useEffect(() => {
        if (!user || !tenantId) return undefined;

        const timeoutId = window.setTimeout(() => {
            setState((s) => (s.key === key ? s : { logs: [], error: new Error('Tempo esgotado ao carregar a auditoria do tenant.'), key }));
        }, LIVE_QUERY_TIMEOUT_MS);

        const unsubscribe = subscribeToTenantAuditLogs(tenantId, (data, error) => {
            window.clearTimeout(timeoutId);
            setState({ logs: data, error: error || null, key });
        }, { category });

        return () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [key, tenantId, category, user]);

    if (!user) {
        return demoResult;
    }

    if (!tenantId) {
        return missingTenantResult;
    }

    return liveResult;
}
