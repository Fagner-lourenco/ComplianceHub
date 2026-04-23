/* Report builder — standalone HTML for print / PDF export */

export const REPORT_BUILD_VERSION = 2;

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const CRIMINAL_LABEL  = { POSITIVE: 'Positivo', NEGATIVE: 'Negativo', INCONCLUSIVE: 'Inconclusivo', NOT_FOUND: 'Não Encontrado' };
const LABOR_LABEL     = { ...CRIMINAL_LABEL };
const WARRANT_LABEL   = { POSITIVE: 'Positivo', NEGATIVE: 'Negativo', NOT_FOUND: 'Não Encontrado' };
const OSINT_LABEL     = { LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto', UNKNOWN: 'Desconhecido' };
const SOCIAL_LABEL    = { APPROVED: 'Aprovado', NEUTRAL: 'Neutro', CONCERN: 'Atenção', CONTRAINDICATED: 'Contraindicado' };
const DIGITAL_LABEL   = { CLEAN: 'Limpo', ALERT: 'Alerta', CRITICAL: 'Crítico', NOT_CHECKED: 'Não Verificado' };
const CONFLICT_LABEL  = { YES: 'Sim', NO: 'Não', UNKNOWN: 'Desconhecido' };
const VERDICT_LABEL   = { FIT: 'Recomendado', ATTENTION: 'Atenção', NOT_RECOMMENDED: 'Não Recomendado' };
const RISK_LEVEL_LABEL = { GREEN: 'Baixo', YELLOW: 'Médio', RED: 'Alto' };
const PRIORITY_LABEL  = { NORMAL: 'Normal', HIGH: 'Alta' };
const SEVERITY_LABEL  = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta' };

Object.assign(CRIMINAL_LABEL, {
    NEGATIVE_PARTIAL: 'Negativo parcial',
    INCONCLUSIVE_HOMONYM: 'Inconclusivo por homonimo',
    INCONCLUSIVE_LOW_COVERAGE: 'Inconclusivo por cobertura',
});
Object.assign(LABOR_LABEL, {
    NEGATIVE_PARTIAL: 'Negativo parcial',
    INCONCLUSIVE_HOMONYM: 'Inconclusivo por homonimo',
    INCONCLUSIVE_LOW_COVERAGE: 'Inconclusivo por cobertura',
});
Object.assign(WARRANT_LABEL, {
    INCONCLUSIVE: 'Inconclusivo',
});

function formatDateBR(value) {
    if (!value) return '';
    try {
        const d = typeof value === 'string' ? new Date(value) : value.toDate ? value.toDate() : new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    } catch { return String(value); }
}

function flagColor(v) {
    if (['POSITIVE','CRITICAL','CONTRAINDICATED','NOT_RECOMMENDED','YES'].includes(v)) return 'red';
    if (['INCONCLUSIVE','INCONCLUSIVE_HOMONYM','INCONCLUSIVE_LOW_COVERAGE','NEGATIVE_PARTIAL','CONCERN','ATTENTION','ALERT','MEDIUM','UNKNOWN','NOT_CHECKED'].includes(v)) return 'yellow';
    if (['NEGATIVE','APPROVED','FIT','CLEAN','LOW','NOT_FOUND','NO','NEUTRAL'].includes(v)) return 'green';
    return 'gray';
}
function rlColor(l) { return l === 'RED' ? 'red' : l === 'YELLOW' ? 'yellow' : l === 'GREEN' ? 'green' : 'gray'; }
function sbColor(s) { return s >= 70 ? '#ef4444' : s >= 30 ? '#f59e0b' : '#22c55e'; }

function fieldHtml(label, value) {
    if (!value && value !== 0) return '';
    return `<div class="f"><div class="f__l">${esc(label)}</div><div class="f__v">${esc(value)}</div></div>`;
}

function badge(value, label) {
    return `<span class="b b--${flagColor(value)}">${esc(label)}</span>`;
}

function maskCpfValue(value) {
    if (!value) return '';
    const digits = String(value).replace(/\D/g, '');
    if (digits.length !== 11) return String(value);
    return `***.***.***-${digits.slice(9)}`;
}

function isLikelyUid(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(value);
}

function formatRequestedBy(caseData) {
    const email = caseData.requestedByEmail;
    const name = caseData.requestedByName;
    const fallback = caseData.requestedBy;

    if (email && name) return `${name} (${email})`;
    if (email) return email;
    if (name) return name;
    if (!fallback || isLikelyUid(fallback)) return 'Usuário interno';
    return fallback;
}

function socialLinkHtml(href, label, icon) {
    if (!href) return '';
    const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
    if (!/^https?:\/\//i.test(url)) return '';
    return `<a href="${esc(url)}" class="slink" target="_blank" rel="noopener noreferrer">${icon} ${esc(label)}</a>`;
}

function phaseRow(icon, name, resultBadge, sevBadge, notes, tags, color) {
    return `<div class="pr pr--${color}">
  <div class="pr__top"><div class="pr__left"><span class="pr__icon">${icon}</span><span class="pr__name">${esc(name)}</span></div><div>${resultBadge}</div></div>
  ${sevBadge ? `<div class="pr__sev"><span class="pr__sev-label">Severidade:</span> ${sevBadge}</div>` : ''}
  ${notes ? `<div class="pr__notes">${esc(notes)}</div>` : ''}
  ${tags.length ? `<div class="pr__tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
</div>`;
}

function listBlock(title, items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return `<div class="sec"><div class="sec__t">${esc(title)}</div><ul class="blist">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>`;
}

function processHighlightsHtml(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return `<div class="sec"><div class="sec__t">Apontamentos Relevantes</div><div class="hlist">${items.map((group) => `
        <div class="hcard">
            <div class="hcard__top">
                <div>
                    <strong>${esc(group.title || group.area || 'Achado')}</strong>
                    ${group.source ? `<span class="hcard__meta">${esc(group.source)}</span>` : ''}
                </div>
                ${group.total !== undefined ? `<span class="hcard__count">${esc(group.total)}</span>` : ''}
            </div>
            ${group.summary ? `<p class="hcard__summary">${esc(group.summary)}</p>` : ''}
            ${Array.isArray(group.items) && group.items.length > 0 ? `<div class="hcard__items">${group.items.map((item) => `
                <div class="hcard__item">
                    <div class="hcard__item-top">
                        <span>${esc(item.processNumber || item.reference || item.classification || 'Registro')}</span>
                        ${item.status ? `<span class="tag">${esc(item.status)}</span>` : ''}
                    </div>
                    <div class="hcard__item-body">${[item.court, item.classification, item.stage].filter(Boolean).map((part) => esc(part)).join(' · ')}</div>
                    ${item.impact ? `<div class="hcard__impact">${esc(item.impact)}</div>` : ''}
                </div>
            `).join('')}</div>` : ''}
        </div>
    `).join('')}</div></div>`;
}

function warrantFindingsHtml(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return `<div class="sec"><div class="sec__t">Situação de Mandados</div><div class="hlist">${items.map((item) => `
        <div class="hcard">
            <div class="hcard__top">
                <strong>${esc(item.status || 'Sem status')}</strong>
                ${item.source ? `<span class="hcard__meta">${esc(item.source)}</span>` : ''}
            </div>
            ${[item.court, item.reference].filter(Boolean).length > 0 ? `<div class="hcard__item-body">${[item.court, item.reference].filter(Boolean).map((part) => esc(part)).join(' · ')}</div>` : ''}
            ${item.summary ? `<p class="hcard__summary">${esc(item.summary)}</p>` : ''}
        </div>
    `).join('')}</div></div>`;
}

function timelineHtml(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return `<div class="sec"><div class="sec__t">Histórico do Andamento</div><div class="tlist">${items.map((item) => `
        <div class="titem">
            <div class="titem__row">
                <strong>${esc(item.title || item.type || 'Evento')}</strong>
                ${item.at ? `<span>${esc(formatDateBR(item.at))}</span>` : ''}
            </div>
            ${item.description ? `<p>${esc(item.description)}</p>` : ''}
        </div>
    `).join('')}</div></div>`;
}

/* ── Build body for one case (no <html> wrapper) ───────────────── */
function buildCaseBody(c, cd, generatedAt) {
    const ep  = Array.isArray(c.enabledPhases) && c.enabledPhases.length > 0 ? c.enabledPhases : null;
    const has = (p) => !ep || ep.includes(p);

    const idFields = [
        fieldHtml('Nome completo', c.candidateName || cd.candidateName),
        fieldHtml('CPF', c.cpfMasked || cd.cpfMasked || maskCpfValue(c.cpf || cd.cpf)),
        fieldHtml('Cargo', c.candidatePosition || cd.candidatePosition),
        fieldHtml('Departamento', cd.department || c.department),
        fieldHtml('E-mail', cd.email || c.email),
        fieldHtml('Telefone', cd.phone || c.phone),
        fieldHtml('Data da solicitação', formatDateBR(c.createdAt)),
        fieldHtml('Prioridade', PRIORITY_LABEL[c.priority] || c.priority),
        fieldHtml('Solicitado por', formatRequestedBy(c)),
    ].filter(Boolean).join('');

    const sp = c.socialProfiles || cd.socialProfiles || {};
    const sLinks = [
        socialLinkHtml(sp.linkedin||cd.linkedin||c.linkedin,'LinkedIn','💼'),
        socialLinkHtml(sp.instagram||cd.instagram||c.instagram,'Instagram','📸'),
        socialLinkHtml(sp.facebook||cd.facebook||c.facebook,'Facebook','👤'),
        socialLinkHtml(sp.twitter||cd.twitter||c.twitter,'Twitter / X','🐦'),
        socialLinkHtml(sp.tiktok||cd.tiktok||c.tiktok,'TikTok','🎵'),
        socialLinkHtml(sp.youtube||cd.youtube||c.youtube,'YouTube','▶️'),
        ...(Array.isArray(cd.otherSocialUrls) ? cd.otherSocialUrls.map(u=>socialLinkHtml(u,u,'🔗')) : []),
        ...(Array.isArray(sp.other) ? sp.other.map(u=>socialLinkHtml(u,u,'🔗')) : []),
    ].filter(Boolean);

    const socialSec = sLinks.length > 0
        ? `<div class="sec"><div class="sec__t">Perfis em Redes Sociais</div><div class="slinks">${sLinks.join('')}</div></div>` : '';

    const score = typeof c.riskScore === 'number' ? c.riskScore : 0;
    const riskLevel = c.riskLevel || 'GREEN';
    const verdict = c.finalVerdict;

    const riskSec = `<div class="rbox">
  <div class="rbox__score"><div class="rbox__sl">Score de Risco</div>
    <div class="rbox__bw"><div class="rbox__bar"><div class="rbox__fill" style="width:${score}%;background:${sbColor(score)}"></div></div>
    <span class="rbox__num">${score}<span class="rbox__den">/100</span></span></div>
  </div>
  <div class="rbox__div"></div>
  <div class="rbox__pg"><div class="rbox__pl">Nível de Risco</div><span class="b b--lg b--${rlColor(riskLevel)}">${esc(RISK_LEVEL_LABEL[riskLevel]||riskLevel)}</span></div>
  <div class="rbox__div"></div>
  <div class="rbox__pg"><div class="rbox__pl">Veredito Final</div><span class="b b--lg b--${flagColor(verdict)}">${esc(VERDICT_LABEL[verdict]||verdict||'—')}</span></div>
</div>`;

    const rows = [];
    if (has('criminal') && c.criminalFlag) {
        const sev = c.criminalSeverity ? badge(c.criminalSeverity, SEVERITY_LABEL[c.criminalSeverity]||c.criminalSeverity) : null;
        rows.push(phaseRow('🔴','Criminal',badge(c.criminalFlag,CRIMINAL_LABEL[c.criminalFlag]||c.criminalFlag),sev,c.criminalNotes,[],flagColor(c.criminalFlag)));
    }
    if (has('labor') && c.laborFlag) {
        const sev = c.laborSeverity ? badge(c.laborSeverity, SEVERITY_LABEL[c.laborSeverity]||c.laborSeverity) : null;
        rows.push(phaseRow('⚖️','Trabalhista',badge(c.laborFlag,LABOR_LABEL[c.laborFlag]||c.laborFlag),sev,c.laborNotes,[],flagColor(c.laborFlag)));
    }
    if (has('warrant') && c.warrantFlag)
        rows.push(phaseRow('🔒','Mandado de Prisão',badge(c.warrantFlag,WARRANT_LABEL[c.warrantFlag]||c.warrantFlag),null,c.warrantNotes,[],flagColor(c.warrantFlag)));
    if (has('osint') && c.osintLevel)
        rows.push(phaseRow('🔍','OSINT',badge(c.osintLevel,OSINT_LABEL[c.osintLevel]||c.osintLevel),null,c.osintNotes,Array.isArray(c.osintVectors)?c.osintVectors:[],flagColor(c.osintLevel)));
    if (has('social') && c.socialStatus)
        rows.push(phaseRow('👥','Análise Social',badge(c.socialStatus,SOCIAL_LABEL[c.socialStatus]||c.socialStatus),null,c.socialNotes,Array.isArray(c.socialReasons)?c.socialReasons:[],flagColor(c.socialStatus)));
    if (has('digital') && c.digitalFlag)
        rows.push(phaseRow('💻','Perfil Digital',badge(c.digitalFlag,DIGITAL_LABEL[c.digitalFlag]||c.digitalFlag),null,c.digitalNotes,Array.isArray(c.digitalVectors)?c.digitalVectors:[],flagColor(c.digitalFlag)));
    if (has('conflictInterest') && c.conflictInterest)
        rows.push(phaseRow('⚠️','Conflito de Interesse',badge(c.conflictInterest,CONFLICT_LABEL[c.conflictInterest]||c.conflictInterest),null,c.conflictNotes,[],flagColor(c.conflictInterest)));

    const phasesSec = rows.length > 0
        ? `<div class="sec"><div class="sec__t">Análises Realizadas</div><div class="plist">${rows.join('')}</div></div>` : '';

    const commentSec = c.analystComment
        ? `<div class="sec"><div class="sec__t">Justificativa Final</div><div class="cbox">${esc(c.analystComment)}</div></div>` : '';
    const executiveSec = (c.executiveSummary || c.statusSummary || c.sourceSummary)
        ? `<div class="sec"><div class="sec__t">Resumo Executivo</div><div class="ebox">
            ${c.executiveSummary ? `<div class="ebox__block"><strong>Visão executiva:</strong><div class="ebox__text">${esc(c.executiveSummary)}</div></div>` : ''}
            ${c.statusSummary ? `<p><strong>Situação atual:</strong> ${esc(c.statusSummary)}</p>` : ''}
            ${c.sourceSummary ? `<p><strong>Origem resumida dos dados:</strong> ${esc(c.sourceSummary)}</p>` : ''}
        </div></div>`
        : '';
    const findingsSec = listBlock('Principais Apontamentos', c.keyFindings);
    const nextStepsSec = listBlock('Próximos Passos', c.nextSteps);
    const processSec = processHighlightsHtml(c.processHighlights);
    const warrantSec = warrantFindingsHtml(c.warrantFindings);
    const timelineSec = timelineHtml(c.timelineEvents);

    return `
  <div class="hdr">
    <div><div class="hdr__brand">ComplianceHub</div><div class="hdr__sub">Relatório de Due Diligence — Documento Confidencial</div></div>
    <div class="hdr__right"><div class="hdr__tenant">${esc(c.tenantName||'')}</div><div>Gerado em ${esc(generatedAt)}</div></div>
  </div>
  <div class="sec"><div class="sec__t">Identificação do Candidato</div><div class="fgrid">${idFields}</div></div>
  ${socialSec}
  <div class="sec"><div class="sec__t">Resultado da Análise de Risco</div>${riskSec}</div>
  ${executiveSec}
  ${findingsSec}
  ${phasesSec}
  ${processSec}
  ${warrantSec}
  ${commentSec}
  ${nextStepsSec}
  ${timelineSec}
  <div class="ftr"><div class="ftr__id">ID: ${esc(c.id||'—')}</div><div>ComplianceHub · Documento Confidencial · ${esc(generatedAt)}</div></div>`;
}

/* ── CSS (shared between single and batch) ─────────────────────── */
const REPORT_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;color:#1e293b;background:#f0f2f5;font-size:13px;line-height:1.6}
.page{max-width:820px;margin:0 auto;background:#fff;padding:40px 48px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #4f46e5;margin-bottom:28px}
.hdr__brand{font-size:20px;font-weight:800;color:#4f46e5;letter-spacing:-.4px}
.hdr__sub{font-size:11px;color:#64748b;margin-top:2px}
.hdr__right{text-align:right;font-size:11px;color:#64748b;line-height:1.9}
.hdr__tenant{font-weight:600;color:#1e293b;font-size:12px}
.sec{margin-bottom:22px}
.sec__t{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #f1f5f9}
.fgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 20px}
.f__l{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px}
.f__v{font-size:12px;color:#1e293b;margin-top:2px;font-weight:500;word-break:break-word}
.rbox{background:linear-gradient(135deg,#f8fafc 0%,#f0f4ff 100%);border-radius:10px;padding:18px 24px;display:flex;align-items:center;gap:0;border:1px solid #e2e8f0}
.rbox__score{flex:1;min-width:160px}
.rbox__sl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
.rbox__bw{display:flex;align-items:center;gap:12px}
.rbox__bar{flex:1;height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden;max-width:140px}
.rbox__fill{height:100%;border-radius:99px}
.rbox__num{font-size:28px;font-weight:800;color:#1e293b;line-height:1}
.rbox__den{font-size:13px;font-weight:400;color:#94a3b8}
.rbox__div{width:1px;background:#e2e8f0;align-self:stretch;margin:0 24px}
.rbox__pg{display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.rbox__pl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px}
.b{display:inline-flex;align-items:center;padding:3px 10px;border-radius:5px;font-size:11px;font-weight:600;line-height:1.5}
.b--lg{padding:6px 14px;font-size:13px;font-weight:700;border-radius:6px}
.b--green{background:#dcfce7;color:#15803d}.b--yellow{background:#fef9c3;color:#a16207}.b--red{background:#fee2e2;color:#b91c1c}.b--gray{background:#f1f5f9;color:#475569}
.plist{display:flex;flex-direction:column;gap:10px}
.pr{border:1px solid #e2e8f0;border-left:4px solid;border-radius:8px;padding:14px 18px;page-break-inside:avoid}
.pr--red{border-left-color:#ef4444}.pr--yellow{border-left-color:#f59e0b}.pr--green{border-left-color:#22c55e}.pr--gray{border-left-color:#94a3b8}
.pr__top{display:flex;justify-content:space-between;align-items:center}
.pr__left{display:flex;align-items:center;gap:7px}
.pr__icon{font-size:14px;line-height:1}
.pr__name{font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.6px}
.pr__sev{margin-top:8px;padding-top:8px;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:6px}
.pr__sev-label{font-size:10px;font-weight:600;color:#94a3b8}
.pr__notes{margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;font-size:12px;color:#374151;line-height:1.75;white-space:pre-wrap}
.pr__tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.tag{background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500}
.slinks{display:flex;flex-wrap:wrap;gap:7px}
.slink{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;font-size:11px;color:#4f46e5;text-decoration:none;font-weight:500}
.ebox{display:flex;flex-direction:column;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px}
.ebox p{font-size:12px;color:#334155}
.ebox__block{font-size:12px;color:#334155}
.ebox__text{white-space:pre-wrap;margin-top:6px;line-height:1.75}
.blist{padding-left:18px;display:flex;flex-direction:column;gap:8px}
.blist li{font-size:12px;color:#334155}
.hlist{display:flex;flex-direction:column;gap:12px}
.hcard{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;background:#fff}
.hcard__top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.hcard__meta{display:block;font-size:10px;color:#94a3b8;margin-top:2px}
.hcard__count{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:24px;padding:0 8px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:700}
.hcard__summary{margin-top:8px;font-size:12px;color:#475569}
.hcard__items{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.hcard__item{padding:10px 12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.hcard__item-top{display:flex;justify-content:space-between;gap:10px;font-size:11px;font-weight:700;color:#334155}
.hcard__item-body{margin-top:4px;font-size:11px;color:#64748b}
.hcard__impact{margin-top:6px;font-size:11px;color:#334155}
.tlist{display:flex;flex-direction:column;gap:10px}
.titem{padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
.titem__row{display:flex;justify-content:space-between;gap:12px;font-size:11px;color:#0f172a}
.titem p{margin-top:6px;font-size:12px;color:#475569}
.cbox{background:#fafbff;border-left:4px solid #4f46e5;padding:14px 18px;border-radius:0 7px 7px 0;font-size:12px;color:#374151;line-height:1.8;white-space:pre-wrap}
.ftr{margin-top:32px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
.ftr__id{font-family:monospace;font-size:9px}
.print-btn{position:fixed;bottom:20px;right:20px;background:#4f46e5;color:#fff;border:none;padding:10px 22px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 4px 18px rgba(79,70,229,.4);z-index:999}
.print-btn:hover{background:#4338ca}
.page-break{page-break-after:always;height:0;overflow:hidden}
.batch-cover{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:80px 40px}
.batch-cover__brand{font-size:28px;font-weight:800;color:#4f46e5;margin-bottom:4px}
.batch-cover__title{font-size:16px;color:#64748b;margin-bottom:32px}
.batch-cover__meta{font-size:12px;color:#94a3b8;line-height:2}
.batch-sep{border:none;border-top:2px dashed #e2e8f0;margin:36px 0}
@media print{body{background:#fff}.page{max-width:100%;padding:24px 28px;box-shadow:none}.print-btn{display:none}.sec{page-break-inside:avoid}.pr{page-break-inside:avoid}}
@page{size:A4;margin:14mm 12mm}
`;

export function buildCaseReportHtml(caseData, candidateData) {
    if (!caseData) return '';
    const c = caseData;
    const cd = candidateData || {};
    const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório — ${esc(c.candidateName || 'Candidato')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${REPORT_CSS}</style></head><body>
<div class="page">${buildCaseBody(c, cd, generatedAt)}</div>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body></html>`;
}

export function buildBatchReportHtml(cases, tenantName) {
    if (!Array.isArray(cases) || cases.length === 0) return '';
    const generatedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

    const cover = `<div class="batch-cover">
  <div class="batch-cover__brand">ComplianceHub</div>
  <div class="batch-cover__title">Relatório Consolidado de Due Diligence</div>
  <div class="batch-cover__meta">
    <div>${esc(tenantName || '')}</div>
    <div>${cases.length} candidato${cases.length > 1 ? 's' : ''}</div>
    <div>Gerado em ${esc(generatedAt)}</div>
  </div>
</div>`;

    const pages = cases.map((c, i) => {
        const body = buildCaseBody(c, {}, generatedAt);
        const sep = i < cases.length - 1 ? '<div class="page-break"></div>' : '';
        return `<div class="page">${body}</div>${sep}`;
    }).join('');

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Consolidado — ${esc(tenantName || 'ComplianceHub')}</title>
<style>${REPORT_CSS}</style></head><body>
<div class="page">${cover}</div>
<div class="page-break"></div>
${pages}
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
</body></html>`;
}
