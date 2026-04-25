const { asDate } = require('./dateUtils');

function normCnj(cnj) { return (cnj || '').replace(/\D/g, ''); }


function formatCnj(raw) {
    const d = normCnj(raw);
    if (d.length === 20) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`;
    return raw || 'N/A';
}

function formatDateBR(isoStr) {
    if (!isoStr) return 'data não informada';
    const d = asDate(isoStr);
    if (!d || isNaN(d.getTime())) return 'data não informada';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function classifyWarrantType(warrant) {
    if (!warrant) return { type: 'CRIMINAL', label: 'Prisão criminal' };
    // Primary: BDC structured field
    if (/^civil$/i.test(warrant.imprisonmentKind || '')) {
        return { type: 'CIVIL', label: 'Prisão civil por dívida alimentar (art. 528, §3º, CPC)' };
    }
    // Fallback: check decision/judgement text for civil keywords
    const txt = (warrant.decision || warrant.judgementSummary || '').toLowerCase();
    if (/cust[oó]dia\s+civil|art\.\s*528|obriga[çc][aã]o\s+alimentar|d[ií]vida\s+alimentar|pris[aã]o\s+civil/i.test(txt)) {
        return { type: 'CIVIL', label: 'Prisão civil por dívida alimentar (art. 528, §3º, CPC)' };
    }
    // Default
    return { type: 'CRIMINAL', label: 'Prisão criminal' };
}

function detectCartaDeGuia(juditRoleSummary, cnj) {
    if (!juditRoleSummary || !cnj) return { found: false, tipo: null, lastStep: null };
    const nk = normCnj(cnj);
    for (const entry of juditRoleSummary) {
        if (normCnj(entry.code) !== nk) continue;
        const ls = entry.lastStep || '';
        if (!/carta\s+de\s+guia/i.test(ls)) continue;
        let tipo = null;
        if (/definitiva/i.test(ls)) tipo = 'DEFINITIVA';
        else if (/provis[oó]ria/i.test(ls)) tipo = 'PROVISÓRIA';
        return { found: true, tipo, lastStep: ls };
    }
    return { found: false, tipo: null, lastStep: null };
}

function findLinkedCivilProcess(caseData, warrant) {
    if (!warrant) return null;
    const procs = selectTopProcessos(caseData, 30);
    const varaW = (warrant.agency || warrant.court || '').toLowerCase().replace(/\s+/g, ' ');
    for (const p of procs) {
        if (p.isCriminal) continue;
        // Same CNJ as warrant = skip (that's the warrant itself)
        if (normCnj(p.cnj) === normCnj(warrant.processNumber || warrant.code || '')) continue;
        const assuntoMatch = /aliment/i.test(p.assunto || '') || /aliment/i.test(p.classe || '');
        const varaP = (p.vara || '').toLowerCase().replace(/\s+/g, ' ');
        const sameVara = varaW && varaP && (varaW.includes(varaP) || varaP.includes(varaW));
        if (assuntoMatch || sameVara) {
            return { cnj: formatCnj(p.cnj), assunto: p.assunto || p.classe || 'N/A', status: p.status || 'N/A' };
        }
    }
    return null;
}

function extractSentenceDetails(decisions) {
    const result = { penalty: null, regime: null, situation: null, articles: [], isConviction: false };
    if (!decisions || !Array.isArray(decisions)) return result;
    for (const dec of decisions) {
        const txt = (dec.content || dec.text || '');
        if (!txt) continue;
        const upper = txt.toUpperCase();
        // Conviction detection
        if (/CONDENAR|SENTEN[CÇ]A\s+CONDENAT[OÓ]RIA/i.test(upper)) {
            result.isConviction = true;
        }
        // Penalty: "DETENCAO: SETE MESES E VINTE E OITO DIAS;" or "RECLUSAO: ..."
        const penaltyMatch = upper.match(/(?:DETEN[CÇ][AÃ]O|RECLUS[AÃ]O):\s*(.+?);/);
        if (penaltyMatch && !result.penalty) {
            result.penalty = penaltyMatch[0].replace(/;$/, '').trim();
        }
        // Regime: "REGIME PARA DETENCAO: ABERTO;"
        const regimeMatch = upper.match(/REGIME\s+(?:PARA\s+)?(?:DETEN[CÇ][AÃ]O|RECLUS[AÃ]O):\s*(.+?);/);
        if (regimeMatch && !result.regime) {
            result.regime = regimeMatch[1].trim();
        }
        // Situation: "SITUACAO: REU PRIMARIO;"
        const sitMatch = upper.match(/SITUA[CÇ][AÃ]O:\s*(.+?);/);
        if (sitMatch && !result.situation) {
            result.situation = sitMatch[1].trim();
        }
        // Articles: "ART. 147 "CAPUT" DO(A) CP" or "ARTIGOS 147 DO CODIGO PENAL"
        const artMatches = txt.match(/ART(?:IGO)?S?\.\s*\d+[-A-Z]*/gi) || [];
        for (const a of artMatches) {
            const normalized = a.replace(/\s+/g, ' ').trim();
            if (!result.articles.includes(normalized)) result.articles.push(normalized);
        }
    }
    return result;
}

function formatProcessBlock(proc, options = {}) {
    const indent = '   ';
    const lines = [];
    lines.push(`${indent}Processo: ${formatCnj(proc.cnj)}`);
    if (proc.classe) lines.push(`${indent}Tipo: ${proc.classe}`);
    if (proc.assunto) lines.push(`${indent}Assunto: ${proc.assunto}`);
    const statusStr = proc.phase ? `${proc.status} (fase: ${proc.phase})` : proc.status;
    lines.push(`${indent}Status: ${statusStr || 'N/A'}`);
    if (options.penalty) lines.push(`${indent}Pena: ${options.penalty}`);
    if (options.regime) lines.push(`${indent}Regime: ${options.regime}`);
    if (options.situation) lines.push(`${indent}Situação: ${options.situation}`);
    if (options.articles && options.articles.length > 0) lines.push(`${indent}Artigos: ${options.articles.join(', ')}`);
    if (proc.tribunal && proc.tribunal !== 'N/A') {
        const varaStr = proc.vara ? ` | Vara: ${proc.vara}` : '';
        lines.push(`${indent}Tribunal: ${proc.tribunal}${varaStr}`);
    }
    if (proc.comarca) lines.push(`${indent}Comarca: ${proc.comarca}`);
    const roleStr = proc.specificRole || proc.polo;
    if (roleStr && roleStr !== 'N/A') lines.push(`${indent}Papel: ${roleStr}`);
    const distDate = formatDateBR(proc.distributionDate || proc.data);
    const lastDate = proc.lastMovementDate ? formatDateBR(proc.lastMovementDate) : null;
    if (distDate !== 'data não informada' || lastDate) {
        let dateStr = `${indent}Distribuição: ${distDate}`;
        if (lastDate) dateStr += ` | Última mov.: ${lastDate}`;
        lines.push(dateStr);
    }
    if (options.cartaDeGuia) lines.push(`${indent}Obs.: ${options.cartaDeGuia}`);
    return lines.join('\n');
}

function selectTopProcessos(caseData, limit = 10) {
    const escavadorProcessos = caseData.escavadorProcessos || [];
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const seen = new Set();
    const all = [];

    for (const p of juditRoleSummary) {
        const cnj = p.code || '';
        if (cnj) seen.add(normCnj(cnj));
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            classe: (p.classifications || [])[0] || null,
            assunto: (p.subjects || []).slice(0, 2).join(', ') || null,
            status: p.status || 'N/A',
            polo: p.side || p.personType || 'N/A',
            tribunal: p.tribunalAcronym || 'N/A',
            vara: p.county || null,
            comarca: p.city || null,
            data: p.distributionDate || 'N/A',
            fonte: 'Judit',
            isCriminal: !!p.isCriminal,
            isTrabalhista: /trabalh/i.test(p.area || ''),
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch ? 'CPF confirmado' : (p.isPossibleHomonym ? 'possivel homonimo' : 'match por nome'),
            specificRole: p.personType || p.specificRole || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            // v5 enrichment
            lastStep: p.lastStep || null,
            distributionDate: p.distributionDate || null,
            phase: p.phase || null,
            instance: p.instance || null,
            lastMovementDate: null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: null,
        });
    }

    for (const p of escavadorProcessos) {
        const cnj = p.numeroCnj || '';
        const nk = cnj ? normCnj(cnj) : null;
        if (nk && seen.has(nk)) {
            // Merge complementary fields into existing entry
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && p.classe) existing.classe = p.classe;
                if (!existing.assunto && p.assuntoPrincipal) existing.assunto = p.assuntoPrincipal;
                if (!existing.decisionSummary && p.decisions?.[0]?.content) existing.decisionSummary = p.decisions[0].content.slice(0, 200);
                if (!existing.specificRole && (p.specificRole || p.tipoNormalizado)) existing.specificRole = p.specificRole || p.tipoNormalizado;
                if (!existing.comarca && p.processCity) existing.comarca = p.processCity;
                // v5 enrichment
                if (!existing.lastStep && p.lastStep) existing.lastStep = p.lastStep;
                existing.fonte = `${existing.fonte}+Escavador`;
            }
            continue;
        }
        if (nk) seen.add(nk);
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            classe: p.classe || null,
            assunto: p.assuntoPrincipal || null,
            status: p.status || 'N/A',
            polo: p.polo || p.tipoNormalizado || 'N/A',
            tribunal: p.tribunalSigla || 'N/A',
            vara: null,
            comarca: p.processCity || null,
            data: p.dataInicio || 'N/A',
            fonte: 'Escavador',
            isCriminal: /penal|criminal|crime/i.test(p.area || ''),
            isTrabalhista: /trabalh/i.test(p.area || ''),
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr|baixad/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch || p.tipoMatch === 'CPF' ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || p.tipoNormalizado || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            // v5 enrichment
            lastStep: null,
            distributionDate: p.dataInicio || null,
            phase: null,
            instance: null,
            lastMovementDate: null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: p.decisions || null,
        });
    }

    // BigDataCorp processes (dedup by normalized CNJ, merge complementary fields)
    const bdcProcessos = caseData.bigdatacorpProcessos || [];
    for (const p of bdcProcessos) {
        const cnj = p.numero || '';
        const nk = cnj ? normCnj(cnj) : null;
        if (nk && seen.has(nk)) {
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && (p.cnjProcedure || p.tipo)) existing.classe = p.cnjProcedure || p.tipo;
                if (!existing.assunto && (p.assunto || p.cnjSubject)) existing.assunto = p.assunto || p.cnjSubject;
                if (!existing.decisionSummary && p.decisions?.[0]?.content) existing.decisionSummary = p.decisions[0].content.slice(0, 200);
                if (!existing.specificRole && p.specificRole) existing.specificRole = p.specificRole;
                if (!existing.comarca && p.courtDistrict) existing.comarca = p.courtDistrict;
                if (p.isDirectCpfMatch && existing.matchType !== 'CPF confirmado') existing.matchType = 'CPF confirmado';
                // v5 enrichment - merge BDC fields
                if (!existing.courtLevel && p.courtLevel) existing.courtLevel = p.courtLevel;
                if (!existing.judgingBody && p.judgingBody) existing.judgingBody = p.judgingBody;
                if (!existing.lastMovementDate && p.lastMovementDate) existing.lastMovementDate = p.lastMovementDate;
                if (!existing.lawsuitAgeDays && p.lawsuitAgeDays) existing.lawsuitAgeDays = p.lawsuitAgeDays;
                if (!existing.allDecisions && p.decisions) existing.allDecisions = p.decisions;
                existing.fonte = `${existing.fonte}+BigDataCorp`;
            }
            continue;
        }
        if (nk) seen.add(nk);
        all.push({
            cnj: cnj || 'N/A',
            area: p.courtType || p.cnjBroadSubject || 'N/A',
            classe: p.cnjProcedure || p.tipo || null,
            assunto: p.assunto || p.cnjSubject || null,
            status: p.status || 'N/A',
            polo: p.polo || p.partyType || 'N/A',
            tribunal: p.courtName || 'N/A',
            vara: null,
            comarca: p.courtDistrict || null,
            data: p.lastMovementDate || 'N/A',
            fonte: 'BigDataCorp',
            isCriminal: !!p.isCriminal,
            isTrabalhista: !!p.isLabor,
            isActive: /\bativ/i.test(p.status || '') && !/inat/i.test(p.status || ''),
            matchType: p.isDirectCpfMatch ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            // v5 enrichment
            lastStep: null,
            distributionDate: null,
            phase: null,
            instance: null,
            lastMovementDate: p.lastMovementDate || null,
            lawsuitAgeDays: p.lawsuitAgeDays || null,
            courtLevel: p.courtLevel || null,
            judgingBody: p.judgingBody || null,
            allDecisions: p.decisions || null,
        });
    }

    all.sort((a, b) => {
        // criminal first, then trabalhista, then active, then rest
        if (a.isCriminal !== b.isCriminal) return a.isCriminal ? -1 : 1;
        if (a.isTrabalhista !== b.isTrabalhista) return a.isTrabalhista ? -1 : 1;
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return 0;
    });

    return all.slice(0, limit);
}

module.exports = {
    normCnj,
    formatCnj,
    formatDateBR,
    classifyWarrantType,
    detectCartaDeGuia,
    findLinkedCivilProcess,
    extractSentenceDetails,
    formatProcessBlock,
    selectTopProcessos,
};
