import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    normalizeDjenComunicacoes,
    classifyArea,
    findCandidatePolo,
    cleanDestinatarioName,
    computeWordSimilarity,
    extractCpfFromText,
    determineConfirmation,
    filterAndConfirmItems,
    normalizeNameNoPrep,
} = require('./djen.js');

const { getDjenGeoMatch } = require('../helpers/tribunalMap.js');

describe('classifyArea', () => {
    it('detects criminal by nomeClasse', () => {
        expect(classifyArea('APELAÇÃO CRIMINAL', 417, 'TJMG')).toBe('criminal');
        expect(classifyArea('Execução Penal', 0, 'TJSP')).toBe('criminal');
        expect(classifyArea('Habeas Corpus', 0, 'STJ')).toBe('criminal');
        expect(classifyArea('Ação Penal', 0, 'TJRJ')).toBe('criminal');
        expect(classifyArea('Inquérito Policial', 0, 'TJMG')).toBe('criminal');
    });

    it('detects trabalhista by nomeClasse', () => {
        expect(classifyArea('Ação Trabalhista Rito Ordinário', 0, 'TRT2')).toBe('trabalhista');
        expect(classifyArea('Reclamatória Trabalhista', 0, 'TRT1')).toBe('trabalhista');
        expect(classifyArea('Dissídio Coletivo', 0, 'TST')).toBe('trabalhista');
    });

    it('detects trabalhista by tribunal TRT/TST', () => {
        expect(classifyArea('Procedimento Comum', 0, 'TRT8')).toBe('trabalhista');
        expect(classifyArea('Recurso Ordinário', 0, 'TRT23')).toBe('trabalhista');
        expect(classifyArea('Recurso de Revista', 0, 'TST')).toBe('trabalhista');
    });

    it('defaults to civel', () => {
        expect(classifyArea('Procedimento Comum Cível', 0, 'TJSP')).toBe('civel');
        expect(classifyArea('Arrolamento Comum', 0, 'TJCE')).toBe('civel');
        expect(classifyArea('', 0, 'TJMG')).toBe('civel');
        expect(classifyArea(null, null, null)).toBe('civel');
    });
});

describe('findCandidatePolo', () => {
    it('finds exact name match', () => {
        const destinatarios = [
            { nome: 'DIEGO FERNANDO PIRES', polo: 'A' },
            { nome: 'MINISTÉRIO PÚBLICO DO ESTADO DE MINAS GERAIS', polo: 'P' },
        ];
        expect(findCandidatePolo(destinatarios, 'DIEGO FERNANDO PIRES')).toBe('A');
    });

    it('finds case-insensitive match', () => {
        const destinatarios = [
            { nome: 'Diego Fernando Pires', polo: 'A' },
        ];
        expect(findCandidatePolo(destinatarios, 'DIEGO FERNANDO PIRES')).toBe('A');
    });

    it('finds partial name match (contains)', () => {
        const destinatarios = [
            { nome: 'RENAN AUGUSTO DE JESUS', polo: 'P' },
        ];
        expect(findCandidatePolo(destinatarios, 'RENAN AUGUSTO')).toBe('P');
    });

    it('returns null when no match', () => {
        const destinatarios = [
            { nome: 'OUTRA PESSOA', polo: 'A' },
        ];
        expect(findCandidatePolo(destinatarios, 'DIEGO FERNANDO')).toBeNull();
    });

    it('handles null/missing destinatarios', () => {
        expect(findCandidatePolo(null, 'NOME')).toBeNull();
        expect(findCandidatePolo([], 'NOME')).toBeNull();
        expect(findCandidatePolo([{ nome: 'X', polo: 'A' }], '')).toBeNull();
    });
});

describe('normalizeDjenComunicacoes', () => {
    const makeItem = (overrides = {}) => ({
        id: 1,
        data_disponibilizacao: '2026-04-13',
        siglaTribunal: 'TJMG',
        tipoComunicacao: 'Intimação',
        nomeOrgao: 'TJMG - 2ª CÂMARA CRIMINAL',
        texto: 'Apelante(s) - DIEGO FERNANDO PIRES',
        numero_processo: '00104442320228130701',
        meio: 'D',
        link: 'https://www4.tjmg.jus.br/juridico/sf/proc_resultado2.jsp',
        nomeClasse: 'APELAÇÃO CRIMINAL',
        codigoClasse: 417,
        numeroprocessocommascara: '0010444-23.2022.8.13.0701',
        ativo: true,
        destinatarios: [
            { nome: 'DIEGO FERNANDO PIRES', polo: 'A' },
            { nome: 'MINISTÉRIO PÚBLICO DO ESTADO DE MINAS GERAIS', polo: 'P' },
        ],
        destinatarioadvogados: [
            { advogado: { nome: 'MICHELLE FERNANDA PIRES', numero_oab: '140802', uf_oab: 'MG' } },
        ],
        ...overrides,
    });

    it('normalizes a criminal comunicação', () => {
        const result = normalizeDjenComunicacoes(
            { count: 1, items: [makeItem()], _request: { endpoint: '/comunicacao' } },
            'DIEGO FERNANDO PIRES',
        );

        expect(result.djenComunicacaoTotal).toBe(1);
        expect(result.djenCriminalFlag).toBe('POSITIVE');
        expect(result.djenCriminalCount).toBe(1);
        expect(result.djenLaborFlag).toBe(false);
        expect(result.djenLaborCount).toBe(0);
        expect(result.djenCivelCount).toBe(0);
        expect(result.djenComunicacoes).toHaveLength(1);
        expect(result.djenComunicacoes[0].area).toBe('criminal');
        expect(result.djenComunicacoes[0].polo).toBe('A');
        expect(result.djenComunicacoes[0].tribunal).toBe('TJMG');
        expect(result.djenComunicacoes[0].advogados[0].nome).toBe('MICHELLE FERNANDA PIRES');
        expect(result._source.provider).toBe('djen');
    });

    it('counts mixed areas correctly', () => {
        const items = [
            makeItem({ nomeClasse: 'APELAÇÃO CRIMINAL', codigoClasse: 417 }),
            makeItem({ id: 2, nomeClasse: 'Ação Trabalhista', siglaTribunal: 'TRT2', codigoClasse: 0 }),
            makeItem({ id: 3, nomeClasse: 'Procedimento Comum Cível', siglaTribunal: 'TJSP', codigoClasse: 0 }),
            makeItem({ id: 4, nomeClasse: 'Procedimento Comum', siglaTribunal: 'TJRJ', codigoClasse: 0 }),
        ];
        const result = normalizeDjenComunicacoes(
            { count: 4, items, _request: {} },
            'DIEGO FERNANDO PIRES',
        );

        expect(result.djenCriminalCount).toBe(1);
        expect(result.djenLaborCount).toBe(1);
        expect(result.djenCivelCount).toBe(2);
        expect(result.djenCriminalFlag).toBe('POSITIVE');
        expect(result.djenLaborFlag).toBe(true);
    });

    it('sorts criminal items first', () => {
        const items = [
            makeItem({ id: 1, nomeClasse: 'Procedimento Cível', siglaTribunal: 'TJSP', codigoClasse: 0 }),
            makeItem({ id: 2, nomeClasse: 'APELAÇÃO CRIMINAL', codigoClasse: 417 }),
        ];
        // Use a known process set so items are PROCESS_CONFIRMED regardless of name
        const knownProcesses = new Set(['00104442320228130701']);
        const result = normalizeDjenComunicacoes(
            { count: 2, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            null,
            knownProcesses,
        );

        expect(result.djenComunicacoes[0].area).toBe('criminal');
        expect(result.djenComunicacoes[1].area).toBe('civel');
    });

    it('handles empty result', () => {
        const result = normalizeDjenComunicacoes(
            { count: 0, items: [], _request: {} },
            'NOME',
        );

        expect(result.djenComunicacaoTotal).toBe(0);
        expect(result.djenCriminalFlag).toBe('NEGATIVE');
        expect(result.djenCriminalCount).toBe(0);
        expect(result.djenComunicacoes).toEqual([]);
    });

    it('handles null apiResult', () => {
        const result = normalizeDjenComunicacoes(null, 'NOME');

        expect(result.djenComunicacaoTotal).toBe(0);
        expect(result.djenCriminalFlag).toBe('NEGATIVE');
        expect(result.djenComunicacoes).toEqual([]);
    });

    it('truncates to max 50 items', () => {
        const items = Array.from({ length: 60 }, (_, i) =>
            makeItem({ id: i, nomeClasse: 'Procedimento Cível', siglaTribunal: 'TJSP', codigoClasse: 0 }),
        );
        // Use known process set to confirm all items
        const knownProcesses = new Set(['00104442320228130701']);
        const result = normalizeDjenComunicacoes(
            { count: 60, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            null,
            knownProcesses,
        );

        expect(result.djenComunicacoes).toHaveLength(50);
        expect(result.djenComunicacaoTotal).toBe(60);
    });

    it('truncates long text and strips HTML', () => {
        const longText = 'A'.repeat(600) + '<br />tag<b>bold</b>';
        const items = [makeItem({ texto: longText })];
        const result = normalizeDjenComunicacoes(
            { count: 1, items, _request: {} },
            'DIEGO FERNANDO PIRES',
        );

        const resumo = result.djenComunicacoes[0].textoResumo;
        expect(resumo.length).toBeLessThanOrEqual(501); // 500 + ellipsis
        expect(resumo).not.toContain('<br');
        expect(resumo).not.toContain('<b>');
    });

    it('warns when 10000 results reached', () => {
        const result = normalizeDjenComunicacoes(
            { count: 10000, items: [], _request: {} },
            'NOME',
        );

        expect(result.djenNotes).toContain('10.000');
        expect(result.djenNotes).toContain('homônimos');
    });

    it('includes criminal summary in notes', () => {
        const items = [makeItem()];
        const result = normalizeDjenComunicacoes(
            { count: 1, items, _request: { endpoint: '/comunicacao' } },
            'DIEGO FERNANDO PIRES',
        );

        expect(result.djenNotes).toContain('criminal');
        expect(result.djenNotes).toContain('0010444-23.2022.8.13.0701');
    });

    it('includes confirmation stats in return', () => {
        const items = [makeItem()];
        const result = normalizeDjenComunicacoes(
            { count: 1, items, _request: {} },
            'DIEGO FERNANDO PIRES',
        );

        expect(result.djenConfirmedTotal).toBe(1);
        expect(result.djenFilteredOutCount).toBe(0);
        expect(result._source.confirmationStats).toBeDefined();
        expect(result._source.confirmationStats.nameExact).toBe(1);
    });

    it('filters out items with unmatched names', () => {
        const items = [
            makeItem({ id: 1 }),
            makeItem({
                id: 2,
                destinatarios: [{ nome: 'FULANO DE TAL', polo: 'A' }],
            }),
        ];
        const result = normalizeDjenComunicacoes(
            { count: 2, items, _request: {} },
            'DIEGO FERNANDO PIRES',
        );

        expect(result.djenConfirmedTotal).toBe(1);
        expect(result.djenFilteredOutCount).toBe(1);
        expect(result.djenComunicacoes).toHaveLength(1);
    });

    it('confirms items by CPF found in text', () => {
        const items = [
            makeItem({
                texto: 'Intimação ao réu CPF 123.456.789-01 para comparecer...',
                destinatarios: [{ nome: 'PESSOA DESCONHECIDA', polo: 'A' }],
            }),
        ];
        const result = normalizeDjenComunicacoes(
            { count: 1, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            '12345678901',
        );

        expect(result.djenConfirmedTotal).toBe(1);
        expect(result.djenComunicacoes[0].confirmationLevel).toBe('CPF_CONFIRMED');
    });

    it('confirms items by known process number', () => {
        const items = [
            makeItem({
                destinatarios: [{ nome: 'PESSOA DESCONHECIDA', polo: 'P' }],
            }),
        ];
        const knownProcesses = new Set(['00104442320228130701']);
        const result = normalizeDjenComunicacoes(
            { count: 1, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            null,
            knownProcesses,
        );

        expect(result.djenConfirmedTotal).toBe(1);
        expect(result.djenComunicacoes[0].confirmationLevel).toBe('PROCESS_CONFIRMED');
    });

    it('adds geoMatch to normalized items', () => {
        const items = [
            makeItem({ siglaTribunal: 'TJMG' }),
            makeItem({ id: 2, siglaTribunal: 'TJSP', nomeClasse: 'Procedimento Comum', codigoClasse: 0 }),
        ];
        const knownProcesses = new Set(['00104442320228130701']);
        const result = normalizeDjenComunicacoes(
            { count: 2, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            null,
            knownProcesses,
            { candidateUfs: ['MG'] },
        );

        const mgItem = result.djenComunicacoes.find((i) => i.tribunal === 'TJMG');
        const spItem = result.djenComunicacoes.find((i) => i.tribunal === 'TJSP');
        expect(mgItem.geoMatch).toBe(true);
        expect(spItem.geoMatch).toBe(false);
    });

    it('geoMatch is null for national tribunals', () => {
        const items = [
            makeItem({ siglaTribunal: 'STJ' }),
        ];
        const result = normalizeDjenComunicacoes(
            { count: 1, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            null,
            null,
            { candidateUfs: ['MG'] },
        );

        expect(result.djenComunicacoes[0].geoMatch).toBeNull();
    });

    it('includes strict mode note when strictNameMatch is true', () => {
        const result = normalizeDjenComunicacoes(
            { count: 0, items: [], _request: {} },
            'NOME',
            null,
            null,
            { strictNameMatch: true },
        );

        expect(result.djenNotes).toContain('Filtro rigoroso ativo');
        expect(result.djenNotes).toContain('NAME_EXACT');
    });

    it('includes geo breakdown in notes', () => {
        const items = [
            makeItem({ siglaTribunal: 'TJMG' }),
            makeItem({ id: 2, siglaTribunal: 'TJSP', nomeClasse: 'Procedimento Comum', codigoClasse: 0 }),
        ];
        const knownProcesses = new Set(['00104442320228130701']);
        const result = normalizeDjenComunicacoes(
            { count: 2, items, _request: {} },
            'DIEGO FERNANDO PIRES',
            null,
            knownProcesses,
            { candidateUfs: ['MG'] },
        );

        expect(result.djenNotes).toContain('1 na UF do candidato (MG)');
        expect(result.djenNotes).toContain('1 em outros estados');
    });
});

describe('cleanDestinatarioName', () => {
    it('removes numbering prefix', () => {
        expect(cleanDestinatarioName('1. RENAN AUGUSTO')).toBe('RENAN AUGUSTO');
        expect(cleanDestinatarioName('23. FULANO')).toBe('FULANO');
    });

    it('removes polo suffix', () => {
        expect(cleanDestinatarioName('RENAN AUGUSTO (AGRAVANTE)')).toBe('RENAN AUGUSTO');
        expect(cleanDestinatarioName('DIEGO PIRES (APELANTE)')).toBe('DIEGO PIRES');
    });

    it('removes both prefix and suffix', () => {
        expect(cleanDestinatarioName('1. DIEGO FERNANDO PIRES (AGRAVANTE)')).toBe('DIEGO FERNANDO PIRES');
    });

    it('handles clean names unchanged', () => {
        expect(cleanDestinatarioName('DIEGO FERNANDO PIRES')).toBe('DIEGO FERNANDO PIRES');
    });

    it('handles null/empty', () => {
        expect(cleanDestinatarioName(null)).toBe('');
        expect(cleanDestinatarioName('')).toBe('');
    });
});

describe('computeWordSimilarity', () => {
    it('returns 1 for identical names', () => {
        expect(computeWordSimilarity('Diego Fernando Pires', 'DIEGO FERNANDO PIRES')).toBe(1);
    });

    it('returns high similarity for minor differences', () => {
        // "diego fernando pires" vs "diego fernando pires de oliveira"
        // Words: {diego, fernando, pires} vs {diego, fernando, pires, de, oliveira}
        // Intersection=3, Union=5 → 0.6
        const sim = computeWordSimilarity('Diego Fernando Pires', 'Diego Fernando Pires de Oliveira');
        expect(sim).toBeCloseTo(0.6, 1);
    });

    it('returns 0 for completely different names', () => {
        expect(computeWordSimilarity('FULANO DE TAL', 'BELTRANO CICLANO')).toBe(0);
    });

    it('handles empty names', () => {
        expect(computeWordSimilarity('', 'DIEGO')).toBe(0);
        expect(computeWordSimilarity('DIEGO', '')).toBe(0);
    });

    it('ignores accents', () => {
        expect(computeWordSimilarity('JOSÉ', 'JOSE')).toBe(1);
    });
});

describe('normalizeNameNoPrep', () => {
    it('strips prepositions de/da/do/dos/das/e', () => {
        expect(normalizeNameNoPrep('RENAN AUGUSTO DE JESUS')).toBe('renan augusto jesus');
        expect(normalizeNameNoPrep('MARIA DA SILVA')).toBe('maria silva');
        expect(normalizeNameNoPrep('JOSÉ DOS SANTOS')).toBe('jose santos');
        expect(normalizeNameNoPrep('CARLOS E SILVA')).toBe('carlos silva');
        expect(normalizeNameNoPrep('ANA DAS GRAÇAS DO CARMO')).toBe('ana gracas carmo');
    });

    it('handles names without prepositions', () => {
        expect(normalizeNameNoPrep('DIEGO FERNANDO PIRES')).toBe('diego fernando pires');
    });

    it('handles empty/null', () => {
        expect(normalizeNameNoPrep('')).toBe('');
        expect(normalizeNameNoPrep(null)).toBe('');
    });
});

describe('getDjenGeoMatch', () => {
    it('returns true when tribunal UF matches candidate UF', () => {
        expect(getDjenGeoMatch('TJMG', ['MG'])).toBe(true);
        expect(getDjenGeoMatch('TRT2', ['SP', 'RJ'])).toBe(true);
        expect(getDjenGeoMatch('TRT8', ['PA'])).toBe(true);
    });

    it('returns false when tribunal UF does not match', () => {
        expect(getDjenGeoMatch('TJMG', ['SP'])).toBe(false);
        expect(getDjenGeoMatch('TRT8', ['MG', 'RJ'])).toBe(false);
    });

    it('returns null for national tribunals (STJ, STF, TST, TSE)', () => {
        expect(getDjenGeoMatch('STJ', ['SP'])).toBeNull();
        expect(getDjenGeoMatch('STF', ['MG'])).toBeNull();
        expect(getDjenGeoMatch('TST', ['RJ'])).toBeNull();
        expect(getDjenGeoMatch('TSE', ['BA'])).toBeNull();
    });

    it('returns null when no candidate UFs provided', () => {
        expect(getDjenGeoMatch('TJMG', [])).toBeNull();
        expect(getDjenGeoMatch('TJMG', null)).toBeNull();
    });

    it('returns null for unknown tribunal', () => {
        expect(getDjenGeoMatch('XPTO', ['SP'])).toBeNull();
    });

    it('handles TRF multi-state coverage', () => {
        expect(getDjenGeoMatch('TRF1', ['MG'])).toBe(true);
        expect(getDjenGeoMatch('TRF1', ['SP'])).toBe(false);
        expect(getDjenGeoMatch('TRF3', ['SP'])).toBe(true);
        expect(getDjenGeoMatch('TRF5', ['CE'])).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(getDjenGeoMatch('tjmg', ['mg'])).toBe(true);
        expect(getDjenGeoMatch('Trt2', ['sp'])).toBe(true);
    });
});

describe('extractCpfFromText', () => {
    it('extracts formatted CPF', () => {
        const result = extractCpfFromText('Intimação ao réu CPF 123.456.789-01 para comparecer');
        expect(result).toEqual(['12345678901']);
    });

    it('extracts multiple CPFs', () => {
        const result = extractCpfFromText('CPF 111.222.333-44 e CPF 555.666.777-88');
        expect(result).toHaveLength(2);
        expect(result).toContain('11122233344');
        expect(result).toContain('55566677788');
    });

    it('returns empty for no CPFs', () => {
        expect(extractCpfFromText('Nenhum CPF aqui')).toEqual([]);
        expect(extractCpfFromText(null)).toEqual([]);
    });

    it('deduplicates repeated CPFs', () => {
        const result = extractCpfFromText('CPF 123.456.789-01 repetido 123.456.789-01');
        expect(result).toEqual(['12345678901']);
    });
});

describe('determineConfirmation', () => {
    const baseItem = {
        numero_processo: '00104442320228130701',
        destinatarios: [{ nome: 'DIEGO FERNANDO PIRES', polo: 'A' }],
        texto: 'Apelante(s) - DIEGO FERNANDO PIRES',
    };

    it('returns CPF_CONFIRMED when CPF found in text', () => {
        const item = { ...baseItem, texto: 'Réu CPF 100.051.856-61 intimado' };
        const result = determineConfirmation(item, 'DIEGO FERNANDO PIRES', '10005185661', new Set());
        expect(result.level).toBe('CPF_CONFIRMED');
    });

    it('returns PROCESS_CONFIRMED when process matches', () => {
        const result = determineConfirmation(
            baseItem, 'OUTRA PESSOA', null,
            new Set(['00104442320228130701']),
        );
        expect(result.level).toBe('PROCESS_CONFIRMED');
    });

    it('returns NAME_EXACT for exact name match', () => {
        const result = determineConfirmation(baseItem, 'DIEGO FERNANDO PIRES', null, new Set());
        expect(result.level).toBe('NAME_EXACT');
        expect(result.polo).toBe('A');
    });

    it('returns NAME_SIMILAR for high similarity', () => {
        // "1. DIEGO FERNANDO PIRES (AGRAVANTE)" cleaned to "DIEGO FERNANDO PIRES" — exact match
        const item = {
            ...baseItem,
            destinatarios: [{ nome: '1. DIEGO FERNANDO PIRES (AGRAVANTE)', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'DIEGO FERNANDO PIRES', null, new Set());
        expect(result.level).toBe('NAME_EXACT');
    });

    it('returns FILTERED_OUT for no match', () => {
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'FULANO BELTRANO CICLANO', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'DIEGO FERNANDO PIRES', null, new Set());
        expect(result.level).toBe('FILTERED_OUT');
    });

    it('CPF takes priority over process match', () => {
        const item = { ...baseItem, texto: 'CPF 111.222.333-44 no texto' };
        const result = determineConfirmation(
            item, 'OUTRO NOME', '11122233344',
            new Set(['00104442320228130701']),
        );
        expect(result.level).toBe('CPF_CONFIRMED');
    });

    it('returns FILTERED_OUT for NAME_SIMILAR when strictNameMatch is true', () => {
        // "MARIA SILVA SANTOS" vs "MARIA SANTOS SILVA" → same words, Jaccard 1.0 → NAME_SIMILAR normally
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'MARIA SILVA SANTOS', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'MARIA SANTOS SILVA', null, new Set(), { strictNameMatch: true });
        expect(result.level).toBe('FILTERED_OUT');
    });

    it('still returns NAME_EXACT when strictNameMatch is true', () => {
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'DIEGO FERNANDO PIRES', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'DIEGO FERNANDO PIRES', null, new Set(), { strictNameMatch: true });
        expect(result.level).toBe('NAME_EXACT');
    });

    it('still returns CPF_CONFIRMED when strictNameMatch is true', () => {
        const item = { ...baseItem, texto: 'CPF 100.051.856-61 no texto' };
        const result = determineConfirmation(item, 'OUTRO NOME', '10005185661', new Set(), { strictNameMatch: true });
        expect(result.level).toBe('CPF_CONFIRMED');
    });

    it('still returns PROCESS_CONFIRMED when strictNameMatch is true', () => {
        const result = determineConfirmation(
            baseItem, 'OUTRA PESSOA', null,
            new Set(['00104442320228130701']),
            { strictNameMatch: true },
        );
        expect(result.level).toBe('PROCESS_CONFIRMED');
    });

    it('NAME_EXACT handles accents via normalization even with strictNameMatch', () => {
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'JOSÉ DA SILVA', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'JOSE DA SILVA', null, new Set(), { strictNameMatch: true });
        expect(result.level).toBe('NAME_EXACT');
    });

    it('NAME_EXACT matches when prepositions differ (DE/DA/DO omitted by tribunal)', () => {
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'RENAN AUGUSTO JESUS', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'RENAN AUGUSTO DE JESUS', null, new Set());
        expect(result.level).toBe('NAME_EXACT');
    });

    it('NAME_EXACT with preposition stripping works under strictNameMatch', () => {
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'JOSE SILVA', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'JOSE DA SILVA', null, new Set(), { strictNameMatch: true });
        expect(result.level).toBe('NAME_EXACT');
    });

    it('preposition stripping does not match different core names', () => {
        const item = {
            ...baseItem,
            destinatarios: [{ nome: 'RENAN AUGUSTO SANTOS', polo: 'A' }],
        };
        const result = determineConfirmation(item, 'RENAN AUGUSTO DE JESUS', null, new Set(), { strictNameMatch: true });
        expect(result.level).toBe('FILTERED_OUT');
    });
});

describe('filterAndConfirmItems', () => {
    const makeFilterItem = (id, nome, processo = '123') => ({
        id,
        numero_processo: processo,
        destinatarios: [{ nome, polo: 'A' }],
        texto: '',
    });

    it('confirms matching items and filters others', () => {
        const items = [
            makeFilterItem(1, 'DIEGO FERNANDO PIRES'),
            makeFilterItem(2, 'FULANO DE TAL'),
            makeFilterItem(3, 'DIEGO FERNANDO PIRES'),
        ];
        const result = filterAndConfirmItems(items, 'DIEGO FERNANDO PIRES', null, new Set());

        expect(result.confirmed).toHaveLength(2);
        expect(result.filteredOutCount).toBe(1);
        expect(result.confirmationStats.nameExact).toBe(2);
    });

    it('returns all filtered out when no match', () => {
        const items = [
            makeFilterItem(1, 'FULANO'),
            makeFilterItem(2, 'BELTRANO'),
        ];
        const result = filterAndConfirmItems(items, 'DIEGO FERNANDO PIRES', null, new Set());

        expect(result.confirmed).toHaveLength(0);
        expect(result.filteredOutCount).toBe(2);
    });

    it('confirms by CPF in text', () => {
        const items = [{
            id: 1,
            numero_processo: '999',
            destinatarios: [{ nome: 'NOME ERRADO', polo: 'P' }],
            texto: 'Intimem o réu CPF 111.222.333-44',
        }];
        const result = filterAndConfirmItems(items, 'DIEGO', '11122233344', new Set());

        expect(result.confirmed).toHaveLength(1);
        expect(result.confirmationStats.cpf).toBe(1);
    });

    it('tracks confirmation stats correctly', () => {
        const items = [
            { id: 1, numero_processo: '111', destinatarios: [{ nome: 'DIEGO FERNANDO PIRES', polo: 'A' }], texto: 'CPF 100.051.856-61' },
            { id: 2, numero_processo: '222', destinatarios: [{ nome: 'PESSOA X', polo: 'A' }], texto: '' },
            { id: 3, numero_processo: '333', destinatarios: [{ nome: 'DIEGO FERNANDO PIRES', polo: 'A' }], texto: '' },
        ];
        const result = filterAndConfirmItems(items, 'DIEGO FERNANDO PIRES', '10005185661', new Set(['222']));

        expect(result.confirmed).toHaveLength(3);
        expect(result.confirmationStats.cpf).toBe(1);
        expect(result.confirmationStats.process).toBe(1);
        expect(result.confirmationStats.nameExact).toBe(1);
    });

    it('filters out NAME_SIMILAR items when strictNameMatch is true', () => {
        const items = [
            makeFilterItem(1, 'DIEGO FERNANDO PIRES'),        // NAME_EXACT → kept
            makeFilterItem(2, 'DIEGO PIRES FERNANDO'),         // NAME_SIMILAR (same words, diff order) → filtered
            makeFilterItem(3, 'FULANO DE TAL'),                // no match → filtered
        ];
        const result = filterAndConfirmItems(items, 'DIEGO FERNANDO PIRES', null, new Set(), { strictNameMatch: true });

        expect(result.confirmed).toHaveLength(1);
        expect(result.filteredOutCount).toBe(2);
        expect(result.confirmationStats.nameExact).toBe(1);
        expect(result.confirmationStats.nameSimilar).toBe(0);
    });
});
