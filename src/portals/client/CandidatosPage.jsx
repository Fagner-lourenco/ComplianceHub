import { useState, useMemo } from 'react';
import { MOCK_CASES } from '../../data/mockData';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import './CandidatosPage.css';

export default function CandidatosPage() {
    const [searchTerm, setSearchTerm] = useState('');

    const candidates = useMemo(() => {
        const unique = [];
        const seen = new Set();
        for (const c of MOCK_CASES) {
            if (!seen.has(c.candidateId)) {
                seen.add(c.candidateId);
                unique.push({
                    id: c.candidateId,
                    name: c.candidateName,
                    cpf: c.cpfMasked,
                    lastPosition: c.candidatePosition,
                    lastVerdict: c.finalVerdict,
                    totalRequests: MOCK_CASES.filter(x => x.candidateId === c.candidateId).length,
                });
            }
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return unique.filter(c => c.name.toLowerCase().includes(term) || c.cpf.includes(term));
        }
        return unique;
    }, [searchTerm]);

    return (
        <div className="candidatos-page">
            <div className="candidatos-header">
                <h2>Candidatos Analisados</h2>
                <div className="filter-bar__search" style={{ maxWidth: 300 }}>
                    <span className="filter-bar__search-icon">🔍</span>
                    <input
                        type="text"
                        className="filter-bar__search-input"
                        placeholder="Buscar por nome ou CPF..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="candidatos-table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="data-table__th">Nome</th>
                            <th className="data-table__th">CPF</th>
                            <th className="data-table__th">Último Cargo</th>
                            <th className="data-table__th">Total Solicitações</th>
                            <th className="data-table__th">Último Veredito</th>
                        </tr>
                    </thead>
                    <tbody>
                        {candidates.map(c => (
                            <tr key={c.id} className="data-table__row">
                                <td className="data-table__td data-table__td--name">{c.name}</td>
                                <td className="data-table__td data-table__td--mono">{c.cpf}</td>
                                <td className="data-table__td">{c.lastPosition}</td>
                                <td className="data-table__td">{c.totalRequests}</td>
                                <td className="data-table__td">
                                    {c.lastVerdict ? <RiskChip value={c.lastVerdict} /> : <span style={{ color: 'var(--text-tertiary)' }}>Pendente</span>}
                                </td>
                            </tr>
                        ))}
                        {candidates.length === 0 && (
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
