# BDC → Dossiê ComplianceHub — Mapeamento Completo

> **Versão:** 2026-04-24  
> **Objetivo:** Documentar como cada campo retornado pela API BigDataCorp alimenta as seções do Dossiê de PF/PJ e demais produtos (LinkMap, etc.).

---

## Sumário

1. [Arquitetura de Dados](#1-arquitetura-de-dados)
2. [Mapeamento PF — Pessoa Física](#2-mapeamento-pf--pessoa-física)
3. [Mapeamento PJ — Pessoa Jurídica](#3-mapeamento-pj--pessoa-jurídica)
4. [Mapeamento Presets → Datasets](#4-mapeamento-presets--datasets)
5. [Decisões de Design](#5-decisões-de-design)
6. [Gaps e TODOs](#6-gaps-e-todos)

---

## 1. Arquitetura de Dados

### Pipeline

```
API BDC (raw JSON)
  → Adapter (bigdatacorp.js) — fetch + retry
  → Normalizers (bigdatacorp/*.js) — campo BDC → campo canonical
  → Domain (v2NormalizationRules.js) — regras cross-provider
  → Dossiê Schema (domain/dossierSchema.js) — seções e evidências
  → Frontend (React) — renderização
```

### Convenções de Nomenclatura

| Origem | Convenção | Exemplo |
|---|---|---|
| BDC Raw | `PascalCase` | `BasicData.MotherName` |
| Canonical | `camelCase` | `basicData.motherName` |
| Dossiê Section | `snake_case` | `dados_cadastrais` |

---

## 2. Mapeamento PF — Pessoa Física

### 2.1 Identidade Cadastral (`dados_cadastrais`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `BasicData.TaxIdNumber` | `str` | `document` | Dados Cadastrais | CPF |
| `BasicData.Name` | `str` | `name` | Dados Cadastrais | Nome completo |
| `BasicData.MotherName` | `str` | `motherName` | Dados Cadastrais | Nome da mãe |
| `BasicData.FatherName` | `str` | `fatherName` | Dados Cadastrais | Nome do pai |
| `BasicData.BirthDate` | `str` | `birthDate` | Dados Cadastrais | `YYYY-MM-DD` |
| `BasicData.Age` | `int` | `age` | Dados Cadastrais | Idade calculada |
| `BasicData.Gender` | `str` | `gender` | Dados Cadastrais | `M`/`F` |
| `BasicData.MaritalStatusData` | `dict` | `maritalStatus` | Dados Cadastrais | Objeto completo |
| `BasicData.TaxIdStatus` | `str` | `taxIdStatus` | Dados Cadastrais | `REGULAR`, `CANCELLED`, etc. |
| `BasicData.TaxIdStatusDate` | `str` | `taxIdStatusDate` | Dados Cadastrais | Data da situação |
| `BasicData.TaxIdStatusReason` | `str` | `taxIdStatusReason` | Dados Cadastrais | Motivo da situação |
| `BasicData.HasObitIndication` | `bool` | `hasObitIndication` | Dados Cadastrais | Indicador de óbito |
| `BasicData.ChineseSign` | `str` | `chineseSign` | Dados Cadastrais | Signo chinês |
| `BasicData.BirthCountry` | `str` | `birthCountry` | Dados Cadastrais | País de nascimento |
| `BasicData.Aliases` | `dict` | `aliases` | Dados Cadastrais | Apelidos/alcunhas |
| `BasicData.FirstNameUniquenessScore` | `float` | `firstNameUniquenessScore` | Dados Cadastrais | Raridade do nome |
| `BasicData.NumberOfFullNameNamesakes` | `int` | `numberOfFullNameNamesakes` | Dados Cadastrais | Quantos homônimos |

**Normalizer:** `normalizers/bigdatacorp/basicData.js` → `normalizeBasicDataPessoa()`

### 2.2 Contato (`contato`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `ExtendedPhones.Phones[].Phone` | `str` | `phones[].phone` | Contato | Número completo |
| `ExtendedPhones.Phones[].Type` | `str` | `phones[].type` | Contato | `PERSONAL`, `WORK` |
| `ExtendedPhones.Phones[].DDD` | `str` | `phones[].ddd` | Contato | DDD |
| `ExtendedPhones.Phones[].ValidationStatus` | `str` | `phones[].validationStatus` | Contato | `VALID`, `INVALID` |
| `ExtendedPhones.Phones[].LastSeen` | `str` | `phones[].lastSeen` | Contato | Última aparição |
| `ExtendedPhones.TotalPhones` | `int` | `phones.total` | Contato | Contagem |
| `ExtendedPhones.TotalActivePhones` | `int` | `phones.active` | Contato | Contagem ativos |
| `ExtendedAddresses.Addresses[].Street` | `str` | `addresses[].street` | Contato | Logradouro |
| `ExtendedAddresses.Addresses[].Number` | `str` | `addresses[].number` | Contato | Número |
| `ExtendedAddresses.Addresses[].Neighborhood` | `str` | `addresses[].neighborhood` | Contato | Bairro |
| `ExtendedAddresses.Addresses[].City` | `str` | `addresses[].city` | Contato | Cidade |
| `ExtendedAddresses.Addresses[].State` | `str` | `addresses[].state` | Contato | UF |
| `ExtendedAddresses.Addresses[].Zipcode` | `str` | `addresses[].zipcode` | Contato | CEP |
| `ExtendedAddresses.Addresses[].Type` | `str` | `addresses[].type` | Contato | `PERSONAL`, `WORK` |
| `ExtendedAddresses.Addresses[].LastSeen` | `str` | `addresses[].lastSeen` | Contato | Última aparição |
| `ExtendedAddresses.TotalAddresses` | `int` | `addresses.total` | Contato | Contagem |
| `ExtendedEmails.TotalEmails` | `int` | `emails.total` | Contato | Contagem |
| `ExtendedEmails.TotalActiveEmails` | `int` | `emails.active` | Contato | Contagem ativos |

**Normalizer:** `normalizers/bigdatacorp/basicData.js` → `normalizeContacts()` (já parcialmente implementado, mas precisa usar keys `Extended*`)

### 2.3 Profissão & Renda (`profissao_renda`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `ProfessionData.Professions[].Title` | `str` | `jobs[].title` | Profissão/Renda | Cargo |
| `ProfessionData.Professions[].Company` | `str` | `jobs[].company` | Profissão/Renda | Empregador |
| `ProfessionData.Professions[].Sector` | `str` | `jobs[].sector` | Profissão/Renda | Setor |
| `ProfessionData.Professions[].StartDate` | `str` | `jobs[].startDate` | Profissão/Renda | Início |
| `ProfessionData.Professions[].EndDate` | `str` | `jobs[].endDate` | Profissão/Renda | Fim |
| `ProfessionData.TotalIncome` | `int` | `income.total` | Profissão/Renda | Renda total estimada |
| `ProfessionData.TotalIncomeRange` | `str` | `income.range` | Profissão/Renda | Faixa de renda |
| `ProfessionData.IsEmployed` | `bool` | `isEmployed` | Profissão/Renda | Empregado atualmente |
| `ProfessionData.TotalActiveProfessions` | `int` | `totalActiveProfessions` | Profissão/Renda | Qtd. profissões ativas |

**Normalizer:** `normalizers/bigdatacorp/occupation.js` → `normalizeOccupation()`

### 2.4 Conselhos de Classe (`conselhos_classe`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `Memberships[]` | `list` | `memberships[]` | Conselhos de Classe | Array de registros |

> ⚠️ **Gap:** Ainda não há normalizer específico. O raw pode ser exposto como `rawMemberships` até normalização.

**Dataset:** `class_organization`

### 2.5 Dados Financeiros (`financeiro`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `FinantialData.TotalAssets` | `str` | `totalAssets` | Financeiro | Patrimônio total |
| `FinantialData.TaxReturns[].Year` | `str` | `taxReturns[].year` | Financeiro | Ano do imposto |
| `FinantialData.TaxReturns[].DeclaredIncome` | `str` | `taxReturns[].declaredIncome` | Financeiro | Renda declarada |
| `FinantialData.IncomeEstimates[].Source` | `str` | `incomeEstimates[].source` | Financeiro | Fonte da estimativa |
| `FinantialData.IncomeEstimates[].Value` | `str` | `incomeEstimates[].value` | Financeiro | Valor estimado |

**Normalizer:** `normalizers/bigdatacorp/financial.js` → `normalizeFinancial()` (atualmente genérico, precisa de PF-specific)

### 2.6 Compliance / KYC (`compliance`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `KycData.IsCurrentlyPEP` | `bool` | `isCurrentlyPep` | Compliance | PEP atual |
| `KycData.IsCurrentlySanctioned` | `bool` | `isCurrentlySanctioned` | Compliance | Sanção ativa |
| `KycData.WasPreviouslySanctioned` | `bool` | `wasPreviouslySanctioned` | Compliance | Sanção anterior |
| `KycData.PEPHistory[].Level` | `int` | `pepHistory[].level` | Compliance | Nível PEP |
| `KycData.PEPHistory[].Organs[]` | `list` | `pepHistory[].organs` | Compliance | Órgãos |
| `KycData.PEPHistory[].StartDate` | `str` | `pepHistory[].startDate` | Compliance | Início mandato |
| `KycData.PEPHistory[].EndDate` | `str` | `pepHistory[].endDate` | Compliance | Fim mandato |
| `KycData.SanctionsHistory[].Source` | `str` | `sanctionsHistory[].source` | Compliance | Fonte da sanção |
| `KycData.SanctionsHistory[].StartDate` | `str` | `sanctionsHistory[].startDate` | Compliance | Início sanção |
| `KycData.SanctionsHistory[].EndDate` | `str` | `sanctionsHistory[].endDate` | Compliance | Fim sanção |
| `KycData.TotalElectoralDonations` | `int` | `totalElectoralDonations` | Compliance | Doações eleitorais |
| `KycData.TotalElectoralDonationAmount` | `int` | `totalElectoralDonationAmount` | Compliance | Valor total doado |
| `KycData.IsCurrentlyElectoralDonor` | `bool` | `isCurrentlyElectoralDonor` | Compliance | Doador atual |
| `KycData.Last30DaysSanctions` | `int` | `last30DaysSanctions` | Compliance | Sanções recentes |
| `KycData.Last365DaysSanctions` | `int` | `last365DaysSanctions` | Compliance | Sanções no ano |

**Normalizer:** `normalizers/bigdatacorp/kyc.js` → `normalizeKyc()`

### 2.7 Processos Judiciais (`juridico`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `Processes.TotalLawsuits` | `int` | `totalLawsuits` | Jurídico | Total de processos |
| `Processes.TotalLawsuitsAsAuthor` | `int` | `totalAsAuthor` | Jurídico | Como autor |
| `Processes.TotalLawsuitsAsDefendant` | `int` | `totalAsDefendant` | Jurídico | Como réu |
| `Processes.TotalLawsuitsAsOther` | `int` | `totalAsOther` | Jurídico | Outras partes |
| `Processes.Last30DaysLawsuits` | `int` | `last30DaysLawsuits` | Jurídico | Distribuições recentes |
| `Processes.Lawsuits[].Number` | `str` | `lawsuits[].number` | Jurídico | Número CNJ |
| `Processes.Lawsuits[].ClassName` | `str` | `lawsuits[].className` | Jurídico | Classe processual |
| `Processes.Lawsuits[].Court` | `str` | `lawsuits[].court` | Jurídico | Tribunal |
| `Processes.Lawsuits[].CourtUnit` | `str` | `lawsuits[].courtUnit` | Jurídico | Vara/Unidade |
| `Processes.Lawsuits[].Status` | `str` | `lawsuits[].status` | Jurídico | Status |
| `Processes.Lawsuits[].Subject` | `str` | `lawsuits[].subject` | Jurídico | Assunto |
| `Processes.Lawsuits[].Value` | `str` | `lawsuits[].value` | Jurídico | Valor causa (cents) |
| `Processes.Lawsuits[].DistributionDate` | `str` | `lawsuits[].distributionDate` | Jurídico | Data distribuição |
| `Processes.Lawsuits[].Parties[].Name` | `str` | `lawsuits[].parties[].name` | Jurídico | Partes |
| `Processes.Lawsuits[].Parties[].Type` | `str` | `lawsuits[].parties[].type` | Jurídico | Polo (Autor/Réu) |
| `Processes.Lawsuits[].Movements[].Date` | `str` | `lawsuits[].movements[].date` | Jurídico | Data movimentação |
| `Processes.Lawsuits[].Movements[].Description` | `str` | `lawsuits[].movements[].description` | Jurídico | Descrição |

**Normalizer:** `normalizers/bigdatacorp/processes.js` → `normalizeProcesses()`

### 2.8 Perfil Digital (`perfil_digital`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `OnlinePresence.InternetUsageLevel` | `str` | `internetUsageLevel` | Perfil Digital | Nível de uso |
| `OnlinePresence.TotalWebPassages` | `int` | `totalWebPassages` | Perfil Digital | Passagens web |
| `OnlinePresence.Last30DaysWebPassages` | `int` | `last30DaysWebPassages` | Perfil Digital | Passagens recentes |
| `OnlinePresence.Eseller` | `str` | `eSellerLevel` | Perfil Digital | Nível vendedor |
| `OnlinePresence.Eshopper` | `str` | `eShopperLevel` | Perfil Digital | Nível comprador |
| `OnlinePresence.FirstWebPassageDate` | `str` | `firstWebPassageDate` | Perfil Digital | Primeira aparição |
| `OnlinePresence.LastWebPassageDate` | `str` | `lastWebPassageDate` | Perfil Digital | Última aparição |

**Normalizer:** `normalizers/bigdatacorp/onlinePresence.js` → `normalizeOnlinePresence()` (NOVO)

### 2.9 Risco Financeiro (`risco`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `GovernmentDebtors.IsGovernmentDebtor` | `bool` | `isGovernmentDebtor` | Risco | Devedor gov |
| `GovernmentDebtors.DebtAmount` | `str` | `debtAmount` | Risco | Valor dívida |
| `GovernmentDebtors.Organ` | `str` | `debtOrgan` | Risco | Órgão |
| `Collections.IsPresentInCollection` | `bool` | `isPresentInCollection` | Risco | Em cobrança |
| `Collections.CollectionCompanies[]` | `list` | `collectionCompanies` | Risco | Empresas cobrança |
| `FinancialRisk.FinancialRiskLevel` | `str` | `financialRiskLevel` | Risco | Nível de risco |
| `FinancialRisk.FinancialRiskScore` | `int` | `financialRiskScore` | Risco | Score |

**Normalizers:** `normalizers/bigdatacorp/financial.js`, `risk.js`

---

## 3. Mapeamento PJ — Pessoa Jurídica

### 3.1 Identidade Cadastral (`dados_cadastrais_pj`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `BasicData.TaxIdNumber` | `str` | `document` | Dados Cadastrais | CNPJ |
| `BasicData.Name` | `str` | `name` | Dados Cadastrais | Razão social |
| `BasicData.OfficialName` | `str` | `officialName` | Dados Cadastrais | Nome fantasia |
| `BasicData.FoundedDate` | `str` | `foundedDate` | Dados Cadastrais | Data abertura |
| `BasicData.CreationDate` | `str` | `creationDate` | Dados Cadastrais | Data cadastro RF |
| `BasicData.LegalNature` | `dict` | `legalNature` | Dados Cadastrais | Natureza jurídica |
| `BasicData.CompanyType_ReceitaFederal` | `str` | `companyType` | Dados Cadastrais | Matriz/Filial |
| `BasicData.IsHeadquarter` | `bool` | `isHeadquarter` | Dados Cadastrais | É matriz |
| `BasicData.HeadquarterState` | `str` | `headquarterState` | Dados Cadastrais | UF matriz |
| `BasicData.TaxIdStatus` | `str` | `taxIdStatus` | Dados Cadastrais | Situação cadastral |
| `BasicData.SpecialSituation` | `str` | `specialSituation` | Dados Cadastrais | Situação especial |
| `BasicData.Activities[].Code` | `str` | `activities[].code` | Dados Cadastrais | CNAE |
| `BasicData.Activities[].Description` | `str` | `activities[].description` | Dados Cadastrais | Descrição CNAE |
| `BasicData.Activities[].IsMain` | `bool` | `activities[].isMain` | Dados Cadastrais | Principal? |
| `BasicData.IsConglomerate` | `bool` | `isConglomerate` | Dados Cadastrais | Conglomerado |

**Normalizer:** `normalizers/bigdatacorp/basicData.js` → `normalizeBasicDataEmpresa()`

### 3.2 QSA / Sócios (`qsa`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `Relationships.TotalOwners` | `int` | `totalOwners` | QSA | Qtd. sócios |
| `Relationships.TotalEmployees` | `int` | `totalEmployees` | QSA | Qtd. funcionários |
| `Relationships.IsFamilyCompany` | `bool` | `isFamilyCompany` | QSA | Empresa familiar |
| `Relationships.CurrentRelationships[].Name` | `str` | `relationships[].name` | QSA | Nome sócio |
| `Relationships.CurrentRelationships[].TaxId` | `str` | `relationships[].document` | QSA | CPF/CNPJ |
| `Relationships.CurrentRelationships[].Type` | `str` | `relationships[].type` | QSA | Tipo (Sócio, etc.) |
| `Relationships.CurrentRelationships[].OwnershipPercentage` | `float` | `relationships[].percentage` | QSA | % capital |
| `Relationships.CurrentRelationships[].StartDate` | `str` | `relationships[].startDate` | QSA | Data entrada |
| `Relationships.HistoricalRelationships[].Name` | `str` | `historicalRelationships[].name` | QSA | Ex-sócios |

**Normalizer:** `normalizers/bigdatacorp/relationships.js` → `normalizeRelationships()`

### 3.3 KYC dos Sócios (`compliance_socios`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `OwnersKycData.TotalCurrentlyPEP` | `int` | `owners.totalCurrentlyPep` | Compliance Sócios | PEPs ativos |
| `OwnersKycData.TotalCurrentlySanctioned` | `int` | `owners.totalCurrentlySanctioned` | Compliance Sócios | Sanções ativas |
| `OwnersKycData.PEPPercentage` | `float` | `owners.pepPercentage` | Compliance Sócios | % PEPs |
| `OwnersKycData.ActiveOwners[]` | `list` | `owners.active[]` | Compliance Sócios | Sócios ativos detalhados |
| `OwnersKycData.InactiveOwners[]` | `list` | `owners.inactive[]` | Compliance Sócios | Ex-sócios |
| `OwnersKycData.AverageSanctionsPerOwner` | `float` | `owners.avgSanctionsPerOwner` | Compliance Sócios | Média |

**Normalizer:** `normalizers/bigdatacorp/ownersKyc.js` → `normalizeOwnersKyc()` (NOVO)

> ⚠️ **Limite:** Empresa_2 tem 1.1 MB em owners_kyc. O adapter deve aplicar `limit(50)` por padrão e expor `NextPageId` para paginação.

### 3.4 Indicadores de Atividade (`indicadores_atividade`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `ActivityIndicators.ActivityLevel` | `float` | `activityLevel` | Indicadores | Nível 0-1 |
| `ActivityIndicators.HasActivity` | `bool` | `hasActivity` | Indicadores | Tem atividade |
| `ActivityIndicators.IncomeRange` | `str` | `incomeRange` | Indicadores | Faixa faturamento |
| `ActivityIndicators.EmployeesRange` | `str` | `employeesRange` | Indicadores | Faixa funcionários |
| `ActivityIndicators.HasActiveDomain` | `bool` | `hasActiveDomain` | Indicadores | Domínio ativo |
| `ActivityIndicators.HasCorporateEmail` | `bool` | `hasCorporateEmail` | Indicadores | Email corporativo |
| `ActivityIndicators.ShellCompanyLikelyhood` | `float` | `shellCompanyLikelihood` | Indicadores | Prob. empresa de fachada |
| `ActivityIndicators.NumberOfBranches` | `int` | `numberOfBranches` | Indicadores | Qtd. filiais |
| `ActivityIndicators.HasRecentAddress` | `bool` | `hasRecentAddress` | Indicadores | Endereço recente |
| `ActivityIndicators.HasRecentPhone` | `bool` | `hasRecentPhone` | Indicadores | Telefone recente |
| `ActivityIndicators.HasRecentEmail` | `bool` | `hasRecentEmail` | Indicadores | Email recente |

**Normalizer:** `normalizers/bigdatacorp/activityIndicators.js` → `normalizeActivityIndicators()` (NOVO)

### 3.5 Evolução da Empresa (`evolucao`)

| Campo BDC | Tipo BDC | Campo Canonical | Seção Dossiê | Notas |
|---|---|---|---|---|
| `CompanyEvolutionData.AverageCapital` | `float` | `avgCapital` | Evolução | Capital médio |
| `CompanyEvolutionData.AverageQtyEmployees` | `int` | `avgEmployees` | Evolução | Func. médio |
| `CompanyEvolutionData.AverageQtyQSA` | `int` | `avgQsaCount` | Evolução | QSA médio |
| `CompanyEvolutionData.DataHistoryOverTime[]` | `list` | `history[]` | Evolução | Série temporal |
| `CompanyEvolutionData.YearOverYearGrowthRateStatus1YearAgo` | `str` | `growthStatus1y` | Evolução | Crescimento 1a |
| `CompanyEvolutionData.YearOverYearGrowthRateStatus3YearsAgo` | `str` | `growthStatus3y` | Evolução | Crescimento 3a |
| `CompanyEvolutionData.YearOverYearGrowthRateStatus5YearsAgo` | `str` | `growthStatus5y` | Evolução | Crescimento 5a |
| `CompanyEvolutionData.HasQSAChangedAnytime` | `bool` | `hasQsaChanged` | Evolução | Mudança QSA |

**Normalizer:** `normalizers/bigdatacorp/companyEvolution.js` → `normalizeCompanyEvolution()` (NOVO)

### 3.6 Processos PJ (`juridico_pj`)

Mesmo mapeamento da PF (seção 2.7), mas aplicado a CNPJ. O BDC retorna `Lawsuits` para PJ no mesmo formato.

**Normalizer:** Reutiliza `normalizers/bigdatacorp/processes.js`

### 3.7 Contato PJ (`contato_pj`)

Mesmo mapeamento da PF (seção 2.2), aplicado a CNPJ. Datasets: `phones_extended`, `addresses_extended`, `emails_extended`.

**Normalizer:** Reutiliza `normalizers/bigdatacorp/basicData.js` → `normalizeContacts()`

### 3.8 KYC PJ (`compliance_pj`)

Mesmo mapeamento da PF (seção 2.6), aplicado a CNPJ. Dataset: `kyc`.

**Normalizer:** Reutiliza `normalizers/bigdatacorp/kyc.js`

---

## 4. Mapeamento Presets → Datasets

| Preset | PF Datasets | PJ Datasets | Custo PF Est. | Custo PJ Est. |
|---|---|---|---|---|
| `compliance` | `basic_data`, `processes`, `kyc` | `basic_data`, `processes`, `kyc`, `relationships` | R$ 0.15 | R$ 0.17 |
| `internacional` | `basic_data`, `kyc`, `online_presence`, `political_involvement` | `basic_data`, `kyc`, `online_presence`, `owners_kyc` | R$ 0.18 | R$ 0.22 |
| `financeiro` | `basic_data`, `processes`, `financial_data`, `collections`, `government_debtors` | `basic_data`, `financial_data`, `government_debtors`, `company_evolution` | R$ 0.25 | R$ 0.17 |
| `investigativo` | `basic_data`, `processes`, `kyc`, `online_presence`, `media_profile_and_exposure` | `basic_data`, `processes`, `kyc`, `online_presence`, `relationships` | R$ 0.27 | R$ 0.22 |
| `juridico` | `basic_data`, `processes`, `owners_lawsuits` | `basic_data`, `processes`, `owners_lawsuits` | R$ 0.15 | R$ 0.16 |
| `pld` | `basic_data`, `kyc`, `financial_data`, `collections` | `basic_data`, `kyc`, `relationships`, `financial_data` | R$ 0.20 | R$ 0.17 |
| `rh` | `basic_data`, `processes`, `kyc`, `occupation_data`, `class_organization` | *(n/a)* | R$ 0.25 | — |
| `dossier_pf_full` | `basic_data`, `processes`, `kyc`, `occupation_data`, `phones_extended`, `addresses_extended`, `emails_extended`, `online_presence`, `financial_data`, `class_organization`, `government_debtors`, `collections` | — | R$ 0.63 | — |
| `dossier_pj_full` | — | `basic_data`, `processes`, `kyc`, `relationships`, `owners_kyc`, `activity_indicators`, `company_evolution`, `phones_extended`, `addresses_extended`, `emails_extended`, `online_presence`, `government_debtors`, `collections` | — | R$ 0.77 |

---

## 5. Decisões de Design

### 5.1 Keys de Acesso por Dataset

O BDC retorna cada dataset em uma key diferente dentro de `Result[0]`:

| Dataset | Key em `Result[0]` |
|---|---|
| `basic_data` | `BasicData` |
| `kyc` | `KycData` |
| `processes.limit(N)` | `Processes` (PF) ou `Lawsuits` (PJ) |
| `occupation_data` | `ProfessionData` |
| `phones_extended` | `ExtendedPhones` |
| `addresses_extended` | `ExtendedAddresses` |
| `emails_extended` | `ExtendedEmails` |
| `online_presence` | `OnlinePresence` |
| `financial_data` | `FinantialData` |
| `class_organization` | `Memberships` |
| `relationships` | `Relationships` |
| `activity_indicators` | `ActivityIndicators` |
| `company_evolution` | `CompanyEvolutionData` |
| `owners_kyc` | `OwnersKycData` |
| `government_debtors` | `GovernmentDebtors` |
| `collections` | `Collections` |

### 5.2 Paginação

- `processes`: suporta `.limit(N)` e `.next(offset)`. O BDC retorna `NextPageId` ou `NextPage`.
- `relationships`: suporta paginação via `NextPageId`.
- `owners_kyc`: **sem paginação nativa** — retorna tudo. Recomenda-se aplicar `limit(50)` no backend para datasets massivos.
- `media_profile_and_exposure`: suporta paginação.

### 5.3 Nomenclatura `FinantialData` vs `FinancialData`

O BDC usa `FinantialData` (com "a" no lugar de "e"). O adapter deve normalizar para `financialData` canonical.

---

## 6. Gaps e TODOs

| # | Item | Prioridade | Responsável |
|---|---|---|---|
| 1 | Criar `normalizers/bigdatacorp/onlinePresence.js` | Alta | Backend |
| 2 | Criar `normalizers/bigdatacorp/activityIndicators.js` | Alta | Backend |
| 3 | Criar `normalizers/bigdatacorp/companyEvolution.js` | Alta | Backend |
| 4 | Criar `normalizers/bigdatacorp/ownersKyc.js` | Alta | Backend |
| 5 | Criar `normalizers/bigdatacorp/governmentDebtors.js` | Média | Backend |
| 6 | Criar `normalizers/bigdatacorp/collections.js` | Média | Backend |
| 7 | Expandir `adapters/bigdatacorp.js` para `queryCombinedExtended` | Alta | Backend |
| 8 | Adicionar presets `dossier_pf_full` e `dossier_pj_full` | Alta | Backend |
| 9 | Atualizar `enrichmentDefaults.js` com novos presets | Média | Backend |
| 10 | Testar com dados reais de empresa_2 (owners_kyc 1.1 MB) | Alta | QA |
| 11 | Criar módulo `memberships` no `MODULE_REGISTRY` | Média | Backend |
| 12 | Frontend: renderizar seções `perfil_digital`, `indicadores_atividade` | Baixa | Frontend |
