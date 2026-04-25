# Recomendações de Integração BDC — PF

> Gerado em: 2026-04-25T12:36:57.687Z

## ✅ Datasets para Adotar (Classificação A)

- **collections**: 3/5 CPFs com dados úteis
- **historical_basic_data**: 5/5 CPFs com dados úteis
- **financial_risk**: 5/5 CPFs com dados úteis
- **indebtedness_question**: 1/5 CPFs com dados úteis
- **profession_data**: 5/5 CPFs com dados úteis
- **media_profile_and_exposure**: 5/5 CPFs com dados úteis
- **lawsuits_distribution_data**: 3/5 CPFs com dados úteis

## ⚠️ Datasets Condicionais (Classificação B)

_Nenhum dataset condicional._

## ❌ Datasets para Descartar (Classificação C/D)

- **government_debtors**: Erro na API ou dados não retornam nos CPFs testados.
- **university_student_data**:  dados não retornam nos CPFs testados.
- **awards_and_certifications**:  dados não retornam nos CPFs testados.
- **sports_exposure**:  dados não retornam nos CPFs testados.
- **political_involvement**:  dados não retornam nos CPFs testados.
- **election_candidate_data**:  dados não retornam nos CPFs testados.
- **online_ads**:  dados não retornam nos CPFs testados.
- **property_data**: Erro na API ou dados não retornam nos CPFs testados.

## Observações

1. Os 5 CPFs de teste podem não representar todos os perfis de risco. Um CPF com risco CRÍTICO ou ALTO pode ter mais dados em datasets como `collections`, `government_debtors`, `political_involvement`.
2. Datasets como `media_profile_and_exposure` e `online_ads` dependem fortemente da exposição pública do indivíduo.
3. `profession_data` e `university_student_data` dependem de registros em conselhos de classe ou instituições de ensino.
4. Recomenda-se testar com um conjunto maior e mais diverso de CPFs antes de descartar definitivamente qualquer dataset.
