# 06 — Matriz de Custo por Consulta

> Fonte oficial: `docs.bigdatacorp.com.br/plataforma/reference/<slug>` (seção "Tabela de preços"). Valores confirmados em **negrito**. Datasets não hidratados marcados `_[a coletar]_`.
>
> **SSoT dos preços:** [`10-source-catalog.json`](./10-source-catalog.json) (`priceByTier` por endpoint).

## Tiers de custo identificados (padrão BDC)

A maioria dos datasets BDC segue 3 curvas de preço distintas:

| Curva | 1-10k | 10k-50k | 50k-100k | 100k-500k | 500k-1M | 1M-5M fixo | 5M+ |
|---|---|---|---|---|---|---|---|
| **Barata (A)** | R$ 0,020 | R$ 0,019 | R$ 0,018 | R$ 0,017 | R$ 0,016 | R$ 14.000 | contato |
| **Padrão (B)** | R$ 0,030 | R$ 0,028 | R$ 0,027 | R$ 0,026 | R$ 0,025 | R$ 21.000 | contato |
| **Média (C)** | R$ 0,050 | R$ 0,048 | R$ 0,046 | R$ 0,044 | R$ 0,042 | R$ 34.000 | contato |
| **Média+ (D)** | R$ 0,070 | R$ 0,066 | R$ 0,063 | R$ 0,060 | R$ 0,057 | R$ 46.000 | contato |
| **Alta (E)** | R$ 0,090 | R$ 0,085 | R$ 0,081 | R$ 0,077 | R$ 0,073 | R$ 61.000 | contato |
| **Premium (F)** | R$ 0,130 | R$ 0,124 | R$ 0,118 | R$ 0,112 | R$ 0,106 | R$ 86.000 | contato |
| **Ultra (G)** | R$ 0,410 | R$ 0,389 | R$ 0,370 | R$ 0,352 | R$ 0,334 | R$ 277.000 | contato |
| **Estendida (H)** | R$ 0,090 | R$ 0,085 | R$ 0,081 | R$ 0,077 | R$ 0,073 | R$ 0,069 (1M-5M) | R$ 0,066 (5M-10M), R$ 0,063 (10M-50M), R$ 0,060 (50M+) |

## A. BigDataCorp — preços por endpoint

Ordenado por curva (barato → caro).

### Curva A — R$ 0,020 (PJ básico)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 76 | `basic_data` | PJ | `/empresas` | Identidade |

### Curva B — R$ 0,030 (PF básico / relacionamentos)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 26 | `basic_data` | PF | `/pessoas` | Identidade |
| 28 | `historical_basic_data` | PF | `/pessoas` | Identidade |
| 96 | `relationships` | PJ | `/empresas` | Ativos |

### Curva C — R$ 0,050 (média — maioria dos datasets)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 12 | `kyc` | PF | `/pessoas` | Compliance |
| 15 | `online_presence` | PF | `/pessoas` | Digital |
| 19 | `emails_extended` | PF | `/pessoas` | Identidade |
| 21 | `phones_extended` | PF | `/pessoas` | Identidade |
| 23 | `addresses_extended` | PF | `/pessoas` | Identidade |
| 29 | `financial_data` | PF | `/pessoas` | Financeiro |
| 34 | `government_debtors` | PF | `/pessoas` | Financeiro |
| 35 | `political_involvement` | PF | `/pessoas` | Político |
| 36 | `election_candidate_data` | PF | `/pessoas` | Político |
| 42 | `online_ads` | PF | `/pessoas` | Digital |
| 46 | `lawsuits_distribution_data` | PF | `/pessoas` | Jurídico |
| 48 | `class_organization` | PF | `/pessoas` | Profissional |
| 50 | `university_student_data` | PF | `/pessoas` | Profissional |
| 53 | `profession_data` | PF | `/pessoas` | Profissional |
| 56 | `financial_risk` | PF | `/pessoas` | Risco |
| 65 | `kyc` | PJ | `/empresas` | Compliance |
| 77 | `history_basic_data` | PJ | `/empresas` | Identidade |
| 78 | `merchant_category_data` | PJ | `/empresas` | Identidade |
| 79 | `company_evolution` | PJ | `/empresas` | Financeiro (500k+ R$ 19.000 fixo) |
| 80 | `activity_indicators` | PJ | `/empresas` | Financeiro |
| 81 | `political_involvement` | PJ | `/empresas` | Político |
| 85 | `syndicate_agreements` | PJ | `/empresas` | ESG |
| 86 | `social_conscience` | PJ | `/empresas` | ESG |
| 94 | `lawsuits_distribution_data` | PJ | `/empresas` | Jurídico |

### Curva D — R$ 0,070 (média+)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 44 | `processes` | PF | `/pessoas` | Jurídico |
| 55 | `sports_exposure` | PF | `/pessoas` | Profissional |
| 58 | `collections` | PF | `/pessoas` | Risco |
| 92 | `processes` | PJ | `/empresas` | Jurídico |
| 101 | `collections` | PJ | `/empresas` | Risco |

### Curva E — R$ 0,090 (alta)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 27 | `basic_data_with_configurable_recency` | PF | `/pessoas` | Identidade |
| 52 | `awards_and_certifications` | PF | `/pessoas` | Profissional |
| 66 | `owners_kyc` | PJ | `/empresas` | Compliance |

### Curva F — R$ 0,130 (premium — processos sócios)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 93 | `owners_lawsuits` | PJ | `/empresas` | Jurídico |

### Curva G — R$ 0,410 (ultra — agregados grandes)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 67 | `employees_kyc` | PJ | `/empresas` | Compliance |
| 68 | `economic_group_kyc` | PJ | `/empresas` | Compliance |

### Curva H — degradada progressiva (escala 50M+)

| # | Dataset | Subject | Endpoint | Macroárea |
|---|---|---|---|---|
| 59 | `indebtedness_question` | PF | `/pessoas` | Risco |
| 98 | `dynamic_qsa_data` | PJ | `/empresas` | Ativos |

---

## B. Outros provedores

### Judit (BRL)

| Operação | Endpoint | Custo unitário |
|---|---|---|
| Entity datalake create | POST `/requests/create` | **R$ 0,12** (fixo, `adapters/judit.js:11`) |
| Lawsuits sync | POST `/lawsuits` | _[solicitar faixas Judit]_ |
| Lawsuits async | POST `/requests` + poll | _[solicitar]_ |
| Warrants async | POST `/requests` (type warrant) | _[solicitar]_ |
| Executions async | POST `/requests` (type execution) | _[solicitar]_ |

### Escavador, FonteData, DJEN

Custos não anotados no código V2. Consultar contratos comerciais.

### OpenAI (USD)

| Modelo | Input $/M tokens | Output $/M tokens |
|---|---|---|
| `gpt-5.4-nano` | **0,20** | **1,25** |

Função: `estimateAiCostUsd(inputTokens, outputTokens)` (`index.js:422`).

---

## C. Estimativa por preset

Custo mínimo = soma dos `sourceKeys` locked + essenciais na tier baixa. Custo máximo = inclui optionals + parâmetros extensos.

| Preset | Sujeito | Min (BRL) | Max (BRL) | Fonte |
|---|---|---|---|---|
| Compliance PF | PF | 0,50 | 1,20 | 3 BDC + FonteData + DJEN |
| Compliance Internacional | PF+PJ | 0,10 | 0,50 | 3 BDC (só `kyc` variantes) |
| Financeiro PF | PF | 0,40 | 2,50 | 6 BDC + FonteData + marketplace crédito |
| Investigativo PF | PF | 1,00 | 3,00 | 10+ BDC + Judit + Escavador + DJEN |
| Jurídico | PF+PJ | 0,60 | 2,00 | 5 BDC processos + Judit + Escavador + DJEN |
| PLD | PF+PJ | 0,60 | 1,50 | 4-7 BDC KYC/político |
| Recursos Humanos | PF | 0,80 | 2,20 | 7 BDC + 3 FonteData |
| **Due Diligence PJ** (novo) | PJ | 1,20 | 4,50 | 13 BDC focado PJ |
| **ESG & Socioambiental** (novo) | PJ | 0,80 | 3,00 | 10+ BDC enderecos + certidões IBAMA |

---

## D. Observações

- Preços BDC diminuem com volume mensal por plano. Os valores acima assumem tier 1-10k consultas/mês.
- Tenants com volume > 5M consultas/mês negociam contrato customizado ("Entre em contato").
- `usageMeters/{id}` em Firestore grava `unitCost` no momento da consulta (snapshot imutável) — permite auditoria histórica mesmo se preços mudarem.
- Curvas A–G são padrões observados. Curva H ("estendida") é exceção com mais tiers acima de 1M.
