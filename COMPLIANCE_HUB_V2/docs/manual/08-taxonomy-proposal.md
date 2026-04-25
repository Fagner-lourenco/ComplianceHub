# 08 — Proposta de Taxonomia (nossa, inspirada Upminer, melhorada)

> Status: **aprovada em princípio** pelo usuário. 11 macroáreas disjuntas. Aguarda refinamento final.

## Decisão arquitetural

**Três eixos de classificação ortogonais:**

1. **Entidade (subject)** — eixo primário de navegação
2. **Macroárea semântica** — eixo secundário (11 blocos disjuntos)
3. **Modo de entrega** — flag não-taxonômica

**Facetas (filtros, não hierarquia):** cobertura geográfica, cadência, tier custo, retorno, provedor, criticidade, subject kind (PF/PJ/ambos), v2 status.

---

## Eixo 1 — Entidade (subject kind)

| Valor | Descrição | Famílias BDC |
|---|---|---|
| `pf` | Pessoa Física | `/pessoas` |
| `pj` | Pessoa Jurídica | `/empresas` |
| `address` | Endereço / Localização | `/enderecos` |
| `vehicle` | Veículo | `/veiculos` |
| `product` | Produto (EAN) | `/produtos` |
| `process` | Processo judicial | `/processos` (on-demand) |

---

## Eixo 2 — Macroáreas (11 blocos)

Disjuntos, cobrem 100% do catálogo BDC + adapters V2 + expansão futura.

### 1. Identidade & Cadastro

**Escopo:** dados cadastrais básicos, históricos, MCC, QSA recente, contatos (e-mail, telefone, endereço).

**BDC datasets típicos:** `basic_data`, `historical_basic_data`, `basic_data_with_configurable_recency`, `emails_extended`, `phones_extended`, `addresses_extended`, `qsa_configurable_recency`, `mcc_data`, `registration_data`.

**Upminer equivalente:** Cadastro + Contatos (agregados).

**Use case:** identificação inicial do sujeito + enriquecimento de contato.

### 2. Jurídico & Processual

**Escopo:** processos judiciais/administrativos, distribuição, CADE, movimentações.

**BDC datasets típicos:** `processes`, `lawsuits_distribution`, `cade_processes`, `owners_processes`, `owners_lawsuits_distribution`.

**Upminer equivalente:** Jurídico.

**Use case:** análise de envolvimento judicial por polaridade, tribunal, valor, status.

### 3. Compliance & Sanções

**Escopo:** KYC, PEP, listas restritivas nacionais/internacionais, casas de apostas.

**BDC datasets típicos:** `kyc`, `owners_kyc`, `employees_kyc`, `economic_group_kyc`, `first_level_family_kyc`, `gambling_compliance`.

**Upminer equivalente:** Listas Restritivas + parte de Reguladores.

**Use case:** due diligence regulatório, PLD, compliance internacional.

### 4. Financeiro & Crédito

**Escopo:** informações financeiras, devedores gov, benefícios sociais, SCR, scores, birô terceiros (marketplace).

**BDC datasets típicos:** `financial_data`, `first_level_family_financial_data`, `social_benefits`, `first_level_family_social_benefits`, `government_debtors`, `industrial_properties`.

**Marketplace:** SCR Score Positivo, Quod, Murabei, Quantum, Birô Crédito (Dados Restritivos / Score Multidados).

**Upminer equivalente:** Financeiro.

**Use case:** análise crédito, capacidade pagamento, regularidade fiscal.

### 5. Risco

**Escopo:** cobrança, probabilidade negativação, risco comportamental/financeiro agregado.

**BDC datasets típicos:** `financial_risk`, `family_financial_risk`, `presence_on_collection`, `negative_flag_probability`.

**Upminer equivalente:** _(novo)_ — Upminer não tem macroárea Risco separada.

**Use case:** scoring + antecipação de default.

### 6. Profissional & Laboral

**Escopo:** conselhos de classe, formação, licenças, servidores públicos, turnover, sindicatos, prêmios.

**BDC datasets típicos:** `class_councils`, `professional_data`, `academic_history`, `licenses_permits`, `awards_certifications`, `public_servants`, `professional_turnover`, `sports_exposure`.

**Upminer equivalente:** Profissional.

**Use case:** background check profissional, validação RH.

### 7. Político & Eleitoral

**Escopo:** PEP expandido, candidatos, doações eleitorais, prestadores serviços eleitorais.

**BDC datasets típicos:** `political_exposure_level`, `electoral_candidates`, `electoral_donations`, `family_political_history`, `electoral_services_providers`, `company_political_exposure`, `owners_electoral_donations`, `electoral_services_companies`.

**Upminer equivalente:** _(novo)_ — em Upminer fica diluído em Compliance.

**Use case:** PLD político, conflito de interesse, contratações governamentais.

### 8. Mídia & Reputação

**Escopo:** exposição pública, popularidade, mídia, avaliações, prêmios.

**BDC datasets típicos:** `popularity_data`, `media_exposure_profile`, `media_exposure_profile_pj`, `owners_influence`, `reviews_reputation`, `pj_awards_certifications`, `product_ratings`.

**Upminer equivalente:** Mídia/Internet + Reguladores (parte).

**Use case:** reputação digital, visibilidade pública.

### 9. Presença Digital & Comportamento

**Escopo:** presença online, sites, anúncios, aposta online, marketplaces, propensão comportamental.

**BDC datasets típicos:** `online_presence`, `family_online_presence`, `web_presence`, `online_gambling_propensity`, `online_ads`, `websites_data`, `company_online_ads`, `websites_data_pj`, `marketplaces`, `related_products`.

**Upminer equivalente:** _(novo)_ — em Upminer diluído em Mídia/Internet.

**Use case:** investigação digital, análise comportamental.

### 10. Ativos & Propriedade

**Escopo:** imóveis (rurais SICAR + urbanos), veículos vinculados, propriedade industrial, relacionamentos, grupo econômico.

**BDC datasets típicos:** `vehicles_linked_to_person`, `industrial_properties_pj`, `industrial_properties_employees`, `industrial_properties_owners`, `relationships`, `economic_group_relationships`, `rural_properties_sicar`, `address_rural_properties`.

**Upminer equivalente:** Bens e Imóveis (expandido).

**Use case:** recuperação ativos, análise patrimonial, estrutura societária.

### 11. Socioambiental & ESG

**Escopo:** embargos IBAMA, biomas, APAs, trabalho escravo, acordos sindicais, obras civis, unidades conservação, terras indígenas.

**BDC datasets típicos:** `ibama_embargos`, `biomes`, `environmental_protection_areas`, `archaeological_sites`, `indigenous_lands`, `conservation_units`, `agroecological_zoning`, `legal_amazonia`, `forced_labor`, `union_agreements`, `social_awareness`, `civil_works`.

**Upminer equivalente:** Socioambiental.

**Use case:** ESG compliance, licenciamento ambiental, responsabilidade social.

---

## Eixo 3 — Modo de entrega (flag, não taxonomia)

| Valor | Descrição |
|---|---|
| `standard` | Chamada síncrona direta (BDC datasets via `POST /pessoas|/empresas|etc.`). Latência < 2 s. |
| `ondemand` | Chamada pontual (SINTEGRA, DETRAN, SUS, Receita Federal Status CPF, Boletim Ocorrência, COMPROT). Latência maior. |
| `certificate` | Emissão de certidão em PDF (Certidões PF/PJ/Endereço). Podem ser async. |
| `marketplace` | Provedor terceiro roteado via BDC (Quod, Murabei, Quantum, Birô de Crédito). |

---

## Facetas (filtros laterais)

| Faceta | Valores |
|---|---|
| **Cobertura geográfica** | `br_nacional`, `uf_estadual`, `municipal`, `internacional` |
| **Cadência atualização** | `online`, `diaria`, `semanal`, `mensal`, `trimestral`, `anual`, `snapshot` |
| **Tier custo (BRL)** | `gratis` (0) · `micro` (<R$0,05) · `barato` (<R$0,10) · `medio` (R$0,10–1) · `caro` (R$1+) · `marketplace-variavel` |
| **Retorno** | `tabular`, `texto_certidao`, `score`, `lista`, `pdf`, `grafo` |
| **Provedor** | `bigdatacorp`, `judit`, `escavador`, `fontedata`, `djen`, `openai`, `marketplace_quod`, `marketplace_murabei`, `marketplace_quantum`, `marketplace_biro_credito` |
| **Criticidade** | `core` · `complementar` · `opcional` · `legado` |
| **Subject kind** | `pf` · `pj` · `ambos` · `address` · `vehicle` · `product` |
| **Status V2** | `consumed` · `gap_proposto` · `nao_aplicavel` · `pendente_hidratacao` |

---

## Presets padronizados (7 seguindo Upminer + 2 novos propostos)

| # | Preset | Sujeito | Macroáreas principais | Observação |
|---|---|---|---|---|
| 1 | **Compliance** | PF / PJ | 3 Compliance + 11 Socioambiental + 6 Profissional (TST) | Upminer "Compliance" |
| 2 | **Compliance Internacional** | PF / PJ | 3 Compliance (sanções int.) | Upminer |
| 3 | **Financeiro** | PF / PJ | 4 Financeiro + 5 Risco + 10 Ativos | Upminer |
| 4 | **Investigativo** | PF | 2 Jurídico + 1 Identidade + 3 Compliance + 9 Digital + 10 Relacionamentos | Upminer |
| 5 | **Jurídico** | PF / PJ | 2 Jurídico + 3 Compliance + 6 Profissional (TST) | Upminer |
| 6 | **PLD** | PF / PJ | 3 Compliance (PEP expandido) + 7 Político + 10 Grupo Econômico | Upminer |
| 7 | **Recursos Humanos** | PF | 1 Identidade + 3 Compliance (antecedentes) + 6 Profissional + 11 Trabalho escravo | Upminer |
| 8 | **Due Diligence PJ (novo)** | PJ | 3 Compliance Sócios/Funcionários + 10 Grupo Econômico + 2 Jurídico + 4 Financeiro + 11 ESG | Propõe — Upminer não tem dedicado |
| 9 | **ESG & Socioambiental (novo)** | PJ | 11 Socioambiental + 3 Compliance ambiental + 6 Sindicatos | Propõe — demanda crescente |

---

## Melhorias vs Upminer

1. **Subject primeiro** — PF/PJ separados no topo, não misturados por macroárea.
2. **Disjunção garantida** — nenhuma fonte aparece em duas macroáreas; Compliance ≠ Listas = removido overlap.
3. **Cobertura BDC 100%** — adicionadas macroáreas Risco, Político, Digital que Upminer não tem.
4. **Preview de custo** — preset mostra custo estimado ao construir.
5. **Filtros facetados** — cadência/custo/cobertura como filtros ortogonais, não como taxonomia.
6. **Preset remixável** — partir de padrão + editar; versiona com hash.
7. **Completeness score** — "este preset cobre 78% dos riscos típicos de RH" (computado sobre dicionário de riscos x fontes).
8. **Tenant governance** — `tenantDossierPolicies` limita presets/fontes/composição.
9. **Modo de entrega explícito** — cliente sabe se é sync/async/certidão/marketplace antes de marcar.

---

## Próximas ações (ordem)

1. ✅ Aprovar taxonomia (11 macroáreas) — feito em princípio.
2. ⏳ Hidratar 199 endpoints BDC (16/199 feitos).
3. ⏳ Classificar cada endpoint no catálogo (macroárea + facetas).
4. ⏳ Gerar `source-catalog.json` (SSoT).
5. ⏳ Definir os 9 presets com `sourceKeys[]` reais.
6. ⏳ Desenhar `tenantDossierPolicies` schema.
7. ⏳ Atualizar `dossierSchema.cjs` para refletir taxonomia.

---

## Esquema de arquivos alvo (pós-hidratação)

```
docs/manual/
├── README.md                        # Índice + status
├── 01-v2-backend-surface.md         # ✓ feito
├── 02-external-providers.md         # ✓ feito
├── 03-firestore-model.md            # ✓ feito
├── 04-client-bindings.md            # ✓ feito
├── 05-bigdatacorp-api.md            # ✓ (header + KYC hidratado)
├── 05a-bigdatacorp-stubs.md         # ✓ stubs 198
├── 05b-bigdatacorp-hydrated.md      # ⏳ running — 16/199
├── 06-cost-matrix.md                # ✓ (parcial, expandir conforme hidrata)
├── 07-provider-to-product-mapping.md # ✓ feito
├── 08-taxonomy-proposal.md          # ✓ este arquivo
├── 09-hydration-status.md           # ⏳ a criar (running log)
├── 10-source-catalog.json           # ⏳ SSoT classificado
├── 11-preset-registry.md            # ⏳ 9 presets finais
├── 12-tenant-policy-schema.md       # ⏳ governança
└── bdc/                             # ⏳ após hidratação completa — um arquivo por macroárea
    ├── 01-identidade-cadastro.md
    ├── 02-juridico-processual.md
    ├── 03-compliance-sancoes.md
    ├── 04-financeiro-credito.md
    ├── 05-risco.md
    ├── 06-profissional-laboral.md
    ├── 07-politico-eleitoral.md
    ├── 08-midia-reputacao.md
    ├── 09-presenca-digital.md
    ├── 10-ativos-propriedade.md
    └── 11-socioambiental-esg.md
```
