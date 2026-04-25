# Analise Profunda -- Schemas Reais BDC

> Gerado automaticamente a partir dos JSONs de resposta reais.
> CPFs: 48052053854, 10794180329, 11819916766, 05023290336, 46247243804
> CNPJs: 42975374000172, 13783221000478

## PF -- `basic_data`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | BasicData | 10.3 KB | OK |
| empresa_2 | BasicData | 21.9 KB | OK |
| pessoa_1 | BasicData | 1.6 KB | OK |
| pessoa_2 | BasicData | 1.5 KB | OK |
| pessoa_3 | BasicData | 1.8 KB | OK |
| pessoa_4 | BasicData | 1.6 KB | OK |
| pessoa_5 | BasicData | 1.6 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `BasicData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `BasicData.Activities` | list |
| `BasicData.AdditionalOutputData` | dict |
| `BasicData.Age` | int |
| `BasicData.Aliases` | dict |
| `BasicData.AlternativeIdNumbers` | dict |
| `BasicData.BirthCountry` | str |
| `BasicData.BirthDate` | str |
| `BasicData.CapturedBirthDateFromRFSource` | str |
| `BasicData.ChineseSign` | str |
| `BasicData.CompanyType_ReceitaFederal` | str |
| `BasicData.CreationDate` | str |
| `BasicData.FatherName` | str |
| `BasicData.FirstAndLastNameUniquenessScore` | float |
| `BasicData.FirstNameUniquenessScore` | float |
| `BasicData.FoundedDate` | str |
| `BasicData.Gender` | str |
| `BasicData.HasObitIndication` | bool |
| `BasicData.HeadquarterState` | str |
| `BasicData.HistoricalData` | dict |
| `BasicData.IsConglomerate` | bool |
| `BasicData.IsHeadquarter` | bool |
| `BasicData.IsValidBirthDateInRFSource` | bool |
| `BasicData.LastUpdateDate` | str |
| `BasicData.LegalNature` | dict |
| `BasicData.MaritalStatusData` | dict |
| `BasicData.MotherName` | str |
| `BasicData.Name` | str |
| `BasicData.NameUniquenessScore` | float, int |
| `BasicData.NameWordCount` | int |
| `BasicData.NumberOfFullNameNamesakes` | int |
| `BasicData.OfficialName` | str |
| `BasicData.OfficialNameUniquenessScore` | float, int |
| `BasicData.SpecialSituation` | str |
| `BasicData.TaxIdCountry` | str |
| `BasicData.TaxIdFiscalRegion` | str |
| `BasicData.TaxIdNumber` | str |
| `BasicData.TaxIdOrigin` | str |
| `BasicData.TaxIdStatus` | str |
| `BasicData.TaxIdStatusDate` | str |
| `BasicData.TaxIdStatusReason` | str |
| ... | ... |
| *+6 campos* | |

## PF -- `kyc`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | KycData | 1.1 KB | OK |
| empresa_2 | KycData | 72.1 KB | OK |
| pessoa_1 | KycData | 17.3 KB | OK |
| pessoa_2 | KycData | 26.4 KB | OK |
| pessoa_3 | KycData | 2.6 KB | OK |
| pessoa_4 | KycData | 73.3 KB | OK |
| pessoa_5 | KycData | 1.0 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `KycData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `KycData.ElectoralDonations` | dict |
| `KycData.FirstPEPOccurenceDate` | str |
| `KycData.FirstSanctionDate` | str |
| `KycData.IsCurrentlyElectoralDonor` | bool |
| `KycData.IsCurrentlyPEP` | bool |
| `KycData.IsCurrentlySanctioned` | bool |
| `KycData.IsHistoricalElectoralDonor` | bool |
| `KycData.Last180DaysSanctions` | int |
| `KycData.Last30DaysSanctions` | int |
| `KycData.Last365DaysSanctions` | int |
| `KycData.Last3YearsPEPOccurence` | int |
| `KycData.Last5PlusYearsPEPOccurence` | int |
| `KycData.Last5YearsPEPOccurence` | int |
| `KycData.Last90DaysSanctions` | int |
| `KycData.LastPEPOccurenceDate` | str |
| `KycData.LastSanctionDate` | str |
| `KycData.LastYearPEPOccurence` | int |
| `KycData.PEPHistory` | list |
| `KycData.SanctionsHistory` | list |
| `KycData.TotalElectoralDonationAmount` | int |
| `KycData.TotalElectoralDonationAmountLastTwoElections` | int |
| `KycData.TotalElectoralDonations` | int |
| `KycData.TotalElectoralDonationsLastTwoElections` | int |
| `KycData.WasPreviouslySanctioned` | bool |

## PF -- `processes_limit_100_`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | Lawsuits | 15.3 KB | OK |
| empresa_2 | Lawsuits | 12177.9 KB | OK |
| pessoa_1 | Processes | 0.6 KB | OK |
| pessoa_2 | Processes | 0.9 KB | OK |
| pessoa_3 | Processes | 27.4 KB | OK |
| pessoa_4 | Processes | 99.5 KB | OK |
| pessoa_5 | Processes | 0.6 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `Lawsuits` | unknown |  |
| `Processes` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `Lawsuits.FirstLawsuitDate` | str |
| `Lawsuits.Last180DaysLawsuits` | int |
| `Lawsuits.Last30DaysLawsuits` | int |
| `Lawsuits.Last365DaysLawsuits` | int |
| `Lawsuits.Last90DaysLawsuits` | int |
| `Lawsuits.LastLawsuitDate` | str |
| `Lawsuits.Lawsuits` | list |
| `Lawsuits.NextPageId` | str |
| `Lawsuits.TotalLawsuits` | int |
| `Lawsuits.TotalLawsuitsAsAuthor` | int |
| `Lawsuits.TotalLawsuitsAsDefendant` | int |
| `Lawsuits.TotalLawsuitsAsOther` | int |
| `Processes.FirstLawsuitDate` | str |
| `Processes.Last180DaysLawsuits` | int |
| `Processes.Last30DaysLawsuits` | int |
| `Processes.Last365DaysLawsuits` | int |
| `Processes.Last90DaysLawsuits` | int |
| `Processes.LastLawsuitDate` | str |
| `Processes.Lawsuits` | list |
| `Processes.TotalLawsuits` | int |
| `Processes.TotalLawsuitsAsAuthor` | int |
| `Processes.TotalLawsuitsAsDefendant` | int |
| `Processes.TotalLawsuitsAsOther` | int |

## PF -- `occupation_data`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | ProfessionData | 1.3 KB | OK |
| pessoa_2 | ProfessionData | 0.5 KB | OK |
| pessoa_3 | ProfessionData | 1.9 KB | OK |
| pessoa_4 | ProfessionData | 1.2 KB | OK |
| pessoa_5 | ProfessionData | 5.1 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `ProfessionData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `ProfessionData.IsEmployed` | bool |
| `ProfessionData.Professions` | list |
| `ProfessionData.TotalActiveProfessions` | int |
| `ProfessionData.TotalDiscounts` | int |
| `ProfessionData.TotalIncome` | int |
| `ProfessionData.TotalIncomeRange` | str |
| `ProfessionData.TotalProfessions` | int |

## PF -- `phones_extended`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | ExtendedPhones | 0.7 KB | OK |
| pessoa_2 | ExtendedPhones | 0.7 KB | OK |
| pessoa_3 | ExtendedPhones | 2.8 KB | OK |
| pessoa_4 | ExtendedPhones | 0.7 KB | OK |
| pessoa_5 | ExtendedPhones | 0.7 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `ExtendedPhones` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `ExtendedPhones.NewestPhonePassageDate` | str |
| `ExtendedPhones.OldestPhonePassageDate` | str |
| `ExtendedPhones.Phones` | list |
| `ExtendedPhones.TotalActivePhones` | int |
| `ExtendedPhones.TotalBadPhonePassages` | int |
| `ExtendedPhones.TotalLast12MonthsPassages` | int |
| `ExtendedPhones.TotalLast18MonthsPassages` | int |
| `ExtendedPhones.TotalLast3MonthsPassages` | int |
| `ExtendedPhones.TotalLast6MonthsPassages` | int |
| `ExtendedPhones.TotalPersonalPhones` | int |
| `ExtendedPhones.TotalPhonePassages` | int |
| `ExtendedPhones.TotalPhones` | int |
| `ExtendedPhones.TotalUniquePhones` | int |
| `ExtendedPhones.TotalWorkPhones` | int |

## PF -- `addresses_extended`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | ExtendedAddresses | 5.3 KB | OK |
| pessoa_2 | ExtendedAddresses | 0.7 KB | OK |
| pessoa_3 | ExtendedAddresses | 9.8 KB | OK |
| pessoa_4 | ExtendedAddresses | 0.7 KB | OK |
| pessoa_5 | ExtendedAddresses | 5.2 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `ExtendedAddresses` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `ExtendedAddresses.Addresses` | list |
| `ExtendedAddresses.NewestAddressPassageDate` | str |
| `ExtendedAddresses.OldestAddressPassageDate` | str |
| `ExtendedAddresses.TotalActiveAddresses` | int |
| `ExtendedAddresses.TotalAddressPassages` | int |
| `ExtendedAddresses.TotalAddresses` | int |
| `ExtendedAddresses.TotalBadAddressPassages` | int |
| `ExtendedAddresses.TotalPersonalAddresses` | int |
| `ExtendedAddresses.TotalUniqueAddresses` | int |
| `ExtendedAddresses.TotalWorkAddresses` | int |

## PF -- `emails_extended`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | ExtendedEmails | 0.7 KB | OK |
| pessoa_2 | ExtendedEmails | 0.7 KB | OK |
| pessoa_3 | ExtendedEmails | 0.7 KB | OK |
| pessoa_4 | ExtendedEmails | 0.7 KB | OK |
| pessoa_5 | ExtendedEmails | 0.7 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `ExtendedEmails` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `ExtendedEmails.NewestEmailPassageDate` | str |
| `ExtendedEmails.OldestEmailPassageDate` | str |
| `ExtendedEmails.TotalActiveEmails` | int |
| `ExtendedEmails.TotalBadEmailPassages` | int |
| `ExtendedEmails.TotalEmailPassages` | int |
| `ExtendedEmails.TotalEmails` | int |
| `ExtendedEmails.TotalPersonalEmails` | int |
| `ExtendedEmails.TotalUniqueEmails` | int |
| `ExtendedEmails.TotalWorkEmails` | int |

## PF -- `online_presence`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | OnlinePresence | 1.0 KB | OK |
| pessoa_2 | OnlinePresence | 1.0 KB | OK |
| pessoa_3 | OnlinePresence | 1.0 KB | OK |
| pessoa_4 | OnlinePresence | 1.0 KB | OK |
| pessoa_5 | OnlinePresence | 1.0 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `OnlinePresence` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `OnlinePresence.CreationDate` | str |
| `OnlinePresence.Eseller` | str |
| `OnlinePresence.Eseller_v2` | str |
| `OnlinePresence.Eseller_v3` | str |
| `OnlinePresence.Eshopper` | str |
| `OnlinePresence.Eshopper_v2` | str |
| `OnlinePresence.Eshopper_v3` | str |
| `OnlinePresence.FirstWebPassageDate` | str |
| `OnlinePresence.InternetUsageLevel` | str |
| `OnlinePresence.InternetUsageLevel_v2` | str |
| `OnlinePresence.InternetUsageLevel_v3` | str |
| `OnlinePresence.Last180DaysWebPassages` | int |
| `OnlinePresence.Last30DaysWebPassages` | int |
| `OnlinePresence.Last365DaysWebPassages` | int |
| `OnlinePresence.Last90DaysWebPassages` | int |
| `OnlinePresence.LastUpdateDate` | str |
| `OnlinePresence.LastWebPassageDate` | str |
| `OnlinePresence.TotalWebPassages` | int |
| `OnlinePresence.WebPassages` | int |

## PF -- `financial_data`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | FinantialData | 0.7 KB | OK |
| pessoa_2 | FinantialData | 0.7 KB | OK |
| pessoa_3 | FinantialData | 1.5 KB | OK |
| pessoa_4 | FinantialData | 1.1 KB | OK |
| pessoa_5 | FinantialData | 1.9 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `FinantialData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `FinantialData.CreationDate` | str |
| `FinantialData.IncomeEstimates` | dict |
| `FinantialData.LastUpdateDate` | str |
| `FinantialData.TaxReturns` | list |
| `FinantialData.TotalAssets` | str |

## PF -- `class_organization`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| pessoa_1 | Memberships | 0.3 KB | OK |
| pessoa_2 | Memberships | 0.3 KB | OK |
| pessoa_3 | Memberships | 0.3 KB | OK |
| pessoa_4 | Memberships | 0.3 KB | OK |
| pessoa_5 | Memberships | 0.3 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `Memberships` | unknown |  |

## PJ -- `basic_data`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | BasicData | 10.3 KB | OK |
| empresa_2 | BasicData | 21.9 KB | OK |
| pessoa_1 | BasicData | 1.6 KB | OK |
| pessoa_2 | BasicData | 1.5 KB | OK |
| pessoa_3 | BasicData | 1.8 KB | OK |
| pessoa_4 | BasicData | 1.6 KB | OK |
| pessoa_5 | BasicData | 1.6 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `BasicData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `BasicData.Activities` | list |
| `BasicData.AdditionalOutputData` | dict |
| `BasicData.Age` | int |
| `BasicData.Aliases` | dict |
| `BasicData.AlternativeIdNumbers` | dict |
| `BasicData.BirthCountry` | str |
| `BasicData.BirthDate` | str |
| `BasicData.CapturedBirthDateFromRFSource` | str |
| `BasicData.ChineseSign` | str |
| `BasicData.CompanyType_ReceitaFederal` | str |
| `BasicData.CreationDate` | str |
| `BasicData.FatherName` | str |
| `BasicData.FirstAndLastNameUniquenessScore` | float |
| `BasicData.FirstNameUniquenessScore` | float |
| `BasicData.FoundedDate` | str |
| `BasicData.Gender` | str |
| `BasicData.HasObitIndication` | bool |
| `BasicData.HeadquarterState` | str |
| `BasicData.HistoricalData` | dict |
| `BasicData.IsConglomerate` | bool |
| `BasicData.IsHeadquarter` | bool |
| `BasicData.IsValidBirthDateInRFSource` | bool |
| `BasicData.LastUpdateDate` | str |
| `BasicData.LegalNature` | dict |
| `BasicData.MaritalStatusData` | dict |
| `BasicData.MotherName` | str |
| `BasicData.Name` | str |
| `BasicData.NameUniquenessScore` | float, int |
| `BasicData.NameWordCount` | int |
| `BasicData.NumberOfFullNameNamesakes` | int |
| `BasicData.OfficialName` | str |
| `BasicData.OfficialNameUniquenessScore` | float, int |
| `BasicData.SpecialSituation` | str |
| `BasicData.TaxIdCountry` | str |
| `BasicData.TaxIdFiscalRegion` | str |
| `BasicData.TaxIdNumber` | str |
| `BasicData.TaxIdOrigin` | str |
| `BasicData.TaxIdStatus` | str |
| `BasicData.TaxIdStatusDate` | str |
| `BasicData.TaxIdStatusReason` | str |
| ... | ... |
| *+6 campos* | |

## PJ -- `kyc`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | KycData | 1.1 KB | OK |
| empresa_2 | KycData | 72.1 KB | OK |
| pessoa_1 | KycData | 17.3 KB | OK |
| pessoa_2 | KycData | 26.4 KB | OK |
| pessoa_3 | KycData | 2.6 KB | OK |
| pessoa_4 | KycData | 73.3 KB | OK |
| pessoa_5 | KycData | 1.0 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `KycData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `KycData.ElectoralDonations` | dict |
| `KycData.FirstPEPOccurenceDate` | str |
| `KycData.FirstSanctionDate` | str |
| `KycData.IsCurrentlyElectoralDonor` | bool |
| `KycData.IsCurrentlyPEP` | bool |
| `KycData.IsCurrentlySanctioned` | bool |
| `KycData.IsHistoricalElectoralDonor` | bool |
| `KycData.Last180DaysSanctions` | int |
| `KycData.Last30DaysSanctions` | int |
| `KycData.Last365DaysSanctions` | int |
| `KycData.Last3YearsPEPOccurence` | int |
| `KycData.Last5PlusYearsPEPOccurence` | int |
| `KycData.Last5YearsPEPOccurence` | int |
| `KycData.Last90DaysSanctions` | int |
| `KycData.LastPEPOccurenceDate` | str |
| `KycData.LastSanctionDate` | str |
| `KycData.LastYearPEPOccurence` | int |
| `KycData.PEPHistory` | list |
| `KycData.SanctionsHistory` | list |
| `KycData.TotalElectoralDonationAmount` | int |
| `KycData.TotalElectoralDonationAmountLastTwoElections` | int |
| `KycData.TotalElectoralDonations` | int |
| `KycData.TotalElectoralDonationsLastTwoElections` | int |
| `KycData.WasPreviouslySanctioned` | bool |

## PJ -- `relationships`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | Relationships | 5.9 KB | OK |
| empresa_2 | Relationships | 130.2 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `Relationships` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `Relationships.CurrentRelationships` | list |
| `Relationships.HistoricalRelationships` | list |
| `Relationships.IsFamilyCompany` | bool |
| `Relationships.IsFamilyOperated` | bool |
| `Relationships.IsFromHeadQuartersData` | bool |
| `Relationships.NextPageId` | str |
| `Relationships.Relationships` | list |
| `Relationships.TotalEmployees` | int |
| `Relationships.TotalOwned` | int |
| `Relationships.TotalOwners` | int |
| `Relationships.TotalRelationships` | int |

## PJ -- `processes_limit_100_`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | Lawsuits | 15.3 KB | OK |
| empresa_2 | Lawsuits | 12177.9 KB | OK |
| pessoa_1 | Processes | 0.6 KB | OK |
| pessoa_2 | Processes | 0.9 KB | OK |
| pessoa_3 | Processes | 27.4 KB | OK |
| pessoa_4 | Processes | 99.5 KB | OK |
| pessoa_5 | Processes | 0.6 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `Lawsuits` | unknown |  |
| `Processes` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `Lawsuits.FirstLawsuitDate` | str |
| `Lawsuits.Last180DaysLawsuits` | int |
| `Lawsuits.Last30DaysLawsuits` | int |
| `Lawsuits.Last365DaysLawsuits` | int |
| `Lawsuits.Last90DaysLawsuits` | int |
| `Lawsuits.LastLawsuitDate` | str |
| `Lawsuits.Lawsuits` | list |
| `Lawsuits.NextPageId` | str |
| `Lawsuits.TotalLawsuits` | int |
| `Lawsuits.TotalLawsuitsAsAuthor` | int |
| `Lawsuits.TotalLawsuitsAsDefendant` | int |
| `Lawsuits.TotalLawsuitsAsOther` | int |
| `Processes.FirstLawsuitDate` | str |
| `Processes.Last180DaysLawsuits` | int |
| `Processes.Last30DaysLawsuits` | int |
| `Processes.Last365DaysLawsuits` | int |
| `Processes.Last90DaysLawsuits` | int |
| `Processes.LastLawsuitDate` | str |
| `Processes.Lawsuits` | list |
| `Processes.TotalLawsuits` | int |
| `Processes.TotalLawsuitsAsAuthor` | int |
| `Processes.TotalLawsuitsAsDefendant` | int |
| `Processes.TotalLawsuitsAsOther` | int |

## PJ -- `activity_indicators`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | ActivityIndicators | 1.3 KB | OK |
| empresa_2 | ActivityIndicators | 1.3 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `ActivityIndicators` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `ActivityIndicators.ActivityLevel` | float |
| `ActivityIndicators.EmployeesRange` | str |
| `ActivityIndicators.FirstLevelEconomicGroupAverageActivityLevel` | float |
| `ActivityIndicators.FirstLevelEconomicGroupMaxActivityLevel` | float |
| `ActivityIndicators.FirstLevelEconomicGroupMinActivityLevel` | float, int |
| `ActivityIndicators.HasActiveDomain` | bool |
| `ActivityIndicators.HasActiveSSL` | bool |
| `ActivityIndicators.HasActivity` | bool |
| `ActivityIndicators.HasCorporateEmail` | bool |
| `ActivityIndicators.HasRecentAddress` | bool |
| `ActivityIndicators.HasRecentEmail` | bool |
| `ActivityIndicators.HasRecentPassages` | bool |
| `ActivityIndicators.HasRecentPhone` | bool |
| `ActivityIndicators.IncomeRange` | str |
| `ActivityIndicators.NumberOfBranches` | int |
| `ActivityIndicators.ShellCompanyLikelyhood` | float, int |

## PJ -- `company_evolution`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | CompanyEvolutionData | 68.8 KB | OK |
| empresa_2 | CompanyEvolutionData | 264.4 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `CompanyEvolutionData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `CompanyEvolutionData.AverageActivityLevel` | float |
| `CompanyEvolutionData.AverageCapital` | float, int |
| `CompanyEvolutionData.AverageCapital1YearAgo` | float, int |
| `CompanyEvolutionData.AverageCapital3YearsAgo` | float, int |
| `CompanyEvolutionData.AverageCapital5YearsAgo` | float, int |
| `CompanyEvolutionData.AverageESellerLevel` | str |
| `CompanyEvolutionData.AverageEShoperLevel` | str |
| `CompanyEvolutionData.AverageQtyEmployees` | int |
| `CompanyEvolutionData.AverageQtyEmployees1YearAgo` | int |
| `CompanyEvolutionData.AverageQtyEmployees3YearsAgo` | int |
| `CompanyEvolutionData.AverageQtyEmployees5YearsAgo` | int |
| `CompanyEvolutionData.AverageQtyQSA` | int |
| `CompanyEvolutionData.AverageQtyQSA1YearAgo` | int |
| `CompanyEvolutionData.AverageQtyQSA3YearsAgo` | int |
| `CompanyEvolutionData.AverageQtyQSA5YearsAgo` | int |
| `CompanyEvolutionData.AverageQtySubsidiaries` | int |
| `CompanyEvolutionData.AverageQtySubsidiaries1YearAgo` | int |
| `CompanyEvolutionData.AverageQtySubsidiaries3YearsAgo` | int |
| `CompanyEvolutionData.AverageQtySubsidiaries5YearsAgo` | int |
| `CompanyEvolutionData.DataHistoryOverTime` | list |
| `CompanyEvolutionData.DistinctQtyEmployees` | int |
| `CompanyEvolutionData.DistinctQtyQSA` | int |
| `CompanyEvolutionData.HasQSAChangedAnytime` | bool |
| `CompanyEvolutionData.MaxActivityLevel` | float |
| `CompanyEvolutionData.MaxCapital` | float, int |
| `CompanyEvolutionData.MaxESellerLevel` | str |
| `CompanyEvolutionData.MaxEShoperLevel` | str |
| `CompanyEvolutionData.MaxQtyEmployees` | int |
| `CompanyEvolutionData.MaxQtyQSA` | int |
| `CompanyEvolutionData.MaxQtySubsidiaries` | int |
| `CompanyEvolutionData.MinActivityLevel` | float |
| `CompanyEvolutionData.MinCapital` | int |
| `CompanyEvolutionData.MinESellerLevel` | str |
| `CompanyEvolutionData.MinEShoperLevel` | str |
| `CompanyEvolutionData.MinQtyEmployees` | int |
| `CompanyEvolutionData.MinQtyQSA` | int |
| `CompanyEvolutionData.MinQtySubsidiaries` | int |
| `CompanyEvolutionData.YearOverYearGrowthRateStatus1YearAgo` | str |
| `CompanyEvolutionData.YearOverYearGrowthRateStatus3YearsAgo` | str |
| `CompanyEvolutionData.YearOverYearGrowthRateStatus5YearsAgo` | str |

## PJ -- `owners_kyc`

### Resumo por entidade

| Entidade | Main Keys | Tamanho | Status |
|---|---|---|---|
| empresa_1 | OwnersKycData | 30.6 KB | OK |
| empresa_2 | OwnersKycData | 1098.2 KB | OK |

### Campos retornados

| Campo | Tipo | Exemplo |
|---|---|---|
| `OwnersKycData` | unknown |  |

### Sub-campos (dentro de objetos)

| Campo | Tipo |
|---|---|
| `OwnersKycData.ActiveOwners` | list |
| `OwnersKycData.AverageSanctionsPerOwner` | float |
| `OwnersKycData.CompanyOwnersKycData` | dict |
| `OwnersKycData.FirstPEPOccurenceDate` | str |
| `OwnersKycData.FirstSanctionDate` | str |
| `OwnersKycData.InactiveOwners` | list |
| `OwnersKycData.Last180DaysSanctions` | int |
| `OwnersKycData.Last30DaysSanctions` | int |
| `OwnersKycData.Last365DaysSanctions` | int |
| `OwnersKycData.Last3YearsPEPOccurence` | int |
| `OwnersKycData.Last5PlusYearsPEPOccurence` | int |
| `OwnersKycData.Last5YearsPEPOccurence` | int |
| `OwnersKycData.Last90DaysSanctions` | int |
| `OwnersKycData.LastPEPOccurenceDate` | str |
| `OwnersKycData.LastSanctionDate` | str |
| `OwnersKycData.LastYearPEPOccurence` | int |
| `OwnersKycData.OwnerMaxSanctions` | int |
| `OwnersKycData.OwnerMinSanctions` | int |
| `OwnersKycData.OwnersKycData` | dict |
| `OwnersKycData.PEPPercentage` | float, int |
| `OwnersKycData.PeopleOwnersKycData` | dict |
| `OwnersKycData.TotalCurrentlyPEP` | int |
| `OwnersKycData.TotalCurrentlySanctioned` | int |
| `OwnersKycData.TotalHistoricallyPEP` | int |
| `OwnersKycData.TotalHistoricallySanctioned` | int |
