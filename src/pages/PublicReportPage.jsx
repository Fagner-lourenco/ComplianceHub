import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicReport } from '../core/firebase/firestoreService';
import { getMockCaseById } from '../data/mockData';
import { buildCaseReportHtml } from '../core/reportBuilder';
import './PublicReportPage.css';

export default function PublicReportPage() {
    const { token, caseId } = useParams();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [reportHtml, setReportHtml] = useState('');
    const [copyOk, setCopyOk] = useState(false);
    const iframeRef = useRef(null);
    const isDemoRoute = Boolean(caseId) && !token;

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
        const doc = parser.parseFromString(String(html), 'text/html');
        doc.querySelectorAll('script, iframe, form, .print-btn').forEach((node) => node.remove());
        doc.querySelectorAll('*').forEach((element) => {
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

        return doc.documentElement.outerHTML;
    };

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                if (isDemoRoute) {
                    const caseData = getMockCaseById(caseId);
                    if (!caseData) {
                        if (!cancelled) {
                            setError(true);
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
                    setError(true);
                    setLoading(false);
                    return;
                }

                setReportHtml(stripActiveContent(report.html));
                setLoading(false);
            } catch {
                if (!cancelled) {
                    setError(true);
                    setLoading(false);
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, [caseId, isDemoRoute, token]);

    if (error) {
        return (
            <div className="public-report__state">
                <div className="public-report__state-card">
                    <div className="public-report__state-icon">📄</div>
                    <h2 className="public-report__state-title">Relatório não encontrado</h2>
                    <p>O link pode ter expirado ou ser inválido.</p>
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

    if (loading) {
        return (
            <div className="public-report__state">
                <div className="public-report__state-card">
                    <div className="public-report__state-brand">ComplianceHub</div>
                    <p>Carregando relatório...</p>
                </div>
            </div>
        );
    }

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
                    onClick={handlePrint}
                    className="public-report__button public-report__button--primary"
                >
                    Imprimir / Salvar PDF
                </button>
            </div>

            <iframe
                ref={iframeRef}
                title="Relatório Público"
                srcDoc={reportHtml}
                sandbox="allow-modals"
                className="public-report__frame"
            />
        </div>
    );
}
