import { useEffect, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { subscribeToTenantAuditLogs } from '../core/firebase/firestoreService';

const LIVE_QUERY_TIMEOUT_MS = 10_000;

const MOCK_TENANT_AUDIT_LOGS = [
    { id: 'TAL-001', tenantId: 'TEN-001', timestamp: '14/04/2026 09:12', action: 'SOLICITATION_CREATED', category: 'case', clientSummary: 'Nova solicitacao criada para Joao Carlos Mendes', detail: 'CPF 123.456.789-00', searchText: 'joao carlos mendes solicitacao criada' },
    { id: 'TAL-002', tenantId: 'TEN-001', timestamp: '14/04/2026 10:45', action: 'CASE_ASSIGNED', category: 'case', clientSummary: 'Caso atribuido a analista para revisao', detail: 'Caso #CS-20260414-001', searchText: 'caso atribuido analista revisao' },
    { id: 'TAL-003', tenantId: 'TEN-001', timestamp: '14/04/2026 14:30', action: 'CASE_CONCLUDED', category: 'case', clientSummary: 'Analise concluida — Veredito: APTO', detail: 'Joao Carlos Mendes — Score de risco: 12', searchText: 'joao carlos mendes concluido apto' },
    { id: 'TAL-004', tenantId: 'TEN-001', timestamp: '13/04/2026 08:55', action: 'SOLICITATION_CREATED', category: 'case', clientSummary: 'Nova solicitacao criada para Maria Aparecida Lima', detail: 'CPF 987.654.321-00', searchText: 'maria aparecida lima solicitacao criada' },
    { id: 'TAL-005', tenantId: 'TEN-001', timestamp: '13/04/2026 11:20', action: 'CASE_CONCLUDED', category: 'case', clientSummary: 'Analise concluida — Veredito: ATENCAO', detail: 'Maria Aparecida Lima — Score de risco: 48', searchText: 'maria aparecida lima concluido atencao' },
    { id: 'TAL-006', tenantId: 'TEN-001', timestamp: '12/04/2026 16:03', action: 'EXPORT_CREATED', category: 'export', clientSummary: 'Exportacao CSV gerada com 15 casos', detail: 'Periodo: 01/03/2026 a 12/04/2026', searchText: 'exportacao csv gerada 15 casos' },
    { id: 'TAL-007', tenantId: 'TEN-001', timestamp: '12/04/2026 09:10', action: 'USER_CREATED', category: 'user', clientSummary: 'Novo usuario adicionado: Ana Beatriz Souza', detail: 'Papel: Gestor do cliente', searchText: 'usuario criado ana beatriz souza gestor' },
    { id: 'TAL-008', tenantId: 'TEN-001', timestamp: '11/04/2026 14:40', action: 'CASE_RETURNED', category: 'case', clientSummary: 'Caso devolvido para correcao de dados', detail: 'Motivo: CPF incorreto — Pedro Henrique Alves', searchText: 'caso devolvido correcao cpf pedro henrique alves' },
    { id: 'TAL-009', tenantId: 'TEN-001', timestamp: '11/04/2026 10:15', action: 'SOLICITATION_CREATED', category: 'case', clientSummary: 'Nova solicitacao criada para Pedro Henrique Alves', detail: 'CPF 456.789.123-00', searchText: 'pedro henrique alves solicitacao criada' },
    { id: 'TAL-010', tenantId: 'TEN-001', timestamp: '10/04/2026 17:50', action: 'PUBLIC_REPORT_CREATED', category: 'export', clientSummary: 'Relatorio publico gerado para Lucas Ferreira', detail: 'Token: rpt-abc123', searchText: 'relatorio publico lucas ferreira' },
    { id: 'TAL-011', tenantId: 'TEN-001', timestamp: '10/04/2026 08:30', action: 'CASE_CONCLUDED', category: 'case', clientSummary: 'Analise concluida — Veredito: NAO RECOMENDADO', detail: 'Carlos Eduardo Ramos — Score de risco: 82', searchText: 'carlos eduardo ramos concluido nao recomendado' },
    { id: 'TAL-012', tenantId: 'TEN-001', timestamp: '09/04/2026 13:22', action: 'CASE_CORRECTED', category: 'case', clientSummary: 'Dados corrigidos pelo cliente e caso reenviado', detail: 'Pedro Henrique Alves — CPF atualizado', searchText: 'corrigido reenviado pedro henrique alves cpf' },
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

    useEffect(() => {
        if (!user || !tenantId) return undefined;

        const timeoutId = window.setTimeout(() => {
            setState((s) => (s.key === key ? s : { logs: [], error: new Error('Tenant audit logs timeout.'), key }));
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
        const filtered = category
            ? MOCK_TENANT_AUDIT_LOGS.filter((log) => log.category === category)
            : MOCK_TENANT_AUDIT_LOGS;
        return { logs: filtered, loading: false, error: null };
    }

    if (!tenantId) {
        return { logs: [], loading: false, error: null };
    }

    return {
        logs: state.key === key ? state.logs : [],
        loading: state.key !== key,
        error: state.key === key ? state.error : null,
    };
}
