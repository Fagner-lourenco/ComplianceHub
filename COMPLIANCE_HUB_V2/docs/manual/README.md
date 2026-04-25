# Manual Consolidado ComplianceHub V2 — BDC

Documentação exaustiva de toda superfície do ComplianceHub V2 + catálogo BigDataCorp.

## Estrutura limpa (pós-reorganização)

```
docs/manual/
├── README.md                          # ← Você está aqui
├── 01-v2-backend-surface.md           # 60 callables + triggers + webhooks
├── 02-external-providers.md           # Adapters: BDC, Judit, Escavador, FonteData, DJEN, OpenAI
├── 03-firestore-model.md              # 38 coleções + roles + índices
├── 04-client-bindings.md              # firestoreService + subscriptions
├── 05-bigdatacorp-api.md              # Header BDC + KYC como referência hidratada
├── 05b-bigdatacorp-hydrated.md        # **41 entradas hidratadas** (ativo)
├── 06-cost-matrix.md                  # 8 curvas de preço BDC
├── 07-provider-to-product-mapping.md  # Provider ↔ Module ↔ Preset
├── 08-taxonomy-proposal.md            # Taxonomia aprovada: 11 macroáreas
├── 09-hydration-status.md             # Plano de execução 4 ondas
├── 10-source-catalog.json             # **SSoT** — 199 entradas JSON classificadas
├── 11-preset-registry.md              # 9 presets com sourceKeys reais
├── 12-backend-scope-confirmation.md
├── 13-system-review-report.md
├── bdc/                               # **12 arquivos por macroárea** — view organizada
│   ├── 00-meta.md
│   ├── 01-identidade-cadastro.md
│   ├── 02-juridico-processual.md
│   ├── 03-compliance-sancoes.md
│   ├── 04-financeiro-credito.md
│   ├── 05-risco.md
│   ├── 06-profissional-laboral.md
│   ├── 07-politico-eleitoral.md
│   ├── 08-midia-reputacao.md
│   ├── 09-presenca-digital.md
│   ├── 10-ativos-propriedade.md
│   └── 11-socioambiental-esg.md
├── bdg_scraped/                       # 189 arquivos raw (fonte primária)
├── archive/                           # Arquivos obsoletos movidos
│   ├── 05a-bigdatacorp-stubs.legacy.md
│   └── 05b-bigdatacorp-hydrated-full.raw.md
├── _*.py                              # 13 scripts do pipeline de hidratação
└── _hydration_results.json            # Output intermediário do pipeline
```

## O que mudou nesta limpeza

| Ação | Motivo |
|---|---|
| `05a-bigdatacorp-stubs.md` → `archive/` | Superseded pela pasta `bdc/` — stubs agora organizados por macroárea |
| `05b-bigdatacorp-hydrated-full.md` → `archive/` | Dump bruto de 99k linhas; a informação útil está em `05b-bigdatacorp-hydrated.md` e `bdc/` |

## Fonte de verdade (SSoT)

1. **`10-source-catalog.json`** — catálogo máster com 199 entradas
2. **`bdc/<macroarea>.md`** — view organizada para consumo humano
3. **`05b-bigdatacorp-hydrated.md`** — running log das 41 entradas hidratadas

## Pipeline de hidratação (scripts)

```
bdg_scraped/  →  _auto_hydrator.py  →  _extract_missing.py  →  _generate_hydrated_entries.py
                                                              ↓
                                                    10-source-catalog.json
                                                              ↓
                                                    bdc/ + 05b-bigdatacorp-hydrated.md
```

## Taxonomia resumida

**3 eixos ortogonais:**
1. **Entidade:** `pf` · `pj` · `address` · `vehicle` · `product` · `process`
2. **11 macroáreas:** Identidade, Jurídico, Compliance, Financeiro, Risco, Profissional, Político, Mídia, Presença Digital, Ativos, ESG
3. **Modo de entrega:** `standard` (114) · `ondemand` (54) · `marketplace` (9) · `meta` (22)

**Total: 199 endpoints** — Hidratados: 41 · Stubs: 158

## Navegação

| Para... | Vá para... |
|---|---|
| Entender backend V2 | `01-v2-backend-surface.md` → `02-external-providers.md` |
| Construir perfil/dossiê customizado | `11-preset-registry.md` → `bdc/<macroarea>.md` → `10-source-catalog.json` |
| Orçar custos | `06-cost-matrix.md` |
| Planejar nova hidratação | `08-taxonomy-proposal.md` → `09-hydration-status.md` |
| Integrar BDC no código | `02-external-providers.md` → `bdc/<macroarea>.md` → `adapters/bigdatacorp.js` |
