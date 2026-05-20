/**
 * Helpers de manipulação de HTML/CSS para geração de PDF.
 */

/**
 * Injeta CSS específico para exportação PDF (watermark, paginação, ocultação de elementos).
 *
 * @param {string} html - HTML original.
 * @param {object} [options] - Opções.
 * @param {boolean} [options.includeWatermark=true] - Incluir marca d'água "CONFIDENCIAL".
 * @returns {string} HTML com CSS injetado.
 */
function injectPdfExportCss(html, options = {}) {
    const includeWatermark = options.includeWatermark !== false;
    const css = `
<style data-pdf-export="true">
@page { size: A4; margin: 14mm 12mm; }
body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
${includeWatermark ? buildPdfWatermarkCss() : ''}
.print-btn, .no-print, [data-no-print="true"] { display: none !important; }
h1, h2, h3, h4, h5, h6 { break-after: avoid-page; page-break-after: avoid; }
.card, .panel, .section-box, .info-box, .highlight-box, .verdict-box {
    break-inside: avoid-page; page-break-inside: avoid;
}
pre, code, table, figure, img, svg, blockquote {
    break-inside: avoid-page; page-break-inside: avoid;
}
.long-text, .paragraph, .description, .summary, .notes, .comment {
    break-inside: auto; page-break-inside: auto;
}
tr { break-inside: avoid-page; page-break-inside: avoid; }
thead { display: table-header-group; }
</style>
`;
    // Inserir antes de </head> se possível, senão no início do body
    if (/<\/head>/i.test(html)) {
        return html.replace(/<\/head>/i, `${css}</head>`);
    }
    if (/<body/i.test(html)) {
        return html.replace(/<body/i, `${css}<body`);
    }
    return css + html;
}

/**
 * Injere banner de verificação pública no topo do relatório.
 *
 * @param {string} html - HTML original.
 * @param {object} reportData - Dados do relatório público.
 * @param {string} token - Token público.
 * @returns {string} HTML com banner injetado.
 */
function injectPublicVerificationBanner(html, reportData, token) {
    const candidateName = escapeHtml(reportData?.candidateName || 'Candidato');
    const tenantName = escapeHtml(reportData?.tenantName || '');
    const expiresAt = reportData?.expiresAt
        ? new Date(reportData.expiresAt).toLocaleDateString('pt-BR')
        : '';

    const banner = `
<div class="public-verification-banner" style="
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: #0c4a6e;
    line-height: 1.5;
">
    <div style="font-weight: 600; margin-bottom: 4px;">Relatório de Verificação de Antecedentes</div>
    <div><strong>Candidato:</strong> ${candidateName}</div>
    ${tenantName ? `<div><strong>Empresa solicitante:</strong> ${tenantName}</div>` : ''}
    ${expiresAt ? `<div><strong>Validade do link:</strong> até ${expiresAt}</div>` : ''}
    <div><strong>Token de verificação:</strong> <code style="background:#e0f2fe;padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(token)}</code></div>
    <div style="margin-top:6px;font-size:12px;color:#0369a1;">
        Este documento foi gerado eletronicamente pela plataforma ComplianceHub.
        A autenticidade pode ser verificada através do token acima.
    </div>
</div>
`;

    if (/<body[^>]*>/i.test(html)) {
        return html.replace(/(<body[^>]*>)/i, `$1\n${banner}`);
    }
    return banner + html;
}

function buildPdfWatermarkCss() {
    return `
body::before {
    content: "CONFIDENCIAL";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 96px;
    font-weight: 700;
    color: rgba(15, 23, 42, 0.055);
    pointer-events: none;
    z-index: 9999;
    white-space: nowrap;
    font-family: system-ui, -apple-system, sans-serif;
    letter-spacing: 8px;
}
`;
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    injectPdfExportCss,
    injectPublicVerificationBanner,
    buildPdfWatermarkCss,
    escapeHtml,
};
