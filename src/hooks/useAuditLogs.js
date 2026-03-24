import { useState, useEffect } from 'react';
import { useAuth } from '../core/auth/AuthContext';
import { subscribeToAuditLogs } from '../core/firebase/firestoreService';

// Inline mock for demo mode
const MOCK_AUDIT_LOGS = [
    { id: 'AUD-001', timestamp: '2026-02-28 14:32:10', user: 'admin@compliancehub.com', action: 'CASE_CONCLUDED', target: 'CASE-001', detail: 'Caso concluído com veredito FIT', ip: '192.168.1.10' },
    { id: 'AUD-002', timestamp: '2026-02-27 11:15:33', user: 'analyst@compliancehub.com', action: 'CASE_UPDATED', target: 'CASE-002', detail: 'Flag criminal atualizada para POSITIVE', ip: '192.168.1.22' },
    { id: 'AUD-003', timestamp: '2026-02-27 10:20:45', user: 'admin@compliancehub.com', action: 'EXPORT_CREATED', target: 'EXP-002', detail: 'Exportação PDF do caso CASE-002', ip: '192.168.1.10' },
    { id: 'AUD-004', timestamp: '2026-02-26 09:05:12', user: 'analyst@compliancehub.com', action: 'CASE_ASSIGNED', target: 'CASE-003', detail: 'Caso atribuído ao analyst1', ip: '192.168.1.22' },
    { id: 'AUD-005', timestamp: '2026-02-25 16:44:58', user: 'cliente@techcorp.com', action: 'SOLICITATION_CREATED', target: 'CASE-005', detail: 'Nova solicitação criada para Beatriz Rodrigues Lima', ip: '200.150.10.5' },
    { id: 'AUD-006', timestamp: '2026-02-25 09:12:00', user: 'admin@compliancehub.com', action: 'EXPORT_CREATED', target: 'EXP-003', detail: 'Exportação CSV de casos concluídos', ip: '192.168.1.10' },
    { id: 'AUD-007', timestamp: '2026-02-24 14:30:22', user: 'analyst@compliancehub.com', action: 'CASE_CONCLUDED', target: 'CASE-004', detail: 'Caso concluído com veredito ATTENTION', ip: '192.168.1.22' },
    { id: 'AUD-008', timestamp: '2026-02-23 08:10:05', user: 'admin@compliancehub.com', action: 'USER_CREATED', target: 'USR-005', detail: 'Novo usuário analyst criado', ip: '192.168.1.10' },
    { id: 'AUD-009', timestamp: '2026-02-22 17:55:30', user: 'cliente@bancoatlantico.com', action: 'SOLICITATION_CREATED', target: 'CASE-007', detail: 'Nova solicitação criada para Larissa Sousa Barbosa', ip: '200.160.20.8' },
    { id: 'AUD-010', timestamp: '2026-02-21 13:20:44', user: 'analyst@compliancehub.com', action: 'CASE_CONCLUDED', target: 'CASE-008', detail: 'Caso concluído com veredito NOT_RECOMMENDED', ip: '192.168.1.22' },
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
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Demo mode
        if (!user) {
            setLogs(MOCK_AUDIT_LOGS);
            setLoading(false);
            return;
        }

        const tenantId = overrideTenantId === undefined
            ? (userProfile?.tenantId || null)
            : overrideTenantId;

        setLoading(true);
        const unsubscribe = subscribeToAuditLogs(tenantId, (data) => {
            setLogs(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile?.tenantId, overrideTenantId]);

    return { logs, loading };
}
