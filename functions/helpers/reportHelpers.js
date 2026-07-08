/**
 * reportHelpers.js — Funções puras de auxílio para construção de relatórios
 * Extraídas do monolito index.js para reuso entre módulos
 */

const { classifyProcessArea } = require('./processClassifier');
const { isExcludedCrimeType } = require('./crimeTypeFilter');
const { classifyCriminalMateriality } = require('./criminalMateriality');

function normCnj(cnj) { return (cnj || '').replace(/\D/g, ''); }

function getDjenProcessNumber(item = {}) {
    return normCnj(item.numeroProcesso || item.numeroProcessoMascara || item.numero_processo || item.processNumber || item.cnj);
}

function getConfirmedProviderProcessNumbers(caseData = {}, kind) {
    const numbers = new Set();
    const isCriminalKind = kind === 'criminal';
    const isLaborKind = kind === 'labor';

    for (const item of caseData.juditRoleSummary || []) {
        const matchesKind = (isCriminalKind && item?.isCriminal) || (isLaborKind && item?.isLabor);
        if (item?.hasExactCpfMatch && matchesKind) {
            const value = normCnj(item.code || item.cnj || item.numero || item.numeroProcesso);
            if (value) numbers.add(value);
        }
    }

    for (const item of caseData.bigdatacorpProcessos || []) {
        const matchesKind = (isCriminalKind && item?.isCriminal) || (isLaborKind && item?.isLabor);
        if (item?.isDirectCpfMatch && matchesKind) {
            const value = normCnj(item.numero || item.processNumber || item.cnj || item.numeroProcesso);
            if (value) numbers.add(value);
        }
    }

    return numbers;
}

function filterDjenComunicacoesByConfirmedProcess(caseData = {}, kind) {
    const confirmedProcessNumbers = getConfirmedProviderProcessNumbers(caseData, kind);
    if (confirmedProcessNumbers.size === 0) return [];
    const areaPattern = kind === 'labor' ? /trabalh/i : /criminal|penal/i;

    return (caseData.djenComunicacoes || []).filter((item) => {
        const itemNumber = getDjenProcessNumber(item);
        if (!itemNumber || !confirmedProcessNumbers.has(itemNumber)) return false;
        const areaText = [item.area, item.inferredArea, item.classe, item.tribunal].filter(Boolean).join(' ');
        return areaPattern.test(areaText);
    });
}

function formatCnj(raw) {
    const d = normCnj(raw);
    if (d.length === 20) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`;
    return raw || 'N/A';
}

function asDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'string') {
        const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
        if (brMatch) {
            const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = brMatch;
            const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function normalizePartyName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function isSamePersonName(a, b) {
    const left = normalizePartyName(a);
    const right = normalizePartyName(b);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
}

function isWeakProcessStatus(status) {
    const normalized = normalizePartyName(status);
    if (!normalized || ['N A', 'NA', 'NAO INFORMADO', 'NÃO INFORMADO', 'INDEFINIDO'].includes(normalized)) return true;
    // Vocabulario de pipeline persistido em casos antigos (ex.: Escavador2
    // "detalhes: DONE | movimentacoes: DONE") nao eh status processual.
    return /\b(DONE|PENDING|RUNNING|SKIPPED|FAILED|PARTIAL)\b/.test(normalized);
}

function inferStatusFromLastStep(lastStep) {
    const text = normalizePartyName(lastStep);
    if (!text) return null;
    if (/ARQUIVAD/.test(text)) return 'ARQUIVADO';
    if (/TRANSITAD/.test(text)) return 'TRANSITADO EM JULGADO';
    if (/DISTRIBU/.test(text)) return 'DISTRIBUIDO';
    if (/CONCLUS|REMETID|AUDIENCIA|JUNTADA|DECORRIDO/.test(text)) return 'EM ANDAMENTO';
    return null;
}

function resolveProcessStatus(proc) {
    if (proc && !isWeakProcessStatus(proc.status)) return proc.status;
    // Status fraco/pipeline nunca volta como fallback — melhor omitir a linha.
    return inferStatusFromLastStep(firstMovementContent(proc)) || null;
}

function isPassiveLaborParty(party) {
    const role = normalizePartyName(party?.role || party?.personType);
    const side = normalizePartyName(party?.side);
    if (/ADVOGAD|PROCURADOR|PERITO|RELATOR|CUSTOS LEGIS|TESTEMUNH/.test(role)) return false;
    return /PASSIVE|PASSIVO|DEFENDANT/.test(side) ||
        /RECLAMAD|REU|REQUERID|EXECUTAD|POLO PASSIVO|PASSIVO|RECORRIDO|CONSIGNATARIO/.test(role);
}

function isActiveLaborParty(party) {
    const role = normalizePartyName(party?.role || party?.personType);
    const side = normalizePartyName(party?.side);
    if (/ADVOGAD|PROCURADOR|PERITO|RELATOR|CUSTOS LEGIS|TESTEMUNH/.test(role)) return false;
    return /ACTIVE|ATIVO|PLAINTIFF/.test(side) ||
        /RECLAMANTE|AUTOR|REQUERENTE|EXEQUENTE|RECORRENTE|POLO ATIVO/.test(role);
}

function dedupePartyNames(names) {
    const seen = new Set();
    const result = [];
    for (const name of names) {
        const raw = String(name || '').trim();
        const normalized = normalizePartyName(raw);
        if (!normalized || normalized.length < 4 || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(raw);
    }
    return result;
}

function getProcessParties(proc) {
    return [
        ...(Array.isArray(proc?.parties) ? proc.parties : []),
        ...(Array.isArray(proc?.allParties) ? proc.allParties : []),
    ];
}

function resolveCounterpartyNames(proc, candidateName) {
    const role = normalizePartyName(proc?.specificRole || proc?.polo);
    const parties = getProcessParties(proc);
    if (/TESTEMUNH|ADVOGAD|PROCURADOR|PERITO|RELATOR/.test(role)) return { label: null, names: [] };

    const candidateIsPassive = /RECLAMAD|REU|REQUERID|EXECUTAD|POLO PASSIVO|PASSIVO|RECORRIDO/.test(role);
    const predicate = candidateIsPassive ? isActiveLaborParty : isPassiveLaborParty;
    const names = dedupePartyNames(
        parties
            .filter(predicate)
            .map((party) => party.name)
            .filter((name) => !isSamePersonName(name, candidateName)),
    );

    return {
        label: candidateIsPassive ? 'Parte autora/ativa' : 'Parte reclamada/passiva',
        names,
    };
}

function firstMovementContent(proc) {
    if (proc?.lastStep) return proc.lastStep;
    const movement = Array.isArray(proc?.movements) ? proc.movements.find((item) => item?.content) : null;
    return movement?.content || null;
}

function mergeProcessParties(existing, incoming) {
    const incomingParties = Array.isArray(incoming.parties) ? incoming.parties : [];
    const incomingAllParties = Array.isArray(incoming.allParties) ? incoming.allParties : [];
    if (incomingParties.length > 0) existing.parties = [...(existing.parties || []), ...incomingParties];
    if (incomingAllParties.length > 0) existing.allParties = [...(existing.allParties || []), ...incomingAllParties];
}

function formatLaborProcessBlock(proc, options = {}) {
    const indent = '   ';
    const lines = [];
    lines.push(`${indent}Processo: ${formatCnj(proc.cnj)}`);
    if (proc.classe) lines.push(`${indent}Tipo: ${proc.classe}`);
    if (proc.assunto) lines.push(`${indent}Assunto: ${proc.assunto}`);
    const laborStatus = resolveProcessStatus(proc);
    if (laborStatus) lines.push(`${indent}Status processual: ${laborStatus}`);
    if (proc.tribunal && proc.tribunal !== 'N/A') {
        const varaStr = proc.vara ? ` | Vara: ${proc.vara}` : '';
        lines.push(`${indent}Tribunal: ${proc.tribunal}${varaStr}`);
    }
    if (proc.comarca) lines.push(`${indent}Comarca: ${proc.comarca}`);
    const roleStr = proc.specificRole || proc.polo;
    if (roleStr && roleStr !== 'N/A') lines.push(`${indent}Papel do candidato: ${roleStr}`);
    const counterparty = resolveCounterpartyNames(proc, options.candidateName);
    if (counterparty.label && counterparty.names.length > 0) {
        const visibleNames = counterparty.names.slice(0, 5);
        const suffix = counterparty.names.length > visibleNames.length ? '; ...' : '';
        lines.push(`${indent}${counterparty.label}: ${visibleNames.join('; ')}${suffix}`);
    }
    const distributionSource = proc.fonte === 'BigDataCorp' ? null : proc.data;
    const distDate = formatDateBR(proc.distributionDate || distributionSource);
    const lastDate = proc.lastMovementDate ? formatDateBR(proc.lastMovementDate) : null;
    if (distDate !== 'data não informada') {
        let dateStr = `${indent}Distribuição: ${distDate}`;
        if (lastDate) dateStr += ` | Última movimentação: ${lastDate}`;
        lines.push(dateStr);
    } else if (lastDate) {
        lines.push(`${indent}Última movimentação: ${lastDate}`);
    }
    const lastStep = firstMovementContent(proc);
    if (lastStep) lines.push(`${indent}Último andamento: ${lastStep}`);
    return lines.join('\n');
}

function classifyWarrantType(warrant) {
    if (!warrant) return { type: 'CRIMINAL', label: 'Prisão criminal' };
    if (/^civil$/i.test(warrant.imprisonmentKind || '')) {
        return { type: 'CIVIL', label: 'Prisão civil por dívida alimentar (art. 528, §3º, CPC)' };
    }
    const txt = (warrant.decision || warrant.judgementSummary || '').toLowerCase();
    if (/cust[oó]dia\s+civil|art\.\s*528|obriga[çc][aã]o\s+alimentar|d[ií]vida\s+alimentar|pris[aã]o\s+civil/i.test(txt)) {
        return { type: 'CIVIL', label: 'Prisão civil por dívida alimentar (art. 528, §3º, CPC)' };
    }
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
        if (/CONDENAR|SENTEN[CÇ]A\s+CONDENAT[OÓ]RIA/i.test(upper)) {
            result.isConviction = true;
        }
        const penaltyMatch = upper.match(/(?:DETEN[CÇ][AÃ]O|RECLUS[AÃ]O):\s*(.+?);/);
        if (penaltyMatch && !result.penalty) {
            result.penalty = penaltyMatch[0].replace(/;$/, '').trim();
        }
        const regimeMatch = upper.match(/REGIME\s+(?:PARA\s+)?(?:DETEN[CÇ][AÃ]O|RECLUS[AÃ]O):\s*(.+?);/);
        if (regimeMatch && !result.regime) {
            result.regime = regimeMatch[1].trim();
        }
        const sitMatch = upper.match(/SITUA[CÇ][AÃ]O:\s*(.+?);/);
        if (sitMatch && !result.situation) {
            result.situation = sitMatch[1].trim();
        }
        const artMatches = txt.match(/ART(?:IGO)?S?\.\s*\d+[-A-Z]*/gi) || [];
        for (const a of artMatches) {
            const normalized = a.replace(/\s+/g, ' ').trim();
            if (!result.articles.includes(normalized)) result.articles.push(normalized);
        }
    }
    return result;
}

function formatProcessBlock(proc, options = {}) {
    if (proc.isTrabalhista) return formatLaborProcessBlock(proc, options);

    const indent = '   ';
    const lines = [];
    lines.push(`${indent}Processo: ${formatCnj(proc.cnj)}`);
    if (proc.classe) lines.push(`${indent}Tipo: ${proc.classe}`);
    if (proc.assunto) lines.push(`${indent}Assunto: ${proc.assunto}`);
    const resolvedStatus = resolveProcessStatus(proc);
    if (resolvedStatus) {
        const statusStr = proc.phase ? `${resolvedStatus} (fase: ${proc.phase})` : resolvedStatus;
        lines.push(`${indent}Status: ${statusStr}`);
    } else if (proc.phase) {
        lines.push(`${indent}Fase: ${proc.phase}`);
    }
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
    const lastStepText = firstMovementContent(proc);
    if (lastStepText) lines.push(`${indent}Último andamento: ${lastStepText}`);
    return lines.join('\n');
}

function selectTopProcessos(caseData, limit = 10) {
    const escavadorProcessos = caseData.escavadorProcessos || [];
    const escavador2Processos = (caseData.escavador2Processos || []).filter((p) => p?.isNewEscavador2Finding === true);
    const juditRoleSummary = caseData.juditRoleSummary || [];
    const seen = new Set();
    const all = [];

    for (const p of juditRoleSummary) {
        const cnj = p.code || '';
        if (cnj) seen.add(normCnj(cnj));
        const processArea = classifyProcessArea({
            area: p.area,
            subjects: p.subjects,
            classifications: p.classifications,
            tribunal: p.tribunalAcronym,
        });
        all.push({
            cnj: cnj || 'N/A',
            area: p.area || 'N/A',
            classe: (p.classifications || [])[0] || null,
            assunto: (p.subjects || []).slice(0, 2).join(', ') || null,
            status: p.status || null,
            polo: p.side || p.personType || 'N/A',
            tribunal: p.tribunalAcronym || 'N/A',
            vara: p.county || null,
            comarca: p.city || null,
            data: p.distributionDate || 'N/A',
            fonte: 'Judit',
            isCriminal: !!p.isCriminal || processArea.area === 'CRIMINAL',
            isTrabalhista: !!p.isLabor || processArea.area === 'LABOR' || /trabalh/i.test(p.area || ''),
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch ? 'CPF confirmado' : (p.isPossibleHomonym ? 'possivel homonimo' : 'match por nome'),
            specificRole: p.personType || p.specificRole || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            lastStep: p.lastStep || null,
            distributionDate: p.distributionDate || null,
            phase: p.phase || null,
            instance: p.instance || null,
            lastMovementDate: p.lastStepDate || null,
            lastStepDate: p.lastStepDate || null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: null,
            isVictim: !!p.isVictim,
            isDefendant: !!p.isDefendant,
            isWitness: !!p.isWitness,
            parties: Array.isArray(p.parties) ? p.parties : [],
            allParties: [],
            movements: [],
        });
    }

    const bdcProcessos = caseData.bigdatacorpProcessos || [];
    for (const p of bdcProcessos) {
        const cnj = p.numero || '';
        const nk = cnj ? normCnj(cnj) : null;
        const processArea = classifyProcessArea({
            courtType: p.courtType,
            cnjBroadSubject: p.cnjBroadSubject,
            cnjSubject: p.cnjSubject || p.assunto,
            cnjProcedure: p.cnjProcedure || p.tipo,
            subject: p.assunto,
            procedure: p.tipo,
            tribunal: p.courtName,
        });
        if (nk && seen.has(nk)) {
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && (p.cnjProcedure || p.tipo)) existing.classe = p.cnjProcedure || p.tipo;
                if (!existing.assunto && (p.assunto || p.cnjSubject)) existing.assunto = p.assunto || p.cnjSubject;
                if (!existing.decisionSummary && p.decisions?.[0]?.content) existing.decisionSummary = p.decisions[0].content.slice(0, 200);
                if (!existing.specificRole && p.specificRole) existing.specificRole = p.specificRole;
                if (!existing.comarca && p.courtDistrict) existing.comarca = p.courtDistrict;
                if (p.status && isWeakProcessStatus(existing.status)) existing.status = p.status;
                if (p.isDirectCpfMatch && existing.matchType !== 'CPF confirmado') existing.matchType = 'CPF confirmado';
                if (p.isCriminal && !existing.isCriminal) existing.isCriminal = true;
                if (p.isLabor && !existing.isTrabalhista) existing.isTrabalhista = true;
                if (p.isActive && !existing.isActive) existing.isActive = true;
                if (!existing.courtLevel && p.courtLevel) existing.courtLevel = p.courtLevel;
                if (!existing.judgingBody && p.judgingBody) existing.judgingBody = p.judgingBody;
                if (!existing.lastMovementDate && p.lastMovementDate) existing.lastMovementDate = p.lastMovementDate;
                if (!existing.lawsuitAgeDays && p.lawsuitAgeDays) existing.lawsuitAgeDays = p.lawsuitAgeDays;
                if (p.isVictim && !existing.isVictim) existing.isVictim = true;
                if (p.isWitness && !existing.isWitness) existing.isWitness = true;
                if (p.isDefendant && !existing.isDefendant) existing.isDefendant = true;
                if (!existing.allDecisions && p.decisions) existing.allDecisions = p.decisions;
                if (!existing.lastStep && Array.isArray(p.movements) && p.movements[0]?.content) existing.lastStep = p.movements[0].content;
                mergeProcessParties(existing, { allParties: p.allParties || [], movements: p.movements || [] });
                if (Array.isArray(p.movements) && p.movements.length > 0) existing.movements = [...(existing.movements || []), ...p.movements];
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
            status: p.status || null,
            polo: p.polo || p.partyType || 'N/A',
            tribunal: p.courtName || 'N/A',
            vara: null,
            comarca: p.courtDistrict || null,
            data: p.lastMovementDate || 'N/A',
            fonte: 'BigDataCorp',
            isCriminal: !!p.isCriminal || processArea.area === 'CRIMINAL',
            isTrabalhista: !!p.isLabor || processArea.area === 'LABOR',
            isActive: /\bativ/i.test(p.status || '') && !/inat/i.test(p.status || ''),
            matchType: p.isDirectCpfMatch ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            lastStep: null,
            distributionDate: null,
            phase: null,
            instance: null,
            lastMovementDate: p.lastMovementDate || null,
            lawsuitAgeDays: p.lawsuitAgeDays || null,
            courtLevel: p.courtLevel || null,
            judgingBody: p.judgingBody || null,
            allDecisions: p.decisions || null,
            isVictim: !!p.isVictim,
            isDefendant: !!p.isDefendant,
            isWitness: !!p.isWitness,
            parties: [],
            allParties: Array.isArray(p.allParties) ? p.allParties : [],
            movements: Array.isArray(p.movements) ? p.movements : [],
        });
    }

    for (const p of escavadorProcessos) {
        const cnj = p.numeroCnj || '';
        const nk = cnj ? normCnj(cnj) : null;
        const processArea = classifyProcessArea({
            area: p.area,
            className: p.classe,
            subject: p.assuntoPrincipal,
            tribunal: p.tribunalSigla,
        });
        if (nk && seen.has(nk)) {
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && p.classe) existing.classe = p.classe;
                if (!existing.assunto && p.assuntoPrincipal) existing.assunto = p.assuntoPrincipal;
                if (!existing.decisionSummary && p.decisions?.[0]?.content) existing.decisionSummary = p.decisions[0].content.slice(0, 200);
                if (!existing.specificRole && (p.specificRole || p.tipoNormalizado)) existing.specificRole = p.specificRole || p.tipoNormalizado;
                if (!existing.comarca && p.processCity) existing.comarca = p.processCity;
                if (isWeakProcessStatus(existing.status) && p.status) existing.status = p.status;
                if (!existing.lastStep && p.lastStep) existing.lastStep = p.lastStep;
                if (!existing.lastMovementDate && p.dataUltimaMovimentacao) existing.lastMovementDate = p.dataUltimaMovimentacao;
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
            status: p.status || null,
            polo: p.polo || p.tipoNormalizado || 'N/A',
            tribunal: p.tribunalSigla || 'N/A',
            vara: null,
            comarca: p.processCity || null,
            data: p.dataInicio || 'N/A',
            fonte: 'Escavador',
            isCriminal: !!p.isCriminal || processArea.area === 'CRIMINAL' || /penal|criminal|crime/i.test(p.area || ''),
            isTrabalhista: !!p.isLabor || processArea.area === 'LABOR' || /trabalh/i.test(p.area || ''),
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr|baixad/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch || p.tipoMatch === 'CPF' ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || p.tipoNormalizado || null,
            decisionSummary: p.decisions?.[0]?.content ? p.decisions[0].content.slice(0, 200) : null,
            lastStep: null,
            distributionDate: p.dataInicio || null,
            phase: null,
            instance: null,
            lastMovementDate: p.dataUltimaMovimentacao || null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: p.decisions || null,
            parties: [],
            allParties: [],
            movements: [],
        });
    }

    for (const p of escavador2Processos) {
        const cnj = p.numeroCnj || p.cnj || '';
        const nk = cnj ? normCnj(cnj) : null;
        const processArea = classifyProcessArea({
            area: p.area,
            className: p.classe,
            subject: p.assunto || p.assuntoPrincipal,
            tribunal: p.tribunalSigla || p.tribunal,
        });
        const isCriminal = !!p.isCriminal || processArea.area === 'CRIMINAL' || /penal|criminal|crime/i.test(p.area || '');
        const isLabor = !!p.isLabor || !!p.isTrabalhista || processArea.area === 'LABOR' || /trabalh/i.test(p.area || '');
        const excludedCrimeType = isExcludedCrimeType(p);
        const effectiveCriminal = isCriminal && !excludedCrimeType;

        if (nk && seen.has(nk)) {
            const existing = all.find((e) => normCnj(e.cnj) === nk);
            if (existing) {
                if (!existing.classe && p.classe) existing.classe = p.classe;
                if (!existing.assunto && (p.assunto || p.assuntoPrincipal)) existing.assunto = p.assunto || p.assuntoPrincipal;
                if (!existing.specificRole && (p.specificRole || p.tipoNormalizado || p.tipoPrincipal)) existing.specificRole = p.specificRole || p.tipoNormalizado || p.tipoPrincipal;
                if (isWeakProcessStatus(existing.status) && p.status) existing.status = p.status;
                if (!existing.lastMovementDate && (p.lastMovementDate || p.dataUltimaMovimentacao)) existing.lastMovementDate = p.lastMovementDate || p.dataUltimaMovimentacao;
                if (!existing.distributionDate && (p.distributionDate || p.dataInicio)) existing.distributionDate = p.distributionDate || p.dataInicio;
                if (p.hasExactCpfMatch && existing.matchType !== 'CPF confirmado') existing.matchType = 'CPF confirmado';
                if (effectiveCriminal && !existing.isCriminal) existing.isCriminal = true;
                if (excludedCrimeType && !existing.isExcludedCrimeType) existing.isExcludedCrimeType = excludedCrimeType;
                if (isLabor && !existing.isTrabalhista) existing.isTrabalhista = true;
                if (p.isVictim && !existing.isVictim) existing.isVictim = true;
                if (p.isWitness && !existing.isWitness) existing.isWitness = true;
                if (p.isDefendant && !existing.isDefendant) existing.isDefendant = true;
                existing.fonte = `${existing.fonte}+Escavador2`;
            }
            continue;
        }
        if (nk) seen.add(nk);
        all.push({
            cnj: cnj || 'CNJ_MASCARADO',
            area: p.area || 'N/A',
            classe: p.classe || null,
            assunto: p.assunto || p.assuntoPrincipal || null,
            status: p.status || null,
            polo: p.polo || p.tipoNormalizado || p.tipoPrincipal || 'N/A',
            tribunal: p.tribunalSigla || p.tribunal || 'N/A',
            vara: null,
            comarca: p.processUf || null,
            data: p.dataInicio || p.data || 'N/A',
            fonte: 'Escavador2',
            isCriminal: effectiveCriminal,
            isTrabalhista: isLabor,
            isExcludedCrimeType: excludedCrimeType || null,
            isActive: /ativo|em andamento/i.test(p.status || '') && !/finaliz|arquiv|encerr|baixad/i.test(p.status || ''),
            matchType: p.hasExactCpfMatch || p.tipoMatch === 'CPF' || p.matchType === 'CPF' ? 'CPF confirmado' : 'match por nome',
            specificRole: p.specificRole || p.tipoNormalizado || p.tipoPrincipal || null,
            decisionSummary: null,
            lastStep: null,
            distributionDate: p.distributionDate || p.dataInicio || null,
            phase: null,
            instance: null,
            lastMovementDate: p.lastMovementDate || p.dataUltimaMovimentacao || null,
            lawsuitAgeDays: null,
            courtLevel: null,
            judgingBody: null,
            allDecisions: Array.isArray(p.decisions) ? p.decisions : null,
            isVictim: !!p.isVictim,
            isDefendant: !!p.isDefendant,
            isWitness: !!p.isWitness,
            parties: Array.isArray(p.parties) ? p.parties : [],
            allParties: Array.isArray(p.allParties) ? p.allParties : [],
            movements: Array.isArray(p.movements) ? p.movements : [],
        });
    }

    all.sort((a, b) => {
        if (a.isCriminal !== b.isCriminal) return a.isCriminal ? -1 : 1;
        if (a.isTrabalhista !== b.isTrabalhista) return a.isTrabalhista ? -1 : 1;
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return 0;
    });

    return all.slice(0, limit);
}

function isLowRiskCriminalProcess(process = {}) {
    return classifyCriminalMateriality(process).isLowRiskRole === true;
}

function isMaterialCriminalProcess(process = {}) {
    return classifyCriminalMateriality(process).isMaterial === true;
}

module.exports = {
    normCnj,
    getDjenProcessNumber,
    getConfirmedProviderProcessNumbers,
    filterDjenComunicacoesByConfirmedProcess,
    formatCnj,
    formatDateBR,
    normalizePartyName,
    isSamePersonName,
    isWeakProcessStatus,
    inferStatusFromLastStep,
    resolveProcessStatus,
    isPassiveLaborParty,
    isActiveLaborParty,
    dedupePartyNames,
    getProcessParties,
    resolveCounterpartyNames,
    firstMovementContent,
    mergeProcessParties,
    formatLaborProcessBlock,
    classifyWarrantType,
    detectCartaDeGuia,
    findLinkedCivilProcess,
    extractSentenceDetails,
    formatProcessBlock,
    selectTopProcessos,
    isLowRiskCriminalProcess,
    isMaterialCriminalProcess,
};
