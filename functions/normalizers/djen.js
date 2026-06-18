/**
 * Normalizers: map DJEN API responses → form-ready field values + pt-BR notes.
 *
 * Each normalizer returns an object with field names prefixed with `djen*`,
 * plus a `_source` key for audit trail.
 *
 * DJEN (Diário de Justiça Eletrônico Nacional) searches by name or process number.
 * No CPF search available — homonym risk on name searches.
 *
 * Filtering strategy (3 layers):
 *   1. API-level: send FULL name → reduces from 10,000 to ~40-50
 *   2. Post-fetch name filter: match candidate name in destinatarios[].nome
 *   3. Confirmation cross-reference: CPF in text > process match > exact name > similar name
 *
 * Confirmation levels:
 *   - CPF_CONFIRMED: CPF found in communication text (absolute certainty)
 *   - PROCESS_CONFIRMED: processo matches known Judit/Escavador/BDC process
 *   - NAME_EXACT: candidate name exactly matches a destinatário
 *   - NAME_SIMILAR: high similarity (≥0.85) match
 *   - FILTERED_OUT: below threshold — discarded
 */

const { getDjenGeoMatch } = require('../helpers/tribunalMap.js');
const { normalizeText } = require('../helpers/textNormalize.js');
const { classifyRole, normalizeSideForClassifier } = require('../helpers/roleClassifier');

const CRIMINAL_CLASS_REGEX = /criminal|penal|execu[çc][aã]o\s*penal|habeas\s*corpus|a[çc][aã]o\s*penal|inqu[eé]rito\s*policial|medida\s*de\s*seguran[çc]a/i;
const LABOR_CLASS_REGEX = /trabalh|reclamat[oó]|dissídio/i;
const MAX_NORMALIZED_ITEMS = 50;
const MAX_NORMALIZED_ITEMS_GEO_MATCH = 100;
const TEXT_TRUNCATE_LENGTH = 500;
const NAME_SIMILARITY_THRESHOLD = 0.85;
const PREPOSITIONS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

/**
 * Classify the area of a comunicação based on nomeClasse, codigoClasse, and tribunal.
 * @param {string} nomeClasse  e.g. 'APELAÇÃO CRIMINAL'
 * @param {number|string} codigoClasse  e.g. 417
 * @param {string} siglaTribunal  e.g. 'TJMG', 'TRT2'
 * @returns {'criminal'|'trabalhista'|'civel'}
 */
function classifyArea(nomeClasse, codigoClasse, siglaTribunal) {
    const classe = nomeClasse || '';
    if (CRIMINAL_CLASS_REGEX.test(classe)) return 'criminal';
    if (LABOR_CLASS_REGEX.test(classe)) return 'trabalhista';
    // TRT = Tribunal Regional do Trabalho
    if (siglaTribunal && /^TRT/i.test(siglaTribunal)) return 'trabalhista';
    // TST = Tribunal Superior do Trabalho
    if (siglaTribunal && /^TST$/i.test(siglaTribunal)) return 'trabalhista';
    return 'civel';
}

/**
 * Find the candidate's polo (side) in the destinatarios array.
 * @param {object[]} destinatarios
 * @param {string} candidateName  Full name of the candidate
 * @returns {string|null}  'A' (ativo/author) or 'P' (passivo/defendant) or null
 */
function findCandidatePolo(destinatarios, candidateName) {
    if (!Array.isArray(destinatarios) || !candidateName) return null;

    const normalizedCandidate = normalizeName(candidateName);

    for (const dest of destinatarios) {
        const normalizedDest = normalizeName(dest.nome);
        if (!normalizedDest) continue;

        // Exact match or one contains the other
        if (
            normalizedDest === normalizedCandidate ||
            normalizedDest.includes(normalizedCandidate) ||
            normalizedCandidate.includes(normalizedDest)
        ) {
            return dest.polo || null;
        }
    }

    return null;
}

function normalizeName(name) {
    if (!name) return '';
    return normalizeText(name, { toCase: 'lower' });
}

/**
 * Normalize name stripping Portuguese prepositions (de, da, do, dos, das, e).
 * Handles cases where tribunals omit prepositions: "RENAN AUGUSTO JESUS" vs "RENAN AUGUSTO DE JESUS".
 */
function normalizeNameNoPrep(name) {
    const normalized = normalizeName(name);
    if (!normalized) return '';
    return normalized.split(' ').filter((w) => !PREPOSITIONS.has(w)).join(' ');
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.slice(0, maxLength) + '…';
}

/**
 * Clean destinatário name: remove numbering prefixes ("1. "), polo suffixes ("(AGRAVANTE)"),
 * and other court-added annotations.
 * @param {string} rawName  e.g. "1. RENAN AUGUSTO DE JESUS (AGRAVANTE)"
 * @returns {string}  e.g. "RENAN AUGUSTO DE JESUS"
 */
function cleanDestinatarioName(rawName) {
    if (!rawName) return '';
    return rawName
        .replace(/^\d+\.\s*/, '')                       // "1. " prefix
        .replace(/\s*\([^)]*\)\s*$/, '')                // "(AGRAVANTE)" suffix
        .trim();
}

/**
 * Compute word-level similarity between two names (Jaccard on words).
 * Returns 0..1 where 1 = identical word sets.
 */
function computeWordSimilarity(nameA, nameB) {
    const wordsA = new Set(normalizeName(nameA).split(' ').filter(Boolean));
    const wordsB = new Set(normalizeName(nameB).split(' ').filter(Boolean));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
    }
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Extract CPF (XXX.XXX.XXX-XX or 11 digits) from communication text.
 * @param {string} texto  Full text of the communication
 * @returns {string[]}  Array of CPFs found (digits only, 11 chars)
 */
function extractCpfFromText(texto) {
    if (!texto) return [];
    const cpfs = new Set();
    // Formatted: 123.456.789-01
    const formatted = texto.matchAll(/\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g);
    for (const m of formatted) {
        cpfs.add(m[1] + m[2] + m[3] + m[4]);
    }
    return [...cpfs];
}

/**
 * Determine confirmation level for a comunicação against the candidate.
 * @param {object} item  Raw DJEN item
 * @param {string} candidateName  Full candidate name
 * @param {string} candidateCpf  Candidate CPF (11 digits) or null
 * @param {Set<string>} knownProcessNumbers  CNJs from other providers (digits only)
 * @param {object} [options]
 * @param {boolean} [options.strictNameMatch=false]  When true, only NAME_EXACT is accepted (NAME_SIMILAR disabled).
 *   Use for common names (high namesake count) to avoid false positives.
 * @returns {{ level: string, matchedName: string|null, polo: string|null }}
 */
function determineConfirmation(item, candidateName, candidateCpf, knownProcessNumbers, options = {}) {
    const { strictNameMatch = false } = options;
    const destinatarios = item.destinatarios || [];
    const cleanCpf = (candidateCpf || '').replace(/\D/g, '');
    const processNumber = (item.numero_processo || '').replace(/\D/g, '');

    // Layer 3a: CPF in text → absolute certainty
    if (cleanCpf.length === 11) {
        const cpfsInText = extractCpfFromText(item.texto);
        if (cpfsInText.includes(cleanCpf)) {
            const polo = findCandidatePolo(destinatarios, candidateName);
            return { level: 'CPF_CONFIRMED', matchedName: candidateName, polo };
        }
    }

    // Layer 3b: Process number matches known processes
    if (processNumber && knownProcessNumbers.has(processNumber)) {
        const polo = findCandidatePolo(destinatarios, candidateName);
        return { level: 'PROCESS_CONFIRMED', matchedName: candidateName, polo };
    }

    // Layer 3c/3d: Name matching in destinatários
    const normalizedCandidate = normalizeName(candidateName);
    if (!normalizedCandidate) {
        return { level: 'FILTERED_OUT', matchedName: null, polo: null };
    }

    let bestMatch = { level: 'FILTERED_OUT', matchedName: null, polo: null, similarity: 0 };

    for (const dest of destinatarios) {
        const cleanedName = cleanDestinatarioName(dest.nome);
        const normalizedDest = normalizeName(cleanedName);
        if (!normalizedDest) continue;

        // Exact match (after normalization)
        if (normalizedDest === normalizedCandidate) {
            return { level: 'NAME_EXACT', matchedName: cleanedName, polo: dest.polo || null };
        }

        // Exact match ignoring prepositions (de, da, do, dos, das, e)
        // Handles "RENAN AUGUSTO JESUS" vs "RENAN AUGUSTO DE JESUS"
        if (normalizeNameNoPrep(cleanedName) === normalizeNameNoPrep(candidateName) && normalizeNameNoPrep(cleanedName).length > 0) {
            return { level: 'NAME_EXACT', matchedName: cleanedName, polo: dest.polo || null };
        }

        // Containment: one name fully contains the other
        // "diego fernando pires" contains "diego fernando pires" ✓
        // "diego fernando pires de oliveira" contains "diego fernando pires" ✓
        if (!strictNameMatch && (normalizedDest.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedDest))) {
            const similarity = computeWordSimilarity(cleanedName, candidateName);
            if (similarity >= NAME_SIMILARITY_THRESHOLD && similarity > bestMatch.similarity) {
                bestMatch = { level: 'NAME_SIMILAR', matchedName: cleanedName, polo: dest.polo || null, similarity };
            }
        }

        // Word-level similarity (handles word order differences, particles)
        if (!strictNameMatch) {
            const similarity = computeWordSimilarity(cleanedName, candidateName);
            if (similarity >= NAME_SIMILARITY_THRESHOLD && similarity > bestMatch.similarity) {
                bestMatch = { level: 'NAME_SIMILAR', matchedName: cleanedName, polo: dest.polo || null, similarity };
            }
        }
    }

    return bestMatch;
}

/**
 * Filter and confirm comunicações for a candidate.
 * Returns only items that pass the name/CPF/process confirmation gate.
 * @param {object[]} items  Raw DJEN items
 * @param {string} candidateName  Full candidate name
 * @param {string} candidateCpf  Candidate CPF (11 digits) or null
 * @param {Set<string>} knownProcessNumbers  CNJs from other providers
 * @param {object} [options]
 * @param {boolean} [options.strictNameMatch=false]  When true, only NAME_EXACT accepted (NAME_SIMILAR disabled)
 * @returns {{ confirmed: object[], filteredOutCount: number, confirmationStats: object }}
 */
function filterAndConfirmItems(items, candidateName, candidateCpf, knownProcessNumbers, options = {}) {
    const confirmed = [];
    let filteredOutCount = 0;
    const stats = { cpf: 0, process: 0, nameExact: 0, nameSimilar: 0 };

    for (const item of items) {
        const result = determineConfirmation(item, candidateName, candidateCpf, knownProcessNumbers, options);

        if (result.level === 'FILTERED_OUT') {
            filteredOutCount++;
            continue;
        }

        item._confirmation = result;
        confirmed.push(item);

        if (result.level === 'CPF_CONFIRMED') stats.cpf++;
        else if (result.level === 'PROCESS_CONFIRMED') stats.process++;
        else if (result.level === 'NAME_EXACT') stats.nameExact++;
        else if (result.level === 'NAME_SIMILAR') stats.nameSimilar++;
    }

    return { confirmed, filteredOutCount, confirmationStats: stats };
}

/**
 * Normalize DJEN comunicações response with intelligent filtering.
 * @param {{ count: number, items: object[], _request: object }} apiResult
 * @param {string} candidateName  Full name for polo matching
 * @param {string} [candidateCpf]  CPF (11 digits) for text confirmation
 * @param {Set<string>} [knownProcessNumbers]  CNJs from other providers (digits only)
 * @param {object} [options]
 * @param {boolean} [options.strictNameMatch=false]  When true, only NAME_EXACT accepted (NAME_SIMILAR disabled)
 * @param {string[]} [options.candidateUfs]  UFs where the candidate lives/works, for geo-tagging
 * @returns {object}  Normalized fields with `djen*` prefix
 */
/**
 * Compute a probability score (0-100+) for a DJEN comunicação belonging to the candidate.
 * Higher score = higher confidence this comunicação is actually about the candidate.
 */
function computeProbabilityScore(item, namesakeCount) {
    let score = 0;
    const confirmation = item._confirmation || {};

    // Identity confirmation (high weight)
    if (confirmation.level === 'CPF_CONFIRMED') score += 100;
    else if (confirmation.level === 'PROCESS_CONFIRMED') score += 80;
    else if (confirmation.level === 'NAME_EXACT') score += 60;
    else if (confirmation.level === 'NAME_SIMILAR') score += 30;

    // Geo-match (medium-high weight)
    if (item.geoMatch === true) score += 40;
    else if (item.geoMatch === false) score -= 20;

    // Criminal area (contextual boost)
    if (item.area === 'criminal') score += 10;

    // Trabalhista area (moderate boost)
    if (item.area === 'trabalhista') score += 5;

    // Polo: active party (author) is more relevant
    if (item.polo === 'A') score += 15;
    else if (item.polo === 'P') score += 5;

    // Namesake penalty: common names reduce confidence
    if (namesakeCount > 50) score *= 0.7;
    else if (namesakeCount > 20) score *= 0.8;
    else if (namesakeCount > 10) score *= 0.9;

    return Math.round(score);
}

function normalizeDjenComunicacoes(apiResult, candidateName, candidateCpf, knownProcessNumbers, options = {}) {
    const { candidateUfs = [] } = options;
    const { count, items, _request } = apiResult || {};
    const rawItems = items || [];
    const processSet = knownProcessNumbers || new Set();
    const namesakeCount = options.namesakeCount || 0;

    // Filter & confirm items
    const { confirmed, filteredOutCount, confirmationStats } = filterAndConfirmItems(
        rawItems, candidateName, candidateCpf, processSet, options,
    );

    // STEP 1: Classify and filter — keep only criminal + trabalhista (remove cíveis)
    const relevantItems = [];
    for (const item of confirmed) {
        const area = classifyArea(item.nomeClasse, item.codigoClasse, item.siglaTribunal);
        // Skip cível items — we only care about criminal and trabalhista
        if (area === 'civel') continue;
        relevantItems.push({ ...item, _area: area });
    }

    // STEP 2: Deduplicate by process number — keep the highest-scoring communication per process
    const byProcess = new Map();
    for (const item of relevantItems) {
        const processKey = (item.numero_processo || item.numeroprocessocommascara || item.id || '').toString().trim();
        if (!processKey) continue;

        const confirmation = item._confirmation || {};
        const geoMatch = getDjenGeoMatch(item.siglaTribunal, candidateUfs);
        const polo = confirmation.polo || findCandidatePolo(item.destinatarios, candidateName);

        const processedItem = {
            id: item.id,
            dataDisponibilizacao: item.data_disponibilizacao || null,
            tribunal: item.siglaTribunal || null,
            orgao: item.nomeOrgao || null,
            tipoComunicacao: item.tipoComunicacao || null,
            classe: item.nomeClasse || null,
            codigoClasse: item.codigoClasse || null,
            area: item._area,
            numeroProcesso: item.numero_processo || null,
            numeroProcessoMascara: item.numeroprocessocommascara || null,
            polo,
            confirmationLevel: confirmation.level || 'PROCESS_CONFIRMED',
            roleClassification: (() => {
                const area = item._area;
                const side = normalizeSideForClassifier(polo);
                // Mapear polo para papel aproximado quando conhecido
                let role = null;
                if (side === 'Active') role = 'AUTOR';
                else if (side === 'Passive') role = 'REU';
                return classifyRole(role, area, side);
            })(),
            isDefendant: false, // sera atualizado abaixo
            isPlaintiff: false,
            isVictim: false,
            isLawyer: false,
            geoMatch,
            textoResumo: truncateText(
                (item.texto || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''),
                TEXT_TRUNCATE_LENGTH,
            ),
            destinatarios: (item.destinatarios || []).map((d) => ({
                nome: d.nome || null,
                polo: d.polo || null,
            })),
            advogados: (item.destinatarioadvogados || []).map((da) => ({
                nome: da.advogado?.nome || null,
                oab: da.advogado?.numero_oab || null,
                ufOab: da.advogado?.uf_oab || null,
            })),
            link: item.link || null,
            ativo: item.ativo ?? true,
        };

        // Compute probability score
        processedItem.probabilityScore = computeProbabilityScore(processedItem, namesakeCount);

        // Update role classification flags
        const rc = processedItem.roleClassification;
        processedItem.isDefendant = rc.category === 'DEFENDANT';
        processedItem.isPlaintiff = rc.category === 'PLAINTIFF';
        processedItem.isVictim = rc.category === 'VICTIM';
        processedItem.isLawyer = rc.category === 'LAWYER';

        const existing = byProcess.get(processKey);
        if (!existing || processedItem.probabilityScore > existing.probabilityScore) {
            byProcess.set(processKey, processedItem);
        }
    }

    // Convert map to array
    let processedItems = [...byProcess.values()];

    // Count by area
    let criminalCount = 0;
    let laborCount = 0;
    for (const item of processedItems) {
        if (item.area === 'criminal') criminalCount++;
        else if (item.area === 'trabalhista') laborCount++;
    }

    // Sort by probability score descending (highest confidence first)
    processedItems.sort((a, b) => b.probabilityScore - a.probabilityScore);

    // Dynamic limit: increase to 100 when there are strong geo-matches
    const geoMatchedItems = processedItems.filter((i) => i.geoMatch === true);
    const maxItems = geoMatchedItems.length >= 5
        ? Math.min(MAX_NORMALIZED_ITEMS_GEO_MATCH, processedItems.length)
        : MAX_NORMALIZED_ITEMS;

    const normalizedItems = processedItems.slice(0, maxItems);

    // Build notes
    const totalFromApi = count || rawItems.length;
    const civelFiltered = confirmed.length - relevantItems.length;
    let notes = `DJEN: ${totalFromApi} comunicação(ões) da API`;
    if (filteredOutCount > 0) {
        notes += `, ${filteredOutCount} descartada(s) por filtro de nome`;
    }
    notes += `, ${confirmed.length} confirmada(s)`;
    if (civelFiltered > 0) {
        notes += ` (${civelFiltered} cível(is) removida(s))`;
    }
    notes += `, ${relevantItems.length} criminal/trabalhista`;
    if (processedItems.length < relevantItems.length) {
        notes += ` → ${processedItems.length} processo(s) único(s) após desduplicação`;
    } else {
        notes += ` → ${processedItems.length} processo(s) único(s)`;
    }
    notes += '.';
    if (criminalCount > 0) notes += ` ${criminalCount} criminal/penal.`;
    if (laborCount > 0) notes += ` ${laborCount} trabalhista.`;
    if (totalFromApi >= 10000) notes += ' ATENÇÃO: limite de 10.000 resultados atingido — possível excesso de homônimos.';

    // Strict mode note
    if (options.strictNameMatch) {
        notes += ` Filtro rigoroso ativo: apenas NAME_EXACT aceito.`;
    }

    // Geo breakdown
    const geoIn = normalizedItems.filter((i) => i.geoMatch === true).length;
    const geoOut = normalizedItems.filter((i) => i.geoMatch === false).length;
    if (candidateUfs.length > 0 && (geoIn > 0 || geoOut > 0)) {
        notes += ` ${geoIn} na UF do candidato (${candidateUfs.join(',')}), ${geoOut} em outros estados.`;
    }

    // Probability score breakdown
    const highScoreItems = normalizedItems.filter((i) => (i.probabilityScore || 0) >= 80);
    const mediumScoreItems = normalizedItems.filter((i) => {
        const s = i.probabilityScore || 0;
        return s >= 50 && s < 80;
    });
    if (highScoreItems.length > 0 || mediumScoreItems.length > 0) {
        notes += ` ${highScoreItems.length} alta confiança (score ≥80), ${mediumScoreItems.length} média confiança (50-79).`;
    }

    // Confirmation breakdown
    const cs = confirmationStats;
    if (cs.cpf > 0) notes += ` ${cs.cpf} confirmada(s) por CPF no texto.`;
    if (cs.process > 0) notes += ` ${cs.process} confirmada(s) por nº processo.`;

    // Process summary (top 5 criminal)
    const criminalItems = normalizedItems.filter((i) => i.area === 'criminal');
    criminalItems.slice(0, 5).forEach((item, i) => {
        const parts = [];
        if (item.numeroProcessoMascara || item.numeroProcesso) parts.push(item.numeroProcessoMascara || item.numeroProcesso);
        if (item.classe) parts.push(item.classe);
        if (item.tribunal) parts.push(item.tribunal);
        if (item.polo) parts.push(`polo ${item.polo}`);
        if (item.dataDisponibilizacao) parts.push(item.dataDisponibilizacao);
        notes += `\n${i + 1}. ${parts.join(' | ')}`;
    });

    return {
        djenComunicacaoTotal: totalFromApi,
        djenConfirmedTotal: confirmed.length,
        djenFilteredOutCount: filteredOutCount,
        djenCriminalFlag: criminalCount > 0 ? 'POSITIVE' : 'NEGATIVE',
        djenCriminalCount: criminalCount,
        djenLaborFlag: laborCount > 0,
        djenLaborCount: laborCount,
        djenProcessCount: processedItems.length,
        djenCivelCount: civelFiltered,
        djenComunicacoes: normalizedItems,
        djenNotes: notes,
        _source: {
            provider: 'djen',
            endpoint: _request?.endpoint || '/comunicacao',
            totalComunicacoes: totalFromApi,
            confirmedComunicacoes: confirmed.length,
            filteredOutComunicacoes: filteredOutCount,
            normalizedComunicacoes: normalizedItems.length,
            confirmationStats,
            criminalCount,
            laborCount,
            civelCount: 0,
            processCount: processedItems.length,
            candidateUfsUsed: candidateUfs,
            namesakeCount,
            geoMatchedCount: geoIn,
            highScoreCount: highScoreItems.length,
            consultedAt: new Date().toISOString(),
        },
    };
}

module.exports = {
    normalizeDjenComunicacoes,
    classifyArea,
    findCandidatePolo,
    // Exported for testing
    cleanDestinatarioName,
    computeWordSimilarity,
    extractCpfFromText,
    determineConfirmation,
    filterAndConfirmItems,
    normalizeNameNoPrep,
};
