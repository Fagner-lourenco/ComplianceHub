# 05b — BigDataCorp API (entradas hidratadas)

Entradas já extraídas de `docs.bigdatacorp.com.br/plataforma/reference/*` via WebFetch. Formato: Descrição → Dataset técnico → Preços → Chaves → Filtros → Body → Observações.

cURL e Response JSON exemplo são omitidos quando renderizados em widget JS na página oficial (padrão é idêntico: `POST /pessoas|/empresas|...` com headers `AccessToken` + `TokenId` e body `{q, Datasets, Limit}`).

**Progresso:** 16 / 199 hidratadas (7 Compliance, 2 Processos, 2 Dados Básicos PF, 2 Dados Básicos PJ, 1 Endereços PF, 1 E-mails PF, 1 Telefones PF)

---

## Compliance Regulatório

### 12. KYC e Compliance (Pessoas)
<!-- slug: pessoas-kyc-e-compliance | dataset: kyc | endpoint: POST /pessoas -->
<!-- V2: consumido por adapters/bigdatacorp.js::queryKyc, queryCombined (normalizer: normalizeBigDataCorpKyc) -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-kyc-e-compliance
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `kyc`

**Descrição:** Dataset que retorna informações relacionadas a KYC e Compliance da pessoa consultada, incluindo classificações de Pessoa Politicamente Exposta (PEP), sanções e restrições, bem como seus respectivos registros históricos, em escopo nacional e internacional. O retorno contempla indicadores de status atual e histórico das ocorrências, permitindo análises técnicas e automatizadas das informações associadas ao indivíduo.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `minmatch` | Percentual mínimo de similaridade entre nome consultado e nome no registro de sanção para flags `IsCurrentlySanctioned`, `WasPreviouslySanctioned`. Não restringe registros retornados. | Inteiro 0–100 (padrão 70) |
| `considerexpandedpep` | Considerar como PEP suplentes, promotores, defensores públicos e juízes estaduais. | `true`/`false` (padrão `false`) |
| `name` | Consulta por nome quando documento não é informado (útil para estrangeiros). | Qualquer texto |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `pep_level` | Igual | Níveis de PEP definidos |
| `pep_job` | Igual | Nome do cargo (ex. `PRESIDENTE`) |
| `pep_motive` | Igual | Motivo (ex. `RELACIONAMENTO`) |
| `sanctions_source` | Igual | `interpol`, `fbi`, `ofac`, `uk`, `eu`, `unsc`, `CEAF`, `CNEP`, `MTE`, `United Nations Security Council`, `Conselho Nacional de Justiça`, `Tribunal de Contas da União`, `Bank Hindered Suppliers`, `Ibama`, `Tribunal de Contas do Estado de São Paulo`, `Banco Central do Brasil`, `Comissao de Valores Mobiliarios`, `seape-df`, `ca-sanctions`, `DDTC` |
| `sanctions_type` | Igual | Tipo da restrição |
| `type` | Igual | Alias de `sanction_type` |
| `standardized_sanction_type` | Igual / Lista | `arrest warrants`, `financial crimes`, `terrorism`, `financial infractions`, `environmental infractions`, `corruption`, `slavery crimes` |
| `standardized_type` | Igual / Lista | Alias de `standardized_sanction_type` |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | sim | Identificadores e filtros (`doc{CPF}` ou `name{...}`) |
| `Datasets` | string | sim | `kyc` |
| `Limit` | number | não | Máx 80 |

**Observações**

- Consulta apenas por nome: PEP não executado; sanções limitadas a `EU`, `FBI`, `UK`, `INTERPOL`, `OFAC`, `SEAPE-DF`, `Canada Sanctions`, `DDTC`, `UNSC`, `CEAF`.
- Flags:
  - `IsCurrentlyPresentOnSource` — sanção atualmente na fonte (usa `EndDate` + última captura).
  - `WasRecentlyPresentOnSource` — sanção presente em até 40 dias antes da consulta.
  - `IsCurrentlySanctioned` — pelo menos 1 sanção ativa (respeitando `minmatch`).
  - `WasPreviouslySanctioned` — já teve sanção (respeitando `minmatch`).

**cURL template**

```bash
curl --request POST \
  --url https://plataforma.bigdatacorp.com.br/pessoas \
  --header 'AccessToken: ACCESSTOKEN' \
  --header 'TokenId: TOKENID' \
  --header 'accept: application/json' \
  --header 'content-type: application/json' \
  --data '{"Datasets":"kyc","q":"doc{CPF}","Limit":1}'
```

---

### 65. KYC e Compliance (Empresas)
<!-- slug: empresas-kyc-e-compliance | dataset: kyc | endpoint: POST /empresas -->
<!-- V2: GAP (não consumido). Proposta: integrar para PJ dossiê. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `kyc`

**Descrição:** Dataset que consolida informações voltadas a processos de KYC e compliance regulatório, reunindo indicadores e registros históricos relacionados a pessoas politicamente expostas (PEP), sanções e restrições de natureza nacional e internacional, incluindo a empresa consultada e seus sócios. O retorno permite identificar status atuais e passados, bem como apoiar análises regulatórias e de conformidade.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `minmatch` | Similaridade para flags de sanção; não restringe retorno. | 0–100 |
| `name` | Consulta por nome quando documento ausente (útil para estrangeiras). | Texto livre |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `pep_level` | Igual | Níveis PEP |
| `pep_job` | Igual | Nome do cargo |
| `pep_motive` | Igual | Descrição do motivo |
| `sanctions_source` | Igual | Fontes nacionais e internacionais suportadas |
| `sanctions_type` | Igual | Tipo da sanção |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | sim | `doc{CNPJ}` ou `name{...}` |
| `Datasets` | string | sim | `kyc` |
| `Limit` | number | não | Máx 80 |

**Observações:** Consulta apenas por nome: PEP não executado; sanções limitadas a `EU`, `FBI`, `UK`, `INTERPOL`, `OFAC`, `Canada Sanctions`, `CEPIM`, `CEIS`, `MTE`, `CNEP`, `UNSC`.

---

### 66. KYC e Compliance dos Sócios
<!-- slug: empresas-kyc-e-compliance-dos-socios | dataset: owners_kyc | endpoint: POST /empresas -->
<!-- V2: GAP. Crítico para dossiê PJ + análise de sócios agregada. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance-dos-socios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `owners_kyc`

**Descrição:** Dataset que consolida informações de KYC e compliance regulatório aplicáveis aos sócios vinculados à empresa consultada, reunindo indicadores e registros históricos relacionados a pessoas politicamente expostas (PEP), sanções e restrições nacionais e internacionais. O retorno permite avaliar o risco regulatório societário de forma agregada, reduzindo a necessidade de consultas individuais por sócio.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,090 |
| 10.001 – 50.000 | R$ 0,085 |
| 50.001 – 100.000 | R$ 0,081 |
| 100.001 – 500.000 | R$ 0,077 |
| 500.001 – 1.000.000 | R$ 0,073 |
| 1.000.001 – 5.000.000 | R$ 61.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `minmatch` | Similaridade para flags de sanção; não restringe retorno. | 0–100 |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `pep_level` | Igual | Níveis PEP |
| `pep_job` | Igual | Nome do cargo |
| `pep_motive` | Igual | Descrição do motivo |
| `sanctions_source` | Igual | Fontes suportadas |
| `sanctions_type` | Igual | Tipo da sanção |

**Body Params**

- `q` (string, sim): `doc{CNPJ}`
- `Datasets` (string, sim): `owners_kyc`
- `Limit` (number): Máx 80

**Observações:** Paginação via `.limit(x).next(y)` — máx 200 registros, default 50.

---

### 67. KYC e Compliance dos Funcionários
<!-- slug: empresas-kyc-e-compliance-dos-funcionarios | dataset: employees_kyc | endpoint: POST /empresas -->
<!-- V2: GAP. Alto custo — R$ 0,41+ por consulta. Considerar apenas para empresas com necessidade de screening funcionários. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance-dos-funcionarios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `employees_kyc`

**Descrição:** Dataset que consolida informações de KYC e compliance regulatório aplicáveis aos funcionários vinculados à empresa consultada, reunindo indicadores e registros históricos relacionados a pessoas politicamente expostas (PEP), sanções e restrições nacionais e internacionais. O retorno permite analisar o risco regulatório do quadro funcional de forma agregada, reduzindo a necessidade de consultas individuais por colaborador.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,410 |
| 10.001 – 50.000 | R$ 0,389 |
| 50.001 – 100.000 | R$ 0,370 |
| 100.001 – 500.000 | R$ 0,352 |
| 500.001 – 1.000.000 | R$ 0,334 |
| 1.000.001 – 5.000.000 | R$ 277.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `minmatch` | Similaridade para flags de sanção; não restringe retorno. | 0–100 |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `pep_level` | Igual | Níveis PEP |
| `pep_job` | Igual | Nome do cargo |
| `pep_motive` | Igual | Descrição do motivo |
| `sanctions_source` | Igual | Fontes suportadas |
| `sanctions_type` | Igual | Tipo da sanção |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | sim | `doc{CNPJ}` |
| `Datasets` | string | sim | `employees_kyc` |
| `Limit` | number | não | Máx 80 |

---

## Processos Judiciais

### 44. Processos Judiciais e Administrativos (Pessoas)
<!-- slug: pessoas-processos-judiciais-e-administrativos | dataset: processes | endpoint: POST /pessoas -->
<!-- V2: consumido por adapters/bigdatacorp.js::queryCombined, queryProcesses (normalizer: normalizeBigDataCorpProcesses) -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-processos-judiciais-e-administrativos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `processes`

**Descrição:** Dataset que reúne informações detalhadas sobre o envolvimento da entidade consultada em processos judiciais e administrativos, abrangendo diferentes naturezas processuais (cível, trabalhista, criminal, administrativa). Retorna indicadores consolidados + dados detalhados de cada processo identificado, permitindo análises aprofundadas sobre histórico, perfil e comportamento judicial. Oferece controle de volume e performance via modificadores.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,070 |
| 10.001 – 50.000 | R$ 0,066 |
| 50.001 – 100.000 | R$ 0,063 |
| 100.001 – 500.000 | R$ 0,060 |
| 500.001 – 1.000.000 | R$ 0,057 |
| 1.000.001 – 5.000.000 | R$ 46.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `returnupdates` | Se movimentações dos processos devem ser retornadas (impacta volume/performance). | `true`/`false` (padrão `true`) |
| `applyFiltersToStats` | Se estatísticas agregadas devem considerar filtros aplicados. | `true`/`false` (padrão `false`) |
| `returncvmprocesses` | Incluir processos administrativos da CVM. | `true`/`false` (padrão `false`) |
| `updateslimit` | Máximo de movimentações retornadas por processo. | Número |
| `extendednamematch` | Expande associação de processos por nome completo. | `true`/`false` (padrão `false`) |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `capturedate` | Entre | `[yyyy-MM-dd, yyyy-MM-dd]` |
| `closedate` | Entre | `[yyyy-MM-dd, yyyy-MM-dd]` |
| `cnjsubject` | Igual | Número ou nome conforme tabela CNJ |
| `cnjproceduretype` | Igual | Número ou nome do tipo do processo CNJ |
| `courtlevel` | Igual | `1`, `2`, `3` |
| `courtname` | Igual | `STF`, `STJ`, `TRF1`, etc. |
| `courttype` | Igual | `CIVEL`, `CRIMINAL`, `TRIBUTARIA`, `PREVIDENCIARIA`, `TRABALHISTA`, `ESPECIAL CIVEL`, `ESPECIAL CRIMINAL`, `ADMINISTRATIVA`, `ELEITORAL`, `FAZENDA`, `ESPECIAL FAZENDA` |
| `partypolarity` | Igual | `ACTIVE`, `PASSIVE`, `NEUTRAL` |
| `partytype` | Igual | `AUTHOR`, `DEFENDANT`, `CLAIMANT`, `CLAIMED`, `LAWYER`, `REPORTER`, `ATTORNEY`, `WITNESS`, `VICTIM`, `JUDGE`, `INMATE`, `OTHER` |
| `noticedate` | Entre | `[yyyy-MM-dd, yyyy-MM-dd]` |
| `state` | Igual | UF (`RJ`, `SP`, `MG`, …) |
| `status` | Contém | `ATIVO`, `DISTRIBUIDO`, `BAIXADO`, `APENSO`, `DECIDIDO`, `AUTUADO`, `EXECUCAO`, `FINALIZADO`, `ENCERRADO`, `EM GRAU DE RECURSO`, `REDISTRIBUIDO`, `TRANSITADO EM JULGADO`, `ARQUIVADO`, `JULGADO`, `INDEFINIDO`, `SUSPENSO` |
| `resjudicatadate` | Entre | `[yyyy-MM-dd, yyyy-MM-dd]` |
| `value` | Entre | `[Mínimo, Máximo]` |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | sim | `doc{CPF}` |
| `Datasets` | string | sim | `processes.limit(N).next(offset)` |
| `Limit` | number | não | Máx 80 |

**Observações**

- Paginação via `.limit(x)` e `.next(x)`.
- Em consultas >10 mil processos, filtros são aplicados sobre resultados paginados.
- `Parties.Polarity`: `ACTIVE` = polo ativo, `PASSIVE` = polo passivo, `NEUTRAL` = partes neutras.

---

### 92. Processos Judiciais e Administrativos (Empresas)
<!-- slug: empresas-processos-judiciais-e-administrativos | dataset: processes | endpoint: POST /empresas -->
<!-- V2: GAP — integrar para PJ dossiê Jurídico. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-processos-judiciais-e-administrativos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `processes`

**Descrição:** Dataset que retorna informações detalhadas sobre o envolvimento da empresa consultada em processos judiciais e administrativos, abrangendo cível, trabalhista, criminal e administrativa. Combina indicadores consolidados com dados detalhados por processo, permitindo análises de histórico e comportamento judicial. Associações ocorrem por documento quando disponível e por nome quando suficientemente único.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,070 |
| 10.001 – 50.000 | R$ 0,066 |
| 50.001 – 100.000 | R$ 0,063 |
| 100.001 – 500.000 | R$ 0,060 |
| 500.001 – 1.000.000 | R$ 0,057 |
| 1.000.001 – 5.000.000 | R$ 46.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `returnupdates` | Retorno de movimentações processuais | `true`/`false` (padrão `true`) |
| `applyFiltersToStats` | Estatísticas consideram filtros aplicados | `true`/`false` (padrão `false`) |
| `returncvmprocesses` | Inclusão de processos administrativos CVM | `true`/`false` (padrão `false`) |
| `updateslimit` | Limite de movimentações por processo | Número |

**Filtros** (idênticos ao dataset PF): `capturedate`, `closedate`, `cnjsubject`, `cnjproceduretype`, `courtlevel`, `courtname`, `courttype`, `partypolarity`, `partytype`, `noticedate`, `state`, `status`, `resjudicatadate`, `value`. Ver entrada #44 para valores.

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `q` | string | sim | `doc{CNPJ}` |
| `Datasets` | string | sim | `processes.limit(N)` |
| `Limit` | number | não | Máx 80 |

**Observações**

- Paginação `.next(x)` + `.limit(x)`.
- Em consultas >10k processos, filtros aplicam-se sobre resultados paginados.
- Ordenação: `LastMovementDate`, `NoticeDate`, `CloseDate`, `ResJudicataDate`, `CaptureDate`, `Value`.

---

## Dados Básicos

### 26. Dados Cadastrais Básicos (Pessoas)
<!-- slug: pessoas-dados-cadastrais-basicos | dataset: basic_data | endpoint: POST /pessoas -->
<!-- V2: consumido por adapters/bigdatacorp.js::queryCombined (normalizer: normalizeBigDataCorpBasicData) -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-cadastrais-basicos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `basic_data`

**Descrição:** Dataset que retorna os dados cadastrais básicos da pessoa consultada — nome, CPF, data de nascimento, nome da mãe — obtidos a partir de fontes oficiais e enriquecidos com inferências e dados complementares.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,030 |
| 10.001 – 50.000 | R$ 0,028 |
| 50.001 – 100.000 | R$ 0,027 |
| 100.001 – 500.000 | R$ 0,026 |
| 500.001 – 1.000.000 | R$ 0,025 |
| 1.000.001 – 5.000.000 | R$ 21.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `name` | Comparar nome informado com base (retorna similaridade percentual) | Texto livre |
| `mothername` | Comparar nome da mãe | Texto livre |
| `fathername` | Comparar nome do pai | Texto livre |

**Body Params:** `q` (`doc{CPF}` ou `name{...}`), `Datasets`=`basic_data`, `Limit` (máx 80).

**Campos retornados (inferidos):** `TaxIdNumber`, `Name`, `MotherName`, `FatherName`, `BirthDate`, `Gender`, `Age`.

---

### 27. Dados Cadastrais de Recência Configurável (Pessoas)
<!-- slug: pessoas-dados-cadastrais-de-recencia-configuravel | dataset: basic_data_with_configurable_recency | endpoint: POST /pessoas -->
<!-- V2: GAP — útil para tenants com SLA de frescor específico. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-cadastrais-de-recencia-configuravel
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `basic_data_with_configurable_recency`

**Descrição:** Retorna dados cadastrais básicos (nome, CPF, data de nascimento, filiação). Permite configurar recência máxima dos dados Receita Federal e dispara reavaliação automática em tempo real caso dados não atendam critério. Para status `TITULAR FALECIDO` não há atualização dinâmica.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,090 |
| 10.001 – 50.000 | R$ 0,085 |
| 50.001 – 100.000 | R$ 0,081 |
| 100.001 – 500.000 | R$ 0,077 |
| 500.001 – 1.000.000 | R$ 0,073 |
| 1.000.001 – 5.000.000 | _a coletar_ |
| 5.000.001 e acima | ~R$ 0,060 |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `max_days_since_update` | Tempo máximo desde última atualização | Inteiro (mín 7, padrão 30) |
| `name` | Comparação nome | Texto |
| `mothername` | Comparação nome mãe | Texto |
| `fathername` | Comparação nome pai | Texto |

---

### 28. Histórico de Dados Básicos (Pessoas)
<!-- slug: pessoas-historico-de-dados-basicos | dataset: historical_basic_data | endpoint: POST /pessoas -->
<!-- V2: GAP — útil para background check histórico. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-historico-de-dados-basicos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `historical_basic_data`

**Descrição:** Retorna histórico de alterações cadastrais de pessoas físicas na Receita Federal, incluindo mudanças de nome e status do CPF. Aplicável para modelos de crédito, background check e validação em onboarding. Cobre desde maioridade (18 anos).

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,030 |
| 10.001 – 50.000 | R$ 0,028 |
| 50.001 – 100.000 | R$ 0,027 |
| 100.001 – 500.000 | R$ 0,026 |
| 500.001 – 1.000.000 | R$ 0,025 |
| 1.000.001 – 5.000.000 | R$ 21.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `name` | Compara nome informado (similaridade %) | Texto |
| `mothername` | Compara nome mãe | Texto |
| `birthdate` | Valida data nascimento | Data |
| `dateformat` | Formato data | Ex: `yyyy-MM-dd` |

---

### 76. Dados Cadastrais Básicos (Empresas)
<!-- slug: empresas-dados-cadastrais-basicos | dataset: basic_data | endpoint: POST /empresas -->
<!-- V2: consumido por queryCombined para PJ. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-cadastrais-basicos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `basic_data`

**Descrição:** Dataset que reúne informações cadastrais básicas da empresa (CNPJ, razão social, nome fantasia, situação cadastral, data de fundação) obtidas de fontes oficiais. Consultas por chave alternativa (nome/telefone) retornam múltiplos candidatos.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,020 |
| 10.001 – 50.000 | R$ 0,019 |
| 50.001 – 100.000 | R$ 0,018 |
| 100.001 – 500.000 | R$ 0,017 |
| 500.001 – 1.000.000 | R$ 0,016 |
| 1.000.001 – 5.000.000 | R$ 14.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Valores possíveis relevantes no retorno**

- `LegalNature.Code`: 86 códigos distintos (0, 1015, 1023, 1031, … 8885).
- `TaxIdStatus`: `ATIVA`, `ATIVA - EMPRESA DOMICILIADA NO EXTERIOR`, `BAIXADA`, `CNPJ DOES NOT EXIST IN RECEITA FEDERAL DATABASE`, `INAPTA`, `NULA`, `NULA - EMPRESA DOMICILIADA NO EXTERIOR`, `SUSPENSA`, `SUSPENSA - EMPRESA DOMICILIADA NO EXTERIOR`.
- `TaxRegime`: `EIRELI`, `EPP`, `ISENTO`, `LTDA`, `LUCRO PRESUMIDO`, `LUCRO REAL`, `ME`, `MEI`, `NAO ATIVA`, `S.A.`, `SIMPLES`, `ADMINISTRACAO PUBLICA`.

**Body Params:** `q` (`doc{CNPJ}`), `Datasets`=`basic_data`, `Limit` (máx 80).

---

### 77. Histórico de Dados Básicos (Empresas)
<!-- slug: empresas-historico-de-dados-basicos | dataset: history_basic_data | endpoint: POST /empresas -->
<!-- V2: GAP. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-historico-de-dados-basicos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `history_basic_data`

**Descrição:** Compila alterações de informações cadastrais vinculadas ao CNPJ — mudanças em razão social, regime tributário e CNAE — monitoradas pela BDC ao longo do tempo.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

---

## Contatos

### 19. E-mails (Pessoas)
<!-- slug: pessoas-emails | dataset: emails_extended | endpoint: POST /pessoas -->
<!-- V2: GAP — integrar para dossiê RH/Investigativo. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-emails
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `emails_extended`

**Descrição:** Retorna informações e indicadores sobre e-mails associados à pessoa consultada — atributos de qualidade, validação, atividade, relevância de contato e informações agregadas.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `email` | Analisa e-mail adicional independente de vínculo documento | Texto |
| `returnonlydifferentemails` | Evita duplicados | `true`/`false` |
| `returnonlyvalidemails` | Filtra por qualidade | `true`/`false` |

**Filtros:** `type`, `isactive`, `isrecent`, `ismain`, `validationstatus`, `domain` (tipo Igual).

---

### 21. Telefones (Pessoas)
<!-- slug: pessoas-telefones | dataset: phones_extended | endpoint: POST /pessoas -->
<!-- V2: GAP. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-telefones
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `phones_extended`

**Descrição:** Dataset que retorna números de telefone vinculados à pessoa consultada com atributos de classificação, validação e priorização. Suporta análise de contato, segmentação, modelagem de dados e decisões automatizadas.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `phone` | Número adicional para enriquecer | Texto |
| `returnonlydifferentphones` | Retorna só não-match | `true`/`false` |
| `withmatchrate` | Calcula similaridade | `true`/`false` |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `type` | Igual | `mobile`, `work`, `home` |
| `isactive` | Igual | `true`/`false` |
| `isrecent` | Igual | `true`/`false` |
| `ismain` | Igual | `true`/`false` |
| `isindonotcalllist` | Igual | `true`/`false` |
| `areacode` | Igual | DDD (`11`, `21`, `61`, etc.) |

---

### 23. Endereços (Pessoas)
<!-- slug: pessoas-enderecos | dataset: addresses_extended | endpoint: POST /pessoas -->
<!-- V2: GAP. Crítico para validação de endereço em dossiê. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-enderecos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `addresses_extended`

**Descrição:** Retorna endereços vinculados à pessoa consultada — atributos de classificação, recência, prioridade e validação. Informações agregadas facilitam análises de contato, segmentação e decisões automatizadas.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `zipcode` | CEP para precisão com `addressnumber` | Texto |
| `addressnumber` | Número do endereço | Número |
| `address` | Logradouro sem número/CEP | Texto |
| `returnonlydifferentaddresses` | Só endereços distintos | `true`/`false` |
| `withmatchrate` | Calcula similaridade (`MatchRate`) | `true`/`false` |

**Filtros**

| Campo | Tipo | Valores |
|---|---|---|
| `Type` | Igual | `work`, `home` |
| `isratified` | Igual | `true`/`false` |
| `isactive` | Igual | `true`/`false` |
| `isrecent` | Igual | `true`/`false` |
| `ismain` | Igual | `true`/`false` |
| `isindirect` | Igual | `true`/`false` |
| `state` | Igual | UF (`RJ`, `SP`, …) |
| `zipcode` | Começa com | CEP completo ou parcial |

---

## Comportamento (Presença online)

### 15. Presença Online (Pessoas)
<!-- slug: pessoas-presenca-online | dataset: online_presence | endpoint: POST /pessoas -->
<!-- V2: GAP — útil para Investigativo. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-presenca-online
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `online_presence`

**Descrição:** Retorna indicadores e classificações da presença online da pessoa consultada — padrões gerais de uso da internet, presença em plataformas digitais e intensidade de atividade online.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,050 |
| 10.001 – 50.000 | R$ 0,048 |
| 50.001 – 100.000 | R$ 0,046 |
| 100.001 – 500.000 | R$ 0,044 |
| 500.001 – 1.000.000 | R$ 0,042 |
| 1.000.001 – 5.000.000 | R$ 34.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Observações:** Scores v2 usam normalização; scores v3 aplicam normalização com janela deslizante adaptativa (maior estabilidade classificatória).

---

## Compliance — adicionais (#68 Grupo Econômico)

### 68. KYC e Compliance do Grupo Econômico
<!-- slug: empresas-kyc-e-compliance-do-grupo-economico | dataset: economic_group_kyc | endpoint: POST /empresas -->
<!-- V2: GAP — útil para PJ due diligence profunda. -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-kyc-e-compliance-do-grupo-economico
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `economic_group_kyc`

**Descrição:** Dataset que consolida informações de KYC e compliance regulatório aplicáveis ao grupo econômico completo associado ao CNPJ consultado, abrangendo empresas e pessoas vinculadas por relações societárias diretas e indiretas.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 – 10.000 | R$ 0,410 |
| 10.001 – 50.000 | R$ 0,389 |
| 50.001 – 100.000 | R$ 0,370 |
| 100.001 – 500.000 | R$ 0,352 |
| 500.001 – 1.000.000 | R$ 0,334 |
| 1.000.001 – 5.000.000 | R$ 277.000,00 (preço fixo) |
| 5.000.001 e acima | Entre em contato |

**Chaves complementares**

| Chave | Descrição | Valores |
|---|---|---|
| `minmatch` | Similaridade para flags de sanção; não restringe retorno. | 0–100 |

**Filtros:** idênticos ao dataset `kyc` de Pessoas (ver entrada #12): `pep_level`, `pep_job`, `pep_motive`, `sanctions_source`, `sanctions_type`.

---

## Profissional & Laboral (Pessoas)

### 48. Conselhos de Classe
<!-- slug: pessoas-conselhos-de-classe | dataset: class_organization | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Filtros:** `organizationname` (Igual: CREFITO, CREA, CRM…), `organizationtype` (CLASS ASSOCIATION, PROFESSIONAL ORGANIZATION), `organizationchapter` (UF), `status` (ATIVO, BAIXADA, TRANSFERIDO, CANCELADO, INTERROMPIDO, REQUERIMENTO), `category` (FISIOTERAPEUTA, ENGENHARIA CIVIL, ENGENHEIRO AGRÔNOMO, TECNÓLOGO…).

### 50. Histórico Escolar e Acadêmico
<!-- slug: pessoas-historico-escolar-e-academico | dataset: university_student_data | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Filtros:** `level` (UNDERGRADUATE, GRADUATE, POST-GRADUATE), `institution` (Contém), `specializationarea` (Contém: Engenharia, Medicina, Economia, Direito…).

### 52. Prêmios e Certificações
<!-- slug: pessoas-premios-e-certificacoes | dataset: awards_and_certifications | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,090 · 10k-50k R$0,085 · 50k-100k R$0,081 · 100k-500k R$0,077 · 500k-1M R$0,073 · 1M-5M R$61.000 fixo · 5M+ contato.
**Filtros:** `awardname` (Contém), `awardingorganizationname` (Igual), `certificationname` (Contém: PMP, ISO-27001…), `certifyingentity` (Igual: ISO, PMI…), `certificationstatus` (ACTIVE, INACTIVE).

### 53. Servidores Públicos
<!-- slug: pessoas-servidores-publicos | dataset: profession_data | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Filtros:** `sector` (PUBLIC), `companyname` (Contém), `area` (Contém), `level` (Contém), `status` (ACTIVE, INACTIVE).

### 55. Exposição Esportiva
<!-- slug: pessoas-exposicao-esportiva | dataset: sports_exposure | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,070 · 10k-50k R$0,066 · 50k-100k R$0,063 · 100k-500k R$0,060 · 500k-1M R$0,057 · 1M-5M R$46.000 fixo · 5M+ contato.
**Filtros:** `relationshiplevel` (DIRECT, INDIRECT 1ST LEVEL, INDIRECT 2ND LEVEL, INDIRECT 3RD LEVEL, INDIRECT 4TH LEVEL, BUSINESS PARTNER), `role` (ASSISTANT COACH, COACH, COUNCIL MEMBER, DIRECTOR, EX-PRESIDENT, MANAGER, PLAYER, PRESIDENT, REFEREE, STAFF, VICE-PRESIDENT), `isactive` (true/false).
**RelationshipLevel → tipos:** DIRECT; INDIRECT 1ST: MOTHER, FATHER, SON, SPOUSE; INDIRECT 2ND: BROTHER, GRANDSON, GRANDPARENT; INDIRECT 3RD: UNCLE, NEPHEW; INDIRECT 4TH: COUSIN; BUSINESS PARTNER: PARTNER.

## Financeiro & Crédito (Pessoas)

### 29. Informações Financeiras
<!-- slug: pessoas-informacoes-financeiras | dataset: financial_data | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

## Risco (Pessoas)

### 56. Risco Financeiro
<!-- slug: pessoas-risco-financeiro | dataset: financial_risk | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

## Pendentes (HTTP 500)

- #49 Dados Profissionais PF (`pessoas-dados-profissionais`)
- #51 Licenças e Autorizações PF (`pessoas-licencas-e-autorizacoes`)
- #54 Turnover Profissional PF (`pessoas-turnover-profissional`)

---

## Político & Eleitoral

### 35. Nível de Envolvimento Político (Pessoas)
<!-- slug: pessoas-nivel-de-envolvimento-politico | dataset: political_involvement | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

### 36. Candidatos Eleitorais (Pessoas)
<!-- slug: pessoas-candidatos-eleitorais | dataset: election_candidate_data | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

### 81. Envolvimento Político (Empresas)
<!-- slug: empresas-envolvimento-politico | dataset: political_involvement | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

## Financeiro / Risco adicional

### 34. Devedores do Governo (Pessoas)
<!-- slug: pessoas-devedores-do-governo | dataset: government_debtors | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

### 58. Presença em Cobrança (Pessoas)
<!-- slug: pessoas-presenca-em-cobranca | dataset: collections | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,070 · 10k-50k R$0,066 · 50k-100k R$0,063 · 100k-500k R$0,060 · 500k-1M R$0,057 · 1M-5M R$46.000 fixo · 5M+ contato.

### 59. Probabilidade de Negativação (Pessoas)
<!-- slug: pessoas-probabilidade-de-negativacao | dataset: indebtedness_question | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,090 · 10k-50k R$0,085 · 50k-100k R$0,081 · 100k-500k R$0,077 · 500k-1M R$0,073 · 1M-5M R$0,069 · 5M-10M R$0,066 · 10M-50M R$0,063 · 50M+ R$0,060.

## Pendentes (HTTP 500) — retry futuro

- #37 Doações Eleitorais PF, #39 Prestadores Eleitorais PF, #41 Exposição Mídia PF, #40 Dados Popularidade PF, #31 Benefícios Sociais PF

---

## Presença Digital (Pessoas/Empresas)

### 42. Anúncios Online (Pessoas)
<!-- slug: pessoas-anuncios-online | dataset: online_ads | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Filtros:** `activeads` (≥ int), `totalads` (≥ int), `admaxvalue` (≥ dec), `adminvalue` (≥ dec), `portal` (=), `category` (=).

## Identidade & Cadastro (Empresas adicional)

### 78. Dados de Categoria Comercial - MCC (Empresas)
<!-- slug: empresas-dados-de-categoria-comercial-mcc | dataset: merchant_category_data | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

## Econômicos (Empresas)

### 79. Evolução da Empresa
<!-- slug: empresas-evolucao-da-empresa | dataset: company_evolution | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k+ R$19.000 fixo.

### 80. Indicadores de Atividade (Empresas)
<!-- slug: empresas-indicadores-de-atividade | dataset: activity_indicators | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Inferências retornadas:** EmployeesRange, IncomeRange, ActivityLevel, HasActivity, ShellCompanyLikelyhood.
**Indicadores retornados:** HasRecentEmail, HasRecentPassages, HasActiveDomain, HasActiveSSL, HasCorporateEmail, NumberOfBranches.

## Pendentes (500/404)

- #17 Passagens Web PF, #18 Propensão Aposta (404 — slug pode ser `pessoas-propensao-a-aposta-online`), #43 Sites PF, #60 Sócio-Demográfico PF, #61 Veículos PF, #33 Propriedades Industriais PF

---

## Ativos & Propriedade / Relacionamentos

### 96. Relacionamentos (Empresas)
<!-- slug: empresas-relacionamentos | dataset: relationships | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,030 · 10k-50k R$0,028 · 50k-100k R$0,027 · 100k-500k R$0,026 · 500k-1M R$0,025 · 1M-5M R$21.000 fixo · 5M+ contato.
**Chaves:** `useHeadQuartersData` (true/false, default false).
**Filtros:** `relatedentitytaxidtype` (CPF, CNPJ), `relationshiplevel` (Direto, Indireto), `relationshiptype` (QSA, Ownership, Employee, RepresentanteLegal).

### 98. QSA de Recência Configurável (Empresas)
<!-- slug: empresas-qsa-de-recencia-configuravel | dataset: dynamic_qsa_data | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,090 · 10k-50k R$0,085 · 50k-100k R$0,081 · 100k-500k R$0,077 · 500k-1M R$0,073 · 1M-5M R$0,069 · 5M-10M R$0,066 · 10M-50M R$0,063 · 50M+ R$0,060.
**Chaves:** `recency` (número de dias máximo desde última atualização).

## Risco (Empresas)

### 101. Presença em Cobrança (Empresas)
<!-- slug: empresas-presenca-em-cobranca | dataset: collections | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,070 · 10k-50k R$0,066 · 50k-100k R$0,063 · 100k-500k R$0,060 · 500k-1M R$0,057 · 1M-5M R$46.000 fixo · 5M+ contato.

## ESG

### 85. Acordos Sindicais (Empresas)
<!-- slug: empresas-acordos-sindicais | dataset: syndicate_agreements | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.

### 86. Consciência Social (Empresas)
<!-- slug: empresas-consciencia-social | dataset: social_conscience | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Indicadores:** métricas de engajamento social (acessibilidade, diversidade, equidade salarial) inferidas de dados públicos.

## Pendentes (500/econnrefused)

- #102 Devedores Gov PJ, #99 Avaliações Reputação PJ, #100 Prêmios PJ, #105 Mercado Financeiro, #103 Fundos Investimento, #104 Obras Civis

---

## Jurídico & Processual (adicional)

### 93. Processos Judiciais dos Sócios (Empresas)
<!-- slug: empresas-processos-judiciais-dos-socios | dataset: owners_lawsuits | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,130 · 10k-50k R$0,124 · 50k-100k R$0,118 · 100k-500k R$0,112 · 500k-1M R$0,106 · 1M-5M R$86.000 fixo · 5M+ contato.
**Chaves:** idênticas a `processes` — `returnupdates`, `applyFiltersToStats`, `returncvmprocesses`, `updateslimit`.
**Filtros:** idênticos a `processes` (entrada #44).

### 46. Dados de Distribuição de Processos Judiciais (Pessoas)
<!-- slug: pessoas-dados-de-distribuicao-de-processos-judiciais | dataset: lawsuits_distribution_data | endpoint: POST /pessoas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Chaves:** `alternativedistributionparameter` (`PartyType` — retorna agregação adicional).
**Filtros:** idênticos a `processes` (entrada #44).

### 94. Dados de Distribuição de Processos Judiciais (Empresas)
<!-- slug: empresas-dados-de-distribuicao-de-processos-judiciais | dataset: lawsuits_distribution_data | endpoint: POST /empresas | V2: GAP -->
**Preços:** 1-10k R$0,050 · 10k-50k R$0,048 · 50k-100k R$0,046 · 100k-500k R$0,044 · 500k-1M R$0,042 · 1M-5M R$34.000 fixo · 5M+ contato.
**Chaves:** `alternativedistributionparameter` (`PartyType`).
**Filtros:** idênticos a `processes`.

## Pendentes (quota esgotada; reseta 13:30 BRT)

- #69 Dados Registro PJ, #70 E-mails PJ, #72 Telefones PJ, #74 Endereços PJ (Contatos PJ) — 500 BDC
- #82 Doações Eleitorais PJ, #43 Sites PF, #91 Marketplaces PJ — 500 BDC

---

### 16. Presença Online Familiar
<!-- slug: pessoas-presenca-online-familiar | dataset: family_online_participation | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-presenca-online-familiar
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `family_online_participation`

**Descrição:** This dataset returns information related to the online presence of the respondent's family group, considering the presence and activity of family members on digital buying and selling platforms. The data allows for the analysis of digital behavior patterns, levels of digital inclusion, and the degree of presence of the family unit in online marketplaces. The information is consolidated at the family level, supporting behavioral analyses, segmentations, and models that consider the group's digital context as a whole. For more information on context, applications, and use cases related to digital behavior, please refer to the Behavior category documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.130 |
| 10.001 - 50.000 | BRL 0.124 |
| 50.001 - 100.000 | BRL 0.118 |
| 100.001 - 500.000 | BRL 0.112 |
| 500.001 - 1.000.000 | BRL 0.106 |
| 1.000.001 - 5.000.000 | BRL 86,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 17. Passagens pela Web
<!-- slug: pessoas-passagens-pela-web | dataset: passages | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-passagens-pela-web
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `passages`

**Descrição:** This dataset returns aggregated information about an individual's web browsing history, considering frequency, diversity of contexts, and temporal attributes associated with the identifications made in BigDataCorp's processes. The data provided supports analyses of digital presence, behavior, and activity over time. For more information on context, concepts, and applications related to digital behavior, please refer to the Behavior category documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| minpassage threshold | Establishes a threshold with the passed value that determines the minimum number of identical associations a document must have to be counted as a pass in the aggregation fields. NumberOfEmails, NumberOfPhones, NumberOfAddresses, NumberOfIpAddresses and NumberOfDevices. |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 20. E-mails de Pessoas Relacionadas
<!-- slug: pessoas-emails-de-pessoas-relacionadas | dataset: related_people_emails | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-emails-de-pessoas-relacionadas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `related_people_emails`

**Descrição:** A dataset that returns emails associated with people related to the queried individual, with classification and validation attributes that support contact analysis, segmentation, and automated decision-making. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| relationshiptype | Type of relationship |
| type | Email type |
| isactive | If email is active |
| isrecent | If the email is recent |
| ismain | If email is primary |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Field | Filter description | Filter type | Possible Filter Values |
| relationshiptype | Type of relationship | Equal | coworker, neighbor, brother, nephew, mother, son, household, grandson, spouse, relative, grandparent, uncle, cousin, father, partner, related |
| type | Email type | Contains | corporate, personal |
| isactive | If email is active | Equal | true, false |
| isrecent | If the email is recent | Equal | true, false |
| ismain | If email is primary | Equal | true, false |
| validationstatus | validation status | Equal | VALID, ACCEPT_ALL, UNKNOWN, POSSIBLE_SPAM_TRAP, INVALID, HARDBOUNCE, RISKY, ACCEPT |
| domain | Email domain | Equal | gmail.com, yahoo.com.br, ... |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 22. Telefones de Pessoas Relacionadas
<!-- slug: pessoas-telefones-de-pessoas-relacionadas | dataset: related_people_phones | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-telefones-de-pessoas-relacionadas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `related_people_phones`

**Descrição:** This dataset returns phone numbers associated with people related to the queried individual, with attributes for classification, validation, relationship, and prioritization. The results allow for the analysis of contacts linked to family members, partners, colleagues, or other types of relationships, supporting network analysis, segmentation, and automated decision-making. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| relationshiptype | Restricts callbacks to phone numbers of people who have the specified type of relationship. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Field | Filter description | Filter type | Possible Filter Values |
| relationshiptype | Type of relationship between the person being consulted and the phone number holder. | Equal | coworker, neighbor, brother, nephew, mother, son, household, grandson, spouse, relative, grandparent, uncle, cousin, father, partner, related |
| type | phone type | Equal | mobile, work, home |
| isactive | Indicates whether the phone is active. | Equal | true, false |
| isrecent | Indicates whether the phone is recent. | Equal | true, false |
| ismain | Indicates whether the phone is the primary phone. | Equal | true, false |
| isindonotcalllist | Indicates whether the phone number is on any block lists. | Equal | true, false |
| areacode | Telephone area code | Equal | 11, 21, 61, ... |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 24. Endereços de Pessoas Relacionadas
<!-- slug: pessoas-enderecos-de-pessoas-relacionadas | dataset: related_people_addresses | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-enderecos-de-pessoas-relacionadas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `related_people_addresses`

**Descrição:** This dataset returns addresses associated with people related to the individual being consulted, allowing for the analysis of indirect links, address characteristics, recency, priority, and nature of the association. The data supports relationship analysis, segmentation, and automated decision-making in flows that require enhanced contact context. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| relationshiptype | Type of relationship |
| type | Type of address |
| isratified | If it is ratified |
| isactive | If it is active |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Field | Filter description | Filter type | Possible Filter Values |
| relationshiptype | Type of relationship | Equal | coworker, neighbor, brother, nephew, mother, son, household, grandson, spouse, relative, grandparent, uncle, cousin, father, partner, related |
| type | Type of address | Contains | work, home |
| isratified | If it is ratified | Equal | true, false |
| isactive | If it is active | Equal | true, false |
| isrecent | if it's recent | Equal | true, false |
| ismain | If it is main | Equal | true, false |
| state | State acronym | Equal | RJ, SP, MG, ES... |
| zipcode | zip code | Starts with | Any full zip code or first x digits |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 25. Dados de Registro
<!-- slug: pessoas-dados-de-registro | dataset: registration_data | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-registro
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `registration_data`

**Descrição:** This dataset returns registration data for the person being searched, gathering information commonly used in registration and profile enrichment processes, such as identification data, emails, addresses, and phone numbers associated with the individual. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.120 |
| 10.001 - 50.000 | BRL 0.114 |
| 50.001 - 100.000 | BRL 0.108 |
| 100.001 - 500.000 | BRL 0.103 |
| 500.001 - 1.000.000 | BRL 0.098 |
| 1.000.001 - 5.000.000 | BRL 79,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 30. Informações Financeiras de Familiares
<!-- slug: pessoas-informacoes-financeiras-de-familiares | dataset: family_financial_data | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-informacoes-financeiras-de-familiares
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `family_financial_data`

**Descrição:** This dataset returns aggregated financial information about the surveyed individual's family unit, allowing for the assessment of income composition, primary income source, and estimates of household spending and disposable income. For classification purposes, an individual is considered the head of household when they contribute 70% or more of the total income, while financial dependents are those contributing less than 10%, including minors and individuals in situations of economic dependency. The data provided supports economic analyses, risk modeling, and financial capacity assessments. For more information on business context, applications, and use cases, please refer to the Economic and Financial documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 33. Propriedades Industriais
<!-- slug: pessoas-propriedades-industriais | dataset: industrial_property | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-propriedades-industriais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `industrial_property`

**Descrição:** This dataset returns information about trademarks and patents associated with the consulted CPF (Brazilian taxpayer ID), including distinct lists for each asset type and consolidated indicators such as total quantity, countries of registration, and average duration of extraordinary terms. For more information on business context, applications, and use cases, please refer to the Economic and Financial documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| type | Define the type of asset being consulted (trademarks or patents). |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| type | Define the type of asset being consulted (trademarks or patents). | By the way | For trademarks, add {brands} after the dataset. Ex: industrial_property{brands}. For patents, add {patents} after the dataset. Ex: industrial_property{patents} |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 37. Doações Eleitorais
<!-- slug: pessoas-doacoes-eleitorais | dataset: electoral_donors | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-doacoes-eleitorais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `electoral_donors`

**Descrição:** This dataset compiles information on electoral donations made and received by the consulted entity, including aggregated attributes of quantity and total value, as well as details of each donation, such as the politician involved, value, date, and indication of whether it was made digitally. For interpretation purposes, the data includes financial flows in both directions, allowing the identification of both donations made and received by the entity. When a reference date is provided in the query, the electoral cycles considered are counted retroactively from that date. For more information on business context, applications, and use cases, please refer to the Political Engagement documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 38. Histórico Político Familiar
<!-- slug: pessoas-historico-politico-familiar | dataset: family_political_history | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-historico-politico-familiar
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `family_political_history`

**Descrição:** This dataset generates a timeline with information about the political participation of family members of the individual being consulted, including aggregations that allow for the identification of involvement in different regions, elected positions, and political parties. The data enables the analysis of the level of political influence and exposure of the family as a whole. For more information on business context, applications, and use cases, please refer to the Political Engagement documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.070 |
| 10.001 - 50.000 | BRL 0.066 |
| 50.001 - 100.000 | BRL 0.063 |
| 100.001 - 500.000 | BRL 0.060 |
| 500.001 - 1.000.000 | BRL 0.057 |
| 1.000.001 - 5.000.000 | BRL 46,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 39. Prestadores de Serviços Eleitorais
<!-- slug: pessoas-prestadores-de-servicos-eleitorais | dataset: electoral_providers | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-prestadores-de-servicos-eleitorais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `electoral_providers`

**Descrição:** This dataset gathers information on contracts, service provision, and supplies related to election campaigns, involving the consulted entity and service providers or political candidates. The data includes details of each contract, such as the politician or party involved, contracted values, and information associated with the candidacy. For interpretation purposes, the data includes both services rendered and received by the entity, allowing for analysis of the direction of the contractual relationship within the electoral context. For more information on business context, applications, and use cases, please refer to the Political Engagement documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 40. Dados de Popularidade
<!-- slug: pessoas-dados-de-popularidade | dataset: influence_data | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-popularidade
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `influence_data`

**Descrição:** This dataset consolidates information related to individuals' public exposure in political, judicial, economic, social, and media contexts, allowing for analysis of the degree of influence exerted on society. The output includes a normalized influence score, which reflects the individual's level of public exposure, considering the relevance and scope of the different associated signals. For interpretation purposes, the higher the influence score, the greater the individual's public visibility and the potential reach of their actions or positions tend to be. The score composition takes into account, among other factors, political participation, and is adjusted according to the type and scope of the office being contested. For more information on business context, applications, and use cases, please refer to the Public Exposure documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.100 |
| 10.001 - 50.000 | BRL 0.096 |
| 50.001 - 100.000 | BRL 0.092 |
| 100.001 - 500.000 | BRL 0.088 |
| 500.001 - 1.000.000 | BRL 0.084 |
| 1.000.001 - 5.000.000 | R$68,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 41. Exposição e Perfil na Mídia
<!-- slug: pessoas-exposicao-e-perfil-na-midia | dataset: media_profile_and_exposure | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-exposicao-e-perfil-na-midia
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `media_profile_and_exposure`

**Descrição:** This dataset gathers information about individuals' public exposure in open media sources, including associated journalistic content, aggregated visibility indicators, and the nature of the exposure, as well as sentiment analysis of the identified mentions. The returned news items are associated with the queried entity through inference based on the name identified in the content and, when provided, the keywords submitted in the query. Because the publications do not contain formal identifiers (such as CPF numbers), very common or short names may result in less precise associations or content unrelated to the queried individual. For more information on business context, applications, and use cases, please refer to the Public Exposure documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| keywords | Allows you to restrict the returned content based on specific keywords, separated by commas. |
| keywords_operator | Define the logic for combining the given keywords. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| title | News title | Contains | Any text |
| sourcename | Name of the source responsible for the news | Contains | Any text |
| categories | News category | Contains | Any text |
| label | Sentiment rating assigned to the news story. | Equal | NEGATIVE, POSITIVE, NEUTRAL, UNDEFINED, POLARIZED, SLIGHTLY_POSITIVE, SLIGHTLY_NEGATIVE |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 43. Dados de Sites
<!-- slug: pessoas-dados-de-sites | dataset: domains_extended | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-sites
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `domains_extended`

**Descrição:** This dataset gathers information about websites associated with the consulted entity, considering recurring captures made over the last 24 months to compose a historical overview. The return includes aggregated data on the number of websites identified, the diversity of domains associated with the entity, and the association of different entities with the same domain. It is important to note that the dataset returns websites, not domains: a domain can contain multiple websites, just as a website can be distributed across more than one domain. For more information on business context, applications, and use cases, please refer to the Digital Presence documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| hasssl | Indicates whether the website uses SSL. |
| isactive | Indicates whether the site is active. |
| socialnetworks | Social networks associated with the website |
| ispname | Hosting Provider |
| paymentmethods | Identified payment methods |
| paymentservices | Payment services used |
| framework | Framework or platform used o |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| hasssl | Indicates whether the website uses SSL. | Equal | true, false |
| isactive | Indicates whether the site is active. | Equal | true, false |
| socialnetworks | Social networks associated with the website | Contains | facebook, twitter, linkedin, etc. |
| ispname | Hosting Provider | Equal | Provider name, such as AMAZON |
| paymentmethods | Identified payment methods | Contains | credit card, invoice, etc. |
| paymentservices | Payment services used | Contains | paypal, pagseguro, etc. |
| framework | Framework or platform used on the website | Equal | Platform name |
| visitor range | Estimated range of monthly visitors. | Equal | Access range per month |
| domainclass | Domain class | Equal | PORTAL, BLOG, ECOMMERCE, CORPORATE, GOVERNMENT, NEWS, EDUCATIONAL |
| IsRegisteredInWhoIsData | Indicates whether the site is registered in the name of the entity | Equal | true, false |
| TIME | STATUS | USER AGEN |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 47. Dados de Distribuição de Processos Judiciais Familiares
<!-- slug: pessoas-dados-de-distribuicao-de-processos-judiciais-familiares | dataset: family_lawsuits_distribution_data | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-de-distribuicao-de-processos-judiciais-familiares
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `family_lawsuits_distribution_data`

**Descrição:** This dataset provides aggregated data on legal proceedings involving first-degree relatives of the person being consulted. The result consolidates distribution indicators based on the main fields of the Legal Proceedings dataset, allowing for a summary view of the family's legal history for quick analysis, without the need to individually evaluate each identified proceeding. For more information on business context, applications, and use cases, please refer to the Legal Proceedings documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.100 |
| 10.001 - 50.000 | BRL 0.096 |
| 50.001 - 100.000 | BRL 0.092 |
| 100.001 - 500.000 | BRL 0.088 |
| 500.001 - 1.000.000 | BRL 0.084 |
| 1.000.001 - 5.000.000 | R$68,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| capturedate | Process capture date |
| closedate | Process closing date |
| cnjsubject | Case number or subject name in the CNJ (National Council of Justice) |
| cnjproceduretype | Case number or type name in the CNJ (National Council of Justice). |
| courtlevel | Court level |
| courtname | Court name |
| courttype | Court type |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| capturedate | Process capture date | Between | [yyyy-MM-dd, yyyy-MM-dd] |
| closedate | Process closing date | Between | [yyyy-MM-dd, yyyy-MM-dd] |
| cnjsubject | Case number or subject name in the CNJ (National Council of Justice) | Equal | Number or text |
| cnjproceduretype | Case number or type name in the CNJ (National Council of Justice). | Equal | Number or text |
| courtlevel | Court level | Equal | 1, 2, 3 |
| courtname | Court name | Equal | List of courts |
| courttype | Court type | Equal | Civil, Criminal, Tax, Social Security, Labor, Electoral, among others. |
| partypolarity | Polarity of the party in the process | Equal | ACTIVE, PASSIVE, NEUTRAL |
| partytype | Type of participation of the entity in the process | Equal | AUTHOR, DEFENDANT, LAWYER, JUDGE, INMATE, among others |
| noticed | Process notification date | Between | [yyyy-MM-dd, yyyy-MM-dd] |
| state | Status of the process | Equal | UF |
| status | Process status | Contains | ACTIVE, ARCHIVED, CLOSED, UNDER APPEAL, FINAL JUDGMENT, among others |
| resjudicatadate | Date of final judgment | Between | [yyyy-MM-dd, yyyy-MM-dd] |
| value | Value discussed in the process | Between | [minimum, maximum] |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 49. Dados Profissionais
<!-- slug: pessoas-dados-profissionais | dataset: occupation_data | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-dados-profissionais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `occupation_data`

**Descrição:** This dataset returns aggregated and historical information about the professional activity of the person consulted. The return consolidates current and past work relationships, including records of formal employment and indications of informal professional activity, such as self-employment or service provision. The data is suitable for analyzing professional profiles, employment history, and evaluating a person's career path. For more information on business context, applications, and use cases, please refer to the Professionals documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| sector | Employer's sector |
| companyname | Company or entity name |
| area | Area of ​​operation within the company |
| level | Job title, function or position held |
| status | Employment status |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| sector | Employer's sector | Equal | PRIVATE, PUBLIC |
| companyname | Company or entity name | Contains | Full or partial name |
| area | Area of ​​operation within the company | Contains | Marketing, Finance, Technology, among others. |
| level | Job title, function or position held | Contains | Any job description |
| status | Employment status | Equal | ACTIVE, INACTIVE |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 51. Licenças e Autorizações
<!-- slug: pessoas-licencas-e-autorizacoes | dataset: licenses_and_authorizations | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-licencas-e-autorizacoes
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `licenses_and_authorizations`

**Descrição:** This dataset returns information about licenses and authorizations associated with the consulted individual, generally linked to the exercise of regulated economic activities, especially in the context of self-employment. The return includes records issued by official bodies, when available, and may not contain data for CPF numbers (Brazilian individual taxpayer registration numbers) that do not have regulatory requirements associated with their professional activity. For more information on business context, applications, and use cases, please refer to the Professionals documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| licensetype | Type of license or authorization |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| licensetype | Type of license or authorization | Equal | ANTT, CADASTUR |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 54. Turnover Profissional
<!-- slug: pessoas-turnover-profissional | dataset: professional_turnover | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-turnover-profissional
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `professional_turnover`

**Descrição:** This dataset consolidates aggregated indicators on the professional turnover of the person surveyed, considering the frequency, duration, and variation of employment relationships over time. The feedback provides a summarized and analytical view of the history of professional changes, allowing for the evaluation of patterns of stability or high turnover without the need to individually analyze each identified employment relationship. For more information on business context, applications, and use cases, please refer to the Professionals documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 57. Risco Financeiro Familiar
<!-- slug: pessoas-risco-financeiro-familiar | dataset: family_financial_risk | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-risco-financeiro-familiar
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `family_financial_risk`

**Descrição:** This dataset consolidates financial, professional, and debt exposure indicators for the immediate family members of the person being surveyed, allowing for a broader view of financial risk within the family context. The analysis considers not only the individual but also information related to parents, spouse, and children, reflecting the impact of the family's financial situation on the consolidated risk score. For more information on business context, applications, and use cases, please refer to the Risk documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.180 |
| 10.001 - 50.000 | R$ 0.170 |
| 50.001 - 100.000 | BRL 0.162 |
| 100.001 - 500.000 | BRL 0.154 |
| 500.001 - 1.000.000 | BRL 0.146 |
| 1.000.001 - 5.000.000 | R$ 122,000.00 (fixed price) |
| 5,000,001 and above | Contact |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 61. Veículos Associados à Pessoa
<!-- slug: pessoas-veiculos-associados-a-pessoa | dataset: vehicles | endpoint: POST /pessoas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/pessoas-veiculos-associados-a-pessoa
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/pessoas`
**Dataset técnico:** `vehicles`

**Descrição:** This dataset returns information about vehicles associated with the person being searched, including cars, motorcycles, trucks, and other types. The links between individuals and vehicles are mostly inferred from advertisements published on online buying and selling portals and do not necessarily imply ownership of the vehicle by the individual. In many cases, the records represent vehicles that the person has already sold, is advertising to third parties, or simply brokered the transaction for. For more information on business context, applications, and use cases, please refer to the Vehicles documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| Model | vehicle model |
| Category | Vehicle category |
| FuelType | Type of fuel |
| Brand | vehicle make |
| FipeCode | Vehicle code in the FIPE table |
| ModelYear | Vehicle model year |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Model | vehicle model | Contains | Any keyword related to the model. |
| Category | Vehicle category | Equal | Values ​​defined in the category table. |
| FuelType | Type of fuel | Equal | GASOLINE, ALCOHOL, DIESEL, FLEX, etc. |
| Brand | vehicle make | Contains | Any brand keyword |
| FipeCode | Vehicle code in the FIPE table | Equal | Any valid FIPE code |
| ModelYear | Vehicle model year | Equal | 1997, 2006, 2019, etc. |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 62. Propriedades Industriais
<!-- slug: empresas-propriedades-industriais | dataset: industrial_property | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-propriedades-industriais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `industrial_property`

**Descrição:** This dataset gathers information about trademarks and patents associated with the consulted CNPJ (Brazilian taxpayer ID), returning consolidated and detailed data on industrial properties, including indicators of quantity, geographic scope, and registration history. For more information on business context, applications, and use cases, please refer to the Assets documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 63. Propriedades Industriais de Funcionários
<!-- slug: empresas-propriedades-industriais-de-funcionarios | dataset: employees_industrial_property | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-propriedades-industriais-de-funcionarios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `employees_industrial_property`

**Descrição:** This dataset gathers information about trademarks and patents associated with employees linked to the company being consulted, returning consolidated and detailed data on industrial property per employee, including indicators of quantity, geographic scope, and registration history. For more information on business context, applications, and use cases, please refer to the Assets documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.730 |
| 10.001 - 50.000 | BRL 0.694 |
| 50.001 - 100.000 | BRL 0.659 |
| 100.001 - 500.000 | BRL 0.626 |
| 500.001 - 1.000.000 | BRL 0.595 |
| 1.000.001 - 5.000.000 | BRL 496,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 64. Propriedades Industriais de Sócios
<!-- slug: empresas-propriedades-industriais-de-socios | dataset: owners_industrial_property | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-propriedades-industriais-de-socios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `owners_industrial_property`

**Descrição:** This dataset gathers information about trademarks and patents associated with partners linked to the company being consulted, returning consolidated and detailed data on industrial properties per partner, including indicators of quantity, geographic scope, and registration history. For more information on business context, applications, and use cases, please refer to the Assets documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.162 |
| 10.001 - 50.000 | BRL 0.154 |
| 50.001 - 100.000 | BRL 0.146 |
| 100.001 - 500.000 | BRL 0.139 |
| 500.001 - 1.000.000 | BRL 0.132 |
| 1.000.001 - 5.000.000 | BRL 109,400.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 69. Dados de Registro
<!-- slug: empresas-dados-de-registro | dataset: registration_data | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-registro
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `registration_data`

**Descrição:** This dataset compiles registration and contact information associated with the company being consulted, with data typically required in registration, validation, and business relationship processes. The return includes basic identification and status information of the company, as well as records of emails, phone numbers, and addresses available from the sources. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.120 |
| 10.001 - 50.000 | BRL 0.114 |
| 50.001 - 100.000 | BRL 0.108 |
| 100.001 - 500.000 | BRL 0.103 |
| 500.001 - 1.000.000 | BRL 0.098 |
| 1.000.001 - 5.000.000 | BRL 79,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 70. E-mails
<!-- slug: empresas-e-mails | dataset: emails_extended | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-e-mails
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `emails_extended`

**Descrição:** This dataset gathers information on emails associated with the company being consulted, including individual characteristics of each address and aggregated indicators about the set of identified emails. The results allow for the evaluation of attributes such as email type, validation status, recency, priority, and volume of occurrences, supporting contact analysis, database quality, risk assessment, and data modeling. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| e-mail | Allows you to provide an additional email address for analysis of global address information, regardless of direct association with the CNPJ (Brazilian company tax ID) consulted. |
| returnonlydifferentemails | This specifies that only email addresses different from those specified in the query should be returned. |
| returnonlyvalidemails | It specifies that only emails with a validation status considered valid should be returned. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Type | Email type | Equal | corporate, personal |
| isactive | Indicates whether the email is active. | Equal | true, false |
| isrecent | Indicates whether the email is recent. | Equal | true, false |
| ismain | Indicates whether the email is the primary one. | Equal | true, false |
| validationstatus | Email validation status | Equal | VALID, ACCEPT_ALL, UNKNOWN, POSSIBLE_SPAM_TRAP, INVALID, HARDBOUNCE, RISKY, ACCEPT |
| domain | Email domain | Equal | gmail.com, yahoo.com.br, ... |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 71. E-mails de Pessoas Relacionadas
<!-- slug: empresas-e-mails-de-pessoas-relacionadas | dataset: related_people_emails | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-e-mails-de-pessoas-relacionadas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `related_people_emails`

**Descrição:** This dataset compiles emails associated with individuals related to the company being consulted, considering links such as partners, administrators, employees, and other types of relationships identified in the people and companies graph. The result includes a list of emails linked to these individuals, along with attributes describing the type of relationship, email characteristics, validation status, recency, and priority, supporting contact, relationship, and risk analyses. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| relationshiptype | Type of relationship the person has with the company. |
| type | Email type |
| isactive | Indicates whether the email is active. |
| isrecent | Indicates whether the email is recent. |
| ismain | Indicates whether the email is the primary one. |
| validationstatus | Email validation status |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| relationshiptype | Type of relationship the person has with the company. | Equal | QSA, Ownership, Employee, Legal Representative |
| type | Email type | Equal | corporate, personal |
| isactive | Indicates whether the email is active. | Equal | true, false |
| isrecent | Indicates whether the email is recent. | Equal | true, false |
| ismain | Indicates whether the email is the primary one. | Equal | true, false |
| validationstatus | Email validation status | Equal | VALID, ACCEPT_ALL, UNKNOWN, POSSIBLE_SPAM_TRAP, INVALID, HARDBOUNCE, RISKY, ACCEPT |
| domain | Email domain | Equal | gmail.com, yahoo.com.br, ... |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 72. Telefones
<!-- slug: empresas-telefones | dataset: phones_extended | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-telefones
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `phones_extended`

**Descrição:** This dataset returns addresses associated with the queried company, including aggregated information and indicators that aid in contact analysis, recency, and relevance. Addresses can be unified using the building code (BuildCode), allowing for the consolidation of similar records and improving the analytical quality of the results. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| zipcode | Used in conjunction with the address number to assist in building the BuildCode and improve the quality of the result. |
| addressnumber | Used in conjunction with CEP to assist in building the BuildCode and improve the quality of the result. |
| useRawRFData | It instructs the system to return the address exactly as captured from the Federal Revenue Service, without corrections or standardizations. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Type | Type of address | Equal | work, home |
| isratified | Indicates whether the address is verified. | Equal | true, false |
| isactive | Indicates whether the address is active. | Equal | true, false |
| isrecent | Indicates whether the address is recent. | Equal | true, false |
| ismain | Indicates whether the address is a primary address. | Equal | true, false |
| state | State acronym | Equal | RJ, SP, MG, ES... |
| zipcode | Address zip code | Starts with | Any complete postal code or the first x digits. |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 73. Telefones de Pessoas Relacionadas
<!-- slug: empresas-telefones-de-pessoas-relacionadas | dataset: related_people_phones | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-telefones-de-pessoas-relacionadas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `related_people_phones`

**Descrição:** A dataset that gathers phone numbers associated with individuals related to the consulted entity, regardless of any direct link to the entity itself, allowing for broader contact analysis based on corporate, functional, or administrative relationships. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| relationshiptype | Type of relationship between the person and the entity. |
| type | phone type |
| isactive | Indicates whether the phone is active. |
| isrecent | Indicates whether the phone is recent. |
| ismain | Indicates whether the phone is the primary phone. |
| isindonotcalllist | Indicates whether the phone number is listed by PROCON. |
| areacode | Te |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| relationshiptype | Type of relationship between the person and the entity. | Equal | QSA, Ownership, Employee, Legal Representative |
| type | phone type | Contains | mobile, work, home |
| isactive | Indicates whether the phone is active. | Equal | true, false |
| isrecent | Indicates whether the phone is recent. | Equal | true, false |
| ismain | Indicates whether the phone is the primary phone. | Equal | true, false |
| isindonotcalllist | Indicates whether the phone number is listed by PROCON. | Equal | true, false |
| areacode | Telephone area code | Equal | 11, 21, 61, ... |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 74. Endereços
<!-- slug: empresas-enderecos | dataset: addresses_extended | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-enderecos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `addresses_extended`

**Descrição:** This dataset compiles addresses associated with the consulted company, including aggregated information and attributes that describe address characteristics such as recency, priority, activity status, and type of affiliation. The result considers the consolidation of similar addresses through building code identifiers, allowing for more consistent analyses and reducing duplication in data modeling and enrichment scenarios. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| zipcode | Used in conjunction with the address number to assist in constructing the building code, increasing the quality of the result. |
| addressnumber | Used in conjunction with the postal code to assist in constructing the building code identifier, increasing the quality of the result. |
| useRawRFData | It instructs the system to return the address exactly as captured from the Federal Revenue Service, without standardization or automatic corrections. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| Type | Type of address | Equal | work, home |
| isratified | Indicates whether the address is verified. | Equal | true, false |
| isactive | Indicates whether the address is active. | Equal | true, false |
| isrecent | Indicates whether the address is recent. | Equal | true, false |
| ismain | Indicates whether the address is a primary address. | Equal | true, false |
| state | Abbreviation of the federative unit | Equal | RJ, SP, MG, ES, ... |
| zipcode | Address zip code | Starts with | Full postal code or first digits |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 75. Endereços de Pessoas Relacionadas
<!-- slug: empresas-enderecos-de-pessoas-relacionadas | dataset: related_people_addresses | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-enderecos-de-pessoas-relacionadas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `related_people_addresses`

**Descrição:** This dataset returns addresses associated with individuals related to the queried company, regardless of whether the address is directly linked to the company's tax ID (CNPJ). The return includes a list of identified addresses, attributes describing each address, and the type of relationship of the associated individual. For more information on business context, applications, and use cases, please refer to the Contacts documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| relationshiptype | Type of relationship |
| type | Type of address |
| isratified | Indicates whether the address is verified. |
| isactive | Indicates whether the address is active. |
| isrecent | Indicates whether the address is recent. |
| ismain | Indicates whether the address is a primary address. |
| state | State acronym |
| zipcode | Address zip |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| relationshiptype | Type of relationship | Equal | QSA, Ownership, Employee, Legal Representative |
| type | Type of address | Contains | work, home |
| isratified | Indicates whether the address is verified. | Equal | true, false |
| isactive | Indicates whether the address is active. | Equal | true, false |
| isrecent | Indicates whether the address is recent. | Equal | true, false |
| ismain | Indicates whether the address is a primary address. | Equal | true, false |
| state | State acronym | Equal | RJ, SP, MG, ES... |
| zipcode | Address zip code | Starts with | Any complete postal code or the first x digits. |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 82. Doações Eleitorais
<!-- slug: empresas-doacoes-eleitorais | dataset: electoral_donors | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-doacoes-eleitorais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `electoral_donors`

**Descrição:** This dataset compiles information on donations made to election campaigns by the consulted entity, including individual donation records and aggregate indicators related to the quantity and total value donated, allowing for analyses of political involvement and associations between entities and political agents throughout the considered election cycles. For more information on business context, applications, and use cases, please refer to the Political Engagement documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 83. Doações Eleitorais de Sócios
<!-- slug: empresas-doacoes-eleitorais-de-socios | dataset: owners_electoral_donors | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-doacoes-eleitorais-de-socios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `owners_electoral_donors`

**Descrição:** This dataset gathers information on donations made to election campaigns by members linked to the consulted CNPJ (Brazilian tax ID), including individual donation records and aggregate indicators related to the quantity and total value donated, allowing for analyses of indirect political involvement and associations between entities, members, and political agents. For more information on business context, applications, and use cases, please refer to the Political Engagement documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.162 |
| 10.001 - 50.000 | BRL 0.154 |
| 50.001 - 100.000 | BRL 0.146 |
| 100.001 - 500.000 | BRL 0.139 |
| 500.001 - 1.000.000 | BRL 0.132 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 84. Prestadores de Serviços Eleitorais
<!-- slug: empresas-prestadores-de-servicos-eleitorais | dataset: electoral_providers | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-prestadores-de-servicos-eleitorais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `electoral_providers`

**Descrição:** Dataset que reúne informações sobre contratos e licitações firmados por políticos e partidos com prestadores de serviços eleitorais, incluindo registros de fornecimento, valores contratados e vínculos associados às campanhas, permitindo análises de relacionamento e envolvimento político entre entidades e agentes políticos. Os dados retornados contemplam tanto prestações de serviço realizadas quanto recebidas pela entidade consultada, cuja interpretação depende da comparação entre o nome da entidade consultada e o valor informado no campo PoliticianFullName. For more information on business context, applications, and use cases, please refer to the Political Engagement documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 87. Exposição e Perfil na Mídia
<!-- slug: empresas-exposicao-e-perfil-na-midia | dataset: media_profile_and_exposure | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-exposicao-e-perfil-na-midia
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `media_profile_and_exposure`

**Descrição:** This dataset gathers information about the public exposure of entities in open media sources, including associated journalistic content, aggregated indicators of visibility and the nature of the exposure, as well as sentiment analysis of the identified mentions. The returned news items are associated with the consulted entity through contextual inference based on the name identified in the content and, when provided, on the keywords submitted in the query. Less precise associations may occur in cases of very common or generic names, considering that the publications do not use formal identifiers such as CNPJ (Brazilian tax ID). For more information on business context, applications, and use cases, please refer to the Public Exposure documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| keywords | Allows you to restrict the returned content based on specific keywords, separated by commas. |
| keywords_operator | Define the logic for combining the given keywords. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| title | News title | Contains | Any text |
| sourcename | Name of the source responsible for the news | Contains | Any text |
| categories | News category | Contains | Any text |
| label | Sentiment rating assigned to the news story. | Equal | NEGATIVE, POSITIVE, NEUTRAL, UNDEFINED, POLARIZED, SLIGHTLY_POSITIVE, SLIGHTLY_NEGATIVE |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 88. Influência do Quadro Societário
<!-- slug: empresas-influencia-do-quadro-societario | dataset: owners_influence | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-influencia-do-quadro-societario
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `owners_influence`

**Descrição:** This dataset infers the level of influence of the shareholder structure of the company being consulted, considering in an integrated way aspects such as the exposure and profile of the shareholders in the media, political involvement and history of lawsuits, allowing the evaluation of the potential impact of the company's shareholders in the social and institutional context. For more information on business context, applications, and use cases, please refer to the Public Exposure documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.100 |
| 10.001 - 50.000 | BRL 0.096 |
| 50.001 - 100.000 | BRL 0.092 |
| 100.001 - 500.000 | BRL 0.088 |
| 500.001 - 1.000.000 | BRL 0.084 |
| 1.000.001 - 5.000.000 | R$68,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 89. Anúncios Online
<!-- slug: empresas-anuncios-online | dataset: online_ads | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-anuncios-online
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `online_ads`

**Descrição:** This dataset gathers information about online advertisements associated with the company being consulted, based on the identification of seller profiles on portals and marketplaces focused on buying and selling between individuals. It includes consolidated data from the identified profiles and metrics related to advertising activity, and there may be more than one profile associated with the same company. For more information on business context, applications, and use cases, please refer to the Digital Presence documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| activeads | Minimum number of active ads. |
| totalads | Minimum total number of ads published. |
| admaxvalue | Minimum maximum value among the identified ads. |
| adminvalue | Minimum value among the identified ads. |
| portal | The portal where the ads were published. |
| category | Category associated with published ads. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| activeads | Minimum number of active ads. | Any integer |  |
| totalads | Minimum total number of ads published. | Any integer |  |
| admaxvalue | Minimum maximum value among the identified ads. | Any decimal number |  |
| adminvalue | Minimum value among the identified ads. | Any decimal number |  |
| portal | The portal where the ads were published. | Any portal name |  |
| category | Category associated with published ads. | Any category name |  |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 90. Dados de Sites
<!-- slug: empresas-dados-de-sites | dataset: domains_extended | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-sites
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `domains_extended`

**Descrição:** This dataset gathers historical and aggregated information about websites associated with the consulted entity, considering recurring captures made over time, including metrics on the number of related websites and domains, as well as associations between entities, domains, and, in the case of companies, websites linked to partners. The return considers websites as distinct units, meaning a single domain can contain multiple websites and a single website can be distributed across different domains. For more information on business context, applications, and use cases, please refer to the Digital Presence documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| hasssl | Indicates whether the website has an SSL certificate. |
| isactive | Indicates whether the site is active. |
| ismaindomain | Indicates whether the site belongs to the main domain. |
| socialnetworks | Social media networks associated with the website. |
| ispname | Website hosting provider. |
| paymentmethods | Payment methods identified on the website. |
| paymentservices | Payment services used. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| hasssl | Indicates whether the website has an SSL certificate. | true, false |  |
| isactive | Indicates whether the site is active. | true, false |  |
| ismaindomain | Indicates whether the site belongs to the main domain. | true, false |  |
| socialnetworks | Social media networks associated with the website. | facebook, twitter, linkedin, etc. |  |
| ispname | Website hosting provider. | Provider name |  |
| paymentmethods | Payment methods identified on the website. | credit card, invoice, etc. |  |
| paymentservices | Payment services used. | paypal, pagseguro, etc. |  |
| framework | Framework or platform used on the website. | Platform name |  |
| visitor range | Estimated range of monthly visitors. | Access lane |  |
| domainclass | Domain class associated with the website. | PORTAL, BLOG, ECOMMERCE, CORPORATE, GOVERNMENT, NEWS, EDUCATIONAL |  |
| IsRegisteredInWhoIsData | Indicates whether the website is registered in the entity's name. | true, false |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 91. Marketplaces
<!-- slug: empresas-marketplaces | dataset: marketplace_data | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-marketplaces
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `marketplace_data`

**Descrição:** This dataset gathers information about a company's presence in online marketplaces selling products, considering both aggregate indicators and details of its performance in each individual marketplace where the company was identified. The data reflects the existence of active profiles, product categories sold, and metrics associated with the company's performance in these digital environments. For more information on business context, applications, and use cases, please refer to the Digital Presence documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| marketplace name | Marketplace name identified |
| product category | Category of products sold |
| sellertotalproducts | Total number of products sold on the marketplace |
| seller rating | Seller rating level on the marketplace |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| marketplace name | Marketplace name identified | Equal | Americanas, Submarino, MagazineLuiza, etc. |
| product category | Category of products sold | Contains | Electronics, toys, etc. |
| sellertotalproducts | Total number of products sold on the marketplace | Bigger or equal | Any numeric value |
| seller rating | Seller rating level on the marketplace | Bigger or equal | Any numeric value between 0 and 5 |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 95. Dados de Distribuição de Processos dos Sócios
<!-- slug: empresas-dados-de-distribuicao-de-processos-dos-socios | dataset: owners_lawsuits_distribution_data | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-distribuicao-de-processos-dos-socios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `owners_lawsuits_distribution_data`

**Descrição:** This dataset gathers aggregated data on the distribution of legal proceedings involving the partners of the consulted entity, consolidating indicators derived from the main fields of the Legal Proceedings dataset. The result provides a summary view of the volume and nature of the proceedings associated with the partners, facilitating preliminary analyses without the need to evaluate individual records on a large scale. For more information on business context, applications, and use cases, please refer to the Legal Proceedings documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.100 |
| 10.001 - 50.000 | BRL 0.096 |
| 50.001 - 100.000 | BRL 0.092 |
| 100.001 - 500.000 | BRL 0.088 |
| 500.001 - 1.000.000 | BRL 0.084 |
| 1.000.001 - 5.000.000 | R$68,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| capturedate | Process capture date |
| closedate | Process closing date |
| cnjsubject | Number or name of the subject in the CNJ (National Council of Justice) inferred. |
| cnjproceduretype | Inferred process number or type name in the CNJ (National Council of Justice). |
| courtlevel | Court level |
| courtname | Court name |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| capturedate | Process capture date | Between | [yyyy-MM-dd, yyyy-MM-dd] |
| closedate | Process closing date | Between | [yyyy-MM-dd, yyyy-MM-dd] |
| cnjsubject | Number or name of the subject in the CNJ (National Council of Justice) inferred. | Equal | Number or text |
| cnjproceduretype | Inferred process number or type name in the CNJ (National Council of Justice). | Equal | Number or text |
| courtlevel | Court level | Equal | 1, 2, 3 |
| courtname | Court name | Equal | STF, STJ, TRF1, JFAC, JFAM, JFAP, JFBA, JFDF, JFGO, JFMA, JFMG, JFMT, JFPA, JFPI, JFRO, JFRR, JFTO, TRF2, JFES, JFRJ, TRF3, JFMS, JFSP, TRF4, JFPR, JFRS, JFSC, TRF5, JFAL, JFCE, JFPB, JFPE, JFRN, JFSE, TRF6, TJAC, TJAL, TJAM, TJAP, TJBA, TJCE, TJDF, TJES, TJGO, TJMA, TJMG, TJMS, TJMT, TJPA, TJPB, TJPE, TJPI, TJPR, TJRJ, TJRN, TJRO, TJRR, TJRS, TJSC, TJSE, TJSP, TJTO, TRT1, TRT2, TRT3, TRT4, TRT5, TRT6, TRT7, TRT8, TRT9, TRT10, TRT11, TRT12, TRT13, TRT14, TRT15, ​​TRT16, TRT17, TRT18, TRT19, TRT20, TRT21, TRT22, TRT23, TRT24, TST, TRE-AC, TRE-AL, TRE-AM, TRE-AP, TRE-BA, TRE-CE, TRE-DF, TRE-ES, TRE-GO, TRE-MA, TRE-MG, TRE-MS, TRE-MT, TRE-PA, TRE-PB, TRE-PE, TRE-PI, TRE-PR, TRE-RJ, TRE-RN, TRE-RO, TRE-RR, TRE- |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 97. Relacionamentos do Grupo Econômico
<!-- slug: empresas-relacionamentos-do-grupo-economico | dataset: economic_group_relationships | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-relacionamentos-do-grupo-economico
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `economic_group_relationships`

**Descrição:** This dataset returns information about entities—individuals and companies—that are part of the same economic group as the consulted entity, considering exclusively corporate ties. The return includes direct and indirect relationships that make up the structure of the economic group, and may result in large volumes of data due to the corporate complexity involved. When the Federal Revenue Service does not have information about the shareholding structure of the subsidiary being consulted, the relationships are built from the shareholding structure of the parent company . For more information on business context, applications, and use cases, see the Relationships documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| group_level | It defines the level of the economic group up to which relationships should be considered. Level 1 corresponds to direct relationships. |
| extended | Indicates whether the extended economic group should be returned, including relatives and companies associated with the people in the group. |
| group_search_limit | It limits the maximum number of relationships returned, directly impacting query performance. |
| useHeadQuartersData | Indicates whether relationships should be built from the matrix document. |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| RelatedEntityTaxIdType | Type of document from the related entity | Equal | CPF, CNPJ |
| RelationshipLevel | Level of relationship within the economic group | Equal | 1st-LEVEL, 2nd-LEVEL, 3rd-LEVEL, etc. |
| RelationshipType | Type of corporate relationship | Equal | QSA, Ownership, Employee, Legal Representative |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 99. Avaliações e Reputação
<!-- slug: empresas-avaliacoes-e-reputacao | dataset: reputations_and_reviews | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-avaliacoes-e-reputacao
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `reputations_and_reviews`

**Descrição:** This dataset gathers information about a company's reputation across various service review platforms, presenting indicators by source, a consolidated view of its reputation, and a historical overview of its evolution over time. This data supports risk analysis, company valuation, and can be used as input in analytical and statistical models. For more information on business context, applications, and use cases, please refer to the Reputation documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 100. Prêmios e Certificações
<!-- slug: empresas-premios-e-certificacoes | dataset: awards_and_certifications | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-premios-e-certificacoes
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `awards_and_certifications`

**Descrição:** This dataset gathers aggregated and detailed information about awards and certifications obtained by the consulted entity, encompassing recognition from different spheres of activity, such as governmental, academic, private, national or international awards, as well as professional, technical, security or compliance certifications. The data allows for the evaluation of institutional recognition, reputational positioning, and formal attributes associated with the entity's performance. For more information on business context, applications, and use cases, please refer to the Reputation documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Field | Filter description |
| award name | prize name |
| awardingorganizationname | Name of the organization that awarded the prize. |
| certification name | certification name |
| certifying entity | Name of the certifying entity |
| certification status | Certification status |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| award name | prize name | Contains | Any name or part of the name of the award. |
| awardingorganizationname | Name of the organization that awarded the prize. | Equal | Name of the granting entity |
| certification name | certification name | Contains | Any name or part of the name of the certification |
| certifying entity | Name of the certifying entity | Equal | Name of the certifying entity |
| certification status | Certification status | Equal | Any possible status |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 102. Devedores do Governo
<!-- slug: empresas-devedores-do-governo | dataset: government_debtors | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-devedores-do-governo
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `government_debtors`

**Descrição:** This dataset compiles information on taxpayers registered as principal debtors in outstanding debts to the Federal Government and the FGTS (Brazilian Severance Indemnity Fund), according to the most recent records made available by the Attorney General's Office of the National Treasury (PGFN). The return details the outstanding debts associated with the consulted entity, serving as a more agile alternative to on-demand certificate requests, with the caveat that, since it is periodic data, the information may not reflect very recent updates. For more information on business context, applications, and use cases, please refer to the Risk documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 103. Dados de Fundos de Investimento
<!-- slug: empresas-dados-de-fundos-de-investimento | dataset: investment_fund_data | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-fundos-de-investimento
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `investment_fund_data`

**Descrição:** This dataset compiles registration and operational information on investment funds associated with the consulted entity, according to records available from the Brazilian Securities and Exchange Commission (CVM). The return includes basic fund data and consolidated transaction information, when available, allowing for sectoral analyses related to the company's performance in the investment market. For more information on business context, applications, and use cases, please refer to the Sectoral documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| all | This determines whether all captured transactions for the CNPJ (Brazilian tax ID) should be returned, potentially directly impacting the volume and performance of the response. |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 104. Dados de Obras Civis
<!-- slug: empresas-dados-de-obras-civis | dataset: civil_construction_data | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-dados-de-obras-civis
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `civil_construction_data`

**Descrição:** This dataset compiles registration information on construction projects linked to the consulted entity, based on records available in the National Construction Project Registry (CNO). The results include essential data for identifying and monitoring the projects, such as the CNO number, address, constructed area, and registration status, supporting sectoral analyses and compliance with regulatory and tax obligations. For more information on business context, applications, and use cases, please refer to the Sectoral documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 105. Mercado Financeiro
<!-- slug: empresas-mercado-financeiro | dataset: financial_market | endpoint: POST /empresas -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/empresas-mercado-financeiro
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/empresas`
**Dataset técnico:** `financial_market`

**Descrição:** This dataset gathers financial and corporate information on publicly traded companies, based on public data provided by regulatory bodies and capital market entities. The results include information such as balance sheet, financial performance, main shareholders, and shareholding structure. The absence of results indicates that the company consulted does not have shares traded on the stock exchange. For more information on business context, applications, and use cases, please refer to the Sectoral documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 106. Ficha Técnica
<!-- slug: produtos-ficha-tecnica | dataset: extra_info_data | endpoint: POST /produtos -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/produtos-ficha-tecnica
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/produtos`
**Dataset técnico:** `extra_info_data`

**Descrição:** A dataset that gathers technical and supplementary information associated with products, organized in a hierarchical structure that consolidates general item data and specific details by capture source. The return may include primary and alternative identifiers, as well as technical characteristics, physical specifications, nutritional information, active ingredients, editorial data, or other relevant attributes, depending on the product type and availability from the sources. For more information on business context, applications, and use cases, please refer to the Basic Data documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| isbn | International Standard Book Number |
| brand | Product brand |
| category | Product category |
| search terms | Keyword search terms |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 107. Imagens do Produto
<!-- slug: produtos-imagens-do-produto | dataset: images_data | endpoint: POST /produtos -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/produtos-imagens-do-produto
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/produtos`
**Dataset técnico:** `images_data`

**Descrição:** This dataset gathers information about current and historical images associated with products, captured from multiple sources. The output is structured hierarchically, consolidating general product data, aggregated indicators of image availability by source, and historical details of captures made, including volume and recurrence over time. For more information on business context, applications, and use cases, please refer to the Basic Data documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| isbn | International Standard Book Number |
| brand | Product brand |
| category | Product category |
| search terms | Keyword search terms |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 108. Produtos Relacionados
<!-- slug: produtos-produtos-relacionados | dataset: related_product_data | endpoint: POST /produtos -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/produtos-produtos-relacionados
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/produtos`
**Dataset técnico:** `related_product_data`

**Descrição:** This dataset gathers information about products related to the searched item, based on the identification of associations observed in different data sources. The return consolidates indicators by source, such as the total volume of related products and the number of items belonging to the same category, in addition to detailing the types of relationships identified, such as recommended products, products also viewed, or products also purchased. For more information on business context, applications, and use cases, see the Relationships documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| isbn | International Standard Book Number |
| brand | Product brand |
| category | Product category |
| search terms | Keyword search terms |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 109. Notas e avaliações
<!-- slug: produtos-notas-e-avaliacoes | dataset: review_data | endpoint: POST /produtos -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/produtos-notas-e-avaliacoes
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/produtos`
**Dataset técnico:** `review_data`

**Descrição:** This dataset gathers information about ratings and reviews associated with the product being consulted, based on consolidated reviews captured from different sources. The result presents aggregated indicators, such as volume of reviews, best and worst ratings, variations over time, and review content, in addition to consolidated and detailed metrics by source, allowing for historical and comparative analysis of the product's reputation. For more information on business context, applications, and use cases, please refer to the Reputation documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| isbn | International Standard Book Number |
| brand | Product brand |
| category | Product category |
| search terms | Keyword search terms |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 110. Estatísticas de Empresas
<!-- slug: enderecos-estatisticas-de-empresas | dataset: companies_statistics | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-estatisticas-de-empresas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `companies_statistics`

**Descrição:** This dataset returns aggregated statistics on companies associated with a specific geographic region, based on a given address or postal code. The return consolidates indicators such as the number of active and inactive companies, total number of employees, aggregate revenue, declared share capital, and analytical distributions across different economic and registration dimensions. For more information on business context, applications, and use cases, please refer to the Economic Activity documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 111. Dados de Empresas nas Proximidades
<!-- slug: enderecos-dados-de-empresas-nas-proximidades | dataset: companies_data | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-dados-de-empresas-nas-proximidades
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `companies_data`

**Descrição:** This dataset returns a list of companies located near a specified geographic region, considering latitude and longitude coordinates, search radius, and additional filtering criteria. The return includes basic information about the companies found and aggregated indicators for the region consulted, allowing for territorial, sectoral, and economic density analyses. For more information on business context, applications, and use cases, please refer to the Economic Activity documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| Data Delivered in the Month | Value per data in returned list |
| 1 - 10.000 | BRL 0.020 |
| 10.001 - 50.000 | BRL 0.019 |
| 50.001 - 100.000 | BRL 0.018 |
| 100.001 - 500.000 | BRL 0.017 |
| 500.001 - 1.000.000 | BRL 0.016 |
| 1.000.001 - 5.000.000 | BRL 14,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| distance | Search radius from the given coordinates |

**Chaves complementares:** _[não encontradas]_

**Filtros**

| Campo | Descrição | Tipo | Valores |
|---|---|---|---|
| economicactivitycodes | Economic activity code | Equal | CNAE Code |
| legalnaturecodes | Code of legal nature | Equal | Code of legal nature |
| namefilter | Filter by company name | Contains | Text |
| employees range | range of number of employees | Equal | ATE 01, 002 TO 005, 006 TO 009, 010 TO 019, 020 TO 049, 050 TO 099, 100 TO 499, >= 500 |
| taxidstatus | Company registration status | Equal | ACTIVE, CANCELLED, INACTIVE, NULL, SUSPENDED and variations |
| TIME | STATUS | USER AGENT |  |

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 112. Municípios
<!-- slug: enderecos-municipios | dataset: counties_map | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-municipios
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `counties_map`

**Descrição:** This dataset returns basic information about Brazilian municipalities within a defined geographic area, based on the identification of overlap between the consulted region and the territorial boundaries of the municipalities. The return includes official identifiers, such as IBGE and SICOR codes, as well as the percentage of overlap of the consulted area in each identified municipality. For more information on business context, applications, and use cases, please refer to the Basic Data documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Allows you to manually define the geographic search area using a longitude/latitude coordinate polygon, used to identify municipalities with overlapping areas. |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 113. Dados de Propriedades Rurais SICAR
<!-- slug: enderecos-dados-de-propriedades-rurais-sicar | dataset: sicar_property_data | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-dados-de-propriedades-rurais-sicar
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `sicar_property_data`

**Descrição:** This dataset returns data on rural properties registered in the Rural Environmental Registry System (SICAR), based on the CAR (Rural Environmental Registry) number provided. The CAR is a national, mandatory, electronic public registry for rural properties that compiles declared environmental information about the property or possession, including permanent preservation areas (APP), restricted use areas, legal reserves, remnants of native vegetation, and consolidated areas. For more information on business context, applications, and use cases, please refer to the Rural Properties documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10000 | BRL 0.100 |
| 10.001 - 50.000 | BRL 0.095 |
| 50.001 - 100.000 | BRL 0.090 |
| 100.001 - 500.000 | BRL 0.085 |
| 500.001 - 1.000.000 | BRL 0.081 |
| 1.000.001 - 5.000.000 | BRL 0.077 |
| 5.000.001 - 10.000.000 | BRL 0.073 |
| 10.000.001 - 50.000.000 | BRL 0.069 |
| 50,000,001 and above | BRL 0.066 |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 114. Amazônia Legal
<!-- slug: enderecos-amazonia-legal | dataset: legal_amazon | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-amazonia-legal
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `legal_amazon`

**Descrição:** This dataset identifies whether a given address or geographic area is located within, crosses, or is near the Legal Amazon region, according to the current geopolitical delimitation. The data provided supports risk analysis, environmental compliance, and validation of economic or contractual activities subject to territorial and environmental restrictions. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| latitude + longitude | Coordinates of the lookout point (must be provided together) |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 115. Áreas de Proteção Ambiental
<!-- slug: enderecos-areas-de-protecao-ambiental | dataset: environmental_preservation_areas | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-areas-de-protecao-ambiental
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `environmental_preservation_areas`

**Descrição:** This dataset returns information about environmental protection areas located within, overlapping, or near the consulted geographic area, indicating the existence and spatial relationship between the reported location and officially protected areas. For more information on business context, applications, and use cases, please refer to the documentation. Environmental and Cultural Protection. Technical name of the dataset: environmental_preservation_areas.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| latitude + longitude | Coordinates of the lookout point (must be provided together) |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 116. Biomas
<!-- slug: enderecos-biomas | dataset: biomes_data | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-biomas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `biomes_data`

**Descrição:** Dataset que identifica o bioma ao qual um endereço, ponto geográfico ou área consultada pertence, bem como indicadores de presença ou proximidade de biomas relevantes em relação à localização informada. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| state | Unidade federativa utilizada para delimitação territorial |
| city | Nome da cidade utilizada na consulta |
| cities | Lista de cidades para análise conjunta |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 117. Consulta de Áreas Embargadas ICMBio
<!-- slug: enderecos-consulta-de-areas-embargadas-icmbio | dataset: embargoed_areas | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-consulta-de-areas-embargadas-icmbio
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `embargoed_areas`

**Descrição:** Dataset que identifica se uma área geográfica informada encontra-se dentro, cruza ou está próxima de áreas embargadas por órgãos ambientais, indicando a existência de sanções administrativas aplicadas para proteção e recuperação ambiental. O retorno apoia análises de risco, compliance ambiental e validação de atividades econômicas ou contratuais sujeitas a restrições ambientais. For more information on business context, applications, and use cases, please refer to the documentation. Environmental and Cultural Protection. Technical name of the dataset: embargoed_areas.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| latitude + longitude | Coordinates of the lookout point (must be provided together) |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 118. Consulta de Reservas Legais SICAR
<!-- slug: enderecos-consulta-de-reservas-legais-sicar | dataset: legal_reserve | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-consulta-de-reservas-legais-sicar
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `legal_reserve`

**Descrição:** Dataset que identifica se uma área geográfica informada encontra-se dentro, cruza ou está próxima de áreas classificadas como Reserva Legal, conforme registros do Cadastro Ambiental Rural (CAR). O retorno apoia análises de risco, compliance ambiental e validação de atividades econômicas ou contratuais sujeitas a restrições de uso sustentável do território. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 119. Sítios Arqueológicos
<!-- slug: enderecos-sitios-arqueologicos | dataset: archaeological_sites | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-sitios-arqueologicos
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `archaeological_sites`

**Descrição:** Dataset que identifica a existência de sítios arqueológicos associados a uma área geográfica informada, indicando a presença, cruzamento ou proximidade desses sítios em relação à área analisada. O retorno apoia análises de risco, compliance regulatório e validação de atividades sujeitas a restrições de preservação do patrimônio histórico e cultural. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| latitude + longitude | Coordinates of the lookout point (must be provided together) |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 120. Terras Indígenas
<!-- slug: enderecos-terras-indigenas | dataset: indigenous_lands_data | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-terras-indigenas
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `indigenous_lands_data`

**Descrição:** This dataset identifies the proximity, intersection, or insertion of an address, point, or geographic area in relation to Indigenous lands, returning information associated with Indigenous lands related to the analyzed area. The data provided supports risk analysis, territorial compliance, and validation of activities subject to legal and socio-environmental restrictions. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| latitude + longitude | Coordinates of the lookout point (must be provided |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 121. Unidades de Conservação
<!-- slug: enderecos-unidades-de-conservacao | dataset: conservation_units | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-unidades-de-conservacao
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `conservation_units`

**Descrição:** This dataset identifies the proximity, intersection, or insertion of an address, point, or geographic area in relation to conservation units, returning information associated with the units related to the analyzed area. The data provided supports risk analyses, environmental compliance, and validation of activities subject to legal and territorial restrictions. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| polygon | Geographic polygon used to delimit the area of ​​analysis. |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| latitude + longitude | Coordinates of the lookout point (must be provided together) |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 122. Zoneamento Agroecológico
<!-- slug: enderecos-zoneamento-agroecologico | dataset: sugarcane_agroecological_zoning | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-zoneamento-agroecologico
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `sugarcane_agroecological_zoning`

**Descrição:** Dataset que retorna informações sobre o zoneamento agroecológico da região consultada, incluindo indicações de aptidão e restrições para diferentes usos agropecuários, como cultivo agrícola, pastagem e pecuária, conforme os dados oficiais disponíveis para a área analisada. For more information on business context, applications, and use cases, please refer to the Environmental and Cultural Protection documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.090 |
| 10.001 - 50.000 | BRL 0.085 |
| 50.001 - 100.000 | BRL 0.081 |
| 100.001 - 500.000 | BRL 0.077 |
| 500.001 - 1.000.000 | BRL 0.073 |
| 1.000.001 - 5.000.000 | BRL 61,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| householdcode | Geographic residence identifier |
| building code | Geographic identifier for a building. |
| state | Unidade federativa utilizada como referência geográfica |
| cities | Lista de municípios utilizados na consulta |
| city | Município utilizado como referência geográfica |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 123. Endereços em Área de Risco
<!-- slug: enderecos-enderecos-em-area-de-risco | dataset: address_risk | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-enderecos-em-area-de-risco
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `address_risk`

**Descrição:** This dataset identifies whether a given geographic point is located within or near defined areas that may present a public safety risk, according to official IBGE (Brazilian Institute of Geography and Statistics) data. The results support risk analysis, credit assessment, onboarding, logistics, and other location-sensitive decisions. For more information on business context, applications, and use cases, please refer to the Risk and Public Safety documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.070 |
| 10.001 - 50.000 | BRL 0.066 |
| 50.001 - 100.000 | BRL 0.063 |
| 100.001 - 500.000 | BRL 0.060 |
| 500.001 - 1.000.000 | BRL 0.057 |
| 1.000.001 - 5.000.000 | BRL 46,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| zipcode | Postal code used as a geographic reference for the location consulted. |
| addressnumber | Address number used to refine the location of the queried point. |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 124. Estatísticas Criminais
<!-- slug: enderecos-estatisticas-criminais | dataset: criminal_statistics_data | endpoint: POST /addresses -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/enderecos-estatisticas-criminais
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/addresses`
**Dataset técnico:** `criminal_statistics_data`

**Descrição:** This dataset returns aggregated statistics on criminal occurrences recorded in a given city, including indicators related to crimes such as theft, robbery, homicide, kidnapping, and drug trafficking. The data allows for macro-level analyses of public safety and assessment of territorial risk associated with the consulted location. The query always considers the municipality as the unit of analysis, regardless of the geographic key provided. When a polygon encompasses more than one municipality, the returned data corresponds to the city closest to the centroid of the specified area. This dataset is only available for the states of São Paulo, Rio de Janeiro, and Minas Gerais . For more information on business context, applications, and use cases, please refer to the Risk and Public Safety documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| Key | Description |
| state + city | Explicit identification of the municipality to be analyzed. |
| polygon | Geographic area used to identify the reference municipality for the query. |
| latitude + longitude | Coordinates used to identify the reference municipality. |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 125. Processos do CADE
<!-- slug: processos-processos-do-cade | dataset: cade_processes_data | endpoint: POST /processos -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/processos-processos-do-cade
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/processos`
**Dataset técnico:** `cade_processes_data`

**Descrição:** This dataset returns information about the procedural progress of cases analyzed or already processed by the Administrative Council for Economic Defense (CADE), including process identification data, type, interested parties, records, protocols, and progress associated with decisions related to the defense of economic order. For more information on business context, applications, and use cases, see the Other Processes documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

### 126. Dados Históricos de Placa de Veículo
<!-- slug: veiculos-dados-historicos-de-placa-de-veiculo | dataset: license_plates | endpoint: POST /vehicles -->
<!-- V2: GAP -->

**URL:** https://docs.bigdatacorp.com.br/plataforma/reference/veiculos-dados-historicos-de-placa-de-veiculo
**Endpoint:** `POST https://plataforma.bigdatacorp.com.br/vehicles`
**Dataset técnico:** `license_plates`

**Descrição:** This dataset returns registration and historical information associated with a vehicle license plate, including data such as make, model, year, color, registered alerts, and the history of the plate's links to different vehicles over time. The query uses a historical database with data up to July 2021; Mercosur standard license plates can be entered, and will be automatically converted to the old model for query purposes. Newer vehicles, registered after this period, may not have available information. For more information on business context, applications, and use cases, please refer to the Basic Data documentation.

**Tabela de preços**

| Consultas Realizadas no Mês | Valor por consulta |
|---|---|
| 1 - 10.000 | BRL 0.050 |
| 10.001 - 50.000 | BRL 0.048 |
| 50.001 - 100.000 | BRL 0.046 |
| 100.001 - 500.000 | BRL 0.044 |
| 500.001 - 1.000.000 | BRL 0.042 |
| 1.000.001 - 5.000.000 | BRL 34,000.00 (fixed price) |
| 5,000,001 and above | Contact |
| TIME | STATUS |

**Chaves complementares:** _[não encontradas]_

**Filtros:** _[não encontrados]_

**Body Params**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| q | string | sim |  |
| Datasets | string | sim |  |
| Limit | number | não | Maximum number of entities returned in the response, used in |

**Observações:** _[não encontradas]_

---

