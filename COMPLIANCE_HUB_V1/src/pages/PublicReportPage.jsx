import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDoc, doc } from 'firebase/firestore';
import { getPublicReport, generatePublicReportPdf, triggerPdfDownload } from '../core/firebase/firestoreService';
import { db } from '../core/firebase/config';
import { getMockCaseById } from '../data/mockData';
import { buildCaseReportHtml } from '../core/reportBuilder';
import './PublicReportPage.css';

export default function PublicReportPage() {
    const { token, caseId } = useParams();
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [reportHtml, setReportHtml] = useState('');
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
                        setReportHtml(stripActiveContent(buildCaseReportHtml(caseData)));
                        setLoading(false);
                    }
                    return;
                }

                const report = await getPublicReport(token);
                if (cancelled) return;
                if (!report?.html) {
                    setError('not-found');
                    setLoading(false);
                    return;
                }

                // PUB-002: Check if report was revoked
                if (report.active === false) {
                    setError('revoked');
                    setLoading(false);
                    return;
                }

                const now = new Date();
                let expiresAt = null;
                if (report.expiresAt instanceof Date) {
                    expiresAt = report.expiresAt;
                } else if (typeof report.expiresAt?.toDate === 'function') {
                    expiresAt = report.expiresAt.toDate();
                } else if (report.expiresAt?.seconds) {
                    expiresAt = new Date(report.expiresAt.seconds * 1000);
                }
                if (expiresAt && now > expiresAt) {
                    setError('expired');
                    setLoading(false);
                    return;
                }

                // PUB-003: Verify case is still DONE
                const linkedCaseId = report.caseId;
                if (linkedCaseId) {
                    try {
                        const caseSnap = await getDoc(doc(db, 'cases', linkedCaseId));
                        if (caseSnap.exists()) {
                            const caseData = caseSnap.data();
                            if (caseData?.status !== 'DONE') {
                                setError('case-not-done');
                                setLoading(false);
                                return;
                            }
                        }
                    } catch {
                        // If case read fails, continue with report (defense in depth)
                    }
                }

                setReportMeta({
                    token: token.slice(-12),
                    createdAt: report.createdAt,
                    expiresAt: report.expiresAt,
                    reportBuildVersion: report.reportBuildVersion || '1.0',
                    publicSnapshotHash: report.publicSnapshotHash || null,
                });
                setReportHtml(stripActiveContent(report.html));
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    const code = err?.code || '';
                    if (code === 'permission-denied') {
                        setError('expired');
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
        const isNetwork = error === 'network';
        const isWarning = isCaseNotDone;
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
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.focus();
            iframeRef.current.contentWindow.print();
            return;
        }

        window.print();
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
            triggerPdfDownload(url, `relatorio_${reportMeta?.candidateName || token}.pdf`);
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

    // PUB-010: Build verification banner HTML
    const verificationBanner = reportMeta
        ? `<div class="report-verification-banner">
            <div class="report-verification-banner__inner">
                <span class="report-verification-banner__label">ComplianceHub</span>
                <span class="report-verification-banner__sep">·</span>
                <span class="report-verification-banner__item">ID: …${reportMeta.token}</span>
                <span class="report-verification-banner__sep">·</span>
                <span class="report-verification-banner__item">Válido até: ${reportMeta.expiresAt ? new Date(reportMeta.expiresAt.seconds ? reportMeta.expiresAt.seconds * 1000 : reportMeta.expiresAt).toLocaleDateString('pt-BR') : '—'}</span>
                ${reportMeta.publicSnapshotHash ? `<span class="report-verification-banner__sep">·</span><span class="report-verification-banner__item">Hash: ${reportMeta.publicSnapshotHash.slice(0, 8)}</span>` : ''}
            </div>
        </div>`
        : '';

    const htmlWithBanner = reportHtml
        ? reportHtml.replace(/<body\b[^>]*>/i, (match) => `${match}${verificationBanner}`)
        : reportHtml;

    return (
        <div className="public-report">
            <div className="public-report__actions">
                <button
                    type="button"
                    onClick={handleCopyLink}
                    className="public-report__button public-report__button--secondary"
                >
                    {copyOk ? 'Link Copiado!' : 'Copiar Link'}
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

            <iframe
                ref={iframeRef}
                title="Relatório Público"
                srcDoc={htmlWithBanner}
                sandbox="allow-modals"
                className="public-report__frame"
            />
        </div>
    );
}
