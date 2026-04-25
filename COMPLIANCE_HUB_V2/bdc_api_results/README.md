# BDC API Results — ComplianceHub V2

Pasta de resultados das chamadas reais à API BigDataCorp para integração e desenvolvimento.

## Estrutura

```
bdc_api_results/
├── README.md                    # Este arquivo
├── ENDPOINTS_CATALOG.md         # Catálogo completo de endpoints BDC
├── _SUMMARY.json                # Resumo migrado da V1 (5 pessoas)
├── _COMPARISON_MATRIX.json      # Matriz de comparação migrada da V1
├── pessoa_1/                    # ANDRE LUIZ CRUZ DOS SANTOS (SP) — ALTO
├── pessoa_2/                    # DIEGO EMANUEL ALVES DE SOUZA (CE) — BAIXO
├── pessoa_3/                    # RENAN GUIMARAES DE SOUSA AUGUSTO (RJ) — BAIXO
├── pessoa_4/                    # FRANCISCO TACIANO DE SOUSA (CE) — CRITICO
├── pessoa_5/                    # MATHEUS GONCALVES DOS SANTOS (SP) — MEDIO
├── empresa_1/                   # CNPJ 42.975.374/0001-72
└── empresa_2/                   # CNPJ 13.783.221/0004-78
```

## CPFs de teste

| ID | Nome | CPF | UF | Risco Esperado |
|---|---|---|---|---|
| pessoa_1 | ANDRE LUIZ CRUZ DOS SANTOS | 48052053854 | SP | ALTO |
| pessoa_2 | DIEGO EMANUEL ALVES DE SOUZA | 10794180329 | CE | BAIXO |
| pessoa_3 | RENAN GUIMARAES DE SOUSA AUGUSTO | 11819916766 | RJ | BAIXO |
| pessoa_4 | FRANCISCO TACIANO DE SOUSA | 05023290336 | CE | CRITICO |
| pessoa_5 | MATHEUS GONCALVES DOS SANTOS | 46247243804 | SP | MEDIO |

## CNPJs de teste

| ID | CNPJ | Nome |
|---|---|---|
| empresa_1 | 42.975.374/0001-72 | NOVAX INTELIGENCIA SOLUCOES INTEGRADAS LTDA (PR) |
| empresa_2 | 13.783.221/0004-78 | (ver basic_data.json) |

## Mapeamento Completo de Datasets PF (2026-04-25)

Chamadas aos 15 endpoints BDC restantes para PF foram executadas para os 5 CPFs.
Ver relatórios:
- `_PF_DATASET_MAPPING.json` — Matriz de status por CPF × Dataset
- `_PF_FIELD_ANALYSIS.md` — Análise de campos retornados
- `_PF_RECOMMENDATIONS.md` — Recomendações de integração

### Datasets integrados no sistema (Classificação A)

| Dataset | CPFs com dados | Descrição |
|---|---|---|
| `collections` | 3/5 | Presença em cobrança |
| `historical_basic_data` | 5/5 | Histórico cadastral |
| `financial_risk` | 5/5 | Score financeiro e renda |
| `media_profile_and_exposure` | 5/5 | Exposição na mídia |
| `lawsuits_distribution_data` | 3/5 | Distribuição agregada de processos |
| `indebtedness_question` | 1/5 | Probabilidade de inadimplência |

### Datasets descartados (Classificação C/D)

| Dataset | Motivo |
|---|---|
| `government_debtors` | Erro na API ou sempre vazio |
| `university_student_data` | Sem dados nos CPFs testados |
| `awards_and_certifications` | Sem dados nos CPFs testados |
| `sports_exposure` | Sem dados nos CPFs testados |
| `political_involvement` | Sem dados nos CPFs testados |
| `election_candidate_data` | Sem dados nos CPFs testados |
| `online_ads` | Sem dados nos CPFs testados |
| `property_data` | Erro na API |

## Arquivos por pasta

Cada pasta `pessoa_N/` contém:

| Arquivo | Descrição | Dataset BDC |
|---|---|---|
| `01_analysis.json` | Análise consolidada (IA) | — |
| `02_processes_ativo.json` | Processos ativos | `processes` (filtrado) |
| `03_byname.json` | Busca por nome | `processes` (por nome) |
| `04_combined.json` | Dados combinados | `basic_data,processes,kyc,occupation_data` |
| `05_criminal.json` | Filtro criminal | `processes` (filtrado) |
| `06_kyc.json` | KYC/PEP/Sanções | `kyc` |
| `07_trabalhista.json` | Filtro trabalhista | `processes` (filtrado) |
| `08_uf_*.json` | Filtro por UF | `processes` (filtrado por estado) |

## Chamadas executadas (2026-04-24)

### PF — 10 datasets × 5 CPFs = 50 chamadas ✅

| Dataset | Arquivo gerado | Exemplo de retorno |
|---|---|---|
| `basic_data` | `basic_data.json` | `BasicData` (nome, CPF, filiação, status) |
| `kyc` | `kyc.json` | `KycData` (PEP, sanções) |
| `processes.limit(100)` | `processes_limit_100_.json` | `Processes` (processos judiciais) |
| `occupation_data` | `occupation_data.json` | `ProfessionData` (dados profissionais) |
| `phones_extended` | `phones_extended.json` | `ExtendedPhones` (telefones) |
| `addresses_extended` | `addresses_extended.json` | `ExtendedAddresses` (endereços) |
| `emails_extended` | `emails_extended.json` | `ExtendedEmails` (e-mails) |
| `online_presence` | `online_presence.json` | `OnlinePresence` (presença digital) |
| `financial_data` | `financial_data.json` | `FinantialData` (dados financeiros) |
| `class_organization` | `class_organization.json` | `Memberships` (conselhos de classe) |

### PJ — 7 datasets × 2 CNPJs = 14 chamadas ✅

| Dataset | Arquivo gerado | Exemplo de retorno |
|---|---|---|
| `basic_data` | `basic_data.json` | `BasicData` (razão social, situação, CNAE) |
| `kyc` | `kyc.json` | `KycData` (sanções da empresa) |
| `relationships` | `relationships.json` | `Relationships` (QSA, sócios) |
| `processes.limit(100)` | `processes_limit_100_.json` | `Lawsuits` (processos da empresa) |
| `activity_indicators` | `activity_indicators.json` | `ActivityIndicators` (funcionários, faturamento) |
| `company_evolution` | `company_evolution.json` | `CompanyEvolutionData` (evolução temporal) |
| `owners_kyc` | `owners_kyc.json` | `OwnersKycData` (KYC agregado dos sócios) |

**Total: 64 chamadas realizadas, 0 erros.**

## Como executar novas chamadas

```bash
# Defina as credenciais (ou use .env.bdc na raiz)
$env:BIGDATACORP_ACCESS_TOKEN="SEU_TOKEN"
$env:BIGDATACORP_TOKEN_ID="SEU_TOKEN_ID"

# PF — dataset individual
node scripts/bdc-cli.js --batch-pf --dataset phones_extended

# PF — múltiplos datasets
node scripts/bdc-cli.js --batch-pf --dataset "basic_data,kyc,processes.limit(100)"

# PJ — dataset individual
node scripts/bdc-cli.js --batch-pj --dataset basic_data

# PJ — múltiplos datasets
node scripts/bdc-cli.js --batch-pj --dataset "basic_data,kyc,relationships"

# Executar tudo (PF + PJ, 17 datasets)
node scripts/bdc-run-all.js
```

## Endpoints disponíveis

Ver [`ENDPOINTS_CATALOG.md`](./ENDPOINTS_CATALOG.md) para o catálogo completo de 199 endpoints com preços, datasets técnicos e status de integração.
