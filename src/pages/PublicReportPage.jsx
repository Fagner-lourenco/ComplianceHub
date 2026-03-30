import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicReport } from '../core/firebase/firestoreService';

export default function PublicReportPage() {
    const { token } = useParams();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [reportHtml, setReportHtml] = useState('');
    const [copyOk, setCopyOk] = useState(false);
    const iframeRef = useRef(null);

    const stripActiveContent = (html) => {
        if (!html) return '';

        // Remove script tags and the embedded print button to keep controls in host page.
        return String(html)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<button\s+class="print-btn"[^>]*>[\s\S]*?<\/button>/gi, '');
    };

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
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
    }, [token]);

    if (error) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#64748b',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                    <h2 style={{ color: '#1e293b', marginBottom: '8px' }}>Relatório não encontrado</h2>
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
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#64748b',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 600, color: '#4f46e5' }}>ComplianceHub</div>
                    <p>Carregando relatório...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#e5e7eb' }}>
            <div style={{
                position: 'fixed',
                right: 20,
                bottom: 20,
                display: 'flex',
                gap: 8,
                zIndex: 20,
            }}>
                <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                        background: '#0f172a',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 22px',
                        borderRadius: 7,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 18px rgba(15,23,42,.3)',
                    }}
                >
                    {copyOk ? 'Link Copiado!' : 'Copiar Link'}
                </button>
                <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 22px',
                        borderRadius: 7,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 18px rgba(79,70,229,.4)',
                    }}
                >
                    Imprimir / Salvar PDF
                </button>
            </div>

            <iframe
                ref={iframeRef}
                title="Relatório Público"
                srcDoc={reportHtml}
                style={{ width: '100%', minHeight: '100vh', border: 'none', background: '#e5e7eb' }}
            />
        </div>
    );
}
