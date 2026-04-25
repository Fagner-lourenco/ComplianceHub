# Análise de Datasets BDC para PF

> Gerado em: 2026-04-25T12:36:57.686Z

## Resumo por Dataset

| Dataset | OK | Vazio | Erro | Dados Úteis | Classificação |
|---------|----|-------|------|-------------|---------------|
| government_debtors | 0 | 4 | 1 | 0 | ⛔ Erro/Indisponível |
| collections | 3 | 2 | 0 | 3 | ✅ Adotar |
| historical_basic_data | 5 | 0 | 0 | 5 | ✅ Adotar |
| financial_risk | 5 | 0 | 0 | 5 | ✅ Adotar |
| indebtedness_question | 1 | 4 | 0 | 1 | ✅ Adotar |
| university_student_data | 0 | 5 | 0 | 0 | ⛔ Erro/Indisponível |
| profession_data | 5 | 0 | 0 | 5 | ✅ Adotar |
| awards_and_certifications | 0 | 5 | 0 | 0 | ⛔ Erro/Indisponível |
| sports_exposure | 0 | 5 | 0 | 0 | ⛔ Erro/Indisponível |
| political_involvement | 0 | 5 | 0 | 0 | ⛔ Erro/Indisponível |
| election_candidate_data | 0 | 5 | 0 | 0 | ⛔ Erro/Indisponível |
| online_ads | 0 | 5 | 0 | 0 | ⛔ Erro/Indisponível |
| media_profile_and_exposure | 5 | 0 | 0 | 5 | ✅ Adotar |
| lawsuits_distribution_data | 3 | 2 | 0 | 3 | ✅ Adotar |
| property_data | 0 | 0 | 5 | 0 | ⛔ Erro/Indisponível |

## Detalhes por Dataset

### government_debtors

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 4
- **CPFs com dados úteis**: 0
- **Erros**: 1

### collections

- **Classificação**: A
- **CPFs com dados**: 3
- **CPFs vazios**: 2
- **CPFs com dados úteis**: 3
- **Erros**: 0

**pessoa_3** (BAIXO): Last30DaysCollectionOccurrences, Last90DaysCollectionOccurrences, Last180DaysCollectionOccurrences, Last365DaysCollectionOccurrences, Last30DaysCollectionOrigins, Last90DaysCollectionOrigins, Last180DaysCollectionOrigins, Last365DaysCollectionOrigins, TotalCollectionMonths, FirstCollectionDate, LastCollectionDate, CollectionOccurrences, CollectionOrigins
  - Last30DaysCollectionOccurrences: 1
  - Last90DaysCollectionOccurrences: 1
  - Last180DaysCollectionOccurrences: 1

**pessoa_4** (CRITICO): TotalCollectionMonths, FirstCollectionDate, LastCollectionDate, CollectionOccurrences, CollectionOrigins
  - TotalCollectionMonths: 2
  - FirstCollectionDate: 2024-12-29T10:13:05Z
  - LastCollectionDate: 2025-01-13T17:53:43Z

**pessoa_5** (MEDIO): TotalCollectionMonths, FirstCollectionDate, LastCollectionDate, CollectionOccurrences, CollectionOrigins
  - TotalCollectionMonths: 2
  - FirstCollectionDate: 2019-07-09T03:03:10Z
  - LastCollectionDate: 2021-01-07T22:34:44Z

### historical_basic_data

- **Classificação**: A
- **CPFs com dados**: 5
- **CPFs vazios**: 0
- **CPFs com dados úteis**: 5
- **Erros**: 0

**pessoa_1** (ALTO): CurrentName, CurrentStatus, CurrentGender, BirthDate, Age, TaxIdNumber, NameChangeHistory, StatusChangeHistory, NameLifetimePercent, GenderLifetimePercent, StatusLifetimePercent
  - CurrentName: ANDRE LUIZ CRUZ DOS SANTOS
  - CurrentStatus: REGULAR
  - CurrentGender: M

**pessoa_2** (BAIXO): CurrentName, CurrentStatus, CurrentGender, BirthDate, Age, TaxIdNumber, NameChangeHistory, StatusChangeHistory, NameLifetimePercent, GenderLifetimePercent, StatusLifetimePercent
  - CurrentName: DIEGO EMANUEL ALVES DE SOUZA
  - CurrentStatus: REGULAR
  - CurrentGender: M

**pessoa_3** (BAIXO): CurrentName, CurrentStatus, CurrentGender, BirthDate, Age, TaxIdNumber, NameChangeHistory, StatusChangeHistory, NameLifetimePercent, GenderLifetimePercent, StatusLifetimePercent
  - CurrentName: RENAN GUIMARAES DE SOUSA AUGUSTO
  - CurrentStatus: REGULAR
  - CurrentGender: M

**pessoa_4** (CRITICO): CurrentName, CurrentStatus, CurrentGender, BirthDate, Age, TaxIdNumber, NameChangeHistory, StatusChangeHistory, NameLifetimePercent, GenderLifetimePercent, StatusLifetimePercent
  - CurrentName: FRANCISCO TACIANO DE SOUSA
  - CurrentStatus: REGULAR
  - CurrentGender: M

**pessoa_5** (MEDIO): CurrentName, CurrentStatus, CurrentGender, BirthDate, Age, TaxIdNumber, NameChangeHistory, StatusChangeHistory, NameLifetimePercent, GenderLifetimePercent, StatusLifetimePercent
  - CurrentName: MATHEUS GONCALVES DOS SANTOS
  - CurrentStatus: REGULAR
  - CurrentGender: M

### financial_risk

- **Classificação**: A
- **CPFs com dados**: 5
- **CPFs vazios**: 0
- **CPFs com dados úteis**: 5
- **Erros**: 0

**pessoa_1** (ALTO): TotalAssets, EstimatedIncomeRange, FinancialRiskScore, FinancialRiskLevel
  - TotalAssets: ABAIXO DE 100K
  - EstimatedIncomeRange: 3 A 5 SM
  - FinancialRiskScore: 650

**pessoa_2** (BAIXO): TotalAssets, EstimatedIncomeRange, FinancialRiskScore, FinancialRiskLevel
  - TotalAssets: ABAIXO DE 100K
  - EstimatedIncomeRange: 0 A 1 SM
  - FinancialRiskScore: 300

**pessoa_3** (BAIXO): TotalAssets, EstimatedIncomeRange, IsCurrentlyEmployed, LastOccupationStartDate, Last365DaysCollectionOccurrences, FinancialRiskScore, FinancialRiskLevel
  - TotalAssets: ABAIXO DE 100K
  - EstimatedIncomeRange: 5 A 7 SM
  - IsCurrentlyEmployed: true

**pessoa_4** (CRITICO): TotalAssets, EstimatedIncomeRange, IsCurrentlyEmployed, LastOccupationStartDate, FinancialRiskScore, FinancialRiskLevel
  - TotalAssets: ABAIXO DE 100K
  - EstimatedIncomeRange: 2 A 3 SM
  - IsCurrentlyEmployed: true

**pessoa_5** (MEDIO): TotalAssets, EstimatedIncomeRange, FinancialRiskScore, FinancialRiskLevel
  - TotalAssets: ABAIXO DE 100K
  - EstimatedIncomeRange: 3 A 5 SM
  - FinancialRiskScore: 650

### indebtedness_question

- **Classificação**: A
- **CPFs com dados**: 1
- **CPFs vazios**: 4
- **CPFs com dados úteis**: 1
- **Erros**: 0

**pessoa_3** (BAIXO): LikelyInDebt
  - LikelyInDebt: true

### university_student_data

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 5
- **CPFs com dados úteis**: 0
- **Erros**: 0

### profession_data

- **Classificação**: A
- **CPFs com dados**: 5
- **CPFs vazios**: 0
- **CPFs com dados úteis**: 5
- **Erros**: 0

**pessoa_1** (ALTO): TotalIncomeRange
  - TotalIncomeRange: SEM INFORMACAO

**pessoa_2** (BAIXO): TotalIncomeRange
  - TotalIncomeRange: SEM INFORMACAO

**pessoa_3** (BAIXO): TotalIncomeRange
  - TotalIncomeRange: SEM INFORMACAO

**pessoa_4** (CRITICO): TotalIncomeRange
  - TotalIncomeRange: SEM INFORMACAO

**pessoa_5** (MEDIO): TotalIncomeRange
  - TotalIncomeRange: SEM INFORMACAO

### awards_and_certifications

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 5
- **CPFs com dados úteis**: 0
- **Erros**: 0

### sports_exposure

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 5
- **CPFs com dados úteis**: 0
- **Erros**: 0

### political_involvement

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 5
- **CPFs com dados úteis**: 0
- **Erros**: 0

### election_candidate_data

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 5
- **CPFs com dados úteis**: 0
- **Erros**: 0

### online_ads

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 5
- **CPFs com dados úteis**: 0
- **Erros**: 0

### media_profile_and_exposure

- **Classificação**: A
- **CPFs com dados**: 5
- **CPFs vazios**: 0
- **CPFs com dados úteis**: 5
- **Erros**: 0

**pessoa_1** (ALTO): MediaExposureLevel, CelebrityLevel, UnpopularityLevel, SearchLabels, EntityStatistics
  - MediaExposureLevel: H
  - CelebrityLevel: H
  - UnpopularityLevel: H

**pessoa_2** (BAIXO): MediaExposureLevel, CelebrityLevel, UnpopularityLevel, SearchLabels, EntityStatistics
  - MediaExposureLevel: H
  - CelebrityLevel: H
  - UnpopularityLevel: H

**pessoa_3** (BAIXO): MediaExposureLevel, CelebrityLevel, UnpopularityLevel, SearchLabels, EntityStatistics
  - MediaExposureLevel: H
  - CelebrityLevel: H
  - UnpopularityLevel: H

**pessoa_4** (CRITICO): MediaExposureLevel, CelebrityLevel, UnpopularityLevel, SearchLabels, EntityStatistics
  - MediaExposureLevel: H
  - CelebrityLevel: H
  - UnpopularityLevel: H

**pessoa_5** (MEDIO): MediaExposureLevel, CelebrityLevel, UnpopularityLevel, NewsItems, CreationDate, LastUpdateDate, SearchLabels, TotalPages, EntityStatistics
  - MediaExposureLevel: H
  - CelebrityLevel: H
  - UnpopularityLevel: H

### lawsuits_distribution_data

- **Classificação**: A
- **CPFs com dados**: 3
- **CPFs vazios**: 2
- **CPFs com dados úteis**: 3
- **Erros**: 0

**pessoa_2** (BAIXO): TotalLawsuits, TypeDistribution, CourtNameDistribution, StatusDistribution, StateDistribution, PartyTypeDistribution, CourtTypeDistribution, CourtLevelDistribution, CnjProcedureTypeDistribution, CnjProcedureTypeNumberDistribution, CnjSubjectDistribution, CnjSubjectNumberDistribution, CnjBroadSubjectDistribution, CnjBroadSubjectNumberDistribution
  - TotalLawsuits: 1
  - TypeDistribution: {"ACAO DE ALIMENTOS":1}
  - CourtNameDistribution: {"TJCE":1}

**pessoa_3** (BAIXO): TotalLawsuits, TypeDistribution, CourtNameDistribution, StatusDistribution, StateDistribution, PartyTypeDistribution, CourtTypeDistribution, CourtLevelDistribution, CnjSubjectDistribution, CnjSubjectNumberDistribution, CnjBroadSubjectDistribution, CnjBroadSubjectNumberDistribution
  - TotalLawsuits: 1
  - TypeDistribution: {"RITO ORDINARIO":1}
  - CourtNameDistribution: {"TRT1":1}

**pessoa_4** (CRITICO): TotalLawsuits, TypeDistribution, CourtNameDistribution, StatusDistribution, StateDistribution, PartyTypeDistribution, CourtTypeDistribution, CourtLevelDistribution, CnjProcedureTypeDistribution, CnjProcedureTypeNumberDistribution, CnjSubjectDistribution, CnjSubjectNumberDistribution, CnjBroadSubjectDistribution, CnjBroadSubjectNumberDistribution
  - TotalLawsuits: 8
  - TypeDistribution: {"PROCEDIMENTO COMUM":1,"MEDIDAS PROTETIVAS DE URGENCIA":1,"
  - CourtNameDistribution: {"TJCE":8}

### property_data

- **Classificação**: D
- **CPFs com dados**: 0
- **CPFs vazios**: 0
- **CPFs com dados úteis**: 0
- **Erros**: 5

