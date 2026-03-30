import { useEffect, useState } from 'react';
import { useAuth } from '../core/auth/useAuth';
import { subscribeToAuditLogs } from '../core/firebase/firestoreService';
import { isClientRole } from '../core/rbac/permissions';

const LIVE_QUERY_TIMEOUT_MS = 10_000;

const MOCK_AUDIT_LOGS = [
    { id: 'AUD-001', tenantId: 'TEN-001', timestamp: '2026-02-28 14:32:10', user: 'admin@compliancehub.com', action: 'CASE_CONCLUDED', target: 'CASE-001', detail: 'Caso concluido com veredito FIT', ip: '192.168.1.10' },
    { id: 'AUD-002', tenantId: 'TEN-001', timestamp: '2026-02-27 11:15:33', user: 'analyst@compliancehub.com', action: 'CASE_UPDATED', target: 'CASE-002', detail: 'Flag criminal atualizada para POSITIVE', ip: '192.168.1.22' },
    { id: 'AUD-003', tenantId: 'TEN-001', timestamp: '2026-02-27 10:20:45', user: 'admin@compliancehub.com', action: 'EXPORT_CREATED', target: 'EXP-002', detail: 'Exportacao PDF do caso CASE-002', ip: '192.168.1.10' },
    { id: 'AUD-004', tenantId: 'TEN-001', timestamp: '2026-02-26 09:05:12', user: 'analyst@compliancehub.com', action: 'CASE_ASSIGNED', target: 'CASE-003', detail: 'Caso atribuido ao analyst1', ip: '192.168.1.22' },
    { id: 'AUD-005', tenantId: 'TEN-001', timestamp: '2026-02-25 16:44:58', user: 'cliente@techcorp.com', action: 'SOLICITATION_CREATED', target: 'CASE-005', detail: 'Nova solicitacao criada para Beatriz Rodrigues Lima', ip: '200.150.10.5' },
    { id: 'AUD-006', tenantId: 'TEN-001', timestamp: '2026-02-25 09:12:00', user: 'admin@compliancehub.com', action: 'EXPORT_CREATED', target: 'EXP-003', detail: 'Exportacao CSV de casos concluidos', ip: '192.168.1.10' },
    { id: 'AUD-007', tenantId: 'TEN-002', timestamp: '2026-02-24 14:30:22', user: 'analyst@compliancehub.com', action: 'CASE_CONCLUDED', target: 'CASE-004', detail: 'Caso concluido com veredito ATTENTION', ip: '192.168.1.22' },
    { id: 'AUD-008', tenantId: 'TEN-002', timestamp: '2026-02-23 08:10:05', user: 'admin@compliancehub.com', action: 'USER_CREATED', target: 'USR-005', detail: 'Novo usuario analyst criado', ip: '192.168.1.10' },
    { id: 'AUD-009', tenantId: 'TEN-002', timestamp: '2026-02-22 17:55:30', user: 'cliente@bancoatlantico.com', action: 'SOLICITATION_CREATED', target: 'CASE-007', detail: 'Nova solicitacao criada para Larissa Sousa Barbosa', ip: '200.160.20.8' },
    { id: 'AUD-010', tenantId: 'TEN-002', timestamp: '2026-02-21 13:20:44', user: 'analyst@compliancehub.com', action: 'CASE_CONCLUDED', target: 'CASE-008', detail: 'Caso concluido com veredito NOT_RECOMMENDED', ip: '192.168.1.22' },
];

/**
 * Hook that provides real-time audit logs from Firestore.
 * Falls back to inline mock data in demo mode.
 *
 * @param {string|null|undefined} overrideTenantId - null = all tenants (ops)
 * @returns {{ logs: Array, loading: boolean }}
 */
export function useAuditLogs(overrideTenantId) {
    const { user, userProfile } = useAuth();
    const [liveState, setLiveState] = useState({
        logs: [],
        error: null,
        scopeKey: null,
    });

    const tenantId = overrideTenantId === undefined
        ? (userProfile?.tenantId || null)
        : overrideTenantId;
    const scopeKey = user ? `${user.uid}:${tenantId ?? 'all'}` : 'demo';
    const waitingForClientTenant = Boolean(
        user
        && overrideTenantId === undefined
        && isClientRole(userProfile?.role)
        && !userProfile?.tenantId,
    );

    useEffect(() => {
        if (!user || waitingForClientTenant) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setLiveState((currentState) => (
                currentState.scopeKey === scopeKey
                    ? currentState
                    : {
                        logs: [],
                        error: new Error('Firestore audit logs subscription timeout.'),
                        scopeKey,
                    }
            ));
        }, LIVE_QUERY_TIMEOUT_MS);

        const unsubscribe = subscribeToAuditLogs(tenantId, (data, error) => {
            window.clearTimeout(timeoutId);
            setLiveState({
                logs: data,
                error: error || null,
                scopeKey,
            });
        });

        return () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [scopeKey, tenantId, user, waitingForClientTenant]);

    if (!user) {
        const demoTenantId = overrideTenantId === undefined
            ? (userProfile?.tenantId || null)
            : overrideTenantId;
        const demoLogs = demoTenantId
            ? MOCK_AUDIT_LOGS.filter((log) => log.tenantId === demoTenantId)
            : MOCK_AUDIT_LOGS;

        return { logs: demoLogs, loading: false, error: null };
    }

    if (waitingForClientTenant) {
        return { logs: [], loading: true, error: null };
    }

    return {
        logs: liveState.scopeKey === scopeKey ? liveState.logs : [],
        loading: liveState.scopeKey !== scopeKey,
        error: liveState.scopeKey === scopeKey ? liveState.error : null,
    };
}
