const { asDate } = require('../utils/dateUtils');
const {
    normCnj,
    formatCnj,
    formatDateBR,
    classifyWarrantType,
    detectCartaDeGuia,
    findLinkedCivilProcess,
    extractSentenceDetails,
    formatProcessBlock,
    selectTopProcessos,
} = require('../utils/processUtils');

function evaluateComplexityTriggers(caseData) {
    const triggers = [];
    if (caseData.reviewRecommended) triggers.push('REVIEW_RECOMMENDED');
    if ((caseData.ambiguityNotes || []).length > 0) triggers.push('HOMONYM_AMBIGUITY');
    const eq = caseData.criminalEvidenceQuality || '';
    if (['MIXED_STRONG_AND_WEAK', 'WEAK_NAME_ONLY'].includes(eq)) triggers.push('CRIMINAL_EVIDENCE_UNCERTAIN');
    if (caseData.providerDivergence === 'HIGH') triggers.push('HIGH_PROVIDER_DIVERGENCE');
    if (caseData.coverageLevel === 'LOW_COVERAGE') triggers.push('LOW_COVERAGE');
    if (['INCONCLUSIVE_HOMONYM', 'INCONCLUSIVE_LOW_COVERAGE'].includes(caseData.criminalFlag)) triggers.push('CRIMINAL_FLAG_INCONCLUSIVE');
    if (caseData.warrantFlag === 'INCONCLUSIVE') triggers.push('WARRANT_FLAG_INCONCLUSIVE');
    return { isComplex: triggers.length > 0, triggersActive: triggers };
}

function buildDetCriminalNotes(caseData) {
    const parts = [];
    const cf = caseData.criminalFlag || 'NEGATIVE';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const namesakeCount = caseData.bigdatacorpNamesakeCount;

    // Separate by CPF confirmation
    const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
    const nameOnly = criminalProcesses.filter((p) => p.matchType !== 'CPF confirmado');

    // Header context (no redundant status — badge already in report)
    if (cf === 'POSITIVE') {
        const sev = (caseData.criminalSeverity || 'não classificada').toUpperCase();
        parts.push(`Severidade ${sev}. Síntese dos registros em nome de ${caseData.candidateName || 'candidato(a)'}:`);
    } else if (cf === 'INCONCLUSIVE_HOMONYM') {
        parts.push('Possível homonímia detectada — registros identificados podem não pertencer ao candidato.');
    } else if (cf === 'INCONCLUSIVE_LOW_COVERAGE') {
        parts.push('Cobertura insuficiente das bases consultadas — resultado pode não refletir a situação real.');
    } else if (cf === 'NEGATIVE_PARTIAL') {
        parts.push('Consulta realizada com cobertura parcial das bases disponíveis.');
    } else if (cf === 'NOT_FOUND') {
        parts.push('Candidato não localizado nas bases criminais consultadas.');
    } else {
        parts.push('Nenhum processo criminal identificado nas bases consultadas.');
        return parts.join('\n');
    }

    // CPF-confirmed processes
    if (cpfConfirmed.length > 0) {
        parts.push('');
        parts.push(`PROCESSOS IDENTIFICADOS (${cpfConfirmed.length} com CPF confirmado):`);
        for (let i = 0; i < cpfConfirmed.length; i++) {
            const p = cpfConfirmed[i];
            // Extract sentence details from decisions
            const sentence = extractSentenceDetails(p.allDecisions);
            // Detect carta de guia
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
        }
    }

    // Name-only processes
    if (nameOnly.length > 0) {
        parts.push('');
        const label = nameOnly.length === 1 ? 'PROCESSO ADICIONAL (sem confirmação de CPF):' : `PROCESSOS ADICIONAIS (${nameOnly.length}, sem confirmação de CPF):`;
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

    // Fallback body when header exists but no processes to list
    if (cpfConfirmed.length === 0 && nameOnly.length === 0 && cf !== 'NEGATIVE') {
        parts.push('');
        parts.push('Dados detalhados de processos indisponíveis — classificação baseada nos indicadores das fontes consultadas.');
    }

    // Observations
    const observations = [];
    // Carta de guia general note
    for (const p of cpfConfirmed) {
        const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
        if (cg.found) {
            const cgLabel = cg.tipo ? `Carta de Guia ${cg.tipo}` : 'Carta de Guia';
            observations.push(`${cgLabel} expedida no processo ${formatCnj(p.cnj)} — condenação em fase de execução penal`);
            break;
        }
    }
    // Penal execution
    if (caseData.juditExecutionFlag === 'POSITIVE') {
        observations.push(`Execução penal registrada: ${caseData.juditExecutionCount || 1} registro(s)`);
    }
    // PEP / Sanctions
    if (caseData.pepFlag === 'POSITIVE') {
        observations.push(`Pessoa politicamente exposta (PEP) detectada`);
    }
    if (caseData.sanctionFlag === 'POSITIVE') {
        observations.push(`Sanção ativa detectada`);
    } else if (caseData.sanctionFlag === 'HISTORICAL') {
        observations.push(`Histórico de sanção (não ativa) registrado`);
    }
    // Geographic concentration
    const comarcas = [...new Set(criminalProcesses.map((p) => p.comarca).filter(Boolean))];
    if (comarcas.length === 1) {
        observations.push(`Todos os processos concentrados na Comarca de ${comarcas[0]}`);
    }

    if (observations.length > 0) {
        parts.push('');
        parts.push('OBSERVAÇÕES:');
        for (const obs of observations) {
            parts.push(`• ${obs}`);
        }
    }

    return parts.join('\n');
}

function buildDetLaborNotes(caseData) {
    const parts = [];
    const lf = caseData.laborFlag || 'NEGATIVE';
    const topProcessos = selectTopProcessos(caseData, 20);
    const laborProcesses = topProcessos.filter((p) => p.isTrabalhista);

    // Header context (no redundant status — badge already in report)
    if (lf === 'POSITIVE') {
        parts.push('Processos trabalhistas identificados nas bases consultadas.');
    } else if (lf === 'INCONCLUSIVE') {
        parts.push('Resultado inconclusivo na análise trabalhista.');
    } else if (lf === 'NOT_FOUND') {
        parts.push('Candidato não localizado nas bases trabalhistas consultadas.');
    } else {
        parts.push('Não possui, até a data da solicitação, nenhum processo trabalhista já distribuído em seu nome.');
    }

    // Process listing (when POSITIVE)
    if (laborProcesses.length > 0) {
        parts.push('');
        parts.push(`PROCESSOS TRABALHISTAS (${laborProcesses.length}):`);
        for (let i = 0; i < Math.min(laborProcesses.length, 6); i++) {
            const p = laborProcesses[i];
            parts.push('');
            parts.push(`${i + 1}. ${formatCnj(p.cnj)}`);
            parts.push(formatProcessBlock(p, {}));
        }
        if (laborProcesses.length > 6) {
            parts.push(`... e mais ${laborProcesses.length - 6} processo(s) trabalhista(s).`);
        }
    }

    // Professional context — ALWAYS shown
    parts.push('');
    parts.push('CONTEXTO PROFISSIONAL:');
    const profHistory = caseData.bigdatacorpProfessionHistory;
    const employer = caseData.bigdatacorpEmployer;
    const employerCnpj = caseData.bigdatacorpEmployerCnpj;
    const sector = caseData.bigdatacorpSector;
    const isEmployed = caseData.bigdatacorpIsEmployed;

    if (employer || (profHistory && profHistory.length > 0)) {
        const prof = profHistory?.[0];
        const empName = employer || prof?.companyName || 'não informado';
        const cnpj = employerCnpj || prof?.companyCnpj || null;
        const rawSector = sector || prof?.sector || null;
        // Clean sector: "PRIVATE - 6204000 - CONSULTORIA EM TI" → "Consultoria em Tecnologia da Informação (Privado)"
        let sectorLabel = null;
        if (rawSector) {
            const sectorParts = rawSector.split(' - ');
            const sectorType = /private/i.test(sectorParts[0] || '') ? 'Privado' : /public/i.test(sectorParts[0] || '') ? 'Público' : null;
            const sectorDesc = sectorParts.length >= 3 ? sectorParts.slice(2).join(' - ') : sectorParts[sectorParts.length - 1];
            sectorLabel = sectorDesc ? `${sectorDesc.charAt(0).toUpperCase()}${sectorDesc.slice(1).toLowerCase()}` : null;
            if (sectorType && sectorLabel) sectorLabel += ` (${sectorType})`;
        }

        parts.push(`   Último empregador registrado: ${empName}`);
        if (cnpj) {
            const fmtCnpj = cnpj.length === 14 ? `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12,14)}` : cnpj;
            parts.push(`   CNPJ: ${fmtCnpj}`);
        }
        if (sectorLabel) parts.push(`   Setor: ${sectorLabel}`);
        // Employment status and start date
        const startDate = prof?.startDate;
        if (isEmployed || /active/i.test(prof?.status || '')) {
              parts.push(`   Vínculo: Registrado${startDate ? ` desde ${formatDateBR(startDate)}` : ''} (última atualização na base)`);
        } else if (startDate) {
            const endDate = prof?.endDate && !prof.endDate.startsWith('9999') ? formatDateBR(prof.endDate) : null;
            parts.push(`   Vínculo: Encerrado${endDate ? ` em ${endDate}` : ''}`);
        }
        // Salary range
        const incomeRange = prof?.incomeRange;
        const income = prof?.income;
        if (incomeRange && income) {
            parts.push(`   Faixa salarial: R$ ${income.toLocaleString('pt-BR')} (${incomeRange})`);
        } else if (incomeRange) {
            parts.push(`   Faixa salarial: ${incomeRange}`);
        } else if (income) {
            parts.push(`   Faixa salarial: R$ ${income.toLocaleString('pt-BR')}`);
        }
        // Public servant check
        const isPublic = /public/i.test(rawSector || '') || /servidor|concurs/i.test(prof?.level || '');
        parts.push(`   Servidor público: ${isPublic ? 'Sim' : 'Não'}`);
    } else {
        parts.push('   Dados profissionais não disponíveis nas bases consultadas.');
    }

    return parts.join('\n');
}

function buildDetWarrantNotes(caseData) {
    const parts = [];
    const wf = caseData.warrantFlag || 'NEGATIVE';
    const juditWarrants = caseData.juditWarrants || [];
    const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];

    // Deduplicate warrants by normalized process number
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
            // Merge BDC data into existing Judit entry
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

    // Header context (no redundant status — badge already in report)
    if (wf === 'POSITIVE' && unified.length > 0) {
        // No header — go straight to warrant listing
    } else if (wf === 'POSITIVE' && unified.length === 0) {
        parts.push('Mandado de prisão registrado — dados detalhados indisponíveis nas fontes. Verificar diretamente.');
    } else if (wf === 'INCONCLUSIVE') {
        parts.push('Resultado inconclusivo na consulta de mandados de prisão.');
    } else if (wf === 'NOT_FOUND') {
        parts.push('Candidato não localizado nas bases de mandados consultadas.');
    } else {
        parts.push('Nenhum mandado de prisão identificado nas bases consultadas.');
        return parts.join('\n');
    }

    // Warrant listing
    if (unified.length > 0) {
        const label = unified.length === 1 ? 'MANDADO IDENTIFICADO:' : `MANDADOS IDENTIFICADOS (${unified.length}):`;
        parts.push('');
        parts.push(label);
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

            // Check for linked civil process
            if (wType.type === 'CIVIL') {
                const linked = findLinkedCivilProcess(caseData, w);
                if (linked) {
                    w._linkedProcess = linked;
                }
            }
        }
    }

    // Context section
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
    // Multiple warrants on same process (renewal detection)
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
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const juditActiveWarrants = Number(caseData.juditActiveWarrantCount) || 0;
    const bdcWarrants = caseData.bigdatacorpActiveWarrants || [];

    // Priority 1: Criminal conviction with sentence details
    for (const p of criminalProcesses.filter((pr) => pr.matchType === 'CPF confirmado')) {
        const sentence = extractSentenceDetails(p.allDecisions);
        if (sentence.isConviction) {
            let txt = `Condenação criminal definitiva`;
            if (p.assunto) txt += ` por ${p.assunto.toLowerCase()}`;
            if (sentence.penalty) txt += `, pena: ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
            findings.push(txt);
            break; // One conviction finding is enough
        }
    }

    // Priority 2: Carta de guia
    for (const p of criminalProcesses) {
        const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
        if (cg.found) {
            const cgLabel = cg.tipo ? `Carta de Guia ${cg.tipo}` : 'Carta de Guia';
            findings.push(`${cgLabel} expedida — condenação transitada em julgado`);
            break;
        }
    }

    // Priority 3: Active warrants (deduplicated)
    const juditProcessNums = new Set((caseData.juditWarrants || []).map((w) => normCnj(w.code)).filter(Boolean));
    const uniqueBdcWarrants = bdcWarrants.filter((w) => !juditProcessNums.has(normCnj(w.processNumber)));
    const totalWarrants = juditActiveWarrants + uniqueBdcWarrants.filter((w) => /pendente/i.test(w.status || '')).length;
    if (totalWarrants > 0) {
        // Classify warrant type
        const allWarrants = [...(caseData.juditWarrants || []), ...bdcWarrants];
        const wType = allWarrants.length > 0 ? classifyWarrantType(allWarrants[0]) : null;
        let wTxt = `Mandado de prisão${wType?.type === 'CIVIL' ? ' civil' : ''} pendente de cumprimento`;
        if (wType?.type === 'CIVIL') wTxt += ', decorrente de inadimplência de obrigação alimentar';
        findings.push(wTxt);
    }

    // Priority 4: Criminal processes count
    const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
    if (cpfConfirmed.length > 0 && findings.length < 5) {
        const comarcas = [...new Set(cpfConfirmed.map((p) => p.comarca).filter(Boolean))];
        let txt = `${cpfConfirmed.length} processo(s) criminal(is) com CPF confirmado`;
        if (comarcas.length === 1) txt += ` (${comarcas[0]})`;
        findings.push(txt);
    }

    // Priority 5: Active alimony/civil process
    const civilActive = topProcessos.filter((p) => !p.isCriminal && !p.isTrabalhista && p.isActive && /aliment/i.test(p.assunto || ''));
    if (civilActive.length > 0) {
        findings.push('Processo cível de alimentos ativo — candidato figura como executado');
    }

    // Priority 6: PEP
    if (caseData.pepFlag === 'POSITIVE') {
        findings.push(`Pessoa politicamente exposta (PEP) detectada`);
    }

    // Priority 7: Sanctions
    if (caseData.sanctionFlag === 'POSITIVE') {
        findings.push(`Sanção ativa detectada`);
    }

    // Priority 8: Consolidated negatives
    const negatives = [];
    const laborProcesses = topProcessos.filter((p) => p.isTrabalhista);
    if (laborProcesses.length === 0 && caseData.laborFlag !== 'POSITIVE') negatives.push('trabalhista');
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') negatives.push('sanções');
    if (caseData.pepFlag !== 'POSITIVE') negatives.push('PEP');
    if (negatives.length >= 2) {
        findings.push(`Nenhum apontamento ${negatives.join(', ')} identificado`);
    }

    return [...new Set(findings)].slice(0, 7);
}

function buildDetExecutiveSummary(caseData) {
    const parts = [];
    const name = caseData.candidateName || 'Candidato';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];

    // Paragraph 1: Bio data
    const bioItems = [name];
    if (caseData.bigdatacorpAge) bioItems.push(`${caseData.bigdatacorpAge} anos`);
    if (caseData.bigdatacorpGender) bioItems.push(`sexo ${caseData.bigdatacorpGender === 'M' ? 'masculino' : 'feminino'}`);
    const cpf = caseData.cpf || '';
    if (cpf) {
        const cpfDigits = cpf.replace(/\D/g, '');
        const masked = cpfDigits.replace(/(\d{3})\d{3}\d{3}(\d{2})/, '$1.***.***-$2');
        const cpfStatus = caseData.bigdatacorpCpfStatus || caseData.enrichmentIdentity?.cpfStatus;
        bioItems.push(`CPF ${masked}${cpfStatus ? ` (status: ${cpfStatus})` : ''}`);
    }
    let bioLine = bioItems.join(', ') + '.';
    if (caseData.bigdatacorpMotherName) {
        bioLine += ` Filiação materna: ${caseData.bigdatacorpMotherName}.`;
    }
    parts.push(bioLine);

    // Paragraph 2: Professional context
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

    // Paragraph 3: Findings summary
    const findingsSentences = [];
    const cf = caseData.criminalFlag;
    if (cf === 'POSITIVE') {
        // Look for conviction
        let convictionText = 'processo(s) criminal(is) identificado(s)';
        for (const p of criminalProcesses.filter((pr) => pr.matchType === 'CPF confirmado')) {
            const sentence = extractSentenceDetails(p.allDecisions);
            if (sentence.isConviction) {
                convictionText = `condenação criminal definitiva`;
                if (p.assunto) convictionText += ` por ${p.assunto.toLowerCase()}`;
                if (sentence.penalty) convictionText += `, com pena de ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
                if (sentence.regime) convictionText += ` em regime ${sentence.regime.toLowerCase()}`;
                // Check carta de guia
                const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
                if (cg.found) {
                    convictionText += '. A carta de guia definitiva já foi expedida, confirmando trânsito em julgado';
                }
                break;
            }
        }
        findingsSentences.push(convictionText);
    } else if (cf === 'INCONCLUSIVE_HOMONYM' || cf === 'INCONCLUSIVE_LOW_COVERAGE') {
        findingsSentences.push('apontamento criminal inconclusivo pendente de confirmação');
    }

    const wf = caseData.warrantFlag;
    if (wf === 'POSITIVE') {
        const allWarrants = [...(caseData.juditWarrants || []), ...(caseData.bigdatacorpActiveWarrants || [])];
        const wType = allWarrants.length > 0 ? classifyWarrantType(allWarrants[0]) : null;
        let wText = 'mandado de prisão pendente de cumprimento';
        if (wType?.type === 'CIVIL') wText = 'mandado de prisão civil pendente de cumprimento, vinculado a inadimplência de obrigação alimentar';
        findingsSentences.push(wText);
    }

    // Consolidated negatives
    const negatives = [];
    if (caseData.laborFlag !== 'POSITIVE') negatives.push('trabalhista');
    if (caseData.pepFlag !== 'POSITIVE') negatives.push('exposição política (PEP)');
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') negatives.push('sanção internacional');
    if (negatives.length > 0) {
        findingsSentences.push(`nenhum apontamento ${negatives.join(', ')} identificado`);
    }

    // PEP / Sanctions if positive
    if (caseData.pepFlag === 'POSITIVE') findingsSentences.push('pessoa politicamente exposta (PEP) detectada');
    if (caseData.sanctionFlag === 'POSITIVE') findingsSentences.push('sanção ativa detectada');

    if (findingsSentences.length > 0) {
        parts.push('');
        parts.push(`A análise identificou ${findingsSentences.join('. Há ')}.`);
    }

    // Paragraph 4: Risk level
    const riskScores = { POSITIVE: 90, INCONCLUSIVE: 50, INCONCLUSIVE_HOMONYM: 50, INCONCLUSIVE_LOW_COVERAGE: 40, NEGATIVE_PARTIAL: 40, NOT_FOUND: 0, NEGATIVE: 0 };
    const pepRisk = caseData.pepFlag === 'POSITIVE' ? 60 : 0;
    const sanctionRisk = caseData.sanctionFlag === 'POSITIVE' ? 95 : caseData.sanctionFlag === 'HISTORICAL' ? 40 : 0;
    const maxRisk = Math.max(
        riskScores[caseData.criminalFlag] || 0,
        riskScores[caseData.laborFlag] || 0,
        riskScores[caseData.warrantFlag] || 0,
        pepRisk,
        sanctionRisk,
    );
    const _riskLabel = maxRisk >= 70 ? 'ALTO' : maxRisk >= 40 ? 'MÉDIO' : 'BAIXO';
    // Risk level omitted from text — already shown as badge in report Risk Box

    return parts.join('\n');
}

function buildDetFinalJustification(caseData) {
    const parts = [];
    const name = caseData.candidateName || 'Candidato';
    const topProcessos = selectTopProcessos(caseData, 20);
    const criminalProcesses = topProcessos.filter((p) => p.isCriminal);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const namesakeCount = caseData.bigdatacorpNamesakeCount;

    // Determine verdict — always derive from current flags (never use stale finalVerdict)
    let derivedVerdict;
    {
        const cf = caseData.criminalFlag;
        const wf = caseData.warrantFlag;
        const lf = caseData.laborFlag;
        const sanctioned = caseData.sanctionFlag === 'POSITIVE';
        if (cf === 'POSITIVE' || wf === 'POSITIVE' || sanctioned) {
            derivedVerdict = 'NOT_RECOMMENDED';
        } else if (lf === 'POSITIVE' || caseData.pepFlag === 'POSITIVE' || ['INCONCLUSIVE_HOMONYM', 'INCONCLUSIVE_LOW_COVERAGE', 'NEGATIVE_PARTIAL', 'NOT_FOUND'].includes(cf) || wf === 'INCONCLUSIVE') {
            derivedVerdict = 'ATTENTION';
        } else {
            derivedVerdict = 'FIT';
        }
    }

    // Verdict omitted from text — already shown as badge in report Risk Box

    // Paragraph 1: Criminal analysis
    const cf = caseData.criminalFlag;
    if (cf === 'POSITIVE') {
        const cpfConfirmed = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado');
        let crimParagraph = '';
        // Look for conviction with details
        for (const p of cpfConfirmed) {
            const sentence = extractSentenceDetails(p.allDecisions);
            if (sentence.isConviction) {
                crimParagraph = `O candidato possui condenação criminal definitiva`;
                if (p.assunto) crimParagraph += ` por ${p.assunto.toLowerCase()}`;
                if (sentence.articles.length > 0) crimParagraph += ` (${sentence.articles.join(', ')})`;
                if (sentence.penalty) crimParagraph += `, com pena de ${sentence.penalty.charAt(0) + sentence.penalty.slice(1).toLowerCase()}`;
                if (sentence.regime) crimParagraph += ` em regime ${sentence.regime.toLowerCase()}`;
                if (sentence.situation) crimParagraph += `, ${sentence.situation.toLowerCase()}`;
                // Carta de guia
                const cg = detectCartaDeGuia(juditRoleSummary, p.cnj);
                if (cg.found) {
                    crimParagraph += `. A condenação transitou em julgado, conforme atesta a expedição da carta de guia ${cg.tipo ? cg.tipo.toLowerCase() : ''}`;
                }
                crimParagraph += '.';
                break;
            }
        }
        if (!crimParagraph) {
            if (criminalProcesses.length > 0) {
                const cpfCount = criminalProcesses.filter((p) => p.matchType === 'CPF confirmado').length;
                const nameOnlyCount = criminalProcesses.length - cpfCount;
                if (cpfCount > 0 && nameOnlyCount === 0) {
                    crimParagraph = `${cpfCount} processo(s) criminal(is) com CPF confirmado, sem condenação definitiva identificada até o momento.`;
                } else if (cpfCount > 0) {
                    crimParagraph = `${cpfCount} processo(s) criminal(is) com CPF confirmado e ${nameOnlyCount} adicional(is) sem confirmação documental. Recomenda-se validação complementar.`;
                } else {
                    crimParagraph = `${criminalProcesses.length} processo(s) criminal(is) identificado(s) — sem confirmação documental de CPF. Recomenda-se validação complementar.`;
                }
            } else {
                crimParagraph = 'Indicadores criminais positivos nas fontes consultadas, porém sem processos detalhados disponíveis.';
            }
        }
        parts.push('');
        parts.push(crimParagraph);
    } else if (cf === 'INCONCLUSIVE_HOMONYM' || cf === 'INCONCLUSIVE_LOW_COVERAGE') {
        parts.push('');
        parts.push('Foram identificados apontamentos criminais, porém sem confirmação inequívoca de identidade. Recomenda-se análise complementar.');
    }

    // Paragraph 2: Warrant context
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
            // Linked civil process
            const linked = findLinkedCivilProcess(caseData, w);
            if (linked) {
                wParagraph += ` O candidato também é parte em processo cível ativo de ${linked.assunto.toLowerCase()} na mesma vara (${linked.cnj}).`;
            }
            parts.push('');
            parts.push(wParagraph);
        }
    }

    // Paragraph 3: Secondary findings (labor, PEP, sanctions)
    const secondaries = [];
    if (caseData.laborFlag !== 'POSITIVE') {
        secondaries.push('apontamentos trabalhistas');
    }
    if (caseData.sanctionFlag !== 'POSITIVE' && caseData.sanctionFlag !== 'HISTORICAL') {
        secondaries.push('sanções internacionais');
    }
    if (caseData.pepFlag !== 'POSITIVE') {
        secondaries.push('exposição política');
    }
    if (secondaries.length > 0) {
        parts.push('');
        let secondaryLine = `Não foram identificados ${secondaries.join(', ')}.`;
        if (caseData.laborFlag === 'POSITIVE') secondaryLine += ' Há processos trabalhistas registrados.';
        parts.push(secondaryLine);
    }
    if (caseData.pepFlag === 'POSITIVE') {
        parts.push(`${name} foi identificado como pessoa politicamente exposta.`);
    }
    if (caseData.sanctionFlag === 'POSITIVE') {
        parts.push('Há sanção ativa detectada nas bases consultadas.');
    }

    // Paragraph 4: Conclusion
    parts.push('');
    if (derivedVerdict === 'NOT_RECOMMENDED') {
        parts.push('O conjunto de evidências configura risco elevado para continuidade do processo.');
    } else if (derivedVerdict === 'ATTENTION') {
        parts.push('Os apontamentos identificados exigem validação manual antes de qualquer decisão final.');
    } else {
        parts.push('Não foram identificados impeditivos materiais, observados os limites das fontes consultadas.');
    }

    // Caveat: segredo de justiça + namesakeCount
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
    evaluateComplexityTriggers,
    buildDetCriminalNotes,
    buildDetLaborNotes,
    buildDetWarrantNotes,
    buildDetKeyFindings,
    buildDetExecutiveSummary,
    buildDetFinalJustification,
    buildDeterministicPrefill,
};
