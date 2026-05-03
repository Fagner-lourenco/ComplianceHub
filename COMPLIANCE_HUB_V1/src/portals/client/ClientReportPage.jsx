import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageShell from '../../ui/layouts/PageShell';
import PageHeader from '../../ui/components/PageHeader/PageHeader';
import Modal from '../../ui/components/Modal/Modal';
import { useAuth } from '../../core/auth/useAuth';
import { getCasePublicResult, saveClientPublicReport, generateClientCasePdf } from '../../core/firebase/firestoreService';
import { getReportAvailability, resolveClientCaseView } from '../../core/clientPortal';
import { buildClientPortalPath } from '../../core/portalPaths';
import { useCases } from '../../hooks/useCases';
import { buildCaseReportHtml } from '../../core/reportBuilder';
import { extractErrorMessage } from '../../core/errorUtils';
import StatusBadge from '../../ui/components/StatusBadge/StatusBadge';
import './ClientReportPage.css';

function shortToken(token) {
    if (!token) return 'Não gerado';
    return token.length > 12 ? `${token.slice(0, 6)}...${token.slice(-4)}` : token;
}

export default function ClientReportPage() {
    const { caseId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userProfile } = useAuth();
    const isDemoMode = !user || userProfile?.source === 'demo';
    const clientTenantId = isDemoMode ? undefined : (userProfile?.tenantId ?? undefined);
    const { cases, loading, error } = useCases(clientTenantId);
    const [publicResult, setPublicResult] = useState(null);
    const [publicResultError, setPublicResultError] = useState(null);
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareState, setShareState] = useState({ status: 'idle', message: '', token: '' });
    const [pdfState, setPdfState] = useState({ status: 'idle', message: '' });
    const iframeRef = useRef(null);

    const caseData = useMemo(() => cases.find((item) => item.id === caseId) || null, [caseId, cases]);
    const effectivePublicResult = caseData?.status === 'DONE'
        ? (isDemoMode ? caseData.publicResultMock || null : publicResult)
        : null;
    const caseView = useMemo(
        () => (caseData ? resolveClientCaseView(caseData, effectivePublicResult) : null),
        [caseData, effectivePublicResult],
    );
    const reportAvailability = useMemo(
        () => getReportAvailability(caseData, effectivePublicResult),
        [caseData, effectivePublicResult],
    );

    useEffect(() => {
        if (!caseData || caseData.status !== 'DONE' || isDemoMode) return;
        let cancelled = false;
        getCasePublicResult(caseData.id)
            .then((data) => {
                if (!cancelled) {
                    setPublicResult(data || caseData.publicResultMock || null);
                    setPublicResultError(null);
                }
            })
            .catch((err) => {
                if (!cancelled) setPublicResultError(err);
            });
        return () => { cancelled = true; };
    }, [caseData, isDemoMode]);

    const reportHtml = useMemo(() => {
        if (!caseView || !reportAvailability.available) return '';
        return buildCaseReportHtml(caseView);
    }, [caseView, reportAvailability.available]);

    // HTML shown in the embedded iframe — strip the internal print button (we have our own)
    const iframeHtml = useMemo(() => {
        if (!reportHtml) return '';
        return reportHtml.replace(/<button[^>]*class="print-btn"[^>]*>[\s\S]*?<\/button>/gi, '');
    }, [reportHtml]);

    const handlePrint = () => {
        if (!reportHtml) return;
        // Open as blob URL in new tab — avoids sandbox restrictions and auto-triggers print
        const printHtml = iframeHtml.replace(
            '</body>',
            '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});</script></body>',
        );
        const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const opened = window.open(url, '_blank');
        if (opened) {
            // Revoke after enough time for the new tab to load
            window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
        }
    };

    const handleDownloadPdf = async () => {
        if (!caseId || !reportAvailability.available) return;
        if (isDemoMode) {
            handlePrint();
            return;
        }
        setPdfState({ status: 'loading', message: 'Gerando PDF...' });
        try {
            const { url } = await generateClientCasePdf(caseId);
            const link = document.createElement('a');
            link.href = url;
            link.download = `relatorio_${caseView?.candidateName || caseId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setPdfState({ status: 'success', message: 'PDF gerado e download iniciado.' });
            window.setTimeout(() => setPdfState({ status: 'idle', message: '' }), 4000);
        } catch (err) {
            setPdfState({
                status: 'error',
                message: extractErrorMessage(err, 'Nao foi possivel gerar o PDF. Tente imprimir.'),
            });
        }
    };

    const handleBack = () => navigate(buildClientPortalPath(location.pathname, 'solicitacoes'));

    const handleGeneratePublicLink = async () => {
        if (!caseView || !reportAvailability.available) return;
        if (isDemoMode) {
            const demoPath = `${window.location.origin}/demo/r/${caseView.id}`;
            await navigator.clipboard?.writeText(demoPath);
            setShareState({ status: 'success', message: 'Link demo copiado.', token: caseView.id });
            return;
        }
        setShareState({ status: 'loading', message: 'Gerando link público auditado...', token: '' });
        try {
            const token = await saveClientPublicReport(caseView.id);
            const publicUrl = `${window.location.origin}/r/${token}`;
            await navigator.clipboard?.writeText(publicUrl);
            setShareState({ status: 'success', message: 'Link público gerado e copiado para a área de transferência.', token });
        } catch (err) {
            setShareState({
                status: 'error',
                message: extractErrorMessage(err, 'Não foi possível gerar o link público agora.'),
                token: '',
            });
        }
    };

    if (loading) {
        return (
            <div className="crp-state" role="status" aria-live="polite">
                <div className="crp-state__card">
                    <div className="crp-state__spinner" aria-hidden="true" />
                    <p>Carregando dossiê autenticado...</p>
                </div>
            </div>
        );
    }

    if (error || !caseData) {
        return (
            <div className="crp-state">
                <div className="crp-state__card">
                    <h2>Dossiê não encontrado</h2>
                    <p>
                        {error
                            ? extractErrorMessage(error, 'Não foi possível carregar o caso.')
                            : 'Esta solicitação não está disponível para a sua empresa ou não existe nos registros carregados.'}
                    </p>
                    <button type="button" className="crp-btn crp-btn--primary" onClick={handleBack}>
                        Voltar para solicitações
                    </button>
                </div>
            </div>
        );
    }

    return (
        <PageShell size="report" className="crp">
            <PageHeader
                compact
                eyebrow="Relatório"
                title={`Relatório — ${caseView?.candidateName ?? 'Candidato'}`}
                description="Visualize, imprima ou gere o PDF desta análise."
                backAction={{ to: buildClientPortalPath('solicitacoes'), label: '← Solicitações' }}
                actions={
                    <div className="crp__actions-right">
                        {publicResultError && (
                            <span className="crp__warn" role="alert" title="Conteúdo sanitizado indisponível — exibindo dados locais">
                                ⚠ Dados parciais
                            </span>
                        )}
                        {pdfState.message && (
                            <span
                                role={pdfState.status === 'error' ? 'alert' : 'status'}
                                className={`crp__pdf-msg crp__pdf-msg--${pdfState.status}`}
                            >
                                {pdfState.message}
                            </span>
                        )}
                        {reportAvailability.available && (
                            <>
                                <button
                                    type="button"
                                    className="crp-btn crp-btn--primary"
                                    onClick={handleDownloadPdf}
                                    disabled={pdfState.status === 'loading'}
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    {pdfState.status === 'loading' ? 'Gerando PDF...' : 'Baixar PDF'}
                                </button>
                                <button type="button" className="crp-btn crp-btn--secondary" onClick={handlePrint}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                    Imprimir
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            className="crp-btn crp-btn--primary"
                            onClick={() => setShareModalOpen(true)}
                            disabled={!reportAvailability.available}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                            Gerar link público
                        </button>
                    </div>
                }
            />

            {/* Report iframe or pending state */}
            {reportAvailability.available ? (
                <iframe
                    ref={iframeRef}
                    title={`Dossiê — ${caseView?.candidateName || 'Candidato'}`}
                    srcDoc={iframeHtml}
                    sandbox="allow-scripts allow-modals"
                    className="crp__frame"
                />
            ) : (
                <div className="crp__pending">
                    <div className="crp__pending-card">
                        <div className="crp__pending-status">
                            <StatusBadge status={caseData.status} />
                        </div>
                        <h2 className="crp__pending-name">{caseView?.candidateName || 'Candidato'}</h2>
                        <p className="crp__pending-msg">{reportAvailability.message}</p>
                        <p className="crp__pending-sub">
                            {caseView?.statusSummary || 'A análise está em andamento. O relatório será liberado automaticamente quando concluída.'}
                        </p>
                    </div>
                </div>
            )}

            {/* Share modal */}
            <Modal
                open={shareModalOpen}
                onClose={() => setShareModalOpen(false)}
                title="Gerar link público"
                footer={(
                    <>
                        <button type="button" className="crp-btn crp-btn--ghost" onClick={() => setShareModalOpen(false)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="crp-btn crp-btn--primary"
                            onClick={handleGeneratePublicLink}
                            disabled={shareState.status === 'loading'}
                        >
                            {shareState.status === 'loading' ? 'Gerando...' : 'Gerar e copiar link'}
                        </button>
                    </>
                )}
            >
                <div className="crp-share-modal">
                    <p>Esta ação cria ou reutiliza um link externo para leitura pública do relatório. O evento é registrado no histórico e o sistema valida empresa, permissão e status antes da publicação.</p>
                    <dl>
                        <div><dt>Candidato</dt><dd>{caseView?.candidateName || 'Não informado'}</dd></div>
                        <div><dt>Caso</dt><dd>{caseData.id}</dd></div>
                        <div><dt>Empresa</dt><dd>{userProfile?.tenantName || userProfile?.tenantId || caseData.tenantId || 'Franquia atual'}</dd></div>
                        <div><dt>Link de acesso atual</dt><dd>{shortToken(caseData.publicReportToken)}</dd></div>
                    </dl>
                    {shareState.message && (
                        <p
                            role={shareState.status === 'error' ? 'alert' : 'status'}
                            className={`crp-share-modal__msg crp-share-modal__msg--${shareState.status}`}
                        >
                            {shareState.message}
                        </p>
                    )}
                </div>
            </Modal>
        </PageShell>
    );
}
