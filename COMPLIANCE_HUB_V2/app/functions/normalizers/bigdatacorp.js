/**
 * Normalizers: map BigDataCorp API responses → form-ready field values + pt-BR notes.
 *
 * Each normalizer returns an object with field names prefixed with `bigdatacorp*`,
 * plus a `_source` key for audit trail.
 *
 * Datasets handled:
 *   - basic_data → identity fields + validation
 *   - processes → lawsuits with CPF match via Parties.Doc
 *   - kyc → PEP/sanctions (Interpol, FBI, OFAC, etc.)
 *   - occupation_data → employment/profession history
 */

const CRIMINAL_COURT_TYPES = /criminal|penal/i;
const LABOR_COURT_TYPES = /trabalh/i;

/**
 * Normalize basic_data response.
 * @param {object} basicData  Result[].BasicData from BigDataCorp
 * @returns {object}
 */
function normalizeBigDataCorpBasicData(basicData) {
    if (!basicData) {
        return {
            bigdatacorpName: null,
            bigdatacorpCpfStatus: null,
            bigdatacorpGender: null,
            bigdatacorpBirthDate: null,
            bigdatacorpMotherName: null,
            bigdatacorpAge: null,
            bigdatacorpNamesakeCount: null,
            bigdatacorpHasDeathRecord: false,
            bigdatacorpNameUniqueness: null,
            bigdatacorpFatherName: null,
            bigdatacorpNationality: null,
            bigdatacorpFiscalRegion: null,
            _source: {
                provider: 'bigdatacorp',
                dataset: 'basic_data',
                found: false,
                consultedAt: new Date().toISOString(),
            },
        };
    }

    return {
        bigdatacorpName: basicData.Name || basicData.AlternativeName || null,
        bigdatacorpCpfStatus: basicData.TaxIdStatus || null,
        bigdatacorpGender: basicData.Gender || null,
        bigdatacorpBirthDate: basicData.BirthDate || null,
        bigdatacorpMotherName: basicData.MotherName || null,
        bigdatacorpAge: basicData.Age ?? null,
        bigdatacorpNamesakeCount: basicData.NumberOfFullNameNamesakes ?? null,
        bigdatacorpHasDeathRecord: basicData.HasObitIndication ?? false,
        bigdatacorpNameUniqueness: basicData.NameUniquenessScore ?? null,
        bigdatacorpFatherName: basicData.FatherName || null,
        bigdatacorpNationality: basicData.BirthCountry || null,
        bigdatacorpFiscalRegion: basicData.TaxIdFiscalRegion || null,
        _source: {
            provider: 'bigdatacorp',
            dataset: 'basic_data',
            found: true,
            name: basicData.Name || null,
            cpfStatus: basicData.TaxIdStatus || null,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize processes response.
 * Key advantage: Parties[].Doc contains CPF, enabling exact match.
 *
 * @param {object} processesData  Result[].Processes from BigDataCorp
 * @param {string} candidateCpf  11 digits for CPF matching
 * @returns {object}
 */
function normalizeBigDataCorpProcesses(processesData, candidateCpf) {
    const cleanCpf = (candidateCpf || '').replace(/\D/g, '');
    const lawsuits = processesData?.Lawsuits || [];

    let criminalCount = 0;
    let laborCount = 0;
    let civilCount = 0;
    const processos = [];

    for (const lawsuit of lawsuits) {
        const courtType = lawsuit.CourtType || '';
        const isCriminal = CRIMINAL_COURT_TYPES.test(courtType);
        const isLabor = LABOR_COURT_TYPES.test(courtType);

        if (isCriminal) criminalCount++;
        if (isLabor) laborCount++;
        if (!isCriminal && !isLabor) civilCount++;

        // Match candidate CPF against parties
        const parties = Array.isArray(lawsuit.Parties) ? lawsuit.Parties : [];
        let isDirectCpfMatch = false;
        let polo = null;
        let partyType = null;
        let specificRole = null;

        for (const party of parties) {
            const partyDoc = (party.Doc || '').replace(/\D/g, '');
            if (partyDoc && partyDoc === cleanCpf) {
                isDirectCpfMatch = true;
                polo = party.Polarity || null;
                partyType = party.PartyType || null;
                specificRole = party.PartyDetails?.SpecificType || null;
                break;
            }
        }

        // Extract decisions for criminal processes (top 3, 500 chars max each)
        let decisions = null;
        if (isCriminal && Array.isArray(lawsuit.Decisions) && lawsuit.Decisions.length > 0) {
            decisions = lawsuit.Decisions.slice(0, 3).map((d) => ({
                content: (d.DecisionContent || '').substring(0, 500),
                date: d.DecisionDate || null,
            }));
        }

        processos.push({
            numero: lawsuit.Number || null,
            tipo: lawsuit.Type || null,
            assunto: lawsuit.MainSubject || null,
            courtType: courtType || null,
            courtName: lawsuit.CourtName || null,
            courtLevel: lawsuit.CourtLevel || null,
            courtDistrict: lawsuit.CourtDistrict || null,
            judgingBody: lawsuit.JudgingBody || null,
            estado: lawsuit.State || null,
            status: lawsuit.Status || null,
            value: lawsuit.Value != null && lawsuit.Value >= 0 ? lawsuit.Value : null,
            isDirectCpfMatch,
            matchType: lawsuit.LawsuitMatchType || null,
            polo,
            partyType,
            specificRole,
            isCriminal,
            isLabor,
            cnjSubject: lawsuit.InferredCNJSubjectName || null,
            cnjProcedure: lawsuit.InferredCNJProcedureTypeName || null,
            cnjBroadSubject: lawsuit.InferredBroadCNJSubjectName || null,
            lastMovementDate: lawsuit.LastMovementDate || null,
            lawsuitAgeDays: lawsuit.LawSuitAge ?? null,
            decisions,
        });
    }

    const processTotal = lawsuits.length;
    const directCriminalCount = processos.filter((p) => p.isCriminal && p.isDirectCpfMatch).length;
    const directLaborCount = processos.filter((p) => p.isLabor && p.isDirectCpfMatch).length;
    const hasCriminal = directCriminalCount > 0;
    const hasLabor = directLaborCount > 0;
    const activeCount = processos.filter((p) =>
        p.status && /ativ/i.test(p.status),
    ).length;

    // Build notes (pt-BR)
    let notes = `BigDataCorp: ${processTotal} processo(s) encontrado(s).`;
    if (directCriminalCount > 0) notes += ` ${directCriminalCount} criminal(is) com CPF confirmado.`;
    else if (criminalCount > 0) notes += ` ${criminalCount} criminal(is) (sem CPF confirmado — possivel homonimo).`;
    if (directLaborCount > 0) notes += ` ${directLaborCount} trabalhista(s) com CPF confirmado.`;
    else if (laborCount > 0) notes += ` ${laborCount} trabalhista(s) (sem CPF confirmado — possivel homonimo).`;
    if (activeCount > 0) notes += ` ${activeCount} processo(s) ativo(s).`;

    const directMatches = processos.filter((p) => p.isDirectCpfMatch).length;
    if (directMatches > 0) notes += ` ${directMatches} com CPF exato confirmado.`;

    // Process summary (top 10)
    processos.slice(0, 10).forEach((p, i) => {
        const parts = [];
        if (p.numero) parts.push(p.numero);
        if (p.courtType) parts.push(p.courtType);
        if (p.cnjSubject) parts.push(p.cnjSubject);
        else if (p.assunto) parts.push(p.assunto);
        if (p.specificRole) parts.push(p.specificRole);
        else if (p.polo) parts.push(`polo ${p.polo}`);
        if (p.status) parts.push(p.status);
        if (p.isDirectCpfMatch) parts.push('CPF EXATO');
        if (p.decisions && p.decisions.length > 0) parts.push(`${p.decisions.length} decisao(oes)`);
        notes += `\n${i + 1}. ${parts.join(' | ')}`;
    });
    if (processos.length > 10) notes += `\n... e mais ${processos.length - 10} processo(s).`;

    return {
        bigdatacorpProcessTotal: processTotal,
        bigdatacorpCriminalFlag: hasCriminal ? 'POSITIVE' : 'NEGATIVE',
        bigdatacorpCriminalCount: criminalCount,
        bigdatacorpLaborFlag: hasLabor ? 'POSITIVE' : 'NEGATIVE',
        bigdatacorpLaborCount: laborCount,
        bigdatacorpCivilCount: civilCount,
        bigdatacorpActiveCount: activeCount,
        bigdatacorpTotalAsAuthor: processesData?.TotalLawsuitsAsAuthor ?? null,
        bigdatacorpTotalAsDefendant: processesData?.TotalLawsuitsAsDefendant ?? null,
        bigdatacorpFirstLawsuitDate: processesData?.FirstLawsuitDate || null,
        bigdatacorpLastLawsuitDate: processesData?.LastLawsuitDate || null,
        bigdatacorpProcessos: processos,
        bigdatacorpProcessNotes: notes,
        _source: {
            provider: 'bigdatacorp',
            dataset: 'processes',
            totalProcessos: processTotal,
            criminalCount,
            laborCount,
            directCpfMatches: directMatches,
            hasCriminal,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize KYC (PEP + sanctions) response.
 * This is the most valuable BigDataCorp dataset for compliance —
 * detects PEP status, international sanctions (Interpol, FBI, OFAC, EU, UNSC),
 * and maps standardized sanction types.
 *
 * @param {object} kycData  Result[].KycData from BigDataCorp
 * @returns {object}
 */
function normalizeBigDataCorpKyc(kycData) {
    if (!kycData) {
        return {
            bigdatacorpIsPep: false,
            bigdatacorpPepLevel: null,
            bigdatacorpPepDetails: [],
            bigdatacorpIsSanctioned: false,
            bigdatacorpWasSanctioned: false,
            bigdatacorpSanctionCount: 0,
            bigdatacorpSanctionSources: [],
            bigdatacorpSanctionTypes: [],
            bigdatacorpSanctionDetails: [],
            bigdatacorpHasArrestWarrant: false,
            bigdatacorpHasFinancialCrime: false,
            bigdatacorpHasTerrorism: false,
            bigdatacorpHasCorruption: false,
            bigdatacorpHasSlaveryCrime: false,
            bigdatacorpHasEnvironmentalInfraction: false,
            bigdatacorpActiveWarrants: [],
            bigdatacorpIsElectoralDonor: false,
            bigdatacorpElectoralDonationTotal: 0,
            bigdatacorpKycNotes: 'BigDataCorp KYC: sem dados retornados.',
            _source: {
                provider: 'bigdatacorp',
                dataset: 'kyc',
                found: false,
                consultedAt: new Date().toISOString(),
            },
        };
    }

    // PEP analysis
    const pepHistory = Array.isArray(kycData.PEPHistory) ? kycData.PEPHistory : [];
    const isPep = pepHistory.length > 0;
    let pepLevel = null;
    const pepDetails = pepHistory.map((entry) => {
        if (entry.Level && (!pepLevel || entry.Level < pepLevel)) {
            pepLevel = entry.Level;
        }
        return {
            level: entry.Level || null,
            jobTitle: entry.JobTitle || null,
            department: entry.Department || null,
            motive: entry.Motive || null,
            source: entry.Source || null,
            startDate: entry.StartDate || null,
            endDate: entry.EndDate || null,
        };
    });

    // Sanctions analysis — filter by MatchRate threshold (90%)
    const MATCH_RATE_THRESHOLD = 90;
    const rawSanctions = Array.isArray(kycData.SanctionsHistory) ? kycData.SanctionsHistory
        : Array.isArray(kycData.SanctionsList) ? kycData.SanctionsList : [];
    const filteredSanctions = rawSanctions.filter((s) => (s.MatchRate ?? 100) >= MATCH_RATE_THRESHOLD);
    const filteredOutCount = rawSanctions.length - filteredSanctions.length;

    // Separate international sanctions (INTERPOL, FBI, OFAC, EU, UNSC, etc.) from domestic CNJ entries.
    // CNJ entries are Brazilian court records packaged as "sanctions" by BDC — they should only be used
    // for warrant extraction, NOT to flag someone as internationally sanctioned.
    const DOMESTIC_SOURCES = /^(cnj|conselho\s*nacional|tribunal|tjdft|trf|trt|stf|stj|tre)/i;
    const internationalSanctions = filteredSanctions.filter((s) => !DOMESTIC_SOURCES.test(s.Source || ''));
    const domesticEntries = filteredSanctions.filter((s) => DOMESTIC_SOURCES.test(s.Source || ''));

    // Only flag as sanctioned when our own filtered international sanctions confirm it.
    // Do NOT trust kycData.IsCurrentlySanctioned — BDC sets it true using ALL matches
    // (including low MatchRate ones our filter eliminates), causing false positives.
    const isSanctioned = internationalSanctions.length > 0
        && internationalSanctions.some((s) => s.IsCurrentlyPresentOnSource === true);
    const wasSanctioned = internationalSanctions.length > 0;

    const sanctionSources = [...new Set(internationalSanctions.map((s) => s.Source).filter(Boolean))];
    const sanctionTypes = [...new Set(internationalSanctions.map((s) => s.StandardizedSanctionType).filter(Boolean))];

    // Map sanction types from ALL filtered sanctions (international + domestic) to compliance flags.
    // Domestic CNJ entries can contain real arrest warrants (e.g. civil imprisonment for alimony).
    const allSanctionTypes = [...new Set(filteredSanctions.map((s) => s.StandardizedSanctionType).filter(Boolean))];
    const allTypesLower = allSanctionTypes.map((t) => t.toLowerCase());
    const hasArrestWarrant = allTypesLower.some((t) => t.includes('arrest_warrant') || t.includes('arrest warrants'));
    const hasFinancialCrime = allTypesLower.some((t) => t.includes('financial_crime') || t.includes('financial_infraction'));
    const hasTerrorism = allTypesLower.some((t) => t.includes('terrorism'));
    const hasCorruption = allTypesLower.some((t) => t.includes('corruption'));
    const hasSlaveryCrime = allTypesLower.some((t) => t.includes('slavery'));
    const hasEnvironmentalInfraction = allTypesLower.some((t) => t.includes('environmental'));

    // Enriched sanction details with warrant/decision data
    const sanctionDetails = filteredSanctions.map((s) => ({
        source: s.Source || null,
        type: s.Type || null,
        standardizedType: s.StandardizedSanctionType || null,
        isCurrentlyPresent: s.IsCurrentlyPresentOnSource ?? null,
        wasRecentlyPresent: s.WasRecentlyPresentOnSource ?? null,
        matchRate: s.MatchRate ?? null,
        status: s.Details?.Status || null,
        processNumber: s.Details?.ProcessNumber || null,
        arrestWarrantNumber: s.Details?.ArrestWarrantNumber || null,
        imprisonmentKind: s.Details?.ImprisonmentKind || null,
        magistrate: s.Details?.Magistrate || null,
        agency: s.Details?.Agency || null,
        county: s.Details?.County || null,
        penaltyTime: s.Details?.PenaltyTime || null,
        expirationDate: s.Details?.StandardizedExpirationDate || null,
        decisionSummary: s.Details?.Decision ? s.Details.Decision.substring(0, 500) : null,
    }));

    // Active warrants extracted from filtered sanctions
    const activeWarrants = filteredSanctions
        .filter((s) => {
            const st = (s.StandardizedSanctionType || '').toLowerCase();
            return st.includes('arrest_warrant') || st.includes('arrest warrants');
        })
        .map((s) => ({
            source: s.Source || null,
            processNumber: s.Details?.ProcessNumber || null,
            arrestWarrantNumber: s.Details?.ArrestWarrantNumber || null,
            status: s.Details?.Status || null,
            decision: s.Details?.Decision ? s.Details.Decision.substring(0, 500) : null,
            imprisonmentKind: s.Details?.ImprisonmentKind || null,
            magistrate: s.Details?.Magistrate || null,
            agency: s.Details?.Agency || null,
            county: s.Details?.County || null,
            penaltyTime: s.Details?.PenaltyTime || null,
            expirationDate: s.Details?.StandardizedExpirationDate || null,
            matchRate: s.MatchRate ?? null,
            isDomestic: DOMESTIC_SOURCES.test(s.Source || ''),
        }));

    // Build notes (pt-BR)
    let notes = 'BigDataCorp KYC:';
    if (isPep) {
        notes += ` PEP detectado (nivel ${pepLevel || 'N/A'}, ${pepDetails.length} registro(s)).`;
        pepDetails.slice(0, 3).forEach((d) => {
            notes += ` ${d.jobTitle || 'Cargo N/A'} em ${d.department || 'Orgao N/A'}.`;
        });
    } else {
        notes += ' Nao e PEP.';
    }

    if (isSanctioned) {
        notes += ` SANCIONADO ATUALMENTE: ${sanctionSources.join(', ')}.`;
        if (sanctionTypes.length > 0) notes += ` Tipos: ${sanctionTypes.join(', ')}.`;
    } else if (wasSanctioned) {
        notes += ` Historico de sancao (${sanctionSources.join(', ')}), nao ativa.`;
    } else {
        notes += ' Sem sancoes detectadas.';
    }

    if (hasArrestWarrant) notes += ` ALERTA: ${activeWarrants.length} mandado(s) de prisao.`;
    if (hasTerrorism) notes += ' ALERTA CRITICO: vinculo com terrorismo.';
    if (hasCorruption) notes += ' ALERTA: vinculo com corrupcao.';
    if (hasSlaveryCrime) notes += ' ALERTA: vinculo com trabalho escravo.';
    if (filteredOutCount > 0) notes += ` (${filteredOutCount} sancao(oes) descartada(s) por MatchRate < ${MATCH_RATE_THRESHOLD}%)`;
    if (domesticEntries.length > 0) notes += ` (${domesticEntries.length} entrada(s) de fonte domestica/CNJ tratada(s) como dados judiciais, nao como sancao internacional)`;
    if (kycData.IsCurrentlyElectoralDonor) notes += ` Doador eleitoral ativo (R$ ${(kycData.TotalElectoralDonationAmount || 0).toLocaleString('pt-BR')}).`;

    return {
        bigdatacorpIsPep: isPep,
        bigdatacorpPepLevel: pepLevel,
        bigdatacorpPepDetails: pepDetails,
        bigdatacorpIsSanctioned: isSanctioned,
        bigdatacorpWasSanctioned: wasSanctioned,
        bigdatacorpSanctionCount: internationalSanctions.length,
        bigdatacorpSanctionSources: sanctionSources,
        bigdatacorpSanctionTypes: sanctionTypes,
        bigdatacorpSanctionDetails: sanctionDetails,
        // Domestic entries (CNJ mandados) — separated from international sanctions
        bigdatacorpDomesticEntryCount: domesticEntries.length,
        bigdatacorpDomesticSources: [...new Set(domesticEntries.map((s) => s.Source).filter(Boolean))],
        bigdatacorpHasArrestWarrant: hasArrestWarrant,
        bigdatacorpHasFinancialCrime: hasFinancialCrime,
        bigdatacorpHasTerrorism: hasTerrorism,
        bigdatacorpHasCorruption: hasCorruption,
        bigdatacorpHasSlaveryCrime: hasSlaveryCrime,
        bigdatacorpHasEnvironmentalInfraction: hasEnvironmentalInfraction,
        bigdatacorpActiveWarrants: activeWarrants,
        bigdatacorpIsElectoralDonor: kycData.IsCurrentlyElectoralDonor ?? false,
        bigdatacorpElectoralDonationTotal: kycData.TotalElectoralDonationAmount ?? 0,
        bigdatacorpKycNotes: notes,
        _source: {
            provider: 'bigdatacorp',
            dataset: 'kyc',
            found: true,
            isPep,
            pepLevel,
            isSanctioned,
            wasSanctioned,
            sanctionCount: internationalSanctions.length,
            domesticEntryCount: domesticEntries.length,
            rawSanctionCount: rawSanctions.length,
            filteredOutCount,
            matchRateThreshold: MATCH_RATE_THRESHOLD,
            sanctionSources,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize occupation_data response.
 *
 * @param {object} professionData  Result[].ProfessionData from BigDataCorp
 * @returns {object}
 */
function normalizeBigDataCorpProfession(professionData) {
    const professions = professionData?.Professions || [];
    const isEmployed = professionData?.IsEmployed ?? null;
    const totalIncome = professionData?.TotalIncome ?? null;
    const totalIncomeRange = professionData?.TotalIncomeRange || null;

    if (professions.length === 0) {
        return {
            bigdatacorpCurrentJob: null,
            bigdatacorpSector: null,
            bigdatacorpEmployer: null,
            bigdatacorpEmployerCnpj: null,
            bigdatacorpIsEmployed: isEmployed ?? false,
            bigdatacorpIsPublicServant: false,
            bigdatacorpTotalIncome: totalIncome,
            bigdatacorpIncomeRange: totalIncomeRange,
            bigdatacorpProfessionHistory: [],
            bigdatacorpProfessionNotes: 'BigDataCorp Profissao: nenhum registro encontrado.',
            _source: {
                provider: 'bigdatacorp',
                dataset: 'occupation_data',
                found: false,
                consultedAt: new Date().toISOString(),
            },
        };
    }

    const history = professions.map((p) => ({
        source: p.Source || null,
        sector: p.Sector || null,
        companyName: p.CompanyName || null,
        companyCnpj: p.CompanyIdNumber || null,
        level: p.Level || null,
        status: p.Status || null,
        income: p.Income || null,
        incomeRange: p.IncomeRange || null,
        startDate: p.StartDate || null,
        endDate: p.EndDate || null,
    }));

    // Find current/most recent active profession
    const activeProfessions = history.filter((p) =>
        p.status && /active|ativ/i.test(p.status),
    );
    const currentJob = activeProfessions[0] || history[0] || null;
    const isPublicServant = history.some((p) =>
        p.sector && /public|publico/i.test(p.sector),
    );

    let notes = `BigDataCorp Profissao: ${history.length} registro(s).`;
    if (isEmployed) {
        const latestDate = currentJob?.startDate || currentJob?.endDate || null;
        const yearRef = latestDate ? latestDate.substring(0, 4) : null;
        notes += yearRef ? ` Registro de vinculo ativo (ref. ${yearRef}).` : ' Registro de vinculo ativo (data N/A).';
    }
    if (currentJob) {
        notes += ` Ultimo registro: ${currentJob.companyName || 'empresa N/A'} (${currentJob.sector || 'setor N/A'}).`;        if (currentJob.companyCnpj) notes += ` CNPJ: ${currentJob.companyCnpj}.`;
    }
    if (totalIncome != null && totalIncome > 0) notes += ` Renda: R$ ${totalIncome.toLocaleString('pt-BR')} (${totalIncomeRange || 'N/A'}).`;
    if (isPublicServant) notes += ' SERVIDOR PUBLICO detectado.';

    history.slice(0, 5).forEach((p, i) => {
        const parts = [];
        if (p.companyName) parts.push(p.companyName);
        if (p.sector) parts.push(p.sector);
        if (p.level) parts.push(p.level);
        if (p.status) parts.push(p.status);
        if (p.income) parts.push(`R$ ${p.income}`);
        notes += `\n${i + 1}. ${parts.join(' | ')}`;
    });

    return {
        bigdatacorpCurrentJob: currentJob?.companyName || null,
        bigdatacorpSector: currentJob?.sector || null,
        bigdatacorpEmployer: currentJob?.companyName || null,
        bigdatacorpEmployerCnpj: currentJob?.companyCnpj || null,
        bigdatacorpIsEmployed: isEmployed ?? (activeProfessions.length > 0),
        bigdatacorpIsPublicServant: isPublicServant,
        bigdatacorpTotalIncome: totalIncome,
        bigdatacorpIncomeRange: totalIncomeRange,
        bigdatacorpProfessionHistory: history,
        bigdatacorpProfessionNotes: notes,
        _source: {
            provider: 'bigdatacorp',
            dataset: 'occupation_data',
            found: history.length > 0,
            totalProfessions: history.length,
            isPublicServant,
            consultedAt: new Date().toISOString(),
        },
    };
}

module.exports = {
    normalizeBigDataCorpBasicData,
    normalizeBigDataCorpProcesses,
    normalizeBigDataCorpKyc,
    normalizeBigDataCorpProfession,
};
