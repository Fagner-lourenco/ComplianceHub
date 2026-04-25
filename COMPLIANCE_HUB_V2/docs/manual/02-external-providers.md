# 02 — External Providers (Adapters em uso)

Resumo de todo adapter que o backend V2 mantém em [`COMPLIANCE_HUB_V2/app/functions/adapters/`](../../app/functions/adapters/). Para o catálogo completo de endpoints BigDataCorp (incluindo os que **ainda não usamos**), ver [`05-bigdatacorp-api.md`](./05-bigdatacorp-api.md).

---

## 1. BigDataCorp

- **Arquivo:** [`adapters/bigdatacorp.js`](../../app/functions/adapters/bigdatacorp.js)
- **Base URL:** `https://plataforma.bigdatacorp.com.br` (override: `BIGDATACORP_BASE_URL`)
- **Autenticação:** Headers `AccessToken` + `TokenId` (Firebase secrets `BIGDATACORP_ACCESS_TOKEN` + `BIGDATACORP_TOKEN_ID`)
- **Retry:** 3 tentativas, backoff inicial 1 s
- **Timeout:** 25 s por request
- **Endpoints físicos usados:** 1 (`POST /pessoas`) — todos os datasets viajam por esse endpoint
- **Datasets atualmente consumidos pelo V2:** `basic_data`, `processes`, `kyc`, `occupation_data`
- **Datasets BigDataCorp disponíveis mas não consumidos:** ver seção "Gap" em [`05-bigdatacorp-api.md`](./05-bigdatacorp-api.md) (mais de 190 pontos de documentação restantes)

### Funções expostas

| Função | Body `q` | Datasets solicitados | Linha |
|---|---|---|---|
| `queryCombined(cpf, credentials, opts)` | `doc{<CPF>} returnupdates{false}` | `basic_data,processes.limit(N),kyc,occupation_data` | 184 |
| `queryProcesses(cpf, credentials, opts)` | idem | `processes.limit(N).next(offset)` | 220 |
| `queryKyc(cpf, credentials)` | `doc{<CPF>}` | `kyc` | 254 |

### Padrão de payload

```json
POST https://plataforma.bigdatacorp.com.br/pessoas
Headers: { AccessToken, TokenId, content-type: application/json }
Body: {
  "q": "doc{12345678901}",
  "Datasets": "kyc",
  "Limit": 1
}
```

**Error class:** `BigDataCorpError` exportada para discriminação upstream.

---

## 2. Judit

- **Arquivo:** [`adapters/judit.js`](../../app/functions/adapters/judit.js)
- **Autenticação:** header `api-key` (secret `JUDIT_API_KEY`)
- **Bases:**
  - Sync datalake: `https://lawsuits.production.judit.io` (override `JUDIT_SYNC_BASE_URL`)
  - Async requests: `https://requests.prod.judit.io` (override `JUDIT_ASYNC_BASE_URL`)
  - Entity datalake: `https://lawsuits.prod.judit.io` (override `JUDIT_ENTITY_BASE_URL`)
- **Timeouts:** 15 s por request; polling até 8 min (`POLL_MAX_WAIT_MS`)
- **Cache TTL padrão:** 7 dias
- **Custos anotados no código:**
  - Entity create (R$ 0,12)

### Endpoints consumidos

| Operação | Método | URL | Retorno |
|---|---|---|---|
| Sync lawsuits por CPF | POST | `{SYNC}/lawsuits` | imediato, até ~50 processos |
| Sync lawsuits por nome | POST | `{SYNC}/lawsuits` | idem, key `search.search_value = name` |
| Async request create | POST | `{ASYNC}/requests` | `{ request_id, status }` |
| Async request status | GET | `{ASYNC}/requests/{requestId}` | poll status |
| Async responses | GET | `{ASYNC}/responses?request_id=...&page=1&page_size=100` | payload final |
| Entity datalake | POST | `{ENTITY}/requests/create` | synchronous entity lookup |

### Funções expostas

| Função | Linha | Uso |
|---|---|---|
| `queryLawsuitsSync(cpf, apiKey, opts)` | 279 | Sync por CPF (barato, parcial) |
| `queryLawsuitsSyncByName(fullName, apiKey)` | 314 | Sync por nome |
| `queryLawsuitsAsync(cpf, apiKey, opts)` | 332 | Request completo + poll |
| `queryWarrantAsync(cpf, apiKey, opts)` | 387 | Mandados de prisão async |
| `queryExecutionAsync(cpf, apiKey, opts)` | 431 | Execuções async |
| `queryEntityDataLake(cpf, apiKey)` | 474 | Entity datalake sync |
| `queryLawsuitsByNameAsync(fullName, apiKey, opts)` | 503 | Lawsuits async por nome |
| `checkRequestStatus(requestId, apiKey)` | 206 | Status raw |
| `pollRequest(requestId, apiKey, opts)` | 217 | Loop de polling |
| `fetchResponses(requestId, apiKey)` | 252 | Busca payload final |

---

## 3. Escavador

- **Arquivo:** [`adapters/escavador.js`](../../app/functions/adapters/escavador.js)
- **Base URL:** `https://api.escavador.com/api/v2` (override `ESCAVADOR_BASE_URL`)
- **Autenticação:** Header `Authorization: Bearer <token>` (secret `ESCAVADOR_API_TOKEN`)
- **Timeout:** 20 s por request; paginação máx. 5 páginas
- **Retry:** 3 tentativas, backoff 1 s

### Endpoints consumidos

| Operação | Método | Função | Linha |
|---|---|---|---|
| Processos por pessoa (CPF) | GET | `queryProcessosByPerson(cpf, token, opts)` | 116 |
| Processo por CNJ | GET | `queryProcessoByCnj(numeroCnj, token)` | 154 |
| Movimentações por CNJ | GET | `queryMovimentacoes(numeroCnj, token, opts)` | 167 |

---

## 4. FonteData

- **Arquivo:** [`adapters/fontedata.js`](../../app/functions/adapters/fontedata.js)
- **Base URL:** `https://app.fontedata.com/api/v1/consulta` (override `FONTEDATA_BASE_URL`)
- **Autenticação:** Header `api-key` (secret `FONTEDATA_API_KEY`)
- **Timeout:** 15 s; retry 3x
- **Mapa interno:** `UF_TO_TRT` (UF → lista de regiões TRT)

### Endpoints consumidos

| Operação | Path | Função |
|---|---|---|
| Antecedentes criminais | `antecedentes-criminais` | `queryCriminal(cpf, apiKey)` |
| Mandados de prisão | `cnj-mandados-prisao` | `queryWarrant(cpf, apiKey)` |
| TRT consulta (trabalhista) | `trt-consulta?regiao=N` | `queryLabor(cpf, apiKey, uf?)` |
| Cadastro PF básico | `cadastro-pf-basica` | `queryIdentity(cpf, apiKey)` |
| Receita Federal PF | `receita-federal-pf` | `queryReceitaFederal(cpf, apiKey)` |
| Processos agrupada | `processos-agrupada` | `queryProcessosAgrupada(cpf, apiKey)` |
| Processos completa | `processos-completa` | `queryProcessosCompleta(cpf, apiKey)` |

---

## 5. DJEN (Diário de Justiça Eletrônico Nacional / PJE ComunicaAPI)

- **Arquivo:** [`adapters/djen.js`](../../app/functions/adapters/djen.js)
- **Base URL:** `https://comunicaapi.pje.jus.br/api/v1` (override `DJEN_BASE_URL`)
- **Autenticação:** Pública (sem header)
- **Rate limit:** `INTER_REQUEST_DELAY_MS = 500`, `RATE_LIMIT_SAFETY_BUFFER = 2`, max 3 páginas
- **Timeout:** 15 s

### Endpoints consumidos

| Operação | Path | Função |
|---|---|---|
| Comunicações por nome | `GET /comunicacao?nomeParte=...&dataDisponibilizacaoInicio=...&dataDisponibilizacaoFim=...&pagina=N` | `queryComunicacoesByName(nomeParte, opts)` |
| Comunicações por processo | `GET /comunicacao?numeroProcesso=...` | `queryComunicacoesByProcesso(numeroProcesso)` |
| Lista tribunais | `GET /comunicacao/tribunal` | `queryTribunais()` |

---

## 6. OpenAI (análise AI)

- **Uso:** Inline em `index.js` via `fetch` para `https://api.openai.com/v1/chat/completions`
- **Secret:** `OPENAI_API_KEY`
- **Modelo:** `gpt-5.4-nano`
- **Cache:** 24h (`AI_CACHE_TTL_MS`)
- **Circuit breaker:** 3 falhas → cooldown 10 min
- **3 usos distintos com prompts versionados:**
  - `v3-evidence-based` (análise principal de due diligence)
  - `v1-homonym-dedicated` (desambiguação)
  - `v1-report-prefill` (prefill narrativo do relatório)
- **Custo anotado:** USD 0,20 input / USD 1,25 output por M tokens. Função `estimateAiCostUsd(inputTokens, outputTokens)` calcula.

### Schema JSON forçado

Em `index.js:426-466`:

- `AI_JSON_SCHEMA` — análise completa (decision, flags, notes)
- `AI_HOMONYM_JSON_SCHEMA` — homônimo
- `AI_PREFILL_JSON_SCHEMA` — prefill

---

## 7. Tabela consolidada de provedores

| Provedor | Base URL | Auth | Timeout | Retry | Secret |
|---|---|---|---|---|---|
| BigDataCorp | `plataforma.bigdatacorp.com.br` | `AccessToken` + `TokenId` | 25 s | 3× | `BIGDATACORP_ACCESS_TOKEN`, `BIGDATACORP_TOKEN_ID` |
| Judit sync | `lawsuits.production.judit.io` | `api-key` | 15 s | 3× | `JUDIT_API_KEY` |
| Judit async | `requests.prod.judit.io` | `api-key` | 15 s + poll 8 min | 3× | `JUDIT_API_KEY` |
| Judit entity | `lawsuits.prod.judit.io` | `api-key` | 15 s | 3× | `JUDIT_API_KEY` |
| Escavador | `api.escavador.com/api/v2` | `Bearer` | 20 s | 3× | `ESCAVADOR_API_TOKEN` |
| FonteData | `app.fontedata.com/api/v1/consulta` | `api-key` | 15 s | 3× | `FONTEDATA_API_KEY` |
| DJEN | `comunicaapi.pje.jus.br/api/v1` | pública | 15 s | 3× | — |
| OpenAI | `api.openai.com/v1` | `Bearer` | inline | breaker | `OPENAI_API_KEY` |
