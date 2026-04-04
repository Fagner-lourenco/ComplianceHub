/**
 * Normalizers: map Judit API responses → form-ready field values + pt-BR notes.
 *
 * Each normalizer returns an object with field names prefixed with `judit*`,
 * plus a `_source` key for audit trail.
 *
 * Key Judit advantages over FonteData:
 *   - `tags.criminal` flag per lawsuit
 *   - `tags.possible_homonym` per lawsuit
 *   - `person_type` distinguishes TESTEMUNHA from RÉU/AUTOR
 *   - Warrant objects with status, arrest_type, regime, sentence
 */

const WITNESS_TYPES = /testemunha|informante/i;

function firstNumericValue(candidates = []) {
    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric) && numeric >= 0) {
            return numeric;
        }
    }
    return null;
}

/**
 * Find the role of a person in a lawsuit's parties by CPF.
 * @param {object[]} parties
 * @param {string} cpf  11 digits or formatted
 * @returns {{ personType: string, side: string }|null}
 */
function findPersonRole(parties, cpf) {
    if (!Array.isArray(parties) || !cpf) return null;
    const cleanCpf = (cpf || '').replace(/\D/g, '');

    let anyPartyHasCpf = false;
    for (const party of parties) {
        // Check main_document
        const partyDoc = (party.main_document || '').replace(/\D/g, '');
        if (partyDoc) {
            anyPartyHasCpf = true;
            if (partyDoc === cleanCpf) {
                return {
                    personType: party.person_type || null,
                    side: party.side || null,
                    hasDivergentCpf: false,
                };
            }
        }
        // Check documents array
        if (Array.isArray(party.documents)) {
            for (const doc of party.documents) {
                const d = (typeof doc === 'string' ? doc : doc.document || '').replace(/\D/g, '');
                if (d) {
                    anyPartyHasCpf = true;
                    if (d === cleanCpf) {
                        return {
                            personType: party.person_type || null,
                            side: party.side || null,
                            hasDivergentCpf: false,
                        };
                    }
                }
            }
        }
    }
    // No CPF matched: distinguish "no party has CPF" (legitimate ambiguity)
    // from "parties have CPFs but none match" (confirmed different person)
    if (anyPartyHasCpf) {
        return { personType: null, side: null, hasDivergentCpf: true };
    }
    return null;
}

/**
 * Normalize Judit lawsuits (from sync datalake).
 * Schema per operational manual: cnj, name, area, subjects[], classifications[],
 * tribunal, justice, instance, distribution_date, phase, status, situation,
 * amount, secrecy_level, parties[], last_step, steps_count.
 *
 * NOTE: steps[] and attachments[] are NOT returned in historical datalake queries;
 * only available in real-time (async) with on_demand=true.
 *
 * @param {{ hasLawsuits: boolean, requestId: string, responseData: object[] }} result
 * @param {string} cpf
 * @returns {object}
 */
function normalizeJuditLawsuits(result, cpf) {
    const { hasLawsuits, requestId, responseData } = result;
    const lawsuits = responseData || [];

    let criminalCount = 0;
    let homonymCount = 0;
    let activeCount = 0;
    const roleSummary = [];

    for (const lawsuit of lawsuits) {
        const data = lawsuit.response_data || lawsuit;
        const tags = data.tags || {};

        // Criminal detection: use tags.criminal OR heuristic for inquérito policial
        let isCriminal = tags.criminal || false;
        if (!isCriminal) {
            const parties = data.parties || [];
            const hasAveriguado = parties.some((p) => /averiguado|investigado|indiciado/i.test(p.person_type || ''));
            const hasVitima = parties.some((p) => /v[ií]tima/i.test(p.person_type || ''));
            const hasJusticaPublica = parties.some((p) => /just.*p[uú]blica|minist.*p[uú]blico/i.test(p.name || ''));
            if (hasAveriguado || (hasVitima && hasJusticaPublica)) {
                isCriminal = true;
            }
        }

        if (isCriminal) criminalCount++;
        if (tags.possible_homonym) homonymCount++;
        if (data.status === 'ATIVO') activeCount++;

        const parties = data.parties || [];
        const role = findPersonRole(parties, cpf);
        const hasDivergentCpf = role?.hasDivergentCpf === true;
        const hasExactCpfMatch = !!role && !hasDivergentCpf;
        const isWitness = role?.personType && WITNESS_TYPES.test(role.personType);

        roleSummary.push({
            code: data.code || null,
            name: data.name || null,
            area: data.area || null,
            status: data.status || null,
            phase: data.phase || null,
            situation: data.situation || null,
            amount: data.amount || null,
            tribunalAcronym: data.tribunal_acronym || null,
            state: data.state || null,
            city: data.city || null,
            county: data.county || null,
            justice: data.justice || null,
            instance: data.instance || null,
            distributionDate: data.distribution_date || null,
            secrecyLevel: data.secrecy_level || 0,
            personType: role?.personType || null,
            side: role?.side || null,
            hasExactCpfMatch,
            hasDivergentCpf,
            isWitness,
            isCriminal,
            isPossibleHomonym: tags.possible_homonym || false,
            subjects: Array.isArray(data.subjects) ? data.subjects.slice(0, 5).map((s) => s.name || s).filter(Boolean) : [],
            classifications: Array.isArray(data.classifications) ? data.classifications.slice(0, 3).map((c) => c.name || c).filter(Boolean) : [],
            lastStep: data.last_step?.content || null,
            lastStepDate: data.last_step?.date || null,
            stepsCount: data.steps_count || 0,
        });
    }

    const hasCriminal = criminalCount > 0;
    const hasHomonyms = homonymCount > 0;
    const riskProcessCount = roleSummary.filter(
        (r) => !r.isWitness && !r.isPossibleHomonym,
    ).length;

    // Build notes
    let notes = `Judit: ${lawsuits.length} processo(s) encontrado(s)`;
    if (!hasLawsuits) notes = 'Judit: Nenhum processo encontrado no datalake.';
    if (hasCriminal) notes += `. ${criminalCount} processo(s) criminal(is).`;
    if (hasHomonyms) notes += ` ATENCAO: ${homonymCount} possivel(is) homonimo(s).`;
    if (activeCount > 0) notes += ` ${activeCount} ativo(s).`;

    const witnessCount = roleSummary.filter((r) => r.isWitness).length;
    if (witnessCount > 0) notes += ` ${witnessCount} como TESTEMUNHA (nao indicam risco).`;

    // Top 10 details
    roleSummary.slice(0, 10).forEach((r, i) => {
        const parts = [];
        if (r.code) parts.push(r.code);
        if (r.area) parts.push(r.area);
        if (r.phase) parts.push(`Fase: ${r.phase}`);
        if (r.personType) parts.push(r.personType);
        if (r.side) parts.push(`polo ${r.side}`);
        if (r.status) parts.push(r.status);
        if (r.isPossibleHomonym) parts.push('⚠️ HOMONIMO?');
        notes += `\n${i + 1}. ${parts.join(' | ')}`;
    });
    if (roleSummary.length > 10) notes += `\n... e mais ${roleSummary.length - 10} processo(s).`;

    return {
        juditProcessTotal: lawsuits.length,
        juditCriminalFlag: hasCriminal ? 'POSITIVE' : 'NEGATIVE',
        juditCriminalCount: criminalCount,
        juditHomonymFlag: hasHomonyms,
        juditHomonymCount: homonymCount,
        juditActiveCount: activeCount,
        juditRiskProcessCount: riskProcessCount,
        juditRoleSummary: roleSummary,
        juditNotes: notes,
        _source: {
            provider: 'judit',
            endpoint: 'lawsuits',
            requestId: requestId || null,
            totalProcessos: lawsuits.length,
            hasCriminal,
            hasHomonyms,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize Judit warrants (from async flow).
 * Schema per operational manual: code, status, warrant_type, arrest_type,
 * issue_date, expiration_date, tribunal_acronym, court, regime, duration,
 * law_type[], entity { name, main_document, birth_date, gender, parents[] }.
 * @param {object[]|{requestId: string, responseData: object[]}} pageData
 * @returns {object}
 */
function normalizeJuditWarrants(pageData) {
    // Accept both array (legacy) and { responseData } (new format)
    const items = Array.isArray(pageData)
        ? pageData
        : Array.isArray(pageData?.responseData) ? pageData.responseData : [];
    const requestId = pageData?.requestId || null;
    const warrants = [];

    for (const item of items) {
        const data = item.response_data || item;
        warrants.push({
            code: data.code || null,
            status: data.status || null,
            warrantType: data.warrant_type || null,
            arrestType: data.arrest_type || null,
            issueDate: data.issue_date || null,
            expirationDate: data.expiration_date || null,
            tribunalAcronym: data.tribunal_acronym || null,
            court: data.court || null,
            regime: data.regime || null,
            durationYears: data.duration_years || null,
            durationMonths: data.duration_months || null,
            duration: data.duration || null,
            lawType: Array.isArray(data.law_type) ? data.law_type : [],
            judgementSummary: data.judgementSummary
                ? (data.judgementSummary.length > 500
                    ? data.judgementSummary.slice(0, 500) + '...'
                    : data.judgementSummary)
                : null,
            entityName: data.entity?.name || null,
            entityDocument: data.entity?.main_document || null,
            entityBirthDate: data.entity?.birth_date || null,
            entityGender: data.entity?.gender || null,
        });
    }

    const activeWarrants = warrants.filter(
        (w) => w.status && /pendente/i.test(w.status),
    );
    const hasActiveWarrants = activeWarrants.length > 0;

    // Build notes
    let notes = '';
    if (warrants.length === 0) {
        notes = 'Judit: Nenhum mandado de prisao encontrado.';
    } else {
        notes = `ALERTA JUDIT: ${warrants.length} mandado(s) encontrado(s)`;
        if (hasActiveWarrants) notes += `, ${activeWarrants.length} PENDENTE(S) DE CUMPRIMENTO`;
        notes += '.';
        warrants.slice(0, 5).forEach((w, i) => {
            const parts = [];
            if (w.warrantType) parts.push(w.warrantType);
            if (w.arrestType) parts.push(w.arrestType);
            if (w.status) parts.push(w.status);
            if (w.tribunalAcronym) parts.push(w.tribunalAcronym);
            if (w.issueDate) parts.push(`Emitido: ${w.issueDate}`);
            if (w.code) parts.push(w.code);
            notes += `\n${i + 1}. ${parts.join(' | ')}`;
        });
    }

    // POSITIVE = active (pendente) warrants exist
    // INCONCLUSIVE = warrants exist but none are active/pendente
    // NEGATIVE = no warrants at all
    const juditWarrantFlag = hasActiveWarrants
        ? 'POSITIVE'
        : warrants.length > 0
            ? 'INCONCLUSIVE'
            : 'NEGATIVE';

    return {
        juditWarrantFlag,
        juditWarrantCount: warrants.length,
        juditActiveWarrantCount: activeWarrants.length,
        juditWarrants: warrants,
        juditWarrantNotes: notes,
        _source: {
            provider: 'judit',
            endpoint: 'warrants',
            requestId,
            totalWarrants: warrants.length,
            activeWarrants: activeWarrants.length,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize Judit penal executions (from async flow).
 * Schema per operational manual: code, name, area, subjects[], classifications[],
 * tribunal_acronym, judge, free_justice, last_step, steps_count,
 * parties[] (with AUTORIDADE, EXECUTADO, REEDUCANDO roles).
 * @param {object[]|{requestId: string, responseData: object[]}} pageData
 * @returns {object}
 */
function normalizeJuditExecution(pageData) {
    // Accept both array (legacy) and { responseData } (new format)
    const items = Array.isArray(pageData)
        ? pageData
        : Array.isArray(pageData?.responseData) ? pageData.responseData : [];
    const requestId = pageData?.requestId || null;
    const executions = [];

    for (const item of items) {
        const data = item.response_data || item;

        // Extract parties with relevant roles
        const parties = Array.isArray(data.parties) ? data.parties.map((p) => ({
            name: p.name || null,
            personType: p.person_type || null,
            side: p.side || null,
            mainDocument: p.main_document || null,
        })) : [];

        executions.push({
            code: data.code || null,
            name: data.name || null,
            area: data.area || null,
            status: data.status || null,
            tribunalAcronym: data.tribunal_acronym || null,
            judge: data.judge || null,
            freeJustice: data.free_justice || false,
            regime: data.regime || null,
            durationYears: data.duration_years || null,
            subjects: Array.isArray(data.subjects) ? data.subjects.slice(0, 5).map((s) => s.name || s).filter(Boolean) : [],
            classifications: Array.isArray(data.classifications) ? data.classifications.slice(0, 3).map((c) => c.name || c).filter(Boolean) : [],
            lastStep: data.last_step?.content || null,
            lastStepDate: data.last_step?.date || null,
            stepsCount: data.steps_count || 0,
            parties,
            entityName: data.entity?.name || null,
        });
    }

    let notes = '';
    if (executions.length === 0) {
        notes = 'Judit: Nenhuma execucao penal encontrada.';
    } else {
        notes = `ALERTA JUDIT: ${executions.length} execucao(oes) penal(is) encontrada(s).`;
        executions.slice(0, 5).forEach((e, i) => {
            const parts = [];
            if (e.code) parts.push(e.code);
            if (e.name) parts.push(e.name);
            if (e.status) parts.push(e.status);
            if (e.regime) parts.push(e.regime);
            if (e.tribunalAcronym) parts.push(e.tribunalAcronym);
            if (e.freeJustice) parts.push('Justica Gratuita');
            if (e.lastStep) parts.push(`Ultimo: ${e.lastStep}`);
            notes += `\n${i + 1}. ${parts.join(' | ')}`;
        });
    }

    return {
        juditExecutionFlag: executions.length > 0 ? 'POSITIVE' : 'NEGATIVE',
        juditExecutionCount: executions.length,
        juditExecutions: executions,
        juditExecutionNotes: notes,
        _source: {
            provider: 'judit',
            endpoint: 'executions',
            requestId,
            totalExecutions: executions.length,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize Judit Entity Data Lake response into identity + UF fields.
 * Schema per operational manual: entity_type, document, name, birth_date,
 * gender, revenue_service_active, parents[], addresses[], contacts[].
 * Used as Judit gate: validates CPF active status + extracts person data.
 * @param {{ responseData: object[] }} data  From queryEntityDataLake
 * @param {string} cpf  Original CPF (11 digits)
 * @returns {{ juditIdentity: object, juditPrimaryUf: string|null, juditAllUfs: string[], _source: object }}
 */
function normalizeJuditEntity(data, cpf) {
    const items = Array.isArray(data.responseData) ? data.responseData : [];
    const entity = items[0] || {};
    const raw = data?._raw || {};
    const cpfsComNome = firstNumericValue([
        entity.cpfs_com_nome,
        entity.cpfsComNome,
        entity.same_name_cpf_count,
        entity.cpf_count_same_name,
        raw.cpfs_com_nome,
        raw.cpfsComNome,
        raw.same_name_cpf_count,
        raw.cpf_count_same_name,
        raw.potential_homonym_count,
    ]);

    const parents = Array.isArray(entity.parents)
        ? entity.parents.map((p) => ({
            name: p.name || null,
            kinship: p.kinship || null,
        }))
        : [];

    const motherParent = parents.find((p) => (p.kinship || '').toLowerCase() === 'mother');

    const addresses = Array.isArray(entity.addresses) ? entity.addresses : [];
    const allUfs = [...new Set(
        addresses.map((a) => (a.state || '').toUpperCase().trim()).filter(Boolean),
    )];
    const primaryUf = allUfs[0] || null;

    const contacts = Array.isArray(entity.contacts)
        ? entity.contacts.map((c) => ({
            type: c.type || null,
            value: c.value || null,
        }))
        : [];

    const juditIdentity = {
        name: entity.name || null,
        entityType: entity.entity_type || null,
        cpfActive: entity.revenue_service_active === true,
        cpfDocument: entity.main_document || null,
        birthDate: entity.birth_date || null,
        gender: entity.gender || null,
        nationality: entity.nationality || null,
        cpfsComNome,
        motherName: motherParent?.name || null,
        parents,
        addresses: addresses.slice(0, 5).map((a) => ({
            state: a.state || null,
            city: a.city || null,
            neighborhood: a.neighborhood || null,
            street: a.street || null,
            zipcode: a.zipcode || null,
        })),
        contacts: contacts.slice(0, 5),
        consultedAt: new Date().toISOString(),
    };

    return {
        juditIdentity,
        juditPrimaryUf: primaryUf,
        juditAllUfs: allUfs,
        juditHasLawsuits: data.hasLawsuits || false,
        _source: {
            provider: 'judit',
            endpoint: 'entity-datalake',
            requestId: data.requestId || null,
            cost: 'R$0.12 (dados cadastrais datalake)',
            cpf,
            entityFound: !!entity.name,
            ufsFound: allUfs,
            consultedAt: new Date().toISOString(),
        },
    };
}

module.exports = {
    normalizeJuditLawsuits,
    normalizeJuditWarrants,
    normalizeJuditExecution,
    normalizeJuditEntity,
    findPersonRole,
};
