import { useState, useMemo } from 'react';
import { useCases } from '../../hooks/useCases';
import RiskChip from '../../ui/components/RiskChip/RiskChip';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import './ExportacoesPage.css';

const MOCK_EXPORTS = [
    { id: 'EXP-001', type: 'CSV', scope: 'Todos os casos', createdAt: '2026-02-28 14:30', status: 'DONE', records: 10 },
    { id: 'EXP-002', type: 'PDF', scope: 'Caso CASE-002', createdAt: '2026-02-27 10:15', status: 'DONE', records: 1 },
    { id: 'EXP-003', type: 'CSV', scope: 'Casos concluídos', createdAt: '2026-02-25 09:00', status: 'DONE', records: 6 },
];

export default function ExportacoesPage() {
    const { cases } = useCases();
    const [exportType, setExportType] = useState('CSV');
    const [exportScope, setExportScope] = useState('ALL');
    const [exporting, setExporting] = useState(false);
    const [exports] = useState(MOCK_EXPORTS);

    const scopeOptions = [
        { value: 'ALL', label: 'Todos os casos' },
        { value: 'DONE', label: 'Apenas concluídos' },
        { value: 'PENDING', label: 'Apenas pendentes' },
        { value: 'RED', label: 'Apenas alertas (vermelho)' },
    ];

    const recordCount = useMemo(() => {
        if (exportScope === 'ALL') return cases.length;
        if (exportScope === 'DONE') return cases.filter(c => c.status === 'DONE').length;
        if (exportScope === 'PENDING') return cases.filter(c => c.status === 'PENDING').length;
        if (exportScope === 'RED') return cases.filter(c => c.riskLevel === 'RED').length;
        return 0;
    }, [cases, exportScope]);

    const handleExport = () => {
        setExporting(true);
        setTimeout(() => {
            setExporting(false);
            alert(`Exportação ${exportType} gerada com ${recordCount} registros! (simulação)`);
        }, 1500);
    };

    return (
        <div className="export-page">
            <h2>Exportações</h2>

            {/* New export */}
            <div className="export-new">
                <h3>📥 Nova Exportação</h3>
                <div className="export-new__form">
                    <div className="export-new__field">
                        <label>Formato</label>
                        <div className="export-toggle-group">
                            <button className={`export-toggle ${exportType === 'CSV' ? 'export-toggle--active' : ''}`} onClick={() => setExportType('CSV')}>📊 CSV</button>
                            <button className={`export-toggle ${exportType === 'PDF' ? 'export-toggle--active' : ''}`} onClick={() => setExportType('PDF')}>📄 PDF</button>
                        </div>
                    </div>
                    <div className="export-new__field">
                        <label>Escopo</label>
                        <select className="export-select" value={exportScope} onChange={e => setExportScope(e.target.value)}>
                            {scopeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="export-new__field">
                        <label>Registros</label>
                        <span className="export-count">{recordCount}</span>
                    </div>
                    <button className="export-btn" onClick={handleExport} disabled={exporting || recordCount === 0}>
                        {exporting ? '⏳ Gerando...' : '📥 Exportar'}
                    </button>
                </div>
            </div>

            {/* History */}
            <div className="export-history">
                <h3>Histórico</h3>
                <div className="export-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th className="data-table__th">ID</th>
                                <th className="data-table__th">Formato</th>
                                <th className="data-table__th">Escopo</th>
                                <th className="data-table__th">Registros</th>
                                <th className="data-table__th">Data</th>
                                <th className="data-table__th">Status</th>
                                <th className="data-table__th">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exports.map(e => (
                                <tr key={e.id} className="data-table__row">
                                    <td className="data-table__td data-table__td--mono">{e.id}</td>
                                    <td className="data-table__td">{e.type === 'CSV' ? '📊 CSV' : '📄 PDF'}</td>
                                    <td className="data-table__td">{e.scope}</td>
                                    <td className="data-table__td">{e.records}</td>
                                    <td className="data-table__td">{e.createdAt}</td>
                                    <td className="data-table__td"><StatusBadge status={e.status} /></td>
                                    <td className="data-table__td">
                                        <button className="export-download-btn">⬇️ Download</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
