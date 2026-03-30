import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../core/auth/useAuth';
import {
    createExport,
    logAuditEvent,
    savePublicReport,
    subscribeToExports,
} from '../../core/firebase/firestoreService';
import { useCases } from '../../hooks/useCases';
import { buildBatchReportHtml } from '../../core/reportBuilder';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import './ExportacoesPage.css';

const DEMO_EXPORTS = [
    { id: 'EXP-001', type: 'CSV', scope: 'Todos os casos', createdAt: '2026-02-28 14:30', status: 'DONE', records: 10 },
    { id: 'EXP-002', type: 'PDF', scope: 'Caso CASE-002', createdAt: '2026-02-27 10:15', status: 'DONE', records: 1 },
    { id: 'EXP-003', type: 'CSV', scope: 'Casos concluidos', createdAt: '2026-02-25 09:00', status: 'DONE', records: 6 },
];

const SCOPE_OPTIONS = [
    { value: 'ALL', label: 'Todos os casos' },
    { value: 'DONE', label: 'Apenas concluidos' },
    { value: 'PENDING', label: 'Apenas pendentes' },
    { value: 'RED', label: 'Apenas alertas' },
];
const LIVE_QUERY_TIMEOUT_MS = 10_000;

function escapeCsvField(value) {
    const str = String(value ?? '');
    // Prevent CSV injection for formulas
    const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
        return '"' + safe.replace(/"/g, '""') + '"';
    }
    return safe;
}

function buildCsvContent(rows) {
    const headers = [
        'ID', 'Nome', 'CPF', 'Cargo', 'Departamento', 'Data Solicitação', 'Status', 'Prioridade',
        'Criminal', 'Severidade Criminal', 'Trabalhista', 'Severidade Trabalhista',
        'Mandado', 'OSINT', 'Social', 'Digital', 'Conflito Interesse',
        'Nível Risco', 'Score Risco', 'Veredito', 'Parecer Analista',
    ];
    const lines = [headers.map(escapeCsvField).join(',')];

    const STATUS_MAP = { PENDING: 'Pendente', IN_PROGRESS: 'Em Análise', WAITING_INFO: 'Aguardando Info', CORRECTION_NEEDED: 'Correção Necessária', DONE: 'Concluído' };
    const RISK_MAP = { GREEN: 'Baixo', YELLOW: 'Médio', RED: 'Alto' };
    const VERDICT_MAP = { FIT: 'Recomendado', ATTENTION: 'Atenção', NOT_RECOMMENDED: 'Não Recomendado' };
    const FLAG_MAP = { POSITIVE: 'Positivo', NEGATIVE: 'Negativo', INCONCLUSIVE: 'Inconclusivo', NOT_FOUND: 'Não Encontrado' };
    const OSINT_MAP = { LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto', UNKNOWN: 'Desconhecido' };
    const SOCIAL_MAP = { APPROVED: 'Aprovado', NEUTRAL: 'Neutro', CONCERN: 'Atenção', CONTRAINDICATED: 'Contraindicado' };
    const DIGITAL_MAP = { CLEAN: 'Limpo', ALERT: 'Alerta', CRITICAL: 'Crítico', NOT_CHECKED: 'N/V' };
    const CONFLICT_MAP = { YES: 'Sim', NO: 'Não', UNKNOWN: 'Desconhecido' };
    const SEV_MAP = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };
    const PRI_MAP = { NORMAL: 'Normal', HIGH: 'Alta' };

    for (const c of rows) {
        lines.push([
            c.id,
            c.candidateName || '',
            c.cpfMasked || '',
            c.candidatePosition || '',
            c.department || '',
            c.createdAt || '',
            STATUS_MAP[c.status] || c.status || '',
            PRI_MAP[c.priority] || c.priority || '',
            FLAG_MAP[c.criminalFlag] || c.criminalFlag || '',
            SEV_MAP[c.criminalSeverity] || c.criminalSeverity || '',
            FLAG_MAP[c.laborFlag] || c.laborFlag || '',
            SEV_MAP[c.laborSeverity] || c.laborSeverity || '',
            FLAG_MAP[c.warrantFlag] || c.warrantFlag || '',
            OSINT_MAP[c.osintLevel] || c.osintLevel || '',
            SOCIAL_MAP[c.socialStatus] || c.socialStatus || '',
            DIGITAL_MAP[c.digitalFlag] || c.digitalFlag || '',
            CONFLICT_MAP[c.conflictInterest] || c.conflictInterest || '',
            RISK_MAP[c.riskLevel] || c.riskLevel || '',
            c.riskScore ?? '',
            VERDICT_MAP[c.finalVerdict] || c.finalVerdict || '',
            c.analystComment || '',
        ].map(escapeCsvField).join(','));
    }
    return lines.join('\r\n');
}

function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildPdfHtml(rows, scopeLabel, tenantName) {
    const now = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

    const STATUS_MAP = { PENDING: 'Pendente', IN_PROGRESS: 'Em Análise', WAITING_INFO: 'Aguardando', CORRECTION_NEEDED: 'Correção', DONE: 'Concluído' };
    const RISK_MAP = { GREEN: 'Baixo', YELLOW: 'Médio', RED: 'Alto' };
    const VERDICT_MAP = { FIT: 'Recomendado', ATTENTION: 'Atenção', NOT_RECOMMENDED: 'N/Recomendado' };

    function riskBadge(level) {
        const c = level === 'RED' ? 'red' : level === 'YELLOW' ? 'yellow' : 'green';
        return `<span class="b b--${c}">${esc(RISK_MAP[level] || level || '—')}</span>`;
    }
    function verdictBadge(v) {
        const c = v === 'NOT_RECOMMENDED' ? 'red' : v === 'ATTENTION' ? 'yellow' : v === 'FIT' ? 'green' : 'gray';
        return `<span class="b b--${c}">${esc(VERDICT_MAP[v] || v || '—')}</span>`;
    }
    function statusBadge(s) {
        const c = s === 'DONE' ? 'green' : s === 'PENDING' ? 'gray' : 'yellow';
        return `<span class="b b--${c}">${esc(STATUS_MAP[s] || s || '—')}</span>`;
    }
    function scorePill(score) {
        if (score == null || score === '') return '<span class="score-na">—</span>';
        const s = Number(score);
        const c = s >= 70 ? '#ef4444' : s >= 30 ? '#f59e0b' : '#22c55e';
        return `<span class="score" style="background:${c}">${s}</span>`;
    }

    const summary = {
        total: rows.length,
        done: rows.filter(r => r.status === 'DONE').length,
        red: rows.filter(r => r.riskLevel === 'RED').length,
        yellow: rows.filter(r => r.riskLevel === 'YELLOW').length,
        green: rows.filter(r => r.riskLevel === 'GREEN').length,
    };

    const kpis = `<div class="kpis">
      <div class="kpi"><div class="kpi__v">${summary.total}</div><div class="kpi__l">Total</div></div>
      <div class="kpi"><div class="kpi__v">${summary.done}</div><div class="kpi__l">Concluídos</div></div>
      <div class="kpi kpi--red"><div class="kpi__v">${summary.red}</div><div class="kpi__l">Alto Risco</div></div>
      <div class="kpi kpi--yellow"><div class="kpi__v">${summary.yellow}</div><div class="kpi__l">Médio Risco</div></div>
      <div class="kpi kpi--green"><div class="kpi__v">${summary.green}</div><div class="kpi__l">Baixo Risco</div></div>
    </div>`;

    const tableRows = rows.map((c) => {
        const risk = c.riskLevel || '';
        const rowCls = risk === 'RED' ? ' class="row-red"' : '';
        return `<tr${rowCls}>
            <td class="td-name">${esc(c.candidateName || '—')}</td>
            <td class="td-cpf">${esc(c.cpfMasked || '—')}</td>
            <td>${esc(c.candidatePosition || '—')}</td>
            <td class="td-center">${statusBadge(c.status)}</td>
            <td class="td-center">${riskBadge(risk)}</td>
            <td class="td-center">${scorePill(c.riskScore)}</td>
            <td class="td-center">${verdictBadge(c.finalVerdict)}</td>
            <td class="td-date">${esc(c.createdAt || '—')}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Exportação — ComplianceHub</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;background:#f0f2f5;font-size:13px;line-height:1.6}
.page{max-width:960px;margin:0 auto;background:#fff;padding:40px 48px;min-height:100vh}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #4f46e5;margin-bottom:28px}
.hdr__brand{font-size:20px;font-weight:800;color:#4f46e5;letter-spacing:-.4px}
.hdr__sub{font-size:11px;color:#64748b;margin-top:2px}
.hdr__right{text-align:right;font-size:11px;color:#64748b;line-height:1.9}
.hdr__tenant{font-weight:600;color:#1e293b;font-size:12px}
.meta-row{display:flex;gap:20px;margin-bottom:20px;font-size:11px;color:#64748b;flex-wrap:wrap}
.meta-row span{background:#f8fafc;border:1px solid #e2e8f0;padding:4px 12px;border-radius:5px}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:24px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
.kpi__v{font-size:22px;font-weight:800;color:#1e293b}
.kpi__l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-top:2px}
.kpi--red{border-left:3px solid #ef4444}.kpi--red .kpi__v{color:#b91c1c}
.kpi--yellow{border-left:3px solid #f59e0b}.kpi--yellow .kpi__v{color:#a16207}
.kpi--green{border-left:3px solid #22c55e}.kpi--green .kpi__v{color:#15803d}
.sec__t{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #f1f5f9}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
thead th{background:linear-gradient(135deg,#f8fafc 0%,#f0f4ff 100%);text-align:left;padding:10px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#64748b;border-bottom:2px solid #e2e8f0}
tbody td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tbody tr:hover{background:#fafbff}
.row-red{background:#fef2f2}
.td-name{font-weight:600;color:#1e293b;white-space:nowrap}
.td-cpf{font-family:'SF Mono',Consolas,monospace;font-size:10px;color:#64748b;white-space:nowrap}
.td-date{font-size:10px;color:#94a3b8;white-space:nowrap}
.td-center{text-align:center}
.b{display:inline-flex;align-items:center;padding:3px 9px;border-radius:5px;font-size:10px;font-weight:600;line-height:1.4;white-space:nowrap}
.b--green{background:#dcfce7;color:#15803d}.b--yellow{background:#fef9c3;color:#a16207}.b--red{background:#fee2e2;color:#b91c1c}.b--gray{background:#f1f5f9;color:#475569}
.score{display:inline-flex;align-items:center;justify-content:center;width:28px;height:20px;border-radius:4px;color:#fff;font-size:10px;font-weight:700}
.score-na{color:#cbd5e1}
.ftr{margin-top:32px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
.print-btn{position:fixed;bottom:20px;right:20px;background:#4f46e5;color:#fff;border:none;padding:10px 22px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 18px rgba(79,70,229,.4);z-index:999}
.print-btn:hover{background:#4338ca}
@media print{body{background:#fff}.page{max-width:100%;padding:20px 16px;box-shadow:none}.print-btn{display:none}thead{display:table-header-group}tbody tr{page-break-inside:avoid}}
@page{size:A4 landscape;margin:10mm}
</style></head><body>
<div class="page">
  <div class="hdr">
    <div><div class="hdr__brand">ComplianceHub</div><div class="hdr__sub">Exportação de Casos — Documento Confidencial</div></div>
    <div class="hdr__right"><div class="hdr__tenant">${esc(tenantName)}</div><div>Gerado em ${esc(now)}</div></div>
  </div>
  <div class="meta-row"><span>📋 Escopo: <strong>${esc(scopeLabel)}</strong></span><span>📊 ${rows.length} registro${rows.length !== 1 ? 's' : ''}</span></div>
  ${kpis}
  <div class="sec__t">Detalhamento por Candidato</div>
  <table><thead><tr>
    <th>Nome</th><th>CPF</th><th>Cargo</th><th style="text-align:center">Status</th><th style="text-align:center">Risco</th><th style="text-align:center">Score</th><th style="text-align:center">Veredito</th><th>Data</th>
  </tr></thead><tbody>${tableRows}</tbody></table>
  <div class="ftr"><div>ComplianceHub · Documento Confidencial</div><div>${esc(now)}</div></div>
</div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body></html>`;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function ExportacoesPage() {
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const tenantId = userProfile?.tenantId || null;
    const { cases } = useCases();
    const [exportType, setExportType] = useState('CSV');
    const [exportScope, setExportScope] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exporting, setExporting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const demoTimerRef = useRef(null);
    const [exportsState, setExportsState] = useState({
        exports: isDemoMode ? DEMO_EXPORTS : [],
        loading: !isDemoMode,
        error: null,
    });

    useEffect(() => {
        if (isDemoMode || !tenantId) {
            setExportsState({
                exports: isDemoMode ? DEMO_EXPORTS : [],
                loading: false,
                error: null,
            });
            return undefined;
        }

        setExportsState((currentState) => ({
            ...currentState,
            loading: true,
            error: null,
        }));

        const timeoutId = window.setTimeout(() => {
            setExportsState((currentState) => (
                currentState.loading
                    ? {
                        exports: [],
                        loading: false,
                        error: new Error('Firestore exports subscription timeout.'),
                    }
                    : currentState
            ));
        }, LIVE_QUERY_TIMEOUT_MS);

        const unsubscribe = subscribeToExports(tenantId, (data, error) => {
            window.clearTimeout(timeoutId);
            setExportsState({
                exports: data,
                loading: false,
                error: error || null,
            });
        });

        return () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [isDemoMode, tenantId]);

    // Cleanup demo timer on unmount
    useEffect(() => {
        return () => {
            if (demoTimerRef.current) window.clearTimeout(demoTimerRef.current);
        };
    }, []);

    const filteredCases = useMemo(() => {
        let result = [...cases];
        if (exportScope === 'DONE') result = result.filter((c) => c.status === 'DONE');
        if (exportScope === 'PENDING') result = result.filter((c) => c.status === 'PENDING');
        if (exportScope === 'RED') result = result.filter((c) => c.riskLevel === 'RED');
        if (dateFrom) result = result.filter((c) => (c.createdAt || '') >= dateFrom);
        if (dateTo) result = result.filter((c) => (c.createdAt || '').slice(0, 10) <= dateTo);
        return result;
    }, [cases, exportScope, dateFrom, dateTo]);

    const recordCount = filteredCases.length;

    const handleExport = async () => {
        setFeedback('');

        if (recordCount === 0) {
            setFeedback('Nao ha registros disponiveis para este recorte.');
            return;
        }

        if (isDemoMode) {
            setExporting(true);
            demoTimerRef.current = window.setTimeout(() => {
                setExporting(false);
                setFeedback(`Exportacao demo ${exportType} preparada com ${recordCount} registros.`);
            }, 800);
            return;
        }

        if (!user || !tenantId) {
            setFeedback('Nao foi possivel confirmar a sua sessao para exportacao.');
            return;
        }

        setExporting(true);

        try {
            const scopeLabel = SCOPE_OPTIONS.find((option) => option.value === exportScope)?.label || exportScope;
            const dateRange = (dateFrom || dateTo)
                ? ` (${dateFrom || '...'} a ${dateTo || '...'})`
                : '';

            if (exportType === 'CSV') {
                const csv = buildCsvContent(filteredCases);
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                const ts = new Date().toISOString().slice(0, 10);
                downloadBlob(blob, `compliancehub-export-${ts}.csv`);
            } else if (exportType === 'REPORT') {
                const html = buildBatchReportHtml(filteredCases, userProfile?.tenantName || '');
                const token = await savePublicReport(html, { type: 'batch', tenantId, tenantName: userProfile?.tenantName || '' });
                window.open(`/r/${token}`, '_blank');
            } else {
                const html = buildPdfHtml(filteredCases, scopeLabel + dateRange, userProfile?.tenantName || '');
                const token = await savePublicReport(html, { type: 'pdf-export', tenantId, tenantName: userProfile?.tenantName || '' });
                window.open(`/r/${token}`, '_blank');
            }

            await createExport({
                tenantId,
                type: exportType,
                scope: scopeLabel + dateRange,
                records: recordCount,
            });

            await logAuditEvent({
                tenantId,
                userId: user.uid,
                userEmail: user.email,
                action: 'EXPORT_CREATED',
                target: `${exportType}:${scopeLabel}${dateRange}`,
                detail: `Exportacao gerada com ${recordCount} registros`,
            });

            setFeedback('Exportacao gerada com sucesso!');
        } catch (error) {
            console.error('Error creating export:', error);
            setFeedback('Nao foi possivel gerar a exportacao agora.');
        } finally {
            setExporting(false);
        }
    };

    const history = isDemoMode ? DEMO_EXPORTS : exportsState.exports;

    return (
        <div className="export-page">
            <h2>Exportacoes</h2>

            <div className="export-new">
                <h3>Nova exportacao</h3>
                <div className="export-new__form">
                    <div className="export-new__field">
                        <label>Formato</label>
                        <div className="export-toggle-group">
                            <button type="button" className={`export-toggle ${exportType === 'CSV' ? 'export-toggle--active' : ''}`} onClick={() => setExportType('CSV')} aria-pressed={exportType === 'CSV'}>CSV</button>
                            <button type="button" className={`export-toggle ${exportType === 'PDF' ? 'export-toggle--active' : ''}`} onClick={() => setExportType('PDF')} aria-pressed={exportType === 'PDF'}>PDF</button>
                            <button type="button" className={`export-toggle ${exportType === 'REPORT' ? 'export-toggle--active' : ''}`} onClick={() => setExportType('REPORT')} aria-pressed={exportType === 'REPORT'}>Relatório</button>
                        </div>
                    </div>
                    <div className="export-new__field">
                        <label>Escopo</label>
                        <select className="export-select" value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
                            {SCOPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="export-new__field">
                        <label>De</label>
                        <input type="date" className="export-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="export-new__field">
                        <label>Ate</label>
                        <input type="date" className="export-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="export-new__field">
                        <label>Registros</label>
                        <span className="export-count">{recordCount}</span>
                    </div>
                    <button type="button" className="export-btn" onClick={handleExport} disabled={exporting || recordCount === 0}>
                        {exporting ? 'Gerando...' : 'Gerar exportacao'}
                    </button>
                </div>
                {feedback && (
                    <p role="status" aria-live="polite" style={{ marginTop: 12, fontSize: '.875rem', color: feedback.includes('sucesso') ? 'var(--green-700)' : 'var(--text-secondary)' }}>
                        {feedback}
                    </p>
                )}
            </div>

            <div className="export-history">
                <h3>Historico</h3>
                <div className="export-table-wrapper">
                    <table className="data-table" aria-label="Historico de exportacoes">
                        <thead>
                            <tr>
                                <th className="data-table__th" scope="col">ID</th>
                                <th className="data-table__th" scope="col">Formato</th>
                                <th className="data-table__th" scope="col">Escopo</th>
                                <th className="data-table__th" scope="col">Registros</th>
                                <th className="data-table__th" scope="col">Data</th>
                                <th className="data-table__th" scope="col">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exportsState.loading && !isDemoMode && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty">Carregando exportacoes...</td>
                                </tr>
                            )}
                            {!isDemoMode && !exportsState.loading && exportsState.error && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty" style={{ color: 'var(--red-700)' }}>
                                        Nao foi possivel carregar o historico de exportacoes agora.
                                    </td>
                                </tr>
                            )}
                            {(!exportsState.loading || isDemoMode) && !exportsState.error && history.map((item) => (
                                <tr key={item.id} className="data-table__row">
                                    <td className="data-table__td data-table__td--mono">{item.id}</td>
                                    <td className="data-table__td">{item.type}</td>
                                    <td className="data-table__td">{item.scope}</td>
                                    <td className="data-table__td">{item.records}</td>
                                    <td className="data-table__td">{item.createdAt}</td>
                                    <td className="data-table__td"><StatusBadge status={item.status || 'DONE'} /></td>
                                </tr>
                            ))}
                            {(!exportsState.loading || isDemoMode) && !exportsState.error && history.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="data-table__empty">Nenhuma exportacao registrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
