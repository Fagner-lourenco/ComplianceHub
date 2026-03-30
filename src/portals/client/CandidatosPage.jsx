import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/useAuth';
import { useTenant } from '../../core/contexts/useTenant';
import { ALL_TENANTS_ID } from '../../core/contexts/tenantUtils';
import { useCandidates } from '../../hooks/useCandidates';
import { useCases } from '../../hooks/useCases';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import './CandidatosPage.css';

export default function CandidatosPage() {
    const location = useLocation();
    const { user } = useAuth();
    const { selectedTenantId } = useTenant();
    const isOpsPortal = location.pathname.startsWith('/ops') || location.pathname.startsWith('/demo/ops');
    const isDemoMode = location.pathname.startsWith('/demo/');
    const tenantOverride = isOpsPortal
        ? (selectedTenantId === ALL_TENANTS_ID ? null : selectedTenantId)
        : undefined;

    // In real mode, use both candidates and cases to enrich with verdict/totalRequests.
    // In demo mode (no user), fall back to deriving candidates from cases (no mock candidates exist).
    const realCandidates = useCandidates(isDemoMode ? '__skip__' : tenantOverride);
    const realCases = useCases(isDemoMode ? '__skip__' : tenantOverride);
    const demoCases = useCases(isDemoMode ? tenantOverride : '__skip__');
    const useRealSource = Boolean(user) && !isDemoMode;

    const {
        candidates: rawCandidates,
        error,
        loading,
    } = useRealSource
        ? realCandidates
        : { candidates: [], error: demoCases.error, loading: demoCases.loading };

    const [searchTerm, setSearchTerm] = useState('');

    const candidates = useMemo(() => {
        // For real data: enrich candidates with verdict/totalRequests from cases
        if (useRealSource) {
            // Build a map of candidateId -> { count, lastVerdict, lastPosition, lastDate }
            const caseStats = new Map();
            for (const cs of realCases.cases) {
                const prev = caseStats.get(cs.candidateId);
                const date = cs.createdAt || '';
                if (!prev || date > prev.lastDate) {
                    caseStats.set(cs.candidateId, {
                        count: (prev?.count || 0) + 1,
                        lastVerdict: cs.finalVerdict !== 'PENDING' ? cs.finalVerdict : (prev?.lastVerdict || null),
                        lastPosition: cs.candidatePosition || prev?.lastPosition || '',
                        lastDate: date,
                    });
                } else {
                    prev.count += 1;
                    if (!prev.lastVerdict && cs.finalVerdict !== 'PENDING') {
                        prev.lastVerdict = cs.finalVerdict;
                    }
                }
            }

            const list = rawCandidates.map((c) => {
                const stats = caseStats.get(c.id);
                return {
                    id: c.id,
                    name: c.candidateName || c.name || '',
                    cpf: c.cpfMasked || c.cpf || '',
                    lastPosition: stats?.lastPosition || c.candidatePosition || c.position || '',
                    lastVerdict: stats?.lastVerdict || null,
                    totalRequests: stats?.count || 1,
                };
            });

            if (!searchTerm) return list;
            const normalizedTerm = searchTerm.toLowerCase();
            return list.filter((candidate) => (
                candidate.name.toLowerCase().includes(normalizedTerm)
                || candidate.cpf.includes(normalizedTerm)
            ));
        }

        // Demo fallback: derive from cases
        const candidateMap = new Map();
        for (const currentCase of demoCases.cases) {
            const totalRequests = demoCases.cases.filter((item) => item.candidateId === currentCase.candidateId).length;
            if (!candidateMap.has(currentCase.candidateId)) {
                candidateMap.set(currentCase.candidateId, {
                    id: currentCase.candidateId,
                    name: currentCase.candidateName,
                    cpf: currentCase.cpfMasked,
                    lastPosition: currentCase.candidatePosition,
                    lastVerdict: currentCase.finalVerdict,
                    totalRequests,
                });
            }
        }

        const uniqueCandidates = [...candidateMap.values()];
        if (!searchTerm) return uniqueCandidates;
        const normalizedTerm = searchTerm.toLowerCase();
        return uniqueCandidates.filter((candidate) => (
            candidate.name.toLowerCase().includes(normalizedTerm)
            || candidate.cpf.includes(normalizedTerm)
        ));
    }, [useRealSource, rawCandidates, realCases.cases, demoCases.cases, searchTerm]);

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
                                    Nao foi possivel carregar os candidatos agora.
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
                                        : <span style={{ color: 'var(--text-tertiary)' }}>Pendente</span>}
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
