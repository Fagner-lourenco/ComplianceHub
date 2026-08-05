# Escavador2 Data Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preservar partes, status e local dos processos Escavador2 no prefill e limitar o raw interno a 128 KiB sem anonimizar evidencias.

**Architecture:** Concentrar a transformacao em funcoes puras de `functions/normalizers/escavador2.js`. O callback continua consumindo `normalizeEscavador2Response`, portanto recebe automaticamente processos completos para classificacao e um raw compacto para persistencia, sem alterar estados, deduplicacao ou politica de veredito.

**Tech Stack:** Node.js 22, CommonJS, Firebase Cloud Functions Gen2, Firestore, Vitest 2.

## Global Constraints

- Nao executar deploy, rerun, PATCH, update, set ou qualquer escrita no Firebase de producao.
- Nao anonimizar ou mascarar nomes, partes, polos, CNJs ou evidencias processuais.
- `escavador2RawPayloads` permanece interno e nao pode entrar em relatorios publicos ou no portal do cliente.
- Raw compacto deve ter no maximo 128 KiB medidos por `Buffer.byteLength(JSON.stringify(value), 'utf8')`.
- Manter estados terminais e regras de classificacao existentes.
- Nao criar commits sem solicitacao explicita do usuario.

---

### Task 1: Normalizar partes, status e local

**Files:**
- Modify: `functions/normalizers/escavador2.test.js`
- Modify: `functions/normalizers/escavador2.js:13-142`

**Interfaces:**
- Consumes: processo bruto Escavador2 em `mapProcess(processo, index)`.
- Produces: `parties: Array<{name: string, role: string, side: 'ACTIVE'|'PASSIVE'}>`, `status`, `processCity`, `comarca`, `vara` e `judgingBody` em cada item de `escavador2Processos`.

- [ ] **Step 1: Escrever o teste falho para a contraparte Madero**

Adicionar ao fixture trabalhista de `functions/normalizers/escavador2.test.js` os polos reais sanitizados e testar o contrato canonico:

```js
lista: {
  polo_ativo: 'RODRIGO HENRIQUE',
  polo_passivo: 'Madero Industria e Comercio S.A',
},
normalizado: {
  match: { has_exact_cpf_match: true },
  dados: {
    classe: 'Acao Trabalhista - Rito Sumarissimo',
    assunto: 'Acumulo de Funcao',
    tribunal_sigla: 'TRT-1',
    uf: 'RJ',
    cidade: 'Rio de Janeiro',
    orgao_julgador: '62a Vara do Trabalho do Rio de Janeiro',
    status_predito: 'ATIVO',
    data_inicio: '2026-05-25',
  },
},
```

```js
it('maps labor parties, predicted status, city and court unit', () => {
  const normalized = normalizeEscavador2Response(response);
  const labor = normalized.escavador2Processos[1];

  expect(labor).toEqual(expect.objectContaining({
    status: 'ATIVO',
    processCity: 'Rio de Janeiro',
    comarca: 'Rio de Janeiro',
    vara: '62a Vara do Trabalho do Rio de Janeiro',
    judgingBody: '62a Vara do Trabalho do Rio de Janeiro',
    parties: [
      { name: 'RODRIGO HENRIQUE', role: 'Polo Ativo', side: 'ACTIVE' },
      { name: 'Madero Industria e Comercio S.A', role: 'Polo Passivo', side: 'PASSIVE' },
    ],
  }));
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `npm test -- normalizers/escavador2.test.js`

Working directory: `functions`

Expected: FAIL porque `parties`, `processCity`, `comarca`, `vara` e `judgingBody` nao existem e `status` continua `null`.

- [ ] **Step 3: Escrever testes falhos de deduplicacao e fallback de partes**

Adicionar um processo que repete a mesma parte em `lista`, `detalhes.processo` e `detalhes.raw.fontes[].envolvidos[]`:

```js
it('deduplicates parties collected from list, details and involved people', () => {
  const normalized = normalizeEscavador2Response({
    processos: [{
      lista: { polo_ativo: 'CANDIDATA TESTE', polo_passivo: 'EMPRESA TESTE LTDA' },
      detalhes: {
        processo: { polo_passivo: 'EMPRESA TESTE LTDA' },
        raw: {
          fontes: [{ envolvidos: [
            { nome: 'CANDIDATA TESTE', polo: 'ATIVO' },
            { nome: 'EMPRESA TESTE LTDA', polo: 'PASSIVO' },
          ] }],
        },
      },
      classificacao: { area: 'LABOR' },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: { dados: {}, match: {} },
    }],
  });

  expect(normalized.escavador2Processos[0].parties).toEqual([
    { name: 'CANDIDATA TESTE', role: 'Polo Ativo', side: 'ACTIVE' },
    { name: 'EMPRESA TESTE LTDA', role: 'Polo Passivo', side: 'PASSIVE' },
  ]);
});
```

- [ ] **Step 4: Implementar a extracao minima de partes**

Adicionar funcoes puras antes de `mapProcess`:

```js
function asObjectArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  return value && typeof value === 'object' ? [value] : [];
}

function collectProcessParties(processo = {}) {
  const parties = [];
  const seen = new Set();
  const add = (name, side) => {
    const cleanName = String(name || '').trim();
    if (!cleanName || !side) return;
    const key = `${side}:${cleanName.toLocaleUpperCase('pt-BR')}`;
    if (seen.has(key)) return;
    seen.add(key);
    parties.push({
      name: cleanName,
      role: side === 'ACTIVE' ? 'Polo Ativo' : 'Polo Passivo',
      side,
    });
  };
  const addPoles = (source) => {
    const data = asObject(source);
    add(data.polo_ativo, 'ACTIVE');
    add(data.polo_passivo, 'PASSIVE');
  };

  addPoles(processo.lista);
  addPoles(processo.detalhes?.processo);
  for (const fonte of asObjectArray(processo.detalhes?.raw?.fontes)) {
    for (const envolvido of asObjectArray(fonte.envolvidos)) {
      const polo = String(envolvido.polo || '').toUpperCase();
      add(envolvido.nome, polo === 'ATIVO' ? 'ACTIVE' : polo === 'PASSIVO' ? 'PASSIVE' : null);
    }
  }
  return parties;
}
```

Em `mapProcess`, mapear os novos campos:

```js
const status = normalizeStatus(processo.status) || normalizeStatus(dados.status_predito);
const processCity = dados.cidade || null;
const judgingBody = dados.orgao_julgador || null;
const parties = collectProcessParties(processo);
```

```js
status,
processCity,
comarca: processCity,
vara: judgingBody,
judgingBody,
parties,
```

- [ ] **Step 5: Executar testes do normalizador e confirmar GREEN**

Run: `npm test -- normalizers/escavador2.test.js`

Working directory: `functions`

Expected: todos os testes passam, inclusive o teste existente que impede objeto de coleta de virar status processual.

---

### Task 2: Compactar raw e fontes processuais

**Files:**
- Modify: `functions/normalizers/escavador2.test.js`
- Modify: `functions/normalizers/escavador2.js:48-175`

**Interfaces:**
- Consumes: resposta completa em `normalizeEscavador2Response(response, options)`.
- Produces: `buildCompactRawResponse(response): object` com no maximo 128 KiB e `_sourceEscavador2.normalizado` sem movimentos/documentos extensos.

- [ ] **Step 1: Escrever teste falho de limite e preservacao integral de identificadores**

```js
it('compacts verbose raw payload below 128 KiB without anonymizing evidence', () => {
  const verbose = 'conteudo processual '.repeat(20000);
  const input = {
    consulta: { cpf: '86730864508', nome: 'RODRIGO HENRIQUE', status: 'DONE' },
    resumo: { total_processos: 1 },
    processos: [{
      lista: {
        polo_ativo: 'RODRIGO HENRIQUE',
        polo_passivo: 'Madero Industria e Comercio S.A',
      },
      cnj: { valor: '010XXXX-48.2026.5.01.0062', mascarado: true },
      classificacao: { area: 'LABOR', risco_material: true },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: {
        match: { tipo: 'CPF', has_exact_cpf_match: true },
        dados: { classe: 'Acao Trabalhista', cidade: 'Rio de Janeiro' },
        movimentacoes_resumo: [{ conteudo_resumo: verbose }],
      },
      detalhes: {
        processo: { polo_passivo: 'Madero Industria e Comercio S.A' },
        raw: { resumo: verbose, html: verbose },
      },
      movimentacoes: { items: [{ conteudo: verbose }] },
      documentos: [{ conteudo: verbose }],
    }],
  };

  const normalized = normalizeEscavador2Response(input);
  const raw = normalized.escavador2RawPayloads.response;

  expect(Buffer.byteLength(JSON.stringify(raw), 'utf8')).toBeLessThanOrEqual(128 * 1024);
  expect(JSON.stringify(raw)).toContain('86730864508');
  expect(JSON.stringify(raw)).toContain('Madero Industria e Comercio S.A');
  expect(JSON.stringify(raw)).not.toContain(verbose);
  expect(input.processos[0].detalhes.raw.resumo).toBe(verbose);
});
```

- [ ] **Step 2: Executar o teste e confirmar RED**

Run: `npm test -- normalizers/escavador2.test.js -t "compacts verbose raw payload"`

Working directory: `functions`

Expected: FAIL porque o raw atual preserva a resposta completa e excede 128 KiB.

- [ ] **Step 3: Implementar compactacao deterministica**

Adicionar constantes e helpers:

```js
const RAW_AUDIT_MAX_BYTES = 128 * 1024;

function compactFetchSummary(value) {
  if (Array.isArray(value)) return { total: value.length };
  if (!value || typeof value !== 'object') return value || null;
  return {
    total: value.total ?? null,
    coletadas: value.coletadas ?? null,
  };
}

function compactProcessForAudit(processo = {}) {
  const normalizado = asObject(processo.normalizado);
  return {
    status: normalizeStatus(processo.status),
    cnj: processo.cnj || null,
    classificacao: processo.classificacao || null,
    papel_candidato: processo.papel_candidato || null,
    lista: processo.lista ? {
      polo_ativo: processo.lista.polo_ativo || null,
      polo_passivo: processo.lista.polo_passivo || null,
      papeis_pessoa_pesquisada: processo.lista.papeis_pessoa_pesquisada || null,
    } : null,
    normalizado: {
      cnj: normalizado.cnj || null,
      match: normalizado.match || null,
      dados: normalizado.dados || null,
      status_fetch: normalizado.status_fetch || null,
    },
    detalhes: processo.detalhes?.processo ? {
      processo: {
        polo_ativo: processo.detalhes.processo.polo_ativo || null,
        polo_passivo: processo.detalhes.processo.polo_passivo || null,
      },
    } : null,
  };
}

function buildCompactRawResponse(response = {}) {
  const compact = {
    consulta: response.consulta || null,
    perfil: response.perfil || null,
    resumo: response.resumo || null,
    erros_parciais: asArray(response.erros_parciais),
    estatisticas: response.estatisticas || {},
    processos: asArray(response.processos).map(compactProcessForAudit),
  };
  const originalCount = compact.processos.length;
  while (
    Buffer.byteLength(JSON.stringify(compact), 'utf8') > RAW_AUDIT_MAX_BYTES
    && compact.processos.length > 0
  ) {
    compact.processos.pop();
  }
  if (compact.processos.length < originalCount) {
    compact.truncado = true;
    compact.processosOmitidos = originalCount - compact.processos.length;
  }
  if (Buffer.byteLength(JSON.stringify(compact), 'utf8') > RAW_AUDIT_MAX_BYTES) {
    return {
      consulta: {
        cpf: response.consulta?.cpf || null,
        nome: response.consulta?.nome || null,
        status: response.consulta?.status || null,
      },
      resumo: {
        total_processos: response.resumo?.total_processos ?? originalCount,
        total_criminais: response.resumo?.total_criminais ?? null,
        total_trabalhistas: response.resumo?.total_trabalhistas ?? null,
      },
      truncado: true,
      processosOmitidos: originalCount,
    };
  }
  return compact;
}
```

Trocar a persistencia completa:

```js
escavador2RawPayloads: {
  response: buildCompactRawResponse(response),
},
```

- [ ] **Step 4: Remover duplicacoes volumosas dos processos normalizados**

Em `mapProcess`, compactar os resumos e a fonte interna:

```js
movimentacoesResumo: compactFetchSummary(processo.movimentacoes_resumo),
documentosResumo: compactFetchSummary(processo.documentos_resumo),
_sourceEscavador2: {
  provider: 'escavador2',
  cnj,
  classificacao: processo.classificacao || null,
  papel_candidato: papel,
  normalizado: {
    cnj: processo.normalizado?.cnj || null,
    match,
    dados,
    status_fetch: processo.normalizado?.status_fetch || null,
  },
},
```

- [ ] **Step 5: Ajustar teste antigo do raw para o novo contrato compacto**

Substituir a expectativa de igualdade integral por verificacoes de evidencias e imutabilidade:

```js
expect(normalized.escavador2RawPayloads.response).toEqual(expect.objectContaining({
  consulta: response.consulta,
  perfil: response.perfil,
  resumo: response.resumo,
}));
expect(normalized.escavador2RawPayloads.response.processos[0]).toEqual(expect.objectContaining({
  cnj: response.processos[0].cnj,
  classificacao: response.processos[0].classificacao,
  papel_candidato: response.processos[0].papel_candidato,
}));
expect(response).toEqual(original);
```

- [ ] **Step 6: Executar testes do normalizador e confirmar GREEN**

Run: `npm test -- normalizers/escavador2.test.js`

Working directory: `functions`

Expected: todos os testes passam e o teste volumoso confirma raw menor ou igual a 131.072 bytes.

---

### Task 3: Provar o prefill e a classificacao ponta a ponta

**Files:**
- Modify: `functions/helpers/deterministicPrefill.test.js`
- Test: `functions/modules/autoClassification.test.js`

**Interfaces:**
- Consumes: `normalizeEscavador2Response`, `deduplicateEscavador2Findings`, `computeAutoClassification` e `buildDeterministicPrefill`.
- Produces: regressao que prova contraparte visivel sem alterar a politica de classificacao trabalhista.

- [ ] **Step 1: Escrever teste de integracao falho para processo Escavador2 novo**

Criar um fixture pequeno no teste de prefill, normaliza-lo e deduplica-lo com os helpers reais:

```js
it('includes Escavador2 labor counterparty in deterministic prefill', () => {
  const normalized = normalizeEscavador2Response({
    consulta: { status: 'DONE' },
    processos: [{
      lista: {
        polo_ativo: 'RODRIGO HENRIQUE',
        polo_passivo: 'Madero Industria e Comercio S.A',
      },
      cnj: { valor: '010XXXX-48.2026.5.01.0062', mascarado: true },
      classificacao: { area: 'LABOR', risco_material: true },
      papel_candidato: { tipo_principal: 'Autor', polo_principal: 'ATIVO' },
      normalizado: {
        match: { tipo: 'CPF', has_exact_cpf_match: true },
        dados: {
          classe: 'Acao Trabalhista - Rito Sumarissimo',
          assunto: 'Acumulo de Funcao',
          tribunal_sigla: 'TRT-1',
          cidade: 'Rio de Janeiro',
          orgao_julgador: '62a Vara do Trabalho do Rio de Janeiro',
          status_predito: 'ATIVO',
        },
      },
    }],
  });
  const deduped = deduplicateEscavador2Findings(normalized);
  const prefill = buildDeterministicPrefill({
    candidateName: 'RODRIGO HENRIQUE',
    laborFlag: 'POSITIVE',
    criminalFlag: 'NEGATIVE',
    warrantFlag: 'NEGATIVE',
    ...normalized,
    ...deduped,
  });

  expect(prefill.laborNotes).toContain('Parte reclamada/passiva: Madero Industria e Comercio S.A');
  expect(prefill.laborNotes).toContain('Status processual: ATIVO');
  expect(prefill.laborNotes).toContain('Comarca: Rio de Janeiro');
  expect(prefill.laborNotes).toContain('Vara: 62a Vara do Trabalho do Rio de Janeiro');
});
```

Importar no topo do teste as funcoes reais de normalizacao e deduplicacao.

```js
const { normalizeEscavador2Response } = require('../normalizers/escavador2');
const { deduplicateEscavador2Findings } = require('./deduplicateEscavador2');
```

- [ ] **Step 2: Executar o teste e confirmar o estado esperado**

Run: `npm test -- helpers/deterministicPrefill.test.js -t "includes Escavador2 labor counterparty"`

Working directory: `functions`

Expected antes da Task 1: FAIL por ausencia da contraparte. Expected depois das Tasks 1 e 2: PASS, comprovando a integracao.

- [ ] **Step 3: Executar regressao de classificacao**

Run: `npm test -- modules/autoClassification.test.js normalizers/escavador2.test.js helpers/deterministicPrefill.test.js`

Working directory: `functions`

Expected: PASS. Em particular, autor/reclamante novo continua positivo e reu/reclamado continua no fluxo de baixo risco existente.

---

### Task 4: Verificacao do callback e regressao completa

**Files:**
- Test only: `functions/modules/escavador2AsyncCallback.test.js`
- Test only: `functions/modules/enrichmentPhases.test.js`
- Test only: `functions/helpers/deterministicPrefill.test.js`
- Update generated graph: `graphify-out/*`

**Interfaces:**
- Consumes: implementacao final das Tasks 1-3.
- Produces: evidencia de que callback, fase, prefill e consumidores permanecem compativeis.

- [ ] **Step 1: Executar todos os testes Escavador2 e consumidores diretos**

Run:

```powershell
npm test -- normalizers/escavador2.test.js modules/escavador2AsyncCallback.test.js modules/enrichmentPhases.test.js helpers/deduplicateEscavador2.test.js helpers/deterministicPrefill.test.js modules/autoClassification.test.js
```

Working directory: `functions`

Expected: todos passam, sem writes externos porque os testes usam funcoes puras/mocks locais.

- [ ] **Step 2: Executar lint do backend**

Run: `npm run lint`

Working directory: `functions`

Expected: zero erros novos.

- [ ] **Step 3: Executar suite completa do backend**

Run: `npm test`

Working directory: `functions`

Expected: todos os testes passam.

- [ ] **Step 4: Atualizar o grafo de conhecimento**

Run: `graphify update .`

Working directory: raiz do workspace.

Expected: atualizacao AST concluida sem chamadas pagas de API.

- [ ] **Step 5: Inspecionar somente o diff pretendido**

Run: `git diff -- functions/normalizers/escavador2.js functions/normalizers/escavador2.test.js functions/helpers/deterministicPrefill.test.js docs/superpowers/specs/2026-07-17-escavador2-data-quality-design.md docs/superpowers/plans/2026-07-17-escavador2-data-quality.md`

Expected: apenas normalizacao, compactacao, testes e documentacao; nenhum script de escrita, configuracao de deploy ou credencial.
