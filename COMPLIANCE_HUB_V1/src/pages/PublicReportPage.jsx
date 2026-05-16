import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicReportView, generatePublicReportPdf, triggerPdfDownload } from '../core/firebase/firestoreService';
import { getMockCaseById } from '../data/mockData';
import { buildCaseReportHtml } from '../core/reportBuilder';
import { formatDateTimeBR } from '../core/formatDate';
import './PublicReportPage.css';

function safeFilenamePart(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);
}

export default function PublicReportPage() {
    const { token, caseId } = useParams();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rawReportHtml, setRawReportHtml] = useState('');
    const [copyOk, setCopyOk] = useState(false);
    const [reportMeta, setReportMeta] = useState(null);
    const [pdfState, setPdfState] = useState({ status: 'idle', message: '' });
    const iframeRef = useRef(null);
    const autoPrintTriggeredRef = useRef(false);
    const isDemoRoute = Boolean(caseId) && !token;
    const shouldAutoPrint = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('print') === '1';

    const stripActiveContent = (html) => {
        if (!html) return '';

        if (typeof DOMParser === 'undefined') {
            return String(html)
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
                .replace(/<form\b[\s\S]*?<\/form>/gi, '')
                .replace(/<button\s+class="print-btn"[^>]*>[\s\S]*?<\/button>/gi, '')
                .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
                .replace(/\s(href|src)=("|')\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
        }

        const parser = new DOMParser();
        const docu = parser.parseFromString(String(html), 'text/html');
        docu.querySelectorAll('script, iframe, form, .print-btn').forEach((node) => node.remove());
        docu.querySelectorAll('*').forEach((element) => {
            [...element.attributes].forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value || '';
                if (name.startsWith('on')) {
                    element.removeAttribute(attribute.name);
                    return;
                }
                if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) {
                    element.setAttribute(attribute.name, '#');
                }
            });
        });

        return docu.documentElement.outerHTML;
    };

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                if (isDemoRoute) {
                    const caseData = getMockCaseById(caseId);
                    if (!caseData) {
                        if (!cancelled) {
                            setError('not-found');
                            setLoading(false);
                        }
                        return;
                    }

                    if (!cancelled) {
                        setRawReportHtml(buildCaseReportHtml(caseData));
                        setLoading(false);
                    }
                    return;
                }

                const report = await getPublicReportView(token);
                if (cancelled) return;

                setReportMeta({
                    token: report.token,
                    candidateName: report.candidateName || '',
                    createdAt: report.createdAt,
                    expiresAt: report.expiresAt,
                    reportBuildVersion: report.reportBuildVersion || '1.0',
                    publicSnapshotHash: report.publicSnapshotHash || null,
                });
                setRawReportHtml(report.html);
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    const code = err?.code || '';
                    const msg = err?.message || '';
                    if (code === 'not-found') {
                        setError('not-found');
                    } else if (msg.includes('revogado')) {
                        setError('revoked');
                    } else if (msg.includes('expirado') || msg.includes('expirado') || code === 'permission-denied') {
                        setError('expired');
                    } else if (msg.includes('em revisao') || msg.includes('revisão')) {
                        setError('case-not-done');
                    } else if (msg.includes('desatualizado')) {
                        setError('stale');
                    } else {
                        setError('network');
                    }
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, [caseId, isDemoRoute, token]);

    const reportHtml = useMemo(() => stripActiveContent(rawReportHtml), [rawReportHtml]);

    useEffect(() => {
        if (!shouldAutoPrint || loading || error || !reportHtml || autoPrintTriggeredRef.current) {
            return;
        }

        autoPrintTriggeredRef.current = true;
        window.setTimeout(() => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.focus();
                iframeRef.current.contentWindow.print();
                return;
            }

            window.print();
        }, 400);
    }, [error, loading, reportHtml, shouldAutoPrint]);

    if (error) {
        const isExpired = error === 'expired';
        const isRevoked = error === 'revoked';
        const isCaseNotDone = error === 'case-not-done';
        const isStale = error === 'stale';
        const isNetwork = error === 'network';
        const isWarning = isCaseNotDone || isStale;
        return (
            <div className="public-report__state" role="alert">
                <div className="public-report__state-card">
                    <div className="public-report__state-brand">
                        <span className="public-report__state-brand-dot" />
                        ComplianceHub
                    </div>
                    <div className={`public-report__state-icon ${isWarning ? 'public-report__state-icon--warning' : 'public-report__state-icon--error'}`}>
                        {isWarning ? (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        ) : (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        )}
                    </div>
                    <h2 className="public-report__state-title">
                        {isRevoked
                            ? 'Este link foi desativado'
                            : isExpired
                                ? 'Este link não está mais disponível'
                                : isCaseNotDone
                                    ? 'Relatório em revisão'
                                    : isStale
                                        ? 'Relatório desatualizado'
                                        : isNetwork
                                            ? 'Erro de conexão'
                                            : 'Relatório não encontrado'}
                    </h2>
                    <p className="public-report__state-text">
                        {isRevoked
                            ? 'Este link foi desativado e não está mais disponível. Solicite um novo link ao responsável pela análise.'
                            : isExpired
                                ? 'O prazo de acesso a este link expirou. Solicite um novo link ao responsável pela análise.'
                                : isCaseNotDone
                                    ? 'Este caso está sendo revisado e o relatório não está disponível no momento. Solicite um novo link quando a análise for concluída.'
                                    : isStale
                                        ? 'Este relatório foi atualizado e o link precisa ser regenerado. Solicite um novo link ao responsável pela análise.'
                                        : isNetwork
                                            ? 'Não foi possível carregar o relatório. Verifique sua conexão e tente novamente.'
                                            : 'O link pode ter expirado ou ser inválido.'}
                    </p>
                </div>
            </div>
        );
    }

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopyOk(true);
            window.setTimeout(() => setCopyOk(false), 1800);
        } catch {
            setCopyOk(false);
        }
    };

    const handlePrint = () => {
        // Open the report HTML in a popup and trigger print there.
        // Iframe sandbox blocks contentWindow.print() in many browsers.
        if (!reportHtml) return;
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        const win = window.open(blobUrl, '_blank', 'noopener,noreferrer,width=900,height=1100');
        if (!win) {
            // Popup blocked — fallback: try iframe print, then page print
            try {
                iframeRef.current?.contentWindow?.focus();
                iframeRef.current?.contentWindow?.print();
            } catch {
                window.print();
            }
            window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
            return;
        }
        win.addEventListener('load', () => {
            win.focus();
            win.print();
        });
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    };

    const handleDownloadPdf = async () => {
        if (isDemoRoute) {
            handlePrint();
            return;
        }
        if (!token) return;
        setPdfState({ status: 'loading', message: 'Gerando PDF...' });
        try {
            const { url } = await generatePublicReportPdf(token);
            const filenameBase = safeFilenamePart(reportMeta?.candidateName) || token;
            triggerPdfDownload(url, `relatorio_${filenameBase}.pdf`);
            setPdfState({ status: 'success', message: 'PDF gerado e download iniciado.' });
            window.setTimeout(() => setPdfState({ status: 'idle', message: '' }), 4000);
        } catch {
            setPdfState({
                status: 'error',
                message: 'Não foi possível gerar o PDF. Tente imprimir.',
            });
        }
    };

    if (loading) {
        return (
            <div className="public-report__state" role="status" aria-live="polite" aria-label="Carregando relatório">
                <div className="public-report__state-card">
                    <div className="public-report__state-brand">
                        <span className="public-report__state-brand-dot" />
                        ComplianceHub
                    </div>
                    <div className="public-report__state-icon public-report__state-icon--loading">
                        <div className="public-report__spinner" aria-hidden="true" />
                    </div>
                    <h2 className="public-report__state-title">Carregando relatório</h2>
                    <p className="public-report__state-text">Verificando autenticidade e carregando o conteúdo do relatório...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="public-report">
            <div className="public-report__topbar">
                <div className="public-report__topbar-main">
                    <span className="public-report__brand-dot" />
                    <strong>ComplianceHub</strong>
                    <span className="public-report__topbar-sep">·</span>
                    <span>Relatório compartilhado</span>
                </div>

                {reportMeta && (
                    <div className="public-report__topbar-meta">
                        {reportMeta.candidateName && (
                            <span>{reportMeta.candidateName}</span>
                        )}
                        {reportMeta.createdAt && (
                            <span>Gerado: {formatDateTimeBR(reportMeta.createdAt)}</span>
                        )}
                        {reportMeta.expiresAt && (
                            <span>Válido até: {formatDateTimeBR(reportMeta.expiresAt)}</span>
                        )}
                        {reportMeta.token && (
                            <span title="Token de verificação">…{reportMeta.token}</span>
                        )}
                    </div>
                )}

                <div className="public-report__topbar-actions">
                    <button
                        type="button"
                        onClick={handleCopyLink}
                        className="public-report__button public-report__button--secondary"
                    >
                        {copyOk ? 'Copiado!' : 'Copiar link'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={pdfState.status === 'loading'}
                        className="public-report__button public-report__button--primary"
                    >
                        {pdfState.status === 'loading' ? 'Gerando PDF...' : 'Baixar PDF'}
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="public-report__button public-report__button--secondary"
                    >
                        Imprimir
                    </button>
                </div>
            </div>

            <iframe
                ref={iframeRef}
                title="Relatório Público"
                srcDoc={reportHtml}
                sandbox="allow-modals allow-popups allow-popups-to-escape-sandbox"
                className="public-report__frame"
            />
        </div>
    );
}
