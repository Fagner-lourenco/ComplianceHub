import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import { useAuth } from '../../core/auth/useAuth';
import {
    callRegisterClientExport,
    subscribeToExports,
} from '../../core/firebase/firestoreService';
import { getMockCaseById, getMockExports } from '../../data/mockData';
import { useCases } from '../../hooks/useCases';
import { buildBatchReportHtml } from '../../core/reportBuilder';
import { extractErrorMessage } from '../../core/errorUtils';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import MobileDataCardList from '../../ui/components/MobileDataCardList/MobileDataCardList';
import './ExportacoesPage.css';

const SCOPE_OPTIONS = [
    { value: 'ALL', label: 'Solicitações exibidas' },
    { value: 'DONE', label: 'Solicitações concluídas' },
    { value: 'PENDING', label: 'Apenas pendentes' },
    { value: 'RED', label: 'Apenas alertas' },
];

const EXPORT_TYPE_OPTIONS = {
    CSV: { label: 'Planilha .CSV', historyLabel: 'Planilha .CSV', artifactMode: 'download' },
    PRINT: { label: 'Página para impressão', historyLabel: 'Página para impressão', artifactMode: 'printable_html' },
    REPORT: { label: 'Relatório em página web', historyLabel: 'Relatório em página web', artifactMode: 'html_blob' },
};

const LIVE_QUERY_TIMEOUT_MS = 10_000;

const STATUS_MAP = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em análise',
    WAITING_INFO: 'Aguardando informação',
    CORRECTION_NEEDED: 'Correção necessária',
    DONE: 'Concluído',
};

const RISK_MAP = {
    GREEN: 'Baixo',
    YELLOW: 'Médio',
    RED: 'Alto',
};

const VERDICT_MAP = {
    FIT: 'Recomendado',
    ATTENTION: 'Atenção',
    NOT_RECOMMENDED: 'Não recomendado',
};

const PRI_MAP = {
    NORMAL: 'Normal',
    HIGH: 'Alta',
};

const FLAG_MAP = {
    POSITIVE: 'Positivo',
    NEGATIVE: 'Negativo',
    NEGATIVE_PARTIAL: 'Negativo parcial',
    INCONCLUSIVE: 'Inconclusivo',
    INCONCLUSIVE_HOMONYM: 'Inconclusivo por homônimo',
    INCONCLUSIVE_LOW_COVERAGE: 'Inconclusivo por cobertura',
    NOT_FOUND: 'Não encontrado',
};

function escapeCsvField(value, delimiter = ';') {
    const str = String(value ?? '');
    const normalized = str.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const safe = /^[=+\-@\t\r]/.test(normalized) ? `'${normalized}` : normalized;

    if (
        safe.includes(delimiter) ||
        safe.includes('"') ||
        safe.includes('\n') ||
        safe.includes('\r')
    ) {
        return `"${safe.replace(/"/g, '""')}"`;
    }

    return safe;
}

function getCoverageLabel(c) {
    if (c.status === 'DONE') return 'Resultado disponível';
    if (c.status === 'IN_PROGRESS') return 'Em análise — resultado ainda indisponível';
    if (c.status === 'WAITING_INFO') return 'Aguardando informação complementar';
    if (c.status === 'CORRECTION_NEEDED') return 'Correção necessária antes da análise';
    return 'Resultado indisponível — caso ainda não concluído';
}

function buildMainAlerts(c) {
    const alerts = [];

    if (c.warrantFlag === 'POSITIVE') {
        alerts.push('Mandado positivo');
    }

    if (
        c.criminalFlag === 'POSITIVE' ||
        c.criminalFlag === 'INCONCLUSIVE_HOMONYM' ||
        c.criminalFlag === 'INCONCLUSIVE_LOW_COVERAGE'
    ) {
        alerts.push(`Criminal: ${FLAG_MAP[c.criminalFlag] || c.criminalFlag}`);
    }

    if (
        c.laborFlag === 'POSITIVE' ||
        c.laborFlag === 'INCONCLUSIVE_HOMONYM' ||
        c.laborFlag === 'INCONCLUSIVE_LOW_COVERAGE' ||
        c.laborFlag === 'INCONCLUSIVE'
    ) {
        alerts.push(`Trabalhista: ${FLAG_MAP[c.laborFlag] || c.laborFlag}`);
    }

    if (c.osintLevel === 'HIGH') {
        alerts.push('Perfis públicos: alto');
    }

    if (c.socialStatus === 'CONCERN' || c.socialStatus === 'CONTRAINDICATED') {
        alerts.push(`Social: ${c.socialStatus === 'CONTRAINDICATED' ? 'Contraindicado' : 'Atenção'}`);
    }

    if (c.digitalFlag === 'CRITICAL' || c.digitalFlag === 'ALERT') {
        alerts.push(`Digital: ${c.digitalFlag === 'CRITICAL' ? 'Crítico' : 'Alerta'}`);
    }

    if (c.conflictInterest === 'YES') {
        alerts.push('Conflito de interesse');
    }

    if (c.riskLevel === 'RED') {
        alerts.push('Risco alto');
    }

    if (c.finalVerdict === 'NOT_RECOMMENDED') {
        alerts.push('Não recomendado');
    }

    return alerts.length > 0 ? alerts.join(' | ') : 'Sem alerta crítico no resumo';
}

function buildOperationalNote(c) {
    if (c.status !== 'DONE') {
        return 'Solicitação ainda não concluída. Campos de atenção e resultado podem estar indisponíveis ou incompletos.';
    }

    if (c.finalVerdict === 'NOT_RECOMMENDED') {
        return 'Consultar o dossiê completo antes de qualquer decisão operacional.';
    }

    if (c.finalVerdict === 'ATTENTION') {
        return 'Revisar apontamentos e evidências no dossiê individual.';
    }

    if (c.riskLevel === 'RED') {
        return 'Risco alto identificado. Exige revisão individual.';
    }

    if (c.riskLevel === 'YELLOW') {
        return 'Risco intermediário. Recomenda-se revisão do dossiê.';
    }

    if (c.finalVerdict === 'FIT') {
        return 'Sem alerta impeditivo no resumo. Consultar dossiê para detalhes.';
    }

    return 'Consultar dossiê individual para interpretação completa.';
}

function buildCsvContent(rows) {
    const delimiter = ';';

    const headers = [
        'Nº',
        'Nome',
        'CPF',
        'Cargo',
        'Data da solicitação',
        'Situação',
        'Cobertura',
        'Prioridade',
        'Risco',
        'Nível de atenção',
        'Resultado',
        'Alertas principais',
        'Observação operacional',
        'Parecer do analista',
    ];

    const lines = [
        `sep=${delimiter}`,
        headers.map((header) => escapeCsvField(header, delimiter)).join(delimiter),
    ];

    rows.forEach((c, index) => {
        const row = [
            index + 1,
            c.candidateName || '',
            c.cpfMasked || '',
            c.candidatePosition || 'Cargo não informado',
            c.createdAt || '',
            STATUS_MAP[c.status] || c.status || '',
            getCoverageLabel(c),
            PRI_MAP[c.priority] || c.priority || '',
            RISK_MAP[c.riskLevel] || c.riskLevel || '',
            c.riskScore ?? '',
            VERDICT_MAP[c.finalVerdict] || c.finalVerdict || '',
            buildMainAlerts(c),
            buildOperationalNote(c),
            c.analystComment || '',
        ];

        lines.push(row.map((value) => escapeCsvField(value, delimiter)).join(delimiter));
    });

    return lines.join('\r\n');
}

function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPrintableHtml(rows, scopeLabel, tenantName) {
    const now = new Date();
    const nowLabel = now.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

    const statusMap = {
        PENDING: 'Pendente',
        IN_PROGRESS: 'Em análise',
        WAITING_INFO: 'Aguardando info',
        CORRECTION_NEEDED: 'Correção necessária',
        DONE: 'Concluído',
    };

    const riskMap = {
        GREEN: 'Baixo',
        YELLOW: 'Médio',
        RED: 'Alto',
    };

    const verdictMap = {
        FIT: 'Recomendado',
        ATTENTION: 'Atenção',
        NOT_RECOMMENDED: 'Não recomendado',
    };

    const summary = {
        total: rows.length,
        done: rows.filter((r) => r.status === 'DONE').length,
        pending: rows.filter((r) => r.status !== 'DONE').length,
        red: rows.filter((r) => r.riskLevel === 'RED').length,
        yellow: rows.filter((r) => r.riskLevel === 'YELLOW').length,
        green: rows.filter((r) => r.riskLevel === 'GREEN').length,
        attention: rows.filter((r) => r.finalVerdict === 'ATTENTION').length,
        notRecommended: rows.filter((r) => r.finalVerdict === 'NOT_RECOMMENDED').length,
    };

    const badge = (label, tone = 'neutral') => (
        `<span class="badge badge--${tone}">${esc(label || '-')}</span>`
    );

    const statusBadge = (status) => {
        const label = statusMap[status] || status || '-';
        if (status === 'DONE') return badge(label, 'success');
        if (status === 'PENDING') return badge(label, 'muted');
        if (status === 'WAITING_INFO' || status === 'CORRECTION_NEEDED') return badge(label, 'warning');
        if (status === 'IN_PROGRESS') return badge(label, 'info');
        return badge(label, 'neutral');
    };

    const riskBadge = (risk) => {
        const label = riskMap[risk] || risk || '-';
        if (risk === 'RED') return badge(label, 'danger');
        if (risk === 'YELLOW') return badge(label, 'warning');
        if (risk === 'GREEN') return badge(label, 'success');
        return badge(label, 'muted');
    };

    const verdictBadge = (verdict) => {
        const label = verdictMap[verdict] || verdict || '-';
        if (verdict === 'FIT') return badge(label, 'success');
        if (verdict === 'ATTENTION') return badge(label, 'warning');
        if (verdict === 'NOT_RECOMMENDED') return badge(label, 'danger');
        return badge(label, 'muted');
    };

    const coverageLabel = (item) => (
        item.status === 'DONE'
            ? 'Resultado disponível'
            : 'Resultado indisponível — caso ainda não concluído'
    );

    const tableRows = rows.map((c, index) => `<tr>
        <td class="col-index">${index + 1}</td>
        <td>
            <div class="person">
                <strong>${esc(c.candidateName || '-')}</strong>
                <span>${esc(c.candidatePosition || 'Cargo não informado')}</span>
            </div>
        </td>
        <td>${esc(c.cpfMasked || '-')}</td>
        <td>${statusBadge(c.status)}</td>
        <td><span class="coverage">${esc(coverageLabel(c))}</span></td>
        <td>${riskBadge(c.riskLevel)}</td>
        <td class="score">${esc(c.riskScore ?? '-')}</td>
        <td>${verdictBadge(c.finalVerdict)}</td>
        <td>${esc(c.createdAt || '-')}</td>
    </tr>`).join('');

    const pendingWarning = summary.pending > 0
        ? `<section class="notice notice--warning">
            <strong>Atenção sobre cobertura analítica</strong>
            <span>Este pacote contém ${summary.pending} caso(s) sem resultado final. Campos vazios ou indisponíveis indicam que a análise ainda não foi concluída, e não ausência de risco.</span>
        </section>`
        : '';

    const redWarning = summary.red > 0 || summary.notRecommended > 0
        ? `<section class="notice notice--danger">
            <strong>Alerta operacional</strong>
            <span>O recorte contém ${summary.red} solicitação(ões) com atenção alta e ${summary.notRecommended} solicitação(ões) com resultado não recomendado. Consulte o dossiê individual antes de qualquer decisão final.</span>
        </section>`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Exportar solicitações - ComplianceHub</title>
<style>
*{
    box-sizing:border-box;
}
:root{
    --ink:#0f172a;
    --muted:#64748b;
    --soft:#f8fafc;
    --line:#e2e8f0;
    --brand:#1d6fe5;
    --brand-dark:#164fb8;
    --teal:#0f766e;
    --green:#15803d;
    --green-bg:#ecfdf5;
    --yellow:#a16207;
    --yellow-bg:#fffbeb;
    --red:#b91c1c;
    --red-bg:#fef2f2;
    --blue:#1d4ed8;
    --blue-bg:#eff6ff;
    --slate-bg:#f1f5f9;
}
html,
body{
    margin:0;
    min-height:100%;
}
body{
    font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    color:var(--ink);
    background:
        radial-gradient(circle at top left, rgba(29,111,229,.12), transparent 32%),
        linear-gradient(180deg,#eef4fb 0%,#f8fafc 100%);
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
}
body::before{
    content:"CONFIDENCIAL";
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%,-50%) rotate(-45deg);
    transform-origin:center;
    z-index:0;
    pointer-events:none;
    white-space:nowrap;
    font-size:86px;
    line-height:1;
    font-weight:900;
    letter-spacing:.12em;
    color:rgba(15,23,42,.045);
    text-transform:uppercase;
    user-select:none;
}
.page{
    position:relative;
    z-index:1;
    width:min(1180px, calc(100% - 48px));
    margin:24px auto;
    background:rgba(255,255,255,.96);
    border:1px solid rgba(148,163,184,.35);
    border-radius:22px;
    box-shadow:0 24px 70px rgba(15,23,42,.14);
    overflow:hidden;
}
.report-topbar{
    height:8px;
    background:linear-gradient(90deg,var(--brand),var(--teal));
}
.header{
    display:flex;
    justify-content:space-between;
    gap:28px;
    padding:30px 34px 24px;
    border-bottom:1px solid var(--line);
    background:
        linear-gradient(135deg, rgba(29,111,229,.08), rgba(15,118,110,.05)),
        #ffffff;
}
.brand-block{
    display:flex;
    flex-direction:column;
    gap:8px;
    max-width:720px;
}
.eyebrow{
    display:inline-flex;
    align-items:center;
    width:max-content;
    padding:5px 9px;
    border-radius:999px;
    background:var(--blue-bg);
    color:var(--blue);
    font-size:10px;
    font-weight:900;
    letter-spacing:.09em;
    text-transform:uppercase;
}
.brand{
    font-size:24px;
    font-weight:900;
    letter-spacing:-.03em;
}
.title{
    margin:0;
    font-size:18px;
    font-weight:850;
}
.lead{
    margin:0;
    color:var(--muted);
    font-size:12.5px;
    line-height:1.55;
}
.header-meta{
    min-width:230px;
    padding:14px;
    border:1px solid var(--line);
    border-radius:16px;
    background:rgba(255,255,255,.72);
}
.header-meta__item{
    display:flex;
    justify-content:space-between;
    gap:12px;
    padding:6px 0;
    border-bottom:1px dashed #dbe3ef;
    font-size:11px;
}
.header-meta__item:last-child{
    border-bottom:0;
}
.header-meta__item span{
    color:var(--muted);
}
.header-meta__item strong{
    text-align:right;
    font-weight:800;
}
.content{
    padding:24px 34px 30px;
}
.scope-card{
    display:grid;
    grid-template-columns:1.4fr .9fr;
    gap:14px;
    margin-bottom:18px;
}
.scope-card__main,
.scope-card__side{
    border:1px solid var(--line);
    border-radius:18px;
    background:#fff;
    padding:16px;
}
.scope-card h2{
    margin:0 0 8px;
    font-size:15px;
}
.scope-card p{
    margin:0;
    color:var(--muted);
    font-size:12px;
    line-height:1.55;
}
.scope-list{
    display:grid;
    gap:8px;
}
.scope-list div{
    display:flex;
    justify-content:space-between;
    gap:12px;
    font-size:12px;
}
.scope-list span{
    color:var(--muted);
}
.scope-list strong{
    text-align:right;
}
.kpis{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:12px;
    margin:0 0 18px;
}
.kpi{
    position:relative;
    overflow:hidden;
    border:1px solid var(--line);
    border-radius:18px;
    background:#fff;
    padding:15px;
}
.kpi::after{
    content:"";
    position:absolute;
    right:-24px;
    top:-24px;
    width:70px;
    height:70px;
    border-radius:999px;
    background:rgba(29,111,229,.08);
}
.kpi strong{
    display:block;
    font-size:27px;
    line-height:1;
    font-weight:900;
    letter-spacing:-.04em;
}
.kpi span{
    display:block;
    margin-top:6px;
    color:var(--muted);
    font-size:11px;
    font-weight:800;
    text-transform:uppercase;
    letter-spacing:.05em;
}
.kpi--success strong{color:var(--green)}
.kpi--warning strong{color:var(--yellow)}
.kpi--danger strong{color:var(--red)}
.kpi--info strong{color:var(--blue)}
.notices{
    display:grid;
    gap:10px;
    margin-bottom:18px;
}
.notice{
    display:grid;
    gap:3px;
    padding:12px 14px;
    border-radius:16px;
    font-size:12px;
    line-height:1.5;
    border:1px solid var(--line);
}
.notice strong{
    font-size:12px;
}
.notice span{
    color:#475569;
}
.notice--warning{
    background:var(--yellow-bg);
    border-color:#fde68a;
    color:var(--yellow);
}
.notice--danger{
    background:var(--red-bg);
    border-color:#fecaca;
    color:var(--red);
}
.notice--info{
    background:var(--blue-bg);
    border-color:#bfdbfe;
    color:var(--blue);
}
.table-wrap{
    border:1px solid var(--line);
    border-radius:18px;
    overflow:hidden;
    background:#fff;
}
table{
    width:100%;
    border-collapse:collapse;
    font-size:11.5px;
}
thead{
    display:table-header-group;
}
th{
    background:#f8fafc;
    color:#475569;
    text-align:left;
    font-size:9.5px;
    font-weight:900;
    text-transform:uppercase;
    letter-spacing:.07em;
    padding:11px 10px;
    border-bottom:1px solid var(--line);
}
td{
    padding:11px 10px;
    border-bottom:1px solid #edf2f7;
    vertical-align:top;
}
tr:last-child td{
    border-bottom:0;
}
tr{
    break-inside:avoid;
    page-break-inside:avoid;
}
.col-index{
    width:34px;
    color:#94a3b8;
    font-weight:800;
}
.person{
    display:grid;
    gap:3px;
}
.person strong{
    font-size:12px;
}
.person span{
    color:var(--muted);
    font-size:10.5px;
}
.score{
    font-weight:900;
    color:#172033;
}
.coverage{
    color:#475569;
    line-height:1.4;
}
.badge{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:23px;
    padding:4px 8px;
    border-radius:999px;
    font-size:10px;
    font-weight:900;
    line-height:1;
    white-space:nowrap;
    border:1px solid transparent;
}
.badge--success{
    color:var(--green);
    background:var(--green-bg);
    border-color:#bbf7d0;
}
.badge--warning{
    color:var(--yellow);
    background:var(--yellow-bg);
    border-color:#fde68a;
}
.badge--danger{
    color:var(--red);
    background:var(--red-bg);
    border-color:#fecaca;
}
.badge--info{
    color:var(--blue);
    background:var(--blue-bg);
    border-color:#bfdbfe;
}
.badge--muted,
.badge--neutral{
    color:#475569;
    background:var(--slate-bg);
    border-color:#e2e8f0;
}
.legend{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    align-items:center;
    margin-top:12px;
    color:var(--muted);
    font-size:10.5px;
}
.footer{
    display:flex;
    justify-content:space-between;
    gap:20px;
    padding:16px 34px 22px;
    border-top:1px solid var(--line);
    color:var(--muted);
    font-size:10.5px;
    background:#fbfdff;
}
.print{
    position:fixed;
    right:18px;
    bottom:18px;
    z-index:20;
    border:0;
    border-radius:999px;
    background:linear-gradient(135deg,var(--brand),var(--brand-dark));
    color:#fff;
    padding:12px 18px;
    font-weight:850;
    box-shadow:0 14px 35px rgba(29,111,229,.28);
    cursor:pointer;
}
.print:hover{
    transform:translateY(-1px);
}
@media print{
    @page{
        size:A4 landscape;
        margin:10mm;
    }
    html,
    body{
        background:#fff !important;
    }
    body::before{
        color:rgba(15,23,42,.055);
    }
    .page{
        width:auto;
        margin:0;
        border:0;
        border-radius:0;
        box-shadow:none;
        overflow:visible;
    }
    .header,
    .content,
    .footer{
        padding-left:0;
        padding-right:0;
    }
    .print{
        display:none;
    }
    .scope-card,
    .kpis,
    .notice,
    .table-wrap,
    .footer{
        break-inside:avoid-page;
        page-break-inside:avoid;
    }
    tr{
        break-inside:avoid-page;
        page-break-inside:avoid;
    }
}
</style>
</head>
<body>
<main class="page">
    <div class="report-topbar"></div>

    <header class="header">
        <div class="brand-block">
            <span class="eyebrow">Documento confidencial</span>
            <div class="brand">ComplianceHub</div>
            <h1 class="title">Exportar solicitações</h1>
            <p class="lead">
                Este documento consolida as solicitações carregadas no portal no momento da geração.
                O recorte abaixo não substitui o relatório individual de cada candidato e deve ser usado como índice operacional para conferência, triagem e prestação de contas.
            </p>
        </div>

        <aside class="header-meta" aria-label="Detalhes do arquivo">
            <div class="header-meta__item"><span>Empresa</span><strong>${esc(tenantName || 'Não informado')}</strong></div>
            <div class="header-meta__item"><span>Gerado em</span><strong>${esc(nowLabel)}</strong></div>
            <div class="header-meta__item"><span>Formato</span><strong>HTML imprimível</strong></div>
            <div class="header-meta__item"><span>Classificação</span><strong>Confidencial</strong></div>
        </aside>
    </header>

    <section class="content">
        <div class="scope-card">
            <div class="scope-card__main">
                <h2>Escopo e leitura correta</h2>
                <p>
                    A exportação considera apenas os registros atualmente carregados no navegador e os filtros aplicados pelo usuário.
                    Casos sem resultado final aparecem com cobertura indisponível para evitar interpretação equivocada dos campos analíticos.
                </p>
            </div>
            <div class="scope-card__side">
                <div class="scope-list">
                    <div><span>Escopo aplicado</span><strong>${esc(scopeLabel)}</strong></div>
                    <div><span>Total incluído</span><strong>${summary.total} solicitação(ões)</strong></div>
                    <div><span>Concluídas</span><strong>${summary.done}</strong></div>
                    <div><span>Sem resultado final</span><strong>${summary.pending}</strong></div>
                </div>
            </div>
        </div>

        <section class="kpis" aria-label="Resumo do arquivo">
            <div class="kpi kpi--info"><strong>${summary.total}</strong><span>Total no recorte</span></div>
            <div class="kpi kpi--success"><strong>${summary.done}</strong><span>Concluídas</span></div>
            <div class="kpi kpi--warning"><strong>${summary.pending}</strong><span>Sem resultado</span></div>
            <div class="kpi kpi--danger"><strong>${summary.red}</strong><span>Alertas altos</span></div>
        </section>

        <div class="notices">
            <section class="notice notice--info">
                <strong>Orientação de uso</strong>
                <span>Use este resumo para acompanhamento gerencial. Para decisão individual, abra o dossiê completo do candidato e revise as evidências, fontes e observações do analista.</span>
            </section>
            ${pendingWarning}
            ${redWarning}
        </div>

        <section class="table-wrap" aria-label="Tabela de solicitações exportadas">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Nome</th>
                        <th>CPF</th>
                        <th>Situação</th>
                        <th>Cobertura</th>
                        <th>Risco</th>
                        <th>Nível de atenção</th>
                        <th>Resultado</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </section>

        <div class="legend">
            <strong>Legenda:</strong>
            ${badge('Baixo/Recomendado', 'success')}
            ${badge('Atenção/Pendente', 'warning')}
            ${badge('Alto/Não recomendado', 'danger')}
            ${badge('Em análise', 'info')}
            ${badge('Indisponível', 'muted')}
        </div>
    </section>

    <footer class="footer">
        <span>ComplianceHub · Documento confidencial</span>
        <span>Gerado em ${esc(nowLabel)}</span>
    </footer>
</main>

<button class="print" onclick="window.print()">Imprimir / salvar PDF</button>
</body>
</html>`;
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

function openHtmlBlob(html) {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function artifactLabel(item) {
    if (item.artifactUrl) return 'Artefato armazenado';
    return 'Gerado localmente - não armazenado';
}

export default function ExportacoesPage() {
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const tenantId = userProfile?.tenantId || null;
    const { cases, loading: casesLoading, error: casesError } = useCases();
    const [exportType, setExportType] = useState('CSV');
    const [exportScope, setExportScope] = useState('ALL');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exporting, setExporting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const demoTimerRef = useRef(null);
    const [exportsState, setExportsState] = useState({
        exports: isDemoMode ? getMockExports(tenantId) : [],
        loading: !isDemoMode,
        error: null,
    });

    useEffect(() => {
        if (isDemoMode || !tenantId) {
            setExportsState({ exports: isDemoMode ? getMockExports(tenantId) : [], loading: false, error: null });
            return undefined;
        }
        setExportsState((currentState) => ({ ...currentState, loading: true, error: null }));
        const timeoutId = window.setTimeout(() => {
            setExportsState((currentState) => (
                currentState.loading
                    ? { exports: [], loading: false, error: new Error('Tempo esgotado ao carregar o histórico de exportações.') }
                    : currentState
            ));
        }, LIVE_QUERY_TIMEOUT_MS);
        const unsubscribe = subscribeToExports(tenantId, (data, error) => {
            window.clearTimeout(timeoutId);
            setExportsState({ exports: data, loading: false, error: error || null });
        });
        return () => {
            window.clearTimeout(timeoutId);
            unsubscribe();
        };
    }, [isDemoMode, tenantId]);

    useEffect(() => () => {
        if (demoTimerRef.current) window.clearTimeout(demoTimerRef.current);
    }, []);

    const filteredCases = useMemo(() => {
        let result = [...cases];
        if (exportScope === 'DONE') result = result.filter((c) => c.status === 'DONE');
        if (exportScope === 'PENDING') result = result.filter((c) => c.status === 'PENDING');
        if (exportScope === 'RED') result = result.filter((c) => c.riskLevel === 'RED');
        if (dateFrom) result = result.filter((c) => (c.createdAt || '').slice(0, 10) >= dateFrom);
        if (dateTo) result = result.filter((c) => (c.createdAt || '').slice(0, 10) <= dateTo);
        return result;
    }, [cases, exportScope, dateFrom, dateTo]);

    const recordCount = filteredCases.length;
    const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
    const pendingCount = filteredCases.filter((currentCase) => currentCase.status !== 'DONE').length;
    const scopeLabel = SCOPE_OPTIONS.find((option) => option.value === exportScope)?.label || exportScope;
    const dateRange = (dateFrom || dateTo) ? ` (${dateFrom || '...'} a ${dateTo || '...'})` : '';
    const exportTypeConfig = EXPORT_TYPE_OPTIONS[exportType] || EXPORT_TYPE_OPTIONS.CSV;
    const history = isDemoMode ? getMockExports(tenantId) : exportsState.exports;

    const prepareExportArtifact = () => {
        const ts = new Date().toISOString().slice(0, 10);
        if (exportType === 'CSV') {
            return {
                mode: 'download',
                blob: new Blob(['\uFEFF' + buildCsvContent(filteredCases)], { type: 'text/csv;charset=utf-8' }),
                filename: `${isDemoMode ? 'compliancehub-demo-resumo' : 'compliancehub-resumo-exportacao'}-${ts}.csv`,
            };
        }
        if (exportType === 'REPORT') {
            return { mode: 'html', html: buildBatchReportHtml(filteredCases, userProfile?.tenantName || (isDemoMode ? 'Demo' : '')) };
        }
        return { mode: 'html', html: buildPrintableHtml(filteredCases, scopeLabel + dateRange, userProfile?.tenantName || (isDemoMode ? 'Demo' : '')) };
    };

    const deliverPreparedExport = (prepared) => {
        if (prepared.mode === 'download') {
            downloadBlob(prepared.blob, prepared.filename);
            return;
        }
        openHtmlBlob(prepared.html);
    };

    const handleExport = async () => {
        setFeedback('');
        if (casesLoading) {
            setFeedback('Aguarde o carregamento dos casos antes de gerar a exportação.');
            return;
        }
        if (casesError) {
            setFeedback('Não foi possível carregar os casos. A exportação foi bloqueada para evitar arquivo incompleto.');
            return;
        }
        if (invalidDateRange) {
            setFeedback('A data inicial não pode ser posterior à data final.');
            return;
        }
        if (recordCount === 0) {
            setFeedback('Não há registros carregados disponíveis para este recorte.');
            return;
        }

        if (isDemoMode) {
            setExporting(true);
            demoTimerRef.current = window.setTimeout(() => {
                try {
                    deliverPreparedExport(prepareExportArtifact());
                    setFeedback(`${exportTypeConfig.historyLabel} registrado na auditoria e gerado com ${recordCount} registro(s).`);
                } catch (demoError) {
                    setFeedback(extractErrorMessage(demoError, 'Erro ao gerar exportação demo.'));
                } finally {
                    setExporting(false);
                }
            }, 600);
            return;
        }

        if (!user || !tenantId) {
            setFeedback('Não foi possível confirmar a sua sessão para exportação.');
            return;
        }

        setExporting(true);
        try {
            const prepared = prepareExportArtifact();
            await callRegisterClientExport({
                type: exportType,
                scopeCode: exportScope,
                scope: scopeLabel + dateRange,
                records: recordCount,
                artifactMode: exportTypeConfig.artifactMode,
                filters: { status: exportScope, dateFrom: dateFrom || null, dateTo: dateTo || null },
                containsPending: pendingCount > 0,
            });
            deliverPreparedExport(prepared);
            setFeedback(`${exportTypeConfig.historyLabel} registrado na auditoria e gerado com sucesso.`);
        } catch (error) {
            console.error('Error creating export:', error);
            setFeedback(extractErrorMessage(error, 'Não foi possível registrar a exportação. Nenhum arquivo foi entregue.'));
        } finally {
            setExporting(false);
        }
    };

    const openHistoryArtifact = (item) => {
        const caseData = item?.artifactCaseId ? getMockCaseById(item.artifactCaseId) : null;
        if (!caseData) return;
        openHtmlBlob(buildBatchReportHtml([caseData], caseData.tenantName || 'Demo'));
    };

    return (
        <PageShell size="default" className="export-page">
            <PageHeader
                eyebrow="Arquivos"
                title="Exportar solicitações"
                description="Gere arquivos com os dados permitidos para acompanhamento e conferência."
                metric={{ value: cases.length, label: 'Casos carregados' }}
            />

            <div className="export-new">
                <h3>Nova exportação</h3>
                <p className="export-new__hint">
                    Esta exportação considera apenas os resultados carregados agora. Para períodos maiores, solicite uma exportação completa ao suporte.
                </p>
                {casesLoading && <p className="export-alert export-alert--info">Carregando solicitações antes de liberar a exportação.</p>}
                {casesError && <p className="export-alert export-alert--danger">{extractErrorMessage(casesError, 'Não foi possível carregar as solicitações para exportação.')}</p>}
                {invalidDateRange && <p className="export-alert export-alert--danger">A data inicial não pode ser posterior à data final.</p>}
                {pendingCount > 0 && !casesLoading && !casesError && (
                    <p className="export-alert export-alert--warning">
                        Este recorte inclui {pendingCount} solicitação(ões) sem resultado final. O CSV identificará a cobertura analítica para evitar interpretação ambígua.
                    </p>
                )}

                <div className="export-new__form">
                    <div className="export-new__field">
                        <label>Formato</label>
                        <div className="export-toggle-group">
                            {Object.entries(EXPORT_TYPE_OPTIONS).map(([value, config]) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`export-toggle ${exportType === value ? 'export-toggle--active' : ''}`}
                                    onClick={() => setExportType(value)}
                                    aria-pressed={exportType === value}
                                >
                                    {config.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="export-new__field">
                        <label htmlFor="export-scope">Escopo</label>
                        <select id="export-scope" className="export-select" value={exportScope} onChange={(event) => setExportScope(event.target.value)}>
                            {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </div>
                    <div className="export-new__field">
                        <label htmlFor="export-date-from">De</label>
                        <input id="export-date-from" type="date" className="export-select" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="export-new__field">
                        <label htmlFor="export-date-to">Até</label>
                        <input id="export-date-to" type="date" className="export-select" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="export-new__field">
                        <label>Registros disponíveis</label>
                        <span className="export-count">{casesLoading ? '...' : recordCount}</span>
                    </div>
                    <button type="button" className="export-btn" onClick={handleExport} disabled={exporting || casesLoading || Boolean(casesError) || invalidDateRange || recordCount === 0}>
                        {exporting ? 'Registrando...' : 'Registrar e gerar'}
                    </button>
                </div>
                {feedback && <p role="status" aria-live="polite" className="export-feedback">{feedback}</p>}
            </div>

            <div className="export-history">
                <h3>Arquivos gerados</h3>
                <MobileDataCardList
                    items={history}
                    loading={exportsState.loading && !isDemoMode}
                    emptyMessage={exportsState.error ? extractErrorMessage(exportsState.error, 'Não foi possível carregar o histórico de exportações agora.') : 'Nenhuma exportação registrada.'}
                    renderCard={(item) => (
                        <>
                            <div className="mobile-card__header">
                                <div className="mobile-card__title">{EXPORT_TYPE_OPTIONS[item.type]?.historyLabel || item.type}</div>
                                <StatusBadge status={item.status || 'DONE'} />
                            </div>
                            <div className="mobile-card__meta">
                                <span className="mobile-card__meta-item">{item.scope}</span>
                                <span className="mobile-card__meta-item">{item.records} solicitação(ões)</span>
                                <span className="mobile-card__meta-item">{item.createdAt}</span>
                                <span className="mobile-card__meta-item">Gerado por: {item.createdByName || item.createdByEmail || 'Não informado'}</span>
                            </div>
                            <div className="mobile-card__actions">
                                {isDemoMode && item.artifactCaseId ? (
                                    <button type="button" className="export-btn export-btn--compact" onClick={() => openHistoryArtifact(item)}>Abrir demo</button>
                                ) : (
                                    <span className="export-artifact-note">{artifactLabel(item)}</span>
                                )}
                            </div>
                        </>
                    )}
                >
                    <div className="export-table-wrapper">
                        <table className="data-table" aria-label="Histórico de exportações">
                            <thead>
                                <tr>
                                    <th className="data-table__th" scope="col">ID</th>
                                    <th className="data-table__th" scope="col">Formato</th>
                                    <th className="data-table__th" scope="col">Escopo</th>
                                    <th className="data-table__th" scope="col">Solicitações</th>
                                    <th className="data-table__th" scope="col">Gerado por</th>
                                    <th className="data-table__th" scope="col">Data</th>
                                    <th className="data-table__th" scope="col">Status</th>
                                    <th className="data-table__th" scope="col">Artefato</th>
                                </tr>
                            </thead>
                            <tbody>
                                {exportsState.loading && !isDemoMode && Array.from({ length: 3 }, (_, i) => (
                                    <tr key={`sk-${i}`} aria-hidden="true">
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: `${50 + (i % 3) * 15}%` }} /></td>
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 72 }} /></td>
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 60 }} /></td>
                                        <td className="data-table__td"><div className="skeleton" style={{ width: 56, height: 20, borderRadius: 10 }} /></td>
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 50 }} /></td>
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 44 }} /></td>
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 40 }} /></td>
                                        <td className="data-table__td"><div className="skeleton skeleton--text" style={{ width: 36 }} /></td>
                                    </tr>
                                ))}
                                {!isDemoMode && !exportsState.loading && exportsState.error && (
                                    <tr><td colSpan={8} className="data-table__empty export-error">{extractErrorMessage(exportsState.error, 'Não foi possível carregar o histórico de exportações agora.')}</td></tr>
                                )}
                                {(!exportsState.loading || isDemoMode) && !exportsState.error && history.map((item) => (
                                    <tr key={item.id} className="data-table__row">
                                        <td className="data-table__td data-table__td--mono">{item.id}</td>
                                        <td className="data-table__td">{EXPORT_TYPE_OPTIONS[item.type]?.historyLabel || item.type}</td>
                                        <td className="data-table__td">{item.scope}</td>
                                        <td className="data-table__td">{item.records}</td>
                                        <td className="data-table__td">{item.createdByName || item.createdByEmail || 'Não informado'}</td>
                                        <td className="data-table__td">{item.createdAt}</td>
                                        <td className="data-table__td"><StatusBadge status={item.status || 'DONE'} /></td>
                                        <td className="data-table__td">
                                            {isDemoMode && item.artifactCaseId ? (
                                                <button type="button" className="export-btn export-btn--compact" onClick={() => openHistoryArtifact(item)}>Abrir demo</button>
                                            ) : (
                                                <span className="export-artifact-note">{artifactLabel(item)}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {(!exportsState.loading || isDemoMode) && !exportsState.error && history.length === 0 && (
                                    <tr><td colSpan={8} className="data-table__empty">Nenhuma exportação registrada.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </MobileDataCardList>
            </div>
        </PageShell>
    );
}
