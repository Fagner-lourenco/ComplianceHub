/**
 * deterministicPrefill.js — Funções puras de construção de prefill determinístico
 * Extraídas do monolito index.js
 */

const {
    selectTopProcessos,
    formatProcessBlock,
    formatCnj,
    normCnj,
    extractSentenceDetails,
    detectCartaDeGuia,
    classifyWarrantType,
    findLinkedCivilProcess,
    filterDjenComunicacoesByConfirmedProcess,
    isMaterialCriminalProcess,
    formatDateBR,
} = require('../helpers/reportHelpers');
const { SAFE_NARRATIVE_TEXTS, narrativeMatches } = require('./reportEngine');

function evaluateComplexityTriggers(caseData) {
    const triggers = [];
    const coverageNotes = Array.isArray(caseData.coverageNotes) ? caseData.coverageNotes : [];
    const hasOnlyNoProcessCoverageNote = coverageNotes.length > 0
        && coverageNotes.every((note) => /nenhum provider retornou processo aproveitavel/i.test(String(note || '')));
    const benignLowCoverageNegative = caseData.criminalFlag === 'NEGATIVE'
        && caseData.coverageLevel === 'LOW_COVERAGE'
        && caseData.providerDivergence !== 'HIGH'
        && hasOnlyNoProcessCoverageNote;
    if (caseData.reviewRecommended) triggers.push('REVIEW_RECOMMENDED');
    if ((caseData.ambiguityNotes || []).length > 0) triggers.push('HOMONYM_AMBIGUITY');
    const eq = caseData.criminalEvidenceQuality || '';
    if (['MIXED_STRONG_AND_WEAK', 'WEAK_NAME_ONLY'].includes(eq)) triggers.push('CRIMINAL_EVIDENCE_UNCERTAIN');
    if (caseData.providerDivergence === 'HIGH') triggers.push('HIGH_PROVIDER_DIVERGENCE');
    if (caseData.coverageLevel === 'LOW_COVERAGE' && !benignLowCoverageNegative) triggers.push('LOW_COVERAGE');
    if (caseData.criminalFlag === 'INCONCLUSIVE') triggers.push('CRIMINAL_FLAG_INCONCLUSIVE');
    if (caseData.warrantFlag === 'INCONCLUSIVE') triggers.push('WARRANT_FLAG_INCONCLUSIVE');
    return { isComplex: triggers.length > 0, triggersActive: triggers };
}

function formatDjenComunicacao(item, index) {
    const lines = [];
    const num = index + 1;
    const processo = item.numeroProcessoMascara || item.numeroProcesso || 'Processo nao informado';
    const classe = item.classe || 'Classe nao informada';
    const tribunal = item.tribunal || 'Tribunal nao informado';
    const data = item.dataDisponibilizacao || 'Data nao informada';
    const orgao = item.orgao || '';
    const poloLabel = item.polo === 'A' ? 'autor' : item.polo === 'P' ? 'reu' : 'polo nao informado';

    let header = `${String(num).padStart(2, '0')}. ${processo} | ${classe} | ${tribunal} | ${data}`;
    if (item.geoMatch === true) header += ' | [UF candidato]';
    else if (item.geoMatch === false) header += ' | [outro estado]';
    lines.push(header);

    if (orgao) {
        lines.push(`    Polo: ${poloLabel} | Orgao: ${orgao}`);
    } else {
        lines.push(`    Polo: ${poloLabel}`);
    }

    const advogados = (item.advogados || []).filter((a) => a.nome);
    if (advogados.length > 0) {
        const advStr = advogados.map((a) => {
            if (a.oab && a.ufOab) return `${a.nome} (OAB ${a.oab}/${a.ufOab})`;
            return a.nome;
        }).join(', ');
        lines.push(`    Advogado(s): ${advStr}`);
    }

    const score = item.probabilityScore || 0;
    lines.push(`    Score: ${score}/100`);

    return lines.join('\n');
}

function buildDetCriminalNotes(caseData) {
    const parts = [];
    const cf = caseData.criminalFlag || 'NEGATIVE';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const materialCriminalProcesses = criminalProcesses.filter(isMaterialCriminalProcess);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const namesakeCount = caseData.bigdatacorpNamesakeCount;
    const topLevelCriminalNotes = String(caseData.criminalNotes || '').trim();

    const hasMaterialCriminalProcess = materialCriminalProcesses.length > 0;
    const renderedCriminalProcesses = cf === 'POSITIVE' && hasMaterialCriminalProcess
        ? materialCriminalProcesses
        : criminalProcesses;
    const cpfConfirmed = renderedCriminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
    const nameOnly = renderedCriminalProcesses.filter((p) => p.matchType !== 'CPF confirmado');

    if (cf === 'POSITIVE') {
        // go straight to listing
    } else if (cf === 'INCONCLUSIVE' && caseData.criminalEvidenceQuality === 'WEAK_NAME_ONLY') {
        parts.push('Possível homonímia detectada — registros identificados podem não pertencer ao candidato.');
    } else if (cf === 'INCONCLUSIVE' && caseData.criminalEvidenceQuality === 'LOW_COVERAGE_ONLY') {
        parts.push('Cobertura insuficiente das bases consultadas — resultado pode não refletir a situação real.');
    } else if (cf === 'NOT_FOUND') {
        parts.push('Candidato não localizado nas bases criminais consultadas.');
    } else if (cf === 'INCONCLUSIVE') {
        parts.push('Resultado criminal inconclusivo — os dados disponiveis exigem validacao operacional antes da conclusao.');
    } else {
        parts.push(SAFE_NARRATIVE_TEXTS.criminalNegative);
        return parts.join('\n');
    }

    if (cpfConfirmed.length > 0) {
        parts.push('');

        const victimRolePattern = /v[ií]tima|ofendid[oa]|prejudicad[oa]|agraviad[oa]/i;
        const allDirectAreVictim = cpfConfirmed.every(
            (p) => p.isVictim === true || victimRolePattern.test(p.specificRole || ''),
        );
        if (allDirectAreVictim) {
            parts.push('Todos os registros criminais localizados com CPF confirmado indicam o candidato exclusivamente como vítima ou ofendido — não há apontamento de autoria de ato ilícito com confirmação documental.');
        }

        for (let i = 0; i < cpfConfirmed.length; i++) {
            const p = cpfConfirmed[i];
            const sentence = extractSentenceDetails(p.allDecisions);
            const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
            const opts = {};
            if (sentence.penalty) opts.penalty = sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase();
            if (sentence.regime) opts.regime = sentence.regime.charAt(0) + sentence.regime.slice(1).toLowerCase();
            if (sentence.situation) opts.situation = sentence.situation.charAt(0) + sentence.situation.slice(1).toLowerCase();
            if (sentence.articles.length > 0) opts.articles = sentence.articles;
            if (cg.found) {
                const cgLabel = cg.tipo ? `Carta de guia ${cg.tipo.toLowerCase()}` : 'Carta de guia';
                opts.cartaDeGuia = `${cgLabel} expedida — condenação transitada em julgado`;
            }
            parts.push('');
            parts.push(`${i + 1}. ${formatCnj(p.cnj)}`);
            parts.push(formatProcessBlock(p, opts));

            const isProcessVictim = p.isVictim === true || victimRolePattern.test(p.specificRole || '');
            if (isProcessVictim) {
                parts.push(`   Nota: candidato figura como vítima/ofendido neste registro — este apontamento não indica autoria de ato ilícito pelo candidato.`);
            }
        }
    }

    if (nameOnly.length > 0) {
        parts.push('');
        const label = nameOnly.length === 1 ? 'Processo adicional (sem confirmação de CPF):' : `Processos adicionais (${nameOnly.length}, sem confirmação de CPF):`;
        parts.push(label);
        for (const p of nameOnly) {
            parts.push('');
            parts.push(formatProcessBlock(p, {}));
        }
        if (namesakeCount != null) {
            if (namesakeCount <= 1) {
                parts.push(`   Nota: Apenas ${namesakeCount || 1} pessoa no Brasil com o nome "${caseData.candidateName || 'N/A'}". Probabilidade alta de se referir ao mesmo indivíduo, porém sem confirmação documental.`);
            } else if (namesakeCount <= 5) {
                parts.push(`   Nota: ${namesakeCount} pessoas no Brasil com esse nome — probabilidade moderada de homonímia.`);
            } else {
                parts.push(`   Nota: ${namesakeCount} pessoas no Brasil com esse nome — probabilidade relevante de homonímia.`);
            }
        }
    }

    if (cpfConfirmed.length === 0 && nameOnly.length === 0 && cf !== 'NEGATIVE') {
        parts.push('');
        if (cf === 'POSITIVE' && topLevelCriminalNotes && !narrativeMatches(topLevelCriminalNotes, [/nao foram identificados/, /nao ha evidencia criminal relevante/, /sem apontamento/])) {
            parts.push(topLevelCriminalNotes);
        } else {
            parts.push('Nao ha detalhamento processual estruturado suficiente neste bloco. Revisao operacional recomendada.');
        }
    }

    const observations = [];
    for (const p of cpfConfirmed) {
        const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
        if (cg.found) {
            const cgLabel = cg.tipo ? `Carta de Guia ${cg.tipo}` : 'Carta de Guia';
            observations.push(`${cgLabel} expedida no processo ${formatCnj(p.cnj)} — condenação em fase de execução penal`);
            break;
        }
    }
    if (caseData.juditExecutionFlag === 'POSITIVE') {
        observations.push(`Execução penal registrada: ${caseData.juditExecutionCount || 1} registro(s)`);
    }
    if (caseData.pepFlag === 'POSITIVE') {
        observations.push(`Pessoa politicamente exposta (PEP) detectada`);
    }
    if (caseData.sanctionFlag === 'POSITIVE') {
        observations.push(`Sanção ativa detectada`);
    } else if (caseData.sanctionFlag === 'HISTORICAL') {
        observations.push(`Histórico de sanção (não ativa) registrado`);
    }

    const comarcas = [...new Set(criminalProcesses.map((p) => p.comarca).filter(Boolean))];
    if (comarcas.length === 1) {
        observations.push(`Todos os processos concentrados na Comarca de ${comarcas[0]}`);
    }

    if (observations.length > 0) {
        parts.push('');
        for (const obs of observations) {
            parts.push(`• ${obs}`);
        }
    }

    const djenCriminalItems = filterDjenComunicacoesByConfirmedProcess(caseData, 'criminal');
    if (djenCriminalItems.length > 0) {
        parts.push('');
        parts.push(`Comunicacoes judiciais de natureza criminal localizadas (${djenCriminalItems.length}):`);
        djenCriminalItems.slice(0, 5).forEach((item, index) => {
            parts.push(formatDjenComunicacao(item, index));
        });
        if (djenCriminalItems.length > 5) {
            parts.push(`    ... e mais ${djenCriminalItems.length - 5} comunicacao(oes) criminal(is) para revisao operacional.`);
        }
    }

    if (caseData.fontedataCriminalFlag === 'POSITIVE') {
        parts.push('');
        parts.push('Achado criminal complementar:');
        parts.push(caseData.criminalNotes || 'Foi indicado apontamento criminal, sem detalhamento adicional estruturado neste bloco.');
    }

    if (caseData.warrantFlag === 'POSITIVE') {
        parts.push('');
        parts.push('Mandado ativo localizado. Mandados sao tratados como achado critico operacional, independentemente da origem/natureza do processo. Detalhes completos constam na secao de mandados.');
    }

    if (caseData.sanctionFlag === 'POSITIVE' || caseData.bigdatacorpIsSanctioned === true) {
        parts.push('');
        parts.push('Foi identificado alerta cadastral critico. Revisao operacional recomendada.');
    }

    return parts.join('\n');
}

function buildDetLaborNotes(caseData) {
    const parts = [];
    const lf = caseData.laborFlag || 'NEGATIVE';
    const topProcessos = selectTopProcessos(caseData, 20);
    const laborProcesses = topProcessos.filter((p) => p.isTrabalhista);

    if (lf === 'POSITIVE') {
        // go straight to listing
    } else if (lf === 'INCONCLUSIVE') {
        parts.push('Resultado inconclusivo na análise trabalhista.');
    } else if (lf === 'NOT_FOUND') {
        parts.push('Candidato não localizado nas bases trabalhistas consultadas.');
    } else {
        parts.push(SAFE_NARRATIVE_TEXTS.laborNegative);
    }

    if (laborProcesses.length > 0) {
        parts.push('');
        for (let i = 0; i < Math.min(laborProcesses.length, 6); i++) {
            const p = laborProcesses[i];
            parts.push('');
            parts.push(`${i + 1}. ${formatCnj(p.cnj)}`);
            parts.push(formatProcessBlock(p, { candidateName: caseData.candidateName }));
        }
        if (laborProcesses.length > 6) {
            parts.push(`... e mais ${laborProcesses.length - 6} processo(s) trabalhista(s).`);
        }
    }

    const djenLaborItems = filterDjenComunicacoesByConfirmedProcess(caseData, 'labor');
    if (lf === 'POSITIVE' && djenLaborItems.length > 0) {
        parts.push('');
        parts.push(`Comunicacoes judiciais de natureza trabalhista localizadas (${djenLaborItems.length}):`);
        djenLaborItems.slice(0, 5).forEach((item, index) => {
            parts.push(formatDjenComunicacao(item, index));
        });
        if (djenLaborItems.length > 5) {
            parts.push(`    ... e mais ${djenLaborItems.length - 5} comunicacao(oes) trabalhista(s) para revisao operacional.`);
        }
    }

    if (caseData.fontedataLaborFlag === 'POSITIVE') {
        parts.push('');
        parts.push('Achado trabalhista complementar:');
        parts.push(caseData.laborNotes || 'Foi indicado apontamento trabalhista, sem detalhamento adicional estruturado neste bloco.');
    }

    if (lf === 'POSITIVE' && laborProcesses.length === 0 && djenLaborItems.length === 0 && caseData.fontedataLaborFlag !== 'POSITIVE') {
        parts.push('');
        parts.push(SAFE_NARRATIVE_TEXTS.laborPositive + ' Nao ha processo detalhado estruturado disponivel para listagem neste bloco.');
    }

    return parts.join('\n');
}

function buildDetWarrantNotes(caseData) {
    const parts = [];
    const wf = caseData.warrantFlag || 'NEGATIVE';
    const juditWarrants = caseData.juditWarrants || [];
    const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];

    const seen = new Set();
    const unified = [];
    for (const w of juditWarrants) {
        const nk = normCnj(w.code);
        if (nk) seen.add(nk);
        unified.push({ ...w, processNumber: w.code, _source: 'judit' });
    }
    for (const w of bdcWarrants) {
        const nk = normCnj(w.processNumber);
        if (nk && seen.has(nk)) {
            const existing = unified.find((u) => normCnj(u.processNumber) === nk);
            if (existing) {
                if (!existing.imprisonmentKind && w.imprisonmentKind) existing.imprisonmentKind = w.imprisonmentKind;
                if (!existing.magistrate && w.magistrate) existing.magistrate = w.magistrate;
                if (!existing.penaltyTime && w.penaltyTime) existing.penaltyTime = w.penaltyTime;
                if (!existing.expirationDate && w.expirationDate) existing.expirationDate = w.expirationDate;
                if (!existing.agency && w.agency) existing.agency = w.agency;
                if (!existing.county && w.county) existing.county = w.county;
                if (!existing.decision && w.decision) existing.decision = w.decision;
                if (!existing.judgementSummary && w.decision) existing.judgementSummary = w.decision;
            }
            continue;
        }
        if (nk) seen.add(nk);
        unified.push({ ...w, _source: 'bdc' });
    }

    if (wf === 'POSITIVE' && unified.length > 0) {
        // No header — go straight to warrant listing
    } else if (wf === 'POSITIVE' && unified.length === 0) {
        parts.push('Mandado de prisão registrado — dados detalhados indisponíveis nas fontes. Verificar diretamente.');
    } else if (wf === 'INCONCLUSIVE') {
        parts.push('Resultado inconclusivo na consulta de mandados de prisão.');
    } else if (wf === 'NOT_FOUND') {
        parts.push('Candidato não localizado nas bases de mandados consultadas.');
    } else {
        parts.push(SAFE_NARRATIVE_TEXTS.warrantNegative);
        return parts.join('\n');
    }

    if (unified.length > 0) {
        parts.push('');
        for (const w of unified) {
            const wType = classifyWarrantType(w);
            const indent = '   ';
            parts.push('');
            parts.push(`${indent}Processo: ${formatCnj(w.processNumber || w.code)}`);
            parts.push(`${indent}Tipo: ${wType.label}`);
            parts.push(`${indent}Status: ${w.status || 'não informado'}`);
            const vara = w.agency || w.court || null;
            if (vara) parts.push(`${indent}Vara: ${vara}`);
            const comarca = w.county || null;
            if (comarca) parts.push(`${indent}Comarca: ${comarca}`);
            const issueDate = w.issueDate || null;
            const expDate = w.expirationDate || null;
            if (issueDate || expDate) {
                let dateStr = issueDate ? `Emitido: ${formatDateBR(issueDate)}` : '';
                if (expDate) dateStr += `${dateStr ? ' | ' : ''}Válido até: ${formatDateBR(expDate)}`;
                parts.push(`${indent}${dateStr}`);
            }
            if (w.penaltyTime) {
                const cleanPenalty = w.penaltyTime.replace(/\s*\(.*/, '').trim();
                const suffix = /contados/i.test(w.penaltyTime) ? ' contados da data da prisão' : '';
                parts.push(`${indent}Pena: até ${cleanPenalty}${/dias/i.test(cleanPenalty) ? '' : ' dias'}${suffix}`);
            }
            if (w.magistrate) parts.push(`${indent}Magistrado: ${w.magistrate}`);

            if (wType.type === 'CIVIL') {
                const linked = findLinkedCivilProcess(caseData, w);
                if (linked) {
                    w._linkedProcess = linked;
                }
            }
        }
    }

    const context = [];
    for (const w of unified) {
        const wType = classifyWarrantType(w);
        if (wType.type === 'CIVIL') {
            context.push(`Trata-se de prisão CIVIL por inadimplência alimentar — não é mandado de natureza criminal`);
            if (w._linkedProcess) {
                context.push(`Processo cível de alimentos vinculado: ${w._linkedProcess.cnj} (${w._linkedProcess.assunto}, status: ${w._linkedProcess.status})`);
            }
        }
    }
    if (bdcWarrants.length > 1) {
        const processNums = bdcWarrants.map((w) => normCnj(w.processNumber)).filter(Boolean);
        const uniqueProcesses = [...new Set(processNums)];
        if (uniqueProcesses.length < bdcWarrants.length) {
            const magistrates = [...new Set(bdcWarrants.map((w) => w.magistrate).filter(Boolean))];
            if (magistrates.length > 1) {
                context.push(`Detectadas ${bdcWarrants.length} decisões distintas — provável renovação do mandado`);
            }
        }
    }

    if (context.length > 0) {
        parts.push('');
        parts.push('CONTEXTO:');
        for (const c of context) {
            parts.push(`• ${c}`);
        }
    }

    return parts.join('\n');
}

function buildDetKeyFindings(caseData) {
    const findings = [];

    // Alertas cadastrais primeiro (obito / CPF irregular sao informativos, nao bloqueiam)
    if (caseData.bigdatacorpHasDeathRecord === true) {
        findings.push('Indicativo de óbito registrado para o CPF na base cadastral (Receita Federal)');
    }
    const cpfStatusNorm = String(caseData.bigdatacorpCpfStatus || '').trim().toUpperCase();
    if (/CANCEL/.test(cpfStatusNorm)) {
        findings.push('CPF cancelado na Receita Federal');
    } else if (/SUSPENS/.test(cpfStatusNorm)) {
        findings.push('CPF suspenso na Receita Federal');
    }
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const materialCriminalProcesses = caseData.criminalFlag === 'POSITIVE'
        ? criminalProcesses.filter(isMaterialCriminalProcess)
        : [];
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const juditActiveWarrants = Number(caseData.juditActiveWarrantCount) || 0;
    const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];

    for (const p of materialCriminalProcesses.filter((pr) => pr.matchType === 'CPF confirmado')) {
        const sentence = extractSentenceDetails(p.allDecisions);
        if (sentence.isConviction) {
            let txt = `Condenação criminal definitiva`;
            if (p.assunto) txt += ` por ${p.assunto.toLowerCase()}`;
            if (sentence.penalty) txt += `, pena: ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
            findings.push(txt);
            break;
        }
    }

    for (const p of materialCriminalProcesses) {
        const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
        if (cg.found) {
            const cgLabel = cg.tipo ? `Carta de Guia ${cg.tipo}` : 'Carta de Guia';
            findings.push(`${cgLabel} expedida — condenação transitada em julgado`);
            break;
        }
    }

    const juditProcessNums = new Set((caseData.juditWarrants || []).map((w) => normCnj(w.code)).filter(Boolean));
    const uniqueBdcWarrants = bdcWarrants.filter((w) => !juditProcessNums.has(normCnj(w.processNumber)));
    const totalWarrants = juditActiveWarrants + uniqueBdcWarrants.filter((w) => /pendente/i.test(w.status || '')).length;
    if (totalWarrants > 0) {
        const allWarrants = [...(caseData.juditWarrants || []), ...bdcWarrants];
        const wType = allWarrants.length > 0 ? classifyWarrantType(allWarrants[0]) : null;
        let wTxt = `Mandado de prisão${wType?.type === 'CIVIL' ? ' civil' : ''} pendente de cumprimento`;
        if (wType?.type === 'CIVIL') wTxt += ', decorrente de inadimplência de obrigação alimentar';
        findings.push(wTxt);
    }

    const cpfConfirmed = materialCriminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
    if (cpfConfirmed.length > 0 && findings.length < 5) {
        const comarcas = [...new Set(cpfConfirmed.map((p) => p.comarca).filter(Boolean))];
        let txt = `${cpfConfirmed.length} processo(s) criminal(is) com CPF confirmado`;
        if (comarcas.length === 1) txt += ` (${comarcas[0]})`;
        findings.push(txt);
    }

    const civilActive = topProcessos.filter((p) => !p.isCriminal && !p.isTrabalhista && p.isActive && /aliment/i.test(p.assunto || ''));
    if (civilActive.length > 0) {
        findings.push('Processo cível de alimentos ativo — candidato figura como executado');
    }

    if (caseData.pepFlag === 'POSITIVE') {
        findings.push(`Pessoa politicamente exposta (PEP) detectada`);
    }

    if (caseData.sanctionFlag === 'POSITIVE') {
        findings.push(`Sanção ativa detectada`);
    }

    const laborProcesses = topProcessos.filter((p) => p.isTrabalhista);
    if (caseData.laborFlag === 'POSITIVE') {
        const laborText = laborProcesses.length > 1
            ? 'Apontamentos trabalhistas materiais identificados.'
            : 'Apontamento trabalhista material identificado.';
        findings.push(laborText);
    }

    if (caseData.criminalFlag === 'INCONCLUSIVE') {
        findings.push(caseData.criminalEvidenceQuality === 'NEUTRAL_ROLE_REVIEW'
            ? 'Apontamento criminal inconclusivo — papel processual neutro exige revisão operacional'
            : 'Apontamento criminal inconclusivo — exige revisão operacional antes da conclusão');
    }

    const negatives = [];
    // "Nenhum apontamento" so para resultado negativo confirmado.
    if (laborProcesses.length === 0 && caseData.laborFlag !== 'POSITIVE'
        && caseData.laborFlag !== 'INCONCLUSIVE' && caseData.laborFlag !== 'NOT_FOUND') negatives.push('trabalhista');
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') negatives.push('sanções');
    if (caseData.pepFlag !== 'POSITIVE') negatives.push('PEP');
    if (negatives.length >= 2) {
        findings.push(`Nenhum apontamento ${negatives.join(', ')} identificado`);
    }

    return [...new Set(findings)].slice(0, 7);
}

function buildDetExecutiveSummary(caseData) {
    const parts = [];
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const materialCriminalProcesses = criminalProcesses.filter(isMaterialCriminalProcess);
    const juditRoleSummary = caseData.juditRoleSummary || [];

    const employer = caseData.bigdatacorpEmployer;
    const profHistory = caseData.bigdatacorpProfessionHistory;
    if (employer || (profHistory && profHistory.length > 0)) {
        const prof = profHistory?.[0];
        const empName = employer || prof?.companyName || 'não informado';
        const rawSector = caseData.bigdatacorpSector || prof?.sector || '';
        const sectorParts = rawSector.split(' - ');
        const sectorDesc = sectorParts.length >= 3 ? sectorParts.slice(2).join(' - ').toLowerCase() : '';
        const incomeRange = prof?.incomeRange;
        const isEmployed = caseData.bigdatacorpIsEmployed || /active/i.test(prof?.status || '');
        const startDate = prof?.startDate;
        let profLine = `Contexto profissional: último empregador registrado — ${empName}`;
        if (sectorDesc) profLine += `, setor de ${sectorDesc}`;
        if (incomeRange) profLine += `, faixa salarial ${incomeRange}`;
            if (isEmployed && startDate) profLine += `, registrado desde ${formatDateBR(startDate)}`;
        profLine += '.';
        parts.push('');
        parts.push(profLine);
    }

    const findingsSentences = [];
    const cf = caseData.criminalFlag;
    if (cf === 'POSITIVE') {
        let convictionText = 'processo(s) criminal(is) identificado(s)';
        for (const p of materialCriminalProcesses.filter((pr) => pr.matchType === 'CPF confirmado')) {
            const sentence = extractSentenceDetails(p.allDecisions);
            if (sentence.isConviction) {
                convictionText = `condenação criminal definitiva`;
                if (p.assunto) convictionText += ` por ${p.assunto.toLowerCase()}`;
                if (sentence.penalty) convictionText += `, com pena de ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
                if (sentence.regime) convictionText += ` em regime ${sentence.regime.toLowerCase()}`;
                const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
                if (cg.found) {
                    convictionText += '. A carta de guia definitiva já foi expedida, confirmando trânsito em julgado';
                }
                break;
            }
        }
        findingsSentences.push(convictionText);
    } else if (cf === 'INCONCLUSIVE') {
        findingsSentences.push('apontamento criminal inconclusivo pendente de confirmação');
    } else if (cf === 'NOT_FOUND') {
        // Sem resposta das fontes != negativa confirmada — nao afirmar ausencia.
        findingsSentences.push('ficou sem resposta aproveitavel das fontes criminais, nao sendo possivel atestar ausencia de apontamentos');
    } else {
        findingsSentences.push('nenhum apontamento criminal material identificado');
    }

    const wf = caseData.warrantFlag;
    if (wf === 'POSITIVE') {
        const allWarrants = [...(caseData.juditWarrants || []), ...(caseData.bigdatacorpActiveWarrants || [])];
        const wType = allWarrants.length > 0 ? classifyWarrantType(allWarrants[0]) : null;
        let wText = 'mandado de prisão pendente de cumprimento';
        if (wType?.type === 'CIVIL') wText = 'mandado de prisão civil pendente de cumprimento, vinculado a inadimplência de obrigação alimentar';
        findingsSentences.push(wText);
    }

    const lf = caseData.laborFlag;
    if (lf === 'INCONCLUSIVE' || lf === 'NOT_FOUND') {
        findingsSentences.push('resultado trabalhista inconclusivo pendente de validacao');
    }

    const negatives = [];
    // "Nenhum apontamento" so quando o resultado eh negativo confirmado —
    // inconclusivo/sem resposta nao pode virar afirmacao de ausencia.
    if (lf !== 'POSITIVE' && lf !== 'INCONCLUSIVE' && lf !== 'NOT_FOUND') negatives.push('trabalhista');
    if (caseData.pepFlag !== 'POSITIVE') negatives.push('exposicao politica');
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') negatives.push('alertas restritivos');
    if (negatives.length > 0) {
        findingsSentences.push(`nenhum apontamento ${negatives.join(', ')} identificado`);
    }

    if (caseData.pepFlag === 'POSITIVE') findingsSentences.push('pessoa politicamente exposta (PEP) detectada');
    if (caseData.sanctionFlag === 'POSITIVE') findingsSentences.push('sanção ativa detectada');

    if (findingsSentences.length > 0) {
        const clauses = findingsSentences.map((sentence) => {
            if (sentence === 'nenhum apontamento criminal material identificado') {
                return 'nao identificou apontamentos criminais materiais';
            }
            if (sentence.startsWith('nenhum apontamento ')) {
                return sentence.replace(/^nenhum apontamento (.+) identificado$/, 'nao identificou apontamentos $1');
            }
            if (sentence.startsWith('ficou sem resposta')) {
                return sentence;
            }
            return `identificou ${sentence}`;
        });
        parts.push('');
        parts.push(`A analise ${clauses.join('. Tambem ')}.`);
    }

    return parts.join('\n');
}

function buildDetFinalJustification(caseData) {
    const parts = [];
    const name = caseData.candidateName || 'Candidato';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const materialCriminalProcesses = criminalProcesses.filter(isMaterialCriminalProcess);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const namesakeCount = caseData.bigdatacorpNamesakeCount;

    let derivedVerdict;
    {
        const cf = caseData.criminalFlag;
        const wf = caseData.warrantFlag;
        const lf = caseData.laborFlag;
        const sanctioned = caseData.sanctionFlag === 'POSITIVE';
        if (cf === 'POSITIVE' || wf === 'POSITIVE' || sanctioned) {
            derivedVerdict = 'NOT_RECOMMENDED';
        } else if (lf === 'POSITIVE' || caseData.pepFlag === 'POSITIVE' || ['INCONCLUSIVE', 'NOT_FOUND'].includes(cf) || wf === 'INCONCLUSIVE') {
            derivedVerdict = 'ATTENTION';
        } else {
            derivedVerdict = 'FIT';
        }
    }

    const cf = caseData.criminalFlag;
    if (cf === 'POSITIVE') {
        const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
        let crimParagraph = '';
        for (const p of cpfConfirmed) {
            const sentence = extractSentenceDetails(p.allDecisions);
            if (sentence.isConviction) {
                crimParagraph = `O candidato possui condenação criminal definitiva`;
                if (p.assunto) crimParagraph += ` por ${p.assunto.toLowerCase()}`;
                if (sentence.articles.length > 0) crimParagraph += ` (${sentence.articles.join(', ')})`;
                if (sentence.penalty) crimParagraph += `, com pena de ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
                if (sentence.regime) crimParagraph += ` em regime ${sentence.regime.toLowerCase()}`;
                if (sentence.situation) crimParagraph += `, ${sentence.situation.toLowerCase()}`;
                const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
                if (cg.found) {
                    crimParagraph += `. A condenação transitou em julgado, conforme atesta a expedição da carta de guia ${cg.tipo ? cg.tipo.toLowerCase() : ''}`;
                }
                crimParagraph += '.';
                break;
            }
        }
        if (!crimParagraph) {
            if (materialCriminalProcesses.length > 0) {
                const cpfCount = materialCriminalProcesses.filter((p) => p.matchType === 'CPF confirmado').length;
                const nameOnlyCount = materialCriminalProcesses.length - cpfCount;
                if (cpfCount > 0 && nameOnlyCount === 0) {
                    crimParagraph = `${cpfCount} processo(s) criminal(is) com CPF confirmado, sem condenação definitiva identificada até o momento.`;
                } else if (cpfCount > 0) {
                    crimParagraph = `${cpfCount} processo(s) criminal(is) com CPF confirmado e ${nameOnlyCount} adicional(is) sem confirmação documental. Recomenda-se validação complementar.`;
                } else {
                    crimParagraph = `${materialCriminalProcesses.length} processo(s) criminal(is) identificado(s) — sem confirmação documental de CPF. Recomenda-se validação complementar.`;
                }
            } else {
                crimParagraph = 'Indicadores criminais positivos nas fontes consultadas, porém sem processos detalhados disponíveis.';
            }
        }
        parts.push('');
        parts.push(crimParagraph);
    } else if (cf === 'INCONCLUSIVE') {
        parts.push('');
        if (caseData.criminalEvidenceQuality === 'NEUTRAL_ROLE_REVIEW') {
            parts.push('Foram identificados apontamentos criminais com CPF confirmado, porém em papel processual neutro ou indeterminado. Recomenda-se revisão operacional do papel antes da conclusão.');
        } else {
            parts.push('Foram identificados apontamentos criminais, porém sem confirmação inequívoca de identidade. Recomenda-se análise complementar.');
        }
    } else if (cf === 'NOT_FOUND') {
        parts.push('');
        parts.push('Nao foi possivel obter resposta aproveitavel das fontes criminais consultadas — nao e possivel atestar ausencia de apontamentos. Recomenda-se nova consulta ou verificacao manual.');
    } else {
        parts.push('');
        parts.push(SAFE_NARRATIVE_TEXTS.criminalNegative);
    }

    const wf = caseData.warrantFlag;
    if (wf === 'POSITIVE') {
        const allWarrants = [...(caseData.juditWarrants || []), ...(caseData.bigdatacorpActiveWarrants || [])];
        if (allWarrants.length > 0) {
            const w = allWarrants[0];
            const wType = classifyWarrantType(w);
            let wParagraph = 'Adicionalmente, há mandado de prisão';
            if (wType.type === 'CIVIL') {
                wParagraph += ' civil pendente de cumprimento por inadimplência de obrigação alimentar';
            } else {
                wParagraph += ' pendente de cumprimento';
            }
            const processNum = w.processNumber || w.code;
            if (processNum) wParagraph += ` (processo ${formatCnj(processNum)})`;
            if (w.penaltyTime) {
                const days = w.penaltyTime.match(/\d+/)?.[0];
                if (days) wParagraph += `, com prazo de até ${days} dias`;
            }
            wParagraph += '.';
            const linked = findLinkedCivilProcess(caseData, w);
            if (linked) {
                wParagraph += ` O candidato também é parte em processo cível ativo de ${linked.assunto.toLowerCase()} na mesma vara (${linked.cnj}).`;
            }
            parts.push('');
            parts.push(wParagraph);
        }
    }

    const secondaries = [];
    if (caseData.laborFlag !== 'POSITIVE' && caseData.laborFlag !== 'INCONCLUSIVE' && caseData.laborFlag !== 'NOT_FOUND') {
        secondaries.push('apontamentos trabalhistas');
    }
    if (caseData.laborFlag === 'INCONCLUSIVE' || caseData.laborFlag === 'NOT_FOUND') {
        parts.push('');
        parts.push('Resultado trabalhista inconclusivo — recomenda-se validacao complementar.');
    }
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') {
        secondaries.push('alertas restritivos');
    }
    if (caseData.pepFlag !== 'POSITIVE') {
        secondaries.push('exposicao politica');
    }
    if (secondaries.length > 0) {
        parts.push('');
        let secondaryLine = `Nao foram identificados ${secondaries.join(', ')}.`;
        if (caseData.laborFlag === 'POSITIVE') secondaryLine += ' Há processos trabalhistas registrados.';
        parts.push(secondaryLine);
    }
    if (caseData.pepFlag === 'POSITIVE') {
        parts.push(`${name} foi identificado como pessoa politicamente exposta.`);
    }
    if (caseData.sanctionFlag === 'POSITIVE') {
        parts.push('Há sanção ativa detectada nas bases consultadas.');
    }

    parts.push('');
    if (derivedVerdict === 'NOT_RECOMMENDED') {
        parts.push('O conjunto de evidências configura risco elevado para continuidade do processo.');
    } else if (derivedVerdict === 'ATTENTION') {
        parts.push('Os apontamentos identificados exigem avaliacao operacional antes de qualquer decisao final.');
    } else {
        parts.push('Nao foram identificados impeditivos materiais para continuidade do fluxo interno.');
    }

    const secretProcesses = topProcessos.filter((p) => /segredo|sigilo|oculta/i.test(p.status || '') || /segredo|sigilo/i.test(p.assunto || ''));
    const nameOnlyProcesses = criminalProcesses.filter((p) => p.matchType !== 'CPF confirmado');
    if (secretProcesses.length > 0 || nameOnlyProcesses.length > 0 || namesakeCount != null) {
        const caveats = [];
        if (secretProcesses.length > 0) {
            const cnjs = secretProcesses.slice(0, 2).map((p) => formatCnj(p.cnj));
            caveats.push(`${secretProcesses.length} processo(s) sob segredo de justiça (${cnjs.join(', ')}) — sem confirmação documental de CPF`);
        }
        if (namesakeCount != null) {
            if (namesakeCount <= 1) {
                caveats.push(`nome com ocorrência única no Brasil, o que reduz significativamente a possibilidade de homonímia`);
            } else if (namesakeCount <= 5) {
                caveats.push(`${namesakeCount} pessoas no Brasil com esse nome — probabilidade moderada de homonímia`);
            } else {
                caveats.push(`${namesakeCount} pessoas no Brasil com esse nome — probabilidade relevante de homonímia`);
            }
        }
        if (caveats.length > 0) {
            parts.push('');
            parts.push(`Ressalva: ${caveats.join('. ')}.`);
        }
    }

    return parts.join('\n');
}

function buildDeterministicPrefill(caseData) {
    const complexity = evaluateComplexityTriggers(caseData);
    return {
        executiveSummary: buildDetExecutiveSummary(caseData),
        criminalNotes: buildDetCriminalNotes(caseData),
        laborNotes: buildDetLaborNotes(caseData),
        warrantNotes: buildDetWarrantNotes(caseData),
        keyFindings: buildDetKeyFindings(caseData),
        finalJustification: buildDetFinalJustification(caseData),
        metadata: {
            source: 'deterministic',
            version: 'v5-deterministic-prefill',
            generatedAt: new Date().toISOString(),
            triggersActive: complexity.triggersActive,
            isComplex: complexity.isComplex,
        },
    };
}

module.exports = {
    buildDeterministicPrefill,
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
    formatDjenComunicacao,
};
