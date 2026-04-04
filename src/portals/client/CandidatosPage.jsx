import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { isClientRole } from '../../core/rbac/permissions';
import { useCandidates } from '../../hooks/useCandidates';
import { useCases } from '../../hooks/useCases';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import { extractErrorMessage } from '../../core/errorUtils';
import './CandidatosPage.css';

function formatFullCpf(cpf) {
    const d = String(cpf || '').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '';
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function CandidatosPage() {
    const location = useLocation();
    const { user, userProfile } = useAuth();
    const { selectedTenantId } = useTenant();

    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const isDemoMode = !user || userProfile?.source === 'demo';

    // Target tenant setup:
    // - Demo mode: undefined (uses mock data defaults)
    // - Ops Ops: ALL_TENANTS_ID means null (all data), otherwise specific tenant
    // - Client: strictly their userProfile.tenantId
    const tenantTarget = isDemoMode
        ? undefined
        : (isOpsPortal ? (selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId) : userProfile?.tenantId);

    // Only Ops (real data) has direct access to the `candidates` collection.
    // Client and Demo modes build their candidate list by aggregating cases.
    const useRawCandidates = !isDemoMode && isOpsPortal;

    const { candidates: rawCands, error: errorCands, loading: loadCands } = useCandidates(useRawCandidates ? tenantTarget : '__skip__');
    const { cases, error: errorCases, loading: loadCases } = useCases(tenantTarget);

    const loading = loadCands || loadCases;
    const error = errorCands || errorCases;
    const [searchTerm, setSearchTerm] = useState('');

    const candidates = useMemo(() => {
        const caseStats = new Map();
        
        // Build candidate history by aggregating cases
        for (const cs of cases) {
            const prev = caseStats.get(cs.candidateId);
            const date = cs.createdAt || '';
            if (!prev || date > prev.lastDate) {
                caseStats.set(cs.candidateId, {
                    count: (prev?.count || 0) + 1,
                    lastVerdict: cs.finalVerdict !== 'PENDING' ? cs.finalVerdict : (prev?.lastVerdict || null),
                    lastPosition: cs.candidatePosition || prev?.lastPosition || '',
                    lastDate: date,
                    name: cs.candidateName,
                    cpf: cs.cpfMasked
                });
            } else {
                prev.count += 1;
                if (!prev.lastVerdict && cs.finalVerdict !== 'PENDING') prev.lastVerdict = cs.finalVerdict;
            }
        }

        let list = [];
        if (useRawCandidates) {
            // Enrich real ops candidate profiles with stats derived from cases
            list = rawCands.map((c) => {
                const stats = caseStats.get(c.id);
                return {
                    id: c.id,
                    name: c.candidateName || c.name || '',
                    cpf: c.cpf || c.cpfMasked || '', // full cpf is shown in ops mode
                    lastPosition: stats?.lastPosition || c.candidatePosition || c.position || '',
                    lastVerdict: stats?.lastVerdict || null,
                    totalRequests: stats?.count || 1,
                };
            });
        } else {
            // Derive purely from cases for Client / Demo modes
            list = Array.from(caseStats.entries()).map(([id, stats]) => ({
                id,
                name: stats.name || 'Desconhecido',
                cpf: stats.cpf || '',
                lastPosition: stats.lastPosition || '',
                lastVerdict: stats.lastVerdict || null,
                totalRequests: stats.count || 1,
            }));
        }

        if (!searchTerm) return list;
        const normalizedTerm = searchTerm.toLowerCase();
        return list.filter((c) => (
            c.name.toLowerCase().includes(normalizedTerm)
            || c.cpf.includes(normalizedTerm)
        ));
    }, [cases, rawCands, searchTerm, useRawCandidates]);

    return (
        <div className="candidatos-page">
            <div className="candidatos-header">
                <h2>Candidatos analisados</h2>
                <div className="filter-bar__search" style={{ maxWidth: 300 }}>
                    <span className="filter-bar__search-icon" aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por nome ou CPF..."
                        aria-label="Buscar candidatos"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
            </div>

            <div className="candidatos-table-wrapper">
                <table className="data-table" aria-label="Lista de candidatos">
                    <thead>
                        <tr>
                            <th className="data-table__th" scope="col">Nome</th>
                            <th className="data-table__th" scope="col">CPF</th>
                            <th className="data-table__th" scope="col">Ultimo cargo</th>
                            <th className="data-table__th" scope="col">Total solicitacoes</th>
                            <th className="data-table__th" scope="col">Ultimo veredito</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={5} className="data-table__empty">Carregando candidatos...</td>
                            </tr>
                        )}
                        {!loading && error && (
                            <tr>
                                <td colSpan={5} className="data-table__empty" style={{ color: 'var(--red-700)' }}>
                                    {extractErrorMessage(error, 'Nao foi possivel carregar os candidatos agora.')}
                                </td>
                            </tr>
                        )}
                        {!loading && !error && candidates.map((candidate) => (
                            <tr key={candidate.id} className="data-table__row">
                                <td className="data-table__td data-table__td--name">{candidate.name}</td>
                                <td className="data-table__td data-table__td--mono">{candidate.cpf}</td>
                                <td className="data-table__td">{candidate.lastPosition}</td>
                                <td className="data-table__td">{candidate.totalRequests}</td>
                                <td className="data-table__td">
                                    {candidate.lastVerdict
                                        ? <RiskChip value={candidate.lastVerdict} />
                                        : <StatusBadge status="PENDING" />}
                                </td>
                            </tr>
                        ))}
                        {!loading && !error && candidates.length === 0 && (
                            <tr>
                                <td colSpan={5} className="data-table__empty">Nenhum candidato encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
