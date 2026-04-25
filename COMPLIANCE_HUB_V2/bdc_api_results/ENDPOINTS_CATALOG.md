# Catálogo BigDataCorp — Endpoints Organizados

> Total: **199 endpoints** | Hidratados: **41** | Consumidos pelo V2: **4 datasets**
> Base URL: `https://plataforma.bigdatacorp.com.br`
> Auth: `AccessToken` + `TokenId` (headers)

---

## Índice

1. [Modo de chamada](#modo-de-chamada)
2. [Datasets já consumidos pelo V2](#datasets-já-consumidos-pelo-v2)
3. [PF — Identidade & Cadastro](#pf--identidade--cadastro)
4. [PF — Jurídico & Processual](#pf--jurídico--processual)
5. [PF — Compliance & Sanções](#pf--compliance--sanções)
6. [PF — Financeiro & Crédito](#pf--financeiro--crédito)
7. [PF — Profissional & Laboral](#pf--profissional--laboral)
8. [PF — Político & Eleitoral](#pf--político--eleitoral)
9. [PF — Presença Digital](#pf--presença-digital)
10. [PF — Ativos & Propriedade](#pf--ativos--propriedade)
11. [PJ — Identidade & Cadastro](#pj--identidade--cadastro)
12. [PJ — Jurídico & Processual](#pj--jurídico--processual)
13. [PJ — Compliance & Sanções](#pj--compliance--sanções)
14. [PJ — Econômico & Risco](#pj--econômico--risco)
15. [PJ — Relacionamentos & QSA](#pj--relacionamentos--qsa)
16. [PJ — ESG & Socioambiental](#pj--esg--socioambiental)
17. [Outros endpoints](#outros-endpoints)

---

## Modo de chamada

Todos os endpoints são **POST** com o mesmo padrão:

```bash
curl --request POST \
  --url https://plataforma.bigdatacorp.com.br/pessoas \
  --header 'AccessToken: ACCESSTOKEN' \
  --header 'TokenId: TOKENID' \
  --header 'content-type: application/json' \
  --data '{
    "q": "doc{CPF}",
    "Datasets": "basic_data",
    "Limit": 1
  }'
```

| Subject | Endpoint | `q` |
|---|---|---|
| PF | `POST /pessoas` | `doc{CPF}` ou `name{NOME}` |
| PJ | `POST /empresas` | `doc{CNPJ}` ou `name{NOME}` |
| Endereço | `POST /enderecos` | `zipcode{CEP}` ou coordenadas |
| Processo | `POST /processos` | `numeroprocesso{NUMERO}` |
| Veículo | `POST /veiculos` | `placa{PLACA}` |

**Paginação:** `processes.limit(100).next(100)`
**Filtros no `q`:** `doc{CPF} state{SP} status{ATIVO}`

---

## Datasets já consumidos pelo V2

| Dataset | Endpoint | Preço (1-10k) | V2 Status | Uso |
|---|---|---|---|---|
| `basic_data` | `/pessoas` | R$ 0,030 | ✅ consumed | Dados cadastrais PF |
| `processes` | `/pessoas` | R$ 0,070 | ✅ consumed | Processos judiciais |
| `kyc` | `/pessoas` | R$ 0,050 | ✅ consumed | PEP + sanções |
| `occupation_data` | `/pessoas` | R$ 0,050 | ✅ consumed | Dados profissionais |

---

## PF — Identidade & Cadastro

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 26 | `basic_data` | Dados cadastrais básicos (nome, CPF, nascimento, filiação) | R$ 0,030 | ✅ consumed |
| 27 | `basic_data_with_configurable_recency` | Dados básicos com recência configurável | R$ 0,090 | gap |
| 28 | `historical_basic_data` | Histórico de alterações cadastrais na RF | R$ 0,030 | gap |
| 19 | `emails_extended` | E-mails com atributos de qualidade/validação | R$ 0,050 | gap |
| 21 | `phones_extended` | Telefones com classificação e priorização | R$ 0,050 | gap |
| 23 | `addresses_extended` | Endereços com recência e validação | R$ 0,050 | gap |
| 25 | `registration_data` | Dados de registro detalhados | — | pending |
| 60 | `socio_demographic_data` | Informações sócio-demográficas | — | pending |

**Chaves complementares PF:**
- `name` — compara nome informado com base
- `mothername` — compara nome da mãe
- `fathername` — compara nome do pai
- `birthdate` — valida data de nascimento

---

## PF — Jurídico & Processual

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 44 | `processes` | Processos judiciais e administrativos | R$ 0,070 | ✅ consumed |
| 46 | `lawsuits_distribution_data` | Distribuição de processos por vara/estado | R$ 0,050 | gap |
| 143 | `lawsuits_negative_certificate` | Ações judiciais — nada consta | — | pending |
| 144 | `labor_lawsuits` | Ações trabalhistas | — | pending |

**Filtros de processos:**
- `state` — UF (`SP`, `RJ`, …)
- `courttype` — `CIVEL`, `CRIMINAL`, `TRABALHISTA`, `TRIBUTARIA`, `PREVIDENCIARIA`
- `status` — `ATIVO`, `BAIXADO`, `DISTRIBUIDO`, `ENCERRADO`, `TRANSITADO EM JULGADO`
- `partytype` — `AUTHOR`, `DEFENDANT`, `CLAIMANT`, `CLAIMED`, `WITNESS`, `VICTIM`
- `partypolarity` — `ACTIVE`, `PASSIVE`, `NEUTRAL`
- `value` — faixa de valor da causa

---

## PF — Compliance & Sanções

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 12 | `kyc` | PEP + sanções nacionais e internacionais | R$ 0,050 | ✅ consumed |
| 13 | `family_kyc` | KYC dos familiares de 1º grau | — | pending |
| 14 | `betting_compliance` | Compliance de casas de apostas | — | pending |
| 145 | `cgu_correctional_negative` | CGU — correcional negativa | — | pending |
| 146 | `cnj_negative` | CNJ — negativa | — | pending |
| 149 | `ibama_embargoes` | IBAMA — embargos | — | pending |
| 150 | `ibama_negative` | IBAMA — negativa | — | pending |
| 151 | `ibama_regularity` | IBAMA — regularidade | — | pending |
| 152 | `irt` | IRT | — | pending |
| 153 | `sanitary_licenses` | Licenças sanitárias | — | pending |
| 154 | `pgfn` | PGFN | — | pending |
| 155 | `police_civil_criminal_record` | Polícia Civil — antecedentes | — | pending |
| 156 | `police_federal_criminal_record` | Polícia Federal — antecedentes | — | pending |
| 157 | `tse_electoral_quittance` | TSE — quitação eleitoral | — | pending |

**Flags KYC importantes:**
- `IsCurrentlySanctioned` — tem sanção ativa
- `WasPreviouslySanctioned` — já teve sanção
- `IsCurrentlyPresentOnSource` — presente na fonte atualmente
- `IsPEP` — é pessoa politicamente exposta

---

## PF — Financeiro & Crédito

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 29 | `financial_data` | Informações financeiras (renda, patrimônio) | R$ 0,050 | gap |
| 34 | `government_debtors` | Devedores do governo | R$ 0,050 | gap |
| 56 | `financial_risk` | Risco financeiro / score | R$ 0,050 | gap |
| 58 | `collections` | Presença em cobrança / protestos | R$ 0,070 | gap |
| 59 | `indebtedness_question` | Probabilidade de negativação | R$ 0,090 | gap |
| 170 | `bacen_administrative_sanctions` | BACEN — sanções administrativas | — | pending |
| 174 | `rf_income_tax_refund` | Receita Federal — restituição IR | — | pending |
| 175 | `rf_cpf_status` | Receita Federal — status do CPF | — | pending |

---

## PF — Profissional & Laboral

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 48 | `class_organization` | Conselhos de classe (CRM, CREA, OAB…) | R$ 0,050 | gap |
| 50 | `university_student_data` | Histórico escolar e acadêmico | R$ 0,050 | gap |
| 52 | `awards_and_certifications` | Prêmios e certificações | R$ 0,090 | gap |
| 53 | `profession_data` | Dados profissionais / servidores públicos | R$ 0,050 | gap |
| 55 | `sports_exposure` | Exposição esportiva | R$ 0,070 | gap |
| 54 | `professional_turnover` | Turnover profissional | — | pending |

---

## PF — Político & Eleitoral

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 35 | `political_involvement` | Nível de envolvimento político | R$ 0,050 | gap |
| 36 | `election_candidate_data` | Candidatos eleitorais | R$ 0,050 | gap |
| 37 | `electoral_donations` | Doações eleitorais | — | pending |
| 178 | `tse_voting_place` | TSE — local de votação | — | pending |

---

## PF — Presença Digital

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 15 | `online_presence` | Presença online (scores de atividade) | R$ 0,050 | gap |
| 16 | `family_online_participation` | Presença online familiar | R$ 0,130 | gap |
| 17 | `passages` | Passagens pela web | R$ 0,050 | gap |
| 42 | `online_ads` | Anúncios online | R$ 0,050 | gap |
| 43 | `websites` | Dados de sites | — | pending |

---

## PF — Ativos & Propriedade

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 33 | `industrial_properties` | Propriedades industriais | — | pending |
| 61 | `vehicles` | Veículos associados | — | pending |

---

## PJ — Identidade & Cadastro

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 76 | `basic_data` | Dados cadastrais básicos (CNPJ, razão social, situação) | R$ 0,020 | ✅ consumed |
| 77 | `history_basic_data` | Histórico de alterações cadastrais | R$ 0,050 | gap |
| 78 | `merchant_category_data` | Dados de categoria comercial (MCC) | R$ 0,050 | gap |
| 69 | `registration_data` | Dados de registro detalhados | — | pending |
| 70 | `emails` | E-mails da empresa | — | pending |
| 72 | `phones` | Telefones da empresa | — | pending |
| 74 | `addresses` | Endereços da empresa | — | pending |

**Valores retornados importantes (PJ basic_data):**
- `TaxIdStatus`: `ATIVA`, `BAIXADA`, `INAPTA`, `SUSPENSA`, `NULA`
- `TaxRegime`: `SIMPLES`, `MEI`, `LTDA`, `S.A.`, `LUCRO REAL`, `LUCRO PRESUMIDO`
- `LegalNature.Code`: 86 códigos distintos

---

## PJ — Jurídico & Processual

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 92 | `processes` | Processos judiciais e administrativos | R$ 0,070 | gap |
| 93 | `owners_lawsuits` | Processos judiciais dos sócios | R$ 0,130 | gap |
| 94 | `lawsuits_distribution_data` | Distribuição de processos (PJ) | R$ 0,050 | gap |

---

## PJ — Compliance & Sanções

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 65 | `kyc` | KYC e compliance da empresa | R$ 0,050 | gap |
| 66 | `owners_kyc` | KYC dos sócios (agregado) | R$ 0,090 | gap |
| 67 | `employees_kyc` | KYC dos funcionários | R$ 0,410 | gap |
| 68 | `economic_group_kyc` | KYC do grupo econômico | R$ 0,410 | gap |
| 127 | `labor_lawsuits` | Ações trabalhistas (PJ) | — | pending |
| 129 | `cgu_negative` | CGU — negativa | — | pending |
| 130 | `cnj_negative` | CNJ — negativa | — | pending |
| 135 | `ibama_embargoes` | IBAMA — embargos | — | pending |
| 136 | `ibama_negative` | IBAMA — negativa | — | pending |
| 137 | `ibama_regulatory` | IBAMA — regulatória | — | pending |
| 138 | `irt` | IRT | — | pending |
| 139 | `sanitary_licenses` | Licenças sanitárias | — | pending |
| 140 | `pgfn` | PGFN | — | pending |
| 141 | `siproquim` | SIPROQUIM | — | pending |

---

## PJ — Econômico & Risco

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 79 | `company_evolution` | Evolução da empresa | R$ 0,050 | gap |
| 80 | `activity_indicators` | Indicadores de atividade (funcionários, faturamento, shell company) | R$ 0,050 | gap |
| 101 | `collections` | Presença em cobrança | R$ 0,070 | gap |
| 102 | `government_debtors` | Devedores do governo | — | pending |
| 103 | `investment_funds_data` | Dados de fundos de investimento | — | pending |
| 104 | `civil_works_data` | Dados de obras civis | — | pending |
| 105 | `financial_market_data` | Mercado financeiro | — | pending |
| 133 | `fgts` | FGTS | — | pending |
| 134 | `comex_enablement` | Habilitação COMEX | — | pending |
| 158 | `simples_national_collection` | Arrecadação Simples Nacional — MEI | — | pending |
| 159 | `comprot_processes` | COMPROT — processos | — | pending |
| 160 | `digital_accounting` | Escrituração contábil digital | — | pending |
| 161 | `municipal_registration` | Inscrição municipal | — | pending |
| 162 | `simples_optant` | Optante Simples | — | pending |
| 163 | `public_projects` | Projetos públicos | — | pending |
| 164 | `rf_qsa` | Receita Federal — QSA | — | pending |
| 165 | `rf_legal_representative` | Receita Federal — representante legal | — | pending |
| 166 | `rf_cnpj_status` | Receita Federal — situação CNPJ | — | pending |
| 167 | `sintegra` | SINTEGRA | — | pending |

**Indicadores de `activity_indicators`:**
- `EmployeesRange`, `IncomeRange`, `ActivityLevel`
- `HasActivity`, `ShellCompanyLikelyhood`
- `HasRecentEmail`, `HasActiveDomain`, `HasCorporateEmail`

---

## PJ — Relacionamentos & QSA

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 96 | `relationships` | Relacionamentos societários (QSA, ownership, funcionários) | R$ 0,030 | gap |
| 98 | `dynamic_qsa_data` | QSA de recência configurável | R$ 0,090 | gap |
| 111 | `nearby_companies` | Empresas nas proximidades | — | pending |

**Chaves `relationships`:**
- `useHeadQuartersData` — usa dados da matriz

**Filtros `relationships`:**
- `relatedentitytaxidtype`: `CPF`, `CNPJ`
- `relationshiplevel`: `Direto`, `Indireto`
- `relationshiptype`: `QSA`, `Ownership`, `Employee`, `RepresentanteLegal`

---

## PJ — ESG & Socioambiental

| # | Dataset Técnico | Descrição | Preço | V2 |
|---|---|---|---|---|
| 85 | `syndicate_agreements` | Acordos sindicais | R$ 0,050 | gap |
| 86 | `social_conscience` | Consciência social (acessibilidade, diversidade, equidade) | R$ 0,050 | gap |
| 128 | `pcd_hiring` | Contratação de PCD | — | pending |

---

## Outros endpoints

### Meta / Operacional (não retornam dados)

| # | Endpoint | Descrição |
|---|---|---|
| 190 | `POST /tokens/gerar` | Gerar token de acesso |
| 191 | `POST /tokens/desabilitar` | Desabilitar token |
| 192 | `POST /precos/` | Tabela de preços |
| 193 | `POST /log/` | Log de consultas |
| 196 | `POST /lote/listar` | Listar jobs batch |

### Marketplace (parceiros)

| Dataset | Parceiro | Descrição |
|---|---|---|
| `scr_score` | Quod/Birô | Score de crédito |
| `restricted_data` | Quod/Quantum | Dados restritivos |
| `negative_flags` | Quod | Flags negativos |

---

## Presets vs Datasets

| Preset | Datasets principais |
|---|---|
| Compliance | `basic_data`, `kyc`, `processes`, `government_debtors`, `political_involvement` |
| Compliance Internacional | `kyc` (focus internacional), `sanctions` |
| Financeiro | `financial_data`, `financial_risk`, `collections`, `indebtedness_question` |
| Investigativo | `basic_data`, `processes`, `online_presence`, `addresses_extended`, `phones_extended` |
| Jurídico | `processes`, `lawsuits_distribution_data`, `cnj_negative`, `labor_lawsuits` |
| PLD | `kyc`, `political_involvement`, `electoral_donations`, `financial_data` |
| RH | `basic_data`, `profession_data`, `class_organization`, `university_student_data` |
| Due Diligence PJ | `basic_data`, `kyc`, `relationships`, `processes`, `activity_indicators` |
| ESG | `social_conscience`, `syndicate_agreements`, `ibama_regulatory` |
