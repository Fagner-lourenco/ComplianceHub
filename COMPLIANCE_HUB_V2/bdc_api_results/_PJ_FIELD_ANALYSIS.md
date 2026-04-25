# Analise de Datasets BDC para PJ

> Gerado em: 2026-04-25T12:55:50.892Z

## Resumo por Dataset

| Dataset | OK | Vazio | Erro | Dados Uteis | Classificacao |
|---------|----|-------|------|-------------|---------------|
| government_debtors | 1 | 0 | 1 | 1 | Adotar |
| collections | 1 | 1 | 0 | 1 | Adotar |
| phones_extended | 2 | 0 | 0 | 2 | Adotar |
| addresses_extended | 2 | 0 | 0 | 2 | Adotar |
| emails_extended | 2 | 0 | 0 | 2 | Adotar |
| online_presence | 0 | 0 | 2 | 0 | Erro |
| financial_data | 0 | 0 | 2 | 0 | Erro |
| history_basic_data | 2 | 0 | 0 | 2 | Adotar |
| dynamic_qsa_data | 2 | 0 | 0 | 2 | Adotar |
| owners_lawsuits | 2 | 0 | 0 | 2 | Adotar |
| employees_kyc | 1 | 1 | 0 | 1 | Adotar |
| economic_group_kyc | 2 | 0 | 0 | 2 | Adotar |
| merchant_category_data | 2 | 0 | 0 | 2 | Adotar |
| syndicate_agreements | 2 | 0 | 0 | 2 | Adotar |
| social_conscience | 2 | 0 | 0 | 2 | Adotar |
| media_profile_and_exposure | 2 | 0 | 0 | 2 | Adotar |
| online_ads | 1 | 1 | 0 | 1 | Adotar |
| property_data | 0 | 0 | 2 | 0 | Erro |
| awards_and_certifications | 0 | 2 | 0 | 0 | Descartar |
| lawsuits_distribution_data | 2 | 0 | 0 | 2 | Adotar |

## Detalhes

### government_debtors

**empresa_2**: DebtorName, TotalDebtValue, TotalDebtValuePerOrigin, TotalDebts, TotalDebtsPerOrigin, Debts

### collections

**empresa_2**: TotalCollectionOccurrences, TotalCollectionOrigins, TotalCollectionMonths, MaxConsecutiveCollectionMonths, FirstCollectionDate, LastCollectionDate

### phones_extended

**empresa_1**: TotalPhones, TotalActivePhones, TotalWorkPhones, TotalPersonalPhones, TotalUniquePhones, TotalPhonePassages, TotalBadPhonePassages, OldestPhonePassageDate, NewestPhonePassageDate, Phones

**empresa_2**: TotalPhones, TotalActivePhones, TotalWorkPhones, TotalUniquePhones, TotalPhonePassages, TotalBadPhonePassages, OldestPhonePassageDate, NewestPhonePassageDate, Phones

### addresses_extended

**empresa_1**: TotalAddresses, TotalActiveAddresses, TotalPersonalAddresses, TotalAddressPassages, OldestAddressPassageDate, NewestAddressPassageDate, Addresses

**empresa_2**: TotalAddresses, TotalActiveAddresses, TotalWorkAddresses, TotalPersonalAddresses, TotalUniqueAddresses, TotalAddressPassages, OldestAddressPassageDate, NewestAddressPassageDate, Addresses

### emails_extended

**empresa_1**: TotalEmails, TotalWorkEmails, TotalPersonalEmails, TotalUniqueEmails, TotalEmailPassages, OldestEmailPassageDate, NewestEmailPassageDate, Emails

**empresa_2**: TotalEmails, TotalWorkEmails, TotalUniqueEmails, TotalEmailPassages, OldestEmailPassageDate, NewestEmailPassageDate, Emails

### online_presence

### financial_data

### history_basic_data

**empresa_1**: CurrentName, Age, TotalChanges, NameTotalChanges, TradeNameTotalChanges, TaxRegimeTotalChanges, TaxIdStatusTotalChanges, CnaeTotalChanges, CapitalTotalChanges, LastDateChanged, LastNameChanged, NameHistoryList, TradeNameHistoryList, TaxRegimeHistoryList, TaxIdStatusHistoryList, CnaeHistoryList, CapitalHistoryList

**empresa_2**: CurrentName, Age, TotalChanges, NameTotalChanges, TradeNameTotalChanges, TaxRegimeTotalChanges, TaxIdStatusTotalChanges, CnaeTotalChanges, CapitalTotalChanges, LastDateChanged, LastNameChanged, NameHistoryList, TradeNameHistoryList, TaxRegimeHistoryList, TaxIdStatusHistoryList, CnaeHistoryList, CapitalHistoryList

### dynamic_qsa_data

**empresa_1**: BasicData, Relationships

**empresa_2**: BasicData, Relationships

### owners_lawsuits

**empresa_1**: TotalLawsuits, TotalLawsuitsAsAuthor, TotalLawsuitsAsDefendant, TotalLawsuitsAsOther, AverageLawsuitsPerOwner, OwnerMaxLawsuits, Last365DaysLawsuits, LastLawsuitDate, Lawsuits, ActiveOwners, InactiveOwners

**empresa_2**: TotalLawsuits, TotalLawsuitsAsAuthor, TotalLawsuitsAsDefendant, TotalLawsuitsAsOther, AverageLawsuitsPerOwner, OwnerMaxLawsuits, Last90DaysLawsuits, Last180DaysLawsuits, Last365DaysLawsuits, LastLawsuitDate, Lawsuits, ActiveOwners, InactiveOwners

### employees_kyc

**empresa_2**: EmployeesKycData, TotalHistoricallySanctioned, AverageSanctionsPerEmployee, EmployeeMaxSanctions, NextPageId

### economic_group_kyc

**empresa_1**: TotalHistoricallySanctioned, EconomicGroupCompaniesKycData, EconomicGroupPeopleKycData, EconomicGroupKycData

**empresa_2**: TotalCurrentlyPEP, TotalHistoricallyPEP, TotalCurrentlySanctioned, TotalHistoricallySanctioned, AverageSanctionsPerCompany, PEPPercentage, EconomicGroupMaxSanctions, EconomicGroupMinSanctions, LastYearPEPOccurence, Last5PlusYearsPEPOccurence, LastSanctionDate, EconomicGroupCompaniesKycData, EconomicGroupPeopleKycData, EconomicGroupKycData

### merchant_category_data

**empresa_1**: HasMultipleMerchantCodes, CNAECategories

**empresa_2**: HasMultipleMerchantCodes, CNAECategories

### syndicate_agreements

**empresa_1**: CurrentConsecutiveYearsWithSomeAgreementActive, NumberOfMonthsSinceLastAgreementExpired, NumberOfMonthsUntilActiveAgreementsExpire

**empresa_2**: TotalAgreements, TotalActiveAgreements, TotalAgreementsWithLifeInsuranceClause, NumberOfStatesWithAgreementsPresent, CurrentConsecutiveYearsWithSomeAgreementActive, NumberOfMonthsSinceLastAgreementExpired, NumberOfMonthsUntilActiveAgreementsExpire, Agreements

### social_conscience

**empresa_1**: OwnershipDiversityScore, EmployeesDiversityScore, OnlineAccessibilityScore

**empresa_2**: OwnershipDiversityScore, EmployeesDiversityScore, OnlineAccessibilityScore

### media_profile_and_exposure

**empresa_1**: MediaExposureLevel, CelebrityLevel, UnpopularityLevel, SearchLabels, EntityStatistics

**empresa_2**: MediaExposureLevel, CelebrityLevel, UnpopularityLevel, NewsItems, CreationDate, LastUpdateDate, SearchLabels, Next, TotalPages, EntityStatistics

### online_ads

**empresa_1**: array[1]

### property_data

### awards_and_certifications

### lawsuits_distribution_data

**empresa_1**: TotalLawsuits, TypeDistribution, CourtNameDistribution, StatusDistribution, StateDistribution, PartyTypeDistribution, CourtTypeDistribution, CourtLevelDistribution, CnjProcedureTypeDistribution, CnjProcedureTypeNumberDistribution, CnjSubjectDistribution, CnjSubjectNumberDistribution, CnjBroadSubjectDistribution, CnjBroadSubjectNumberDistribution

**empresa_2**: TotalLawsuits, TypeDistribution, CourtNameDistribution, StatusDistribution, StateDistribution, PartyTypeDistribution, CourtTypeDistribution, CourtLevelDistribution, CnjProcedureTypeDistribution, CnjProcedureTypeNumberDistribution, CnjSubjectDistribution, CnjSubjectNumberDistribution, CnjBroadSubjectDistribution, CnjBroadSubjectNumberDistribution

