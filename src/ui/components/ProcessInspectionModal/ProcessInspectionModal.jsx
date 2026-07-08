/**
 * ProcessInspectionModal — Premium modal for deep-inspecting a judicial process.
 *
 * Left column:  Process details from the original source (Judit / BigDataCorp)
 * Right column: DJEN (Diário de Justiça Eletrônico Nacional) timeline correlated by CNJ.
 *
 * IMPORTANT: This component receives already-normalized data from CasoPage state.
 * No API calls are made here — everything is reactive from caseData already in memory.
 */
import { formatDate } from '../../../core/formatDate';
import { getProcessReviewTone } from '../../../core/processReviewTone';
import './ProcessInspectionModal.css';

export default function ProcessInspectionModal({ process, djenTimeline, onClose }) {
    if (!process) return null;
    const { source, cnj, data } = process;
    const sourceColor = source === 'JUDIT' ? 'purple' : source === 'DJEN' ? 'green' : 'blue';
    const tone = getProcessReviewTone(data);
    const reviewTone = tone.level === 'neutral' ? null : tone;

    // Determine parties array (Judit uses `parties`, BDC uses `allParties`)
    const parties = data.parties || data.allParties || [];

    return (
        <div className="pim-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="pim-container">
                {/* ── HEADER ── */}
                <div className="pim-header">
                    <button className="pim-close" onClick={onClose} aria-label="Fechar">✕</button>
                    <span className="pim-cnj">{cnj || '—'}</span>
                    <span className={`pim-badge pim-badge--${sourceColor}`}>{source}</span>
                    {data.isCriminal && <span className="pim-badge pim-badge--red">CRIMINAL</span>}
                    {data.isLabor && <span className="pim-badge pim-badge--yellow">TRABALHISTA</span>}
                    {data.status && <span className="pim-badge pim-badge--gray">{data.status}</span>}
                </div>

                {/* ── BODY: 2 COLUMNS ── */}
                <div className="pim-body">

                    {/* ── LEFT COLUMN: Source details ── */}
                    <div className="pim-col-left">

                        {reviewTone && (
                            <section className={`pim-review-callout pim-review-callout--${reviewTone.level}`} aria-label="Orientação de revisão criminal">
                                <div className="pim-review-callout__eyebrow">{reviewTone.label}</div>
                                <div className="pim-review-callout__message">{reviewTone.message}</div>
                                <div className="pim-review-callout__meta">
                                    {(data.specificRole || data.personType || data.tipoPrincipal || data.partyType || data.polo) && <span>Papel: {data.specificRole || data.personType || data.tipoPrincipal || data.partyType || data.polo}</span>}
                                    {(data.isDirectCpfMatch || data.hasExactCpfMatch) && <span>CPF confirmado</span>}
                                    {(data.matchType || data.matchDocumentoPor) && <span>Match: {data.matchType || data.matchDocumentoPor}</span>}
                                </div>
                            </section>
                        )}

                        {/* Tribunal / Court */}
                        <div className="pim-section">
                            <div className="pim-court-name">
                                {data.tribunalAcronym || data.courtName || data.tribunal || '—'}
                            </div>
                            <div className="pim-court-details">
                                {[data.county || data.courtDistrict || data.city, data.orgao || data.judgingBody, data.area || data.courtType].filter(Boolean).join(' · ')}
                            </div>
                            {data.instance && <div className="pim-court-details">Instância: {data.instance}</div>}
                            {data.distributionDate && <div className="pim-court-details">Distribuição: {data.distributionDate}</div>}
                            {data.dataDisponibilizacao && <div className="pim-court-details">Publicação: {data.dataDisponibilizacao}</div>}
                        </div>

                        {/* Subjects */}
                        {(data.subjects?.length > 0 || data.assunto || data.cnjSubject) && (
                            <div className="pim-section">
                                <div className="pim-label">Assuntos</div>
                                <div className="pim-chips">
                                    {(data.subjects || []).map((s, i) => (
                                        <span key={i} className="pim-chip">{s}</span>
                                    ))}
                                    {!data.subjects?.length && (data.assunto || data.cnjSubject) && (
                                        <span className="pim-chip">{data.assunto || data.cnjSubject}</span>
                                    )}
                                    {data.cnjBroadSubject && <span className="pim-chip pim-chip--subtle">{data.cnjBroadSubject}</span>}
                                </div>
                            </div>
                        )}

                        {/* Classifications */}
                        {data.classifications?.length > 0 && (
                            <div className="pim-section">
                                <div className="pim-label">Classificações</div>
                                <div className="pim-chips">
                                    {data.classifications.map((c, i) => (
                                        <span key={i} className="pim-chip pim-chip--subtle">{c}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {source === 'DJEN' && (data.classe || data.tipoComunicacao || data.numeroProcessoMascara || data.numeroProcesso) && (
                            <div className="pim-section">
                                <div className="pim-label">Comunicação DJEN selecionada</div>
                                <div className="pim-meta-grid">
                                    {(data.numeroProcessoMascara || data.numeroProcesso) && <div><span className="pim-label">Processo</span> {data.numeroProcessoMascara || data.numeroProcesso}</div>}
                                    {data.classe && <div><span className="pim-label">Classe</span> {data.classe}</div>}
                                    {data.tipoComunicacao && <div><span className="pim-label">Tipo</span> {data.tipoComunicacao}</div>}
                                    {data.polo && <div><span className="pim-label">Polo</span> {data.polo}</div>}
                                </div>
                            </div>
                        )}

                        {/* Parties / Envolvidos */}
                        {parties.length > 0 && (
                            <div className="pim-section">
                                <div className="pim-label">Envolvidos ({parties.length})</div>
                                <div className="pim-parties-list">
                                    {parties.map((p, i) => (
                                        <div key={i} className={`pim-party ${i % 2 === 0 ? '' : 'pim-party--alt'}`}>
                                            <span className="pim-party-name">{p.name || '—'}</span>
                                            {(p.personType || p.role) && (
                                                <span className="pim-party-role">· {p.personType || p.role}</span>
                                            )}
                                            {p.side && <span className="pim-party-role">Polo {p.side}</span>}
                                            {p.document && (
                                                <span className="pim-party-doc">
                                                    {p.document.length === 11
                                                        ? `•••.${p.document.slice(3, 6)}.•••-${p.document.slice(9)}`
                                                        : p.document.length > 8
                                                            ? `${p.document.slice(0, 4)}...${p.document.slice(-4)}`
                                                            : p.document}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Last step (Judit) */}
                        {data.lastStep && (
                            <div className="pim-section">
                                <div className="pim-label">
                                    Último andamento
                                    {data.lastStepDate && <span className="pim-label-sub"> ({data.lastStepDate})</span>}
                                </div>
                                <blockquote className="pim-blockquote">{data.lastStep}</blockquote>
                            </div>
                        )}

                        {/* Decisions (BDC) */}
                        {data.decisions?.length > 0 && (
                            <div className="pim-section">
                                <div className="pim-label">Decisões ({data.decisions.length})</div>
                                {data.decisions.map((d, i) => (
                                    <div key={i} className="pim-decision-card">
                                        {d.date && <div className="pim-decision-date">{formatDate(d.date)}</div>}
                                        <div className="pim-decision-content">{d.content}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Movements (BDC Updates) */}
                        {data.movements?.length > 0 && (
                            <div className="pim-section">
                                <div className="pim-label">Movimentações ({data.movements.length})</div>
                                {data.movements.map((m, i) => (
                                    <div key={i} className="pim-movement">
                                        <span className="pim-movement-date">{m.date ? formatDate(m.date) : '—'}</span>
                                        <span className="pim-movement-content">{m.content}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Extra metadata */}
                        <div className="pim-section pim-meta-grid">
                            {data.amount != null && <div><span className="pim-label">Valor</span> R$ {Number(data.amount).toLocaleString('pt-BR')}</div>}
                            {data.value != null && <div><span className="pim-label">Valor</span> R$ {Number(data.value).toLocaleString('pt-BR')}</div>}
                            {data.stepsCount > 0 && <div><span className="pim-label">Movimentações</span> {data.stepsCount}</div>}
                            {data.lawsuitAgeDays != null && <div><span className="pim-label">Idade</span> {Math.round(data.lawsuitAgeDays / 365)} ano(s)</div>}
                            {data.secrecyLevel > 0 && <div><span className="pim-label">Sigilo</span> Nível {data.secrecyLevel}</div>}
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN: DJEN Timeline ── */}
                    <div className="pim-col-right">
                        <div className="pim-label" style={{ marginBottom: 16 }}>
                            Publicações no Diário (DJEN) · {djenTimeline.length} ocorrência(s)
                        </div>

                        {djenTimeline.length === 0 ? (
                            <div className="pim-empty">
                                <div className="pim-empty-icon">📭</div>
                                <div>Sem publicações no Diário Oficial Nacional para este processo.</div>
                            </div>
                        ) : (
                            <div className="pim-timeline">
                                <div className="pim-timeline-line" />
                                {djenTimeline.map((doc, i) => (
                                    <div key={doc.id || i} className="pim-timeline-node">
                                        <div className="pim-timeline-dot" />
                                        <div className="pim-timeline-card">
                                            <div className="pim-timeline-header">
                                                <span className="pim-timeline-date">{doc.dataDisponibilizacao || '—'}</span>
                                                <span className="pim-timeline-tipo">{doc.tipoComunicacao || '—'}</span>
                                                <span className="pim-timeline-tribunal">{doc.tribunal || ''}</span>
                                            </div>
                                            {doc.orgao && <div className="pim-timeline-orgao">{doc.orgao}</div>}
                                            {doc.classe && <div className="pim-timeline-classe">{doc.classe}</div>}
                                            {doc.textoCompleto && (
                                                <details className="pim-timeline-texto-details">
                                                    <summary>Ver despacho completo</summary>
                                                    <div className="pim-timeline-texto">{doc.textoCompleto}</div>
                                                </details>
                                            )}
                                            {doc.advogados?.length > 0 && (
                                                <div className="pim-timeline-advogados">
                                                    {doc.advogados.map((adv, ai) => (
                                                        <span key={ai}>Adv: {adv.nome} {adv.oab && `(OAB ${adv.oab})`}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
