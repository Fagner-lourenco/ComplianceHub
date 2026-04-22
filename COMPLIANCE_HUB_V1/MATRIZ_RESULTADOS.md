# MATRIZ COMPLETA DE RESULTADOS — ComplianceHub API Testing

**Data:** Julho 2026  
**Total de arquivos analisados:** 81  
**APIs testadas:** Escavador V2, Judit, (FonteData — integrado mas sem resultados salvos em JSON)  
**Diretórios:** `results/` (19), `results/advanced/` (40+), `results/names/` (6), `results/missing/` (12)

---

## RESUMO EXECUTIVO

| # | Candidato | CPF | UF | Risco | Mandados | Criminais (Esc) | Criminais (Judit) |
|---|-----------|-----|----|:-----:|:--------:|:----------------:|:-----------------:|
| 1 | ANDRE LUIZ CRUZ DOS SANTOS | 48052053854 | SP | ⚠️ ALTO | 0 | 7 (homônimos) | 7 (homônimos) |
| 2 | DIEGO EMANUEL ALVES DE SOUZA | 10794180329 | CE | ✅ BAIXO | 0 | 0 | 0 |
| 3 | RENAN GUIMARAES DE SOUSA AUGUSTO | 11819916766 | RJ | ✅ BAIXO | 0 | 0 | 0 |
| 4 | FRANCISCO TACIANO DE SOUSA | 05023290336 | CE | 🚨 CRÍTICO | **1** 🔴 | **5** | **1** |
| 5 | MATHEUS GONCALVES DOS SANTOS | 46247243804 | SP | ⚠️ MÉDIO | 0 | 0 (CPF) / 26* (nome) | 1 inquérito |

---

## MATRIZ COMPLETA POR TIPO DE CONSULTA

### ESCAVADOR V2

| Consulta | Params | Andre (1) | Diego (2) | Renan (3) | Francisco (4) | Matheus (5) |
|----------|--------|:---------:|:---------:|:---------:|:-------------:|:-----------:|
| CPF default | — | **0** | **1** | **1** | **7** (5 crim) | **0** |
| CPF + per_page=100 | baseline | **0** | **1** | **1** | **7** | **0** |
| CPF + tribunais[UF] | filtro UF | **0** | **1** | **1** | **7** | **0** |
| CPF + status=ATIVO | filtro ativo | **0** | **0** | **0** | **3** (2crim+1cív) | **0** |
| CPF + incluir_homonimos=1 | **NOVO** | **14** 🔴 | **1** | **1** | **7** | **164** (100 ret.) |
| NOME default | — | **23** (8 cpfs) | **1** (1 cpf) | **1** (1 cpf) | **7** (1 cpf) | **322** (289 cpfs) |
| NOME + per_page=100 | baseline | **22** | **1** | **1** | **7** | **50** |
| NOME + tribunais[UF] | filtro UF | **11** | — | — | — | **100** |

### JUDIT

| Consulta | Params | Andre (1) | Diego (2) | Renan (3) | Francisco (4) | Matheus (5) |
|----------|--------|:---------:|:---------:|:---------:|:-------------:|:-----------:|
| Sync CPF | lawsuits | **0** | **0** | **1** | **1** (crim) | **1** |
| Async CPF | baseline | **0** | **0** | **1** | **1** (crim) | **1** |
| Async CPF + tribunais | filtro UF | **0** | **0** | **0** ⚠️ | **1** (crim) | **1** |
| Async CPF + on_demand | demanda | **0** | — | — | — | **1** |
| Async NOME baseline | **NOVO** | **17** (7 crim) | **0** | **0** | **0** | **198** (18 crim) |
| Async NOME + tribunais | filtro UF | **13** (7 crim) | — | — | — | **63** (21 crim) |
| Async NOME + on_demand | demanda | — | — | — | — | — |
| Warrant (CPF) | mandados | **0** | **0** | **0** | **1** 🚨 | **0** |
| Warrant + tribunais | filtro UF | **0** | — | **0** | **1** 🚨 | **0** |
| Execução Penal (CPF) | **NOVO** | **0** | **0** | **0** | **0** | **0** |

---

## DETALHAMENTO POR CANDIDATO

---

### CANDIDATO 1: ANDRE LUIZ CRUZ DOS SANTOS
**CPF:** 48052053854 | **UF:** SP | **cpfsComEsseNome:** 8  
**Risco:** ⚠️ ALTO (processos criminais por busca de nome/homônimos)

#### Situação CPF
- **Escavador CPF (default):** ❌ Não encontrado (envolvido NULL, 0 processos)
- **Escavador CPF + homonimos=1:** ✅ **14 processos** encontrados (inclui homônimos de 8 CPFs)
- **Judit CPF (sync/async):** ❌ 0 resultados
- **Judit Warrant:** 0 mandados
- **Judit Execução Penal:** 0

#### Escavador CPF + incluir_homonimos=1 — 14 Processos Detalhados

| # | Processo | Ano | Tribunal | Área | Classe | Status | Polo Passivo |
|---|---------|-----|----------|------|--------|--------|-------------|
| 1 | 0000478-49.2023.8.26.0536 | 2023 | TJSP | **Criminal** | Comunicado Mandado de Prisão | INATIVO | Andre Luiz Cruz dos Santos |
| 2 | 1531095-73.2019.8.26.0562 | 2019 | TJSP | **Criminal** | Inquérito Policial | **ATIVO** | — |
| 3 | 0026401-38.2019.8.26.0562 | 2019 | TJSP | **Criminal** | Execução da Pena | **ATIVO** | Andre Luiz Cruz dos Santos |
| 4 | 1500994-66.2019.8.26.0590 | 2019 | TJSP | **Criminal** | Ação Penal - Proc. Ordinário | **ATIVO** | Andre Luiz Cruz dos Santos |
| 5 | 0005600-48.2018.8.26.0009 | 2018 | TJSP | **Criminal** | Carta Precatória Criminal | **ATIVO** | Andre Luiz Cruz dos Santos |
| 6 | 0300092-91.2018.8.05.0022 | 2018 | TJBA | **Criminal** | Auto de Prisão em Flagrante | INATIVO | — |
| 7 | 1500388-74.2017.8.26.0536 | 2017 | TJSP | **Criminal** | Ação Penal - Proc. Ordinário | INATIVO | — |
| 8 | 1502667-52.2017.8.26.0562 | 2017 | TJSP | null | null | null | — |
| 9 | 1005009-48.2014.8.26.0223 | 2014 | TJSP | — | Alimentos - Provisionais | INATIVO | Andre Luiz Cruz dos Santos |
| 10 | 0017276-82.2014.4.01.3300 | 2014 | TRF1 | — | Reintegração de Posse | **ATIVO** | — |
| 11 | 0000107-61.2014.8.25.0073 | 2014 | TJSE | — | Execução de Alimentos | INATIVO | Andre Luiz Cruz dos Santos |
| 12 | 0000823-25.2013.8.25.0073 | 2013 | TJSE | — | — | — | — |
| 13-14 | (2 adicionais) | — | — | — | — | — | — |

**Criminais:** 7 (Mandado Prisão, Inquérito, Execução Pena, 2× Ação Penal, Carta Precatória, Flagrante)  
**⚠️ ATENÇÃO:** Processos de SP, BA e SE — indicam que pode ser 1 pessoa com passagem em múltiplos estados OU homônimos de 8 CPFs diferentes. **Impossível distinguir sem CPF indexado.**

#### Judit NOME baseline — 17 Processos

| # | Processo | Tribunal | Área | Criminal | Polo |
|---|---------|----------|------|:--------:|------|
| 1 | 1500388-74.2017.8.26.0536 | TJSP | DIREITO PENAL | ✅ | Passive |
| 2 | 0026401-38.2019.8.26.0562 | TJSP | DIREITO PENAL | ✅ | Passive |
| 3 | 0024942-35.2018.8.26.0562 | TJSP | NÃO INFORMADO | ✅ | N/A |
| 4-7 | (+ 4 criminais) | TJSP | PENAL | ✅ | — |
| 8-17 | (10 cíveis) | TJSP/TJSE/TJBA | CIVIL/NÃO INF. | ❌ | — |

**criminal_count:** 7 | **potential_homonym_count:** 0 (busca por nome completo raro)

#### Comparação Escavador × Judit (NOME)
- **Escavador Nome:** 22-23 processos (8 criminais)
- **Judit Nome:** 17 processos (7 criminais)
- **Overlap parcial:** Processo `0026401-38.2019` (Execução Pena) e `1500388-74.2017` (Ação Penal) aparecem em ambos
- **Escavador exclusivos:** ~6 processos não encontrados no Judit
- **Judit exclusivos:** ~1-2 não encontrados no Escavador

---

### CANDIDATO 2: DIEGO EMANUEL ALVES DE SOUZA
**CPF:** 10794180329 | **UF:** CE | **cpfsComEsseNome:** 1 (nome único)  
**Risco:** ✅ BAIXO

#### Situação CPF
- **Escavador CPF (default/baseline/tribunal):** ✅ **1 processo** encontrado
- **Escavador CPF + ATIVO:** 0 (processo inativo)
- **Escavador CPF + homonimos=1:** 0 (NULL — bug? cpfsComEsseNome=1 deveria retornar o mesmo)
- **Judit CPF (sync/async):** ❌ 0 resultados
- **Judit Warrant:** 0 mandados
- **Judit Execução Penal:** 0

#### Único Processo (Escavador)

| Processo | Tribunal | Área | Classe | Status |
|---------|----------|------|--------|--------|
| 0001549-63.2024.8.06.0001 | TJCE | — | Reclamação Pré-processual (Exoneração Alimentos) | **INATIVO** |

#### Busca por Nome
- **Escavador Nome:** 1 processo (mesmo acima) — confirmado nome único
- **Judit Nome:** 0 resultados

#### Discrepâncias
- **Escavador encontra 1 processo por CPF, Judit encontra 0** — Judit não tem cobertura desse processo cível/alimentar do TJCE
- **homonimos=1 retorna NULL** para nome com cpfsComEsseNome=1 — comportamento inesperado

---

### CANDIDATO 3: RENAN GUIMARAES DE SOUSA AUGUSTO
**CPF:** 11819916766 | **UF:** RJ | **cpfsComEsseNome:** 1 (nome único)  
**Risco:** ✅ BAIXO

#### Situação CPF
- **Escavador CPF (default/baseline/tribunal):** ✅ **1 processo** encontrado
- **Escavador CPF + ATIVO:** 0 (processo inativo)
- **Escavador CPF + homonimos=1:** 0 (NULL — mesmo comportamento do Diego)
- **Judit CPF (sync/async baseline):** ✅ **1 processo** encontrado (mesmo)
- **Judit CPF + tribunais:** ⚠️ **0** (bug no filtro `TRT1RJ`)
- **Judit Warrant:** 0 mandados
- **Judit Execução Penal:** 0

#### Único Processo

| API | Processo | Tribunal | Área | Classe | Status |
|-----|---------|----------|------|--------|--------|
| Escavador | 0101976-21.2016.5.01.0007 | TRT-1 | — | Ação Trabalhista | INATIVO/Arquivado |
| Judit | 0101976-21.2016.5.01.0007 | TRT1 | NÃO INFORMADO | — | — |

#### Busca por Nome
- **Escavador Nome:** 1 processo (confirmado)
- **Judit Nome:** 0 resultados

#### Discrepâncias
- **BUG Judit filtro tribunal:** Código `TRT1RJ` não encontra o processo do TRT-1. Deve-se investigar o código correto.
- **Judit Nome 0** vs **Judit CPF 1** — busca por nome não encontra o trabalhista

---

### CANDIDATO 4: FRANCISCO TACIANO DE SOUSA 🚨
**CPF:** 05023290336 | **UF:** CE | **cpfsComEsseNome:** 1 (nome único)  
**Risco:** 🚨 **CRÍTICO** — Mandado de prisão pendente, múltiplos criminais, violência doméstica

#### Situação CPF
- **Escavador CPF (default/baseline/tribunal):** ✅ **7 processos** (5 criminais)
- **Escavador CPF + ATIVO:** **3 processos** (2 criminais + 1 cível)
- **Escavador CPF + homonimos=1:** 0 (NULL — cpfsComEsseNome=1)
- **Judit CPF (sync/async):** ✅ **1 processo** criminal
- **Judit Warrant:** 🚨 **1 MANDADO DE PRISÃO**
- **Judit Execução Penal:** 0

#### Escavador — 7 Processos Detalhados

| # | Processo | Ano | Tribunal | Área | Classe | Status |
|---|---------|-----|----------|------|--------|--------|
| 1 | 0205659-11.2024.8.06.0167 | 2024 | TJCE | **CÍVEL** | Cumprimento de Alimentos | **ATIVO** |
| 2 | 0012198-45.2022.8.06.0167 | 2022 | TJCE | **CRIME** | Ação Penal (Contravenções) | — |
| 3 | 0013417-40.2021.8.06.0293 | 2021 | TJCE | **CRIME** | Medidas Protetivas (Maria da Penha) | — |
| 4 | 0202743-72.2022.8.06.0167 | 2022 | TJCE | **CRIME** | Ação Penal (Violência Doméstica) | — |
| 5 | 3001575-02.2021.8.06.0167 | 2021 | TJCE | **CRIME** | Termo Circunstanciado (Porte arma branca) | — |
| 6 | 0053023-02.2020.8.06.0167 | 2020 | TJCE | null | Proc. Cível (Fixação Alimentos) | — |
| 7 | 0040713-08.2013.8.06.0167 | 2013 | TJCE | **CRIME** | TC/Apelação/Embargos (Contravenções) | — |

#### Judit — 1 Processo Criminal Detalhado

| Campo | Valor |
|-------|-------|
| **Processo** | 0202743-72.2022.8.06.0167 |
| **Tribunal** | TJCE — Juizado Violência Doméstica Sobral |
| **Área** | DIREITO PENAL |
| **Criminal** | ✅ true |
| **Classificação** | Ação Penal - Procedimento Ordinário |
| **Assuntos** | VIOLÊNCIA DOMÉSTICA CONTRA A MULHER, AMEAÇA |
| **Status** | Finalizado / Arquivado |
| **Último passo** | "Carta de Guia Definitiva → Execuções Penais" (2024-10-23) |

#### 🚨 MANDADO DE PRISÃO (Judit Warrant)

| Campo | Valor |
|-------|-------|
| **Tipo** | `warrant_of_arrest` (prisão civil) |
| **Status** | 🔴 **Pendente de Cumprimento** |
| **Emissão** | 2025-11-17 |
| **Tribunal** | TJCE — 2ª Vara Família Sobral |
| **Processo vinculado** | 0204723-54.2022.8.06.0167 |
| **Motivo** | Prisão civil — inadimplemento de alimentos (Art. 5º LXVII CF, Art. 528 §3º CPC) |
| **Valor devido** | R$ 4.741,48 |
| **Prazo** | 60 dias ou até pagamento |
| **Determinação** | Inclusão no BNMP 3.0, mandado encaminhado à CEMAN |

#### Busca por Nome
- **Escavador Nome:** 7 processos (mesmo resultado do CPF — nome único)
- **Judit Nome:** 0 resultados ⚠️

#### Discrepâncias CRÍTICAS
1. **Escavador 7 × Judit 1:** Judit encontra apenas 1 dos 7 processos (14% de cobertura)
2. **Judit Nome = 0:** Busca por nome não retorna NENHUM resultado, mas CPF retorna 1
3. **Mandado não vinculado:** O mandado (0204723-54.2022) é de processo DIFERENTE do encontrado na busca CPF (0202743-72.2022)
4. **6 processos invisíveis no Judit:** Contravenções, Maria da Penha, TC, Alimentos — todos só no Escavador

---

### CANDIDATO 5: MATHEUS GONCALVES DOS SANTOS
**CPF:** 46247243804 | **UF:** SP/PR | **cpfsComEsseNome:** 289  
**Risco:** ⚠️ MÉDIO (1 inquérito policial ativo, poluição massiva de homônimos)

#### Situação CPF
- **Escavador CPF (default/baseline/tribunal/ATIVO):** ❌ 0 (CPF não indexado)
- **Escavador CPF + homonimos=1:** **164 processos** (100 retornados, paginado) — ⚠️ 289 CPFs com mesmo nome
- **Judit CPF (sync/async/on_demand/tribunal):** ✅ **1 processo** (inquérito policial)
- **Judit Warrant:** 0 mandados
- **Judit Execução Penal:** 0

#### Judit — 1 Processo (Inquérito Policial)

| Campo | Valor |
|-------|-------|
| **Processo** | 1505327-09.2024.8.26.0001 |
| **Tribunal** | TJSP |
| **Comarca** | 02 Cível de Santana |
| **Nome** | JUSTIÇA PÚBLICA X MATHEUS SANTOS GONÇALVES |
| **Área** | NÃO INFORMADO |
| **Criminal tag** | ❌ false (⚠️ **CLASSIFICAÇÃO INCORRETA**) |
| **Status** | Ativo / Inicial |
| **Distribuição** | 2024-07-22 |
| **Partes** | Justiça Pública (AUTOR) vs Matheus (AVERIGUADO) + Rebeca (VÍTIMA) |

> 🐛 **BUG de classificação Judit:** Processo com Justiça Pública como AUTOR, parte como AVERIGUADO e presença de VÍTIMA é claramente penal/inquérito, mas `criminal: false`.

#### Escavador CPF + homonimos=1 — 164 Processos (100 retornados)

| Área | Quantidade |
|------|:----------:|
| Criminal | 35 |
| Cível | 18 |
| Trabalhista | 1 |
| Tóxico | 2 |
| N/A (sem classificação) | 122 |
| **TOTAL retornado** | **100** (de 164) |

> ⚠️ **CONTAMINAÇÃO MASSIVA:** 289 CPFs com mesmo nome = impossível saber quais dos 164 processos pertencem ao candidato real. Inutilizável sem filtro adicional.

#### Busca por Nome

| API | Total | Criminal | Observação |
|-----|:-----:|:--------:|-----------|
| Escavador Nome (default) | 322 | — | 289 CPFs, 20 retornados (paginado) |
| Escavador Nome (baseline) | 322 | 4 | 50 retornados |
| Escavador Nome + tribunais | 322 | 26 | 100 retornados |
| Judit Nome (baseline) | 198 | 18 | Todos homônimos potenciais |
| Judit Nome + tribunais | 63 | 21 | Filtrado por SP/PR |

#### Discrepâncias
1. **CPF não indexado no Escavador** — busca por CPF retorna NULL (sem homonimos)
2. **Judit encontra 1 por CPF** que Escavador não encontra — sistemas de indexação diferentes
3. **Classificação criminal incorreta** no Judit para inquérito policial óbvio
4. **Homônimos incontroláveis** — nome com 289 CPFs torna busca por nome inutilizável

---

## ANÁLISE COMPARATIVA ENTRE APIs

### Cobertura por CPF

| Candidato | Escavador CPF | Judit CPF | Concordância |
|-----------|:------------:|:---------:|:------------:|
| 1 - Andre | 0 | 0 | ✅ ambos 0 |
| 2 - Diego | 1 | 0 | ❌ Escavador +1 |
| 3 - Renan | 1 | 1 | ✅ mesmo processo |
| 4 - Francisco | 7 | 1 | ❌ Escavador +6 |
| 5 - Matheus | 0 | 1 | ❌ Judit +1 |

**Conclusão:** Concordância total em apenas 2/5 candidatos. Nenhuma API sozinha é suficiente.

### Cobertura por Nome

| Candidato | Escavador Nome | Judit Nome | Variação |
|-----------|:--------------:|:----------:|:--------:|
| 1 - Andre | 22 | 17 | Esc +29% |
| 2 - Diego | 1 | 0 | Esc +1 |
| 3 - Renan | 1 | 0 | Esc +1 |
| 4 - Francisco | 7 | 0 | Esc +7 |
| 5 - Matheus | 322 | 198 | Esc +63% |

**Conclusão:** Escavador consistentemente tem mais cobertura que Judit para busca por nome.

### Funcionalidades Exclusivas

| Feature | Escavador | Judit |
|---------|:---------:|:-----:|
| Busca CPF | ✅ | ✅ |
| Busca Nome | ✅ | ✅ |
| Filtro Tribunal | ✅ | ✅ |
| Filtro Status | ✅ (ATIVO/INATIVO) | ❌ |
| incluir_homonimos | ✅ (param `1`/`0`) | ❌ |
| Mandados de Prisão | ❌ | ✅ (`warrant`) |
| Execução Penal | ❌ | ✅ (`execution`) |
| on_demand | ❌ | ✅ |
| Classificação Criminal | Manual (campo `area`) | Automática (`tags.criminal`) |
| Assuntos/Subjects | ❌ | ✅ (detalhado) |
| Partes | Polo Ativo/Passivo (texto) | Detalhado (nome, CPF, tipo, advogados) |
| cpfsComEsseNome | ✅ (indicador homônimos) | ❌ |

---

## DESCOBERTAS CRÍTICAS

### 1. `incluir_homonimos=1` é ESSENCIAL para CPFs não indexados
- **Andre:** 0 → 14 processos (7 criminais graves)
- **Matheus:** 0 → 164 processos (contaminado com 289 CPFs)
- **Sem este flag:** compliance perde 100% dos registros criminais para CPFs não indexados
- **PORÉM:** para nomes com muitos homônimos (>10 CPFs), os resultados são inutilizáveis sem análise manual

### 2. Judit Warrant é EXCLUSIVO e CRÍTICO
- Único a encontrar mandado de prisão do Francisco (pendente, R$4.741,48)
- Escavador encontra "Comunicado de Mandado de Prisão" como processo, mas não como mandado ativo
- **Recomendação:** SEMPRE executar busca warrant na Judit

### 3. Nenhuma API tem cobertura completa sozinha
- Francisco: Escavador 7 processos, Judit 1 processo + 1 mandado
- Diego: Escavador 1, Judit 0
- Matheus: Escavador 0, Judit 1 (CPF)
- **Abordagem multi-API é obrigatória**

### 4. Bug de classificação criminal no Judit
- Matheus: inquérito policial com AVERIGUADO e VÍTIMA classificado como `criminal: false`
- Impacto: falsos negativos em filtros automatizados de risco criminal

### 5. Busca por nome é problemática para nomes comuns
- Matheus (289 CPFs): 322 processos no Escavador, 198 no Judit — impossível filtrar
- Andre (8 CPFs): 22-23 processos — possível mas requer validação
- Nomes únicos (Diego/Renan/Francisco): busca por nome = busca por CPF

### 6. Parâmetro `incluir_homonimos` requer `1`/`0`, NÃO `true`/`false`
- API retorna 422 com `true`/`false`
- Bug corrigido no adapter `escavador.js`

---

## RECOMENDAÇÃO DE FLUXO DE ENRIQUECIMENTO

```
1. FonteData (CPF)
   └── Extrai: nome completo, UF(s), dados cadastrais

2. Escavador CPF (default)
   ├── Se encontrou → OK, usar resultado
   └── Se envolvido=NULL → Escavador CPF + incluir_homonimos=1
       ├── Se cpfsComEsseNome ≤ 10 → Usar com flag "possíveis homônimos"
       └── Se cpfsComEsseNome > 10 → Marcar "análise manual necessária"

3. Escavador NOME (backup se CPF não indexado)
   └── Usar cpfsComEsseNome como indicador de confiabilidade

4. Judit Async CPF (processos)
   └── Captura processos não encontrados no Escavador

5. Judit Warrant CPF (mandados)
   └── SEMPRE executar — dados exclusivos e críticos

6. Judit Execução Penal CPF
   └── 0 resultados em 5/5 candidatos — baixa prioridade mas incluir

7. Judit NOME (se CPF retornou 0)
   └── Complementa com processos criminais por nome
```

---

## INVENTÁRIO DE ARQUIVOS (81 total)

### `results/` — 19 arquivos (baseline)
| Arquivo | API | Candidato | Tipo |
|---------|-----|:---------:|------|
| escavador_1_andre.json | Escavador | 1 | CPF |
| escavador_1_andre_byname.json | Escavador | 1 | Nome |
| escavador_2_diego.json | Escavador | 2 | CPF |
| escavador_3_renan.json | Escavador | 3 | CPF |
| escavador_4_francisco.json | Escavador | 4 | CPF |
| escavador_5_matheus.json | Escavador | 5 | CPF |
| escavador_5_matheus_byname.json | Escavador | 5 | Nome |
| judit_lawsuits_1_andre.json | Judit | 1 | CPF sync |
| judit_lawsuits_2_diego.json | Judit | 2 | CPF sync |
| judit_lawsuits_3_renan.json | Judit | 3 | CPF sync |
| judit_lawsuits_4_francisco.json | Judit | 4 | CPF sync |
| judit_lawsuits_5_matheus.json | Judit | 5 | CPF sync |
| judit_warrant_1_andre.json | Judit | 1 | Warrant |
| judit_warrant_1_andre_v2.json | Judit | 1 | Warrant (re-poll) |
| judit_warrant_2_diego.json | Judit | 2 | Warrant |
| judit_warrant_2_diego_v2.json | Judit | 2 | Warrant (re-poll) |
| judit_warrant_3_renan.json | Judit | 3 | Warrant |
| judit_warrant_4_francisco.json | Judit | 4 | Warrant |
| judit_warrant_5_matheus.json | Judit | 5 | Warrant |

### `results/advanced/` — 40+ arquivos
| Arquivo | API | Candidato | Tipo |
|---------|-----|:---------:|------|
| esc_1_cpf_baseline.json | Escavador | 1 | CPF baseline |
| esc_1_cpf_tribunal.json | Escavador | 1 | CPF + tribunal |
| esc_1_cpf_ativo.json | Escavador | 1 | CPF + ATIVO |
| esc_1_nome_baseline.json | Escavador | 1 | Nome baseline |
| esc_1_nome_tribunal.json | Escavador | 1 | Nome + tribunal |
| esc_2_cpf_baseline.json | Escavador | 2 | CPF baseline |
| esc_2_cpf_tribunal.json | Escavador | 2 | CPF + tribunal |
| esc_2_cpf_ativo.json | Escavador | 2 | CPF + ATIVO |
| esc_3_cpf_baseline.json | Escavador | 3 | CPF baseline |
| esc_3_cpf_tribunal.json | Escavador | 3 | CPF + tribunal |
| esc_3_cpf_ativo.json | Escavador | 3 | CPF + ATIVO |
| esc_4_cpf_baseline.json | Escavador | 4 | CPF baseline |
| esc_4_cpf_tribunal.json | Escavador | 4 | CPF + tribunal |
| esc_4_cpf_ativo.json | Escavador | 4 | CPF + ATIVO |
| esc_5_cpf_baseline.json | Escavador | 5 | CPF baseline |
| esc_5_cpf_tribunal.json | Escavador | 5 | CPF + tribunal |
| esc_5_cpf_ativo.json | Escavador | 5 | CPF + ATIVO |
| esc_5_nome_baseline.json | Escavador | 5 | Nome baseline |
| esc_5_nome_tribunal.json | Escavador | 5 | Nome + tribunal |
| judit_1_async_baseline.json | Judit | 1 | CPF async |
| judit_1_async_tribunal.json | Judit | 1 | CPF + tribunal |
| judit_1_async_ondemand.json | Judit | 1 | CPF + on_demand |
| judit_1_nome_tribunal.json | Judit | 1 | Nome + tribunal |
| judit_1_nome_ondemand.json | Judit | 1 | Nome + on_demand |
| judit_1_warrant_tribunal.json | Judit | 1 | Warrant + tribunal |
| judit_2_async_baseline.json | Judit | 2 | CPF async |
| judit_2_async_tribunal.json | Judit | 2 | CPF + tribunal |
| judit_2_warrant_tribunal.json | Judit | 2 | Warrant + tribunal |
| judit_3_async_baseline.json | Judit | 3 | CPF async |
| judit_3_async_tribunal.json | Judit | 3 | CPF + tribunal |
| judit_3_warrant_tribunal.json | Judit | 3 | Warrant + tribunal |
| judit_4_async_baseline.json | Judit | 4 | CPF async |
| judit_4_async_tribunal.json | Judit | 4 | CPF + tribunal |
| judit_4_warrant_tribunal.json | Judit | 4 | Warrant + tribunal |
| judit_5_async_baseline.json | Judit | 5 | CPF async |
| judit_5_async_tribunal.json | Judit | 5 | CPF + tribunal |
| judit_5_async_ondemand.json | Judit | 5 | CPF + on_demand |
| judit_5_nome_tribunal.json | Judit | 5 | Nome + tribunal |
| judit_5_nome_ondemand.json | Judit | 5 | Nome + on_demand |
| judit_5_warrant_tribunal.json | Judit | 5 | Warrant + tribunal |
| tribunais_SP.json | Judit | — | Lista tribunais SP |
| tribunais_CE.json | Judit | — | Lista tribunais CE |
| tribunais_RJ.json | Judit | — | Lista tribunais RJ |
| tribunais_PR.json | Judit | — | Lista tribunais PR |

### `results/names/` — 6 arquivos
| Arquivo | API | Candidato | Tipo |
|---------|-----|:---------:|------|
| esc_2_diego_nome.json | Escavador | 2 | Nome |
| esc_3_renan_nome.json | Escavador | 3 | Nome |
| esc_4_francisco_nome.json | Escavador | 4 | Nome |
| judit_2_diego_nome.json | Judit | 2 | Nome |
| judit_3_renan_nome.json | Judit | 3 | Nome |
| judit_4_francisco_nome.json | Judit | 4 | Nome |

### `results/missing/` — 12 arquivos (preenchimento de gaps)
| Arquivo | API | Candidato | Tipo |
|---------|-----|:---------:|------|
| esc_1_cpf_homonimos.json | Escavador | 1 | CPF + homonimos |
| esc_2_cpf_homonimos.json | Escavador | 2 | CPF + homonimos |
| esc_3_cpf_homonimos.json | Escavador | 3 | CPF + homonimos |
| esc_4_cpf_homonimos.json | Escavador | 4 | CPF + homonimos |
| esc_5_cpf_homonimos.json | Escavador | 5 | CPF + homonimos |
| judit_1_nome_baseline.json | Judit | 1 | Nome baseline |
| judit_5_nome_baseline.json | Judit | 5 | Nome baseline |
| judit_1_execucao_penal.json | Judit | 1 | Execução penal |
| judit_2_execucao_penal.json | Judit | 2 | Execução penal |
| judit_3_execucao_penal.json | Judit | 3 | Execução penal |
| judit_4_execucao_penal.json | Judit | 4 | Execução penal |
| judit_5_execucao_penal.json | Judit | 5 | Execução penal |

---

## ESTRATÉGIA DE IMPLEMENTAÇÃO — Atualizado 2026-04-03

### Decisões Baseadas em Evidência

#### 1. Filtro por Tribunal: NÃO usar como padrão
- **Evidência:** Renan (candidato 3) tem processo trabalhista no TRT-1 (RJ), mas filtro `TRT1RJ` no Judit retornou 0 resultados
- **Evidência:** Francisco (candidato 4) — Judit encontra apenas 1 de 7 processos, todos no TJCE
- **Decisão:** Consultar SEM filtro de tribunal. Filtrar só na APRESENTAÇÃO, nunca na BUSCA

#### 2. incluir_homonimos=1: Usar como padrão no Escavador
- **Evidência:** André — CPF default retorna 0, com homonimos=1 retorna 14 (7 criminais graves)
- **Evidência:** Matheus — CPF default retorna 0, com homonimos=1 retorna 164
- **Controle:** Se `cpfsComEsseNome ≤ 10`: usar com flag "possíveis homônimos". Se `> 10`: marcar revisão manual
- **Decisão:** SEMPRE incluir_homonimos=1 + controle de ruído por cpfsComEsseNome

#### 3. Judit Warrant: OBRIGATÓRIO em todo fluxo
- **Evidência:** Francisco — ÚNICO provedor que detectou mandado de prisão pendente (R$4.741,48)
- **Evidência:** FonteData cnj-mandados retornou 503 para Francisco (o caso real com mandado)
- **Decisão:** Judit warrant executa SEMPRE, sem filtro de tribunal

#### 4. Judit Execution: Incluir no fluxo
- **Evidência:** 0/5 candidatos com execução penal, mas custo R$0.50 é baixo e dado é exclusivo
- **Decisão:** Executar em paralelo com lawsuits e warrant

#### 5. FonteData: Manter como Gate + Fallback
- **Evidência:** Receita Federal PF (R$0.54) é o único endpoint confiável para validação cadastral
- **Evidência:** cadastro-pf-basica (R$0.24) fornece telefones, endereços, renda — útil para contexto
- **Evidência:** antecedentes-criminais SEMPRE retorna 400 — REMOVER
- **Decisão:** Gate cadastral + dados de contato. NÃO usar processos como fonte primária

#### 6. Classificação Automática
- **Criminal:** POSITIVE se Escavador `criminalCount > 0` OU Judit `criminalCount > 0` OU FonteData criminal flag
- **Criminal:** INCONCLUSIVE se apenas homônimos com processos criminais
- **Warrant:** POSITIVE se Judit `activeWarrantCount > 0`. NEGATIVE se 0 mandados. NOT_FOUND se API falhar
- **Trabalhista:** POSITIVE se FonteData labor encontrar OU Escavador/Judit tiverem processo trabalhista
- **Regra geral:** Nunca NEGATIVE automático se alguma API falhou → NOT_FOUND

### Fluxo Operacional Implementado

```
                   ┌──── CASO CRIADO ────┐
                   │                     │
                   ▼                     │
        ┌─ GATE: FonteData RF ─┐       │
        │  (R$ 0.54)           │       │
        │  CPF válido?         │       │
        │  Nome confere?       │       │
        └──┬──────────┬────────┘       │
           │          │                 │
        PASSED     BLOCKED              │
           │          └── FIM (exige correção)
           ▼                            │
   ┌─── FASE PARALELA ────────────┐    │
   │                              │    │
   │  FonteData:                  │    │
   │   ├ cadastro-pf-basica       │    │
   │   ├ processos-agrupada       │    │
   │   ├ cnj-mandados-prisao      │    │
   │   └ trt-consulta             │    │
   │                              │    │
   │  + Escalonamento condicional │    │
   │    (processos-completa)      │    │
   │                              │    │
   │  + IA opcional               │    │
   └──────┬───────────────────────┘    │
          │                             │
          │ enrichmentStatus=DONE/PARTIAL
          ▼                             │
   ┌─── FASE SEQUENCIAL ─────────┐    │
   │  (em paralelo entre si)     │    │
   │                              │    │
   │  Escavador:                  │    │
   │   └ processos (homonimos=1)  │    │
   │     SEM filtro de tribunal   │    │
   │                              │    │
   │  Judit:                      │    │
   │   ├ lawsuits async           │    │
   │   │  SEM filtro de tribunal  │    │
   │   ├ warrant                  │    │
   │   └ execution                │    │
   │     SEM filtro de tribunal   │    │
   └──────┬───────────────────────┘    │
          │                             │
          ▼                             │
   AUTO-CLASSIFICAÇÃO                   │
   ├ Criminal: POSITIVE/NEGATIVE/       │
   │   INCONCLUSIVE/NOT_FOUND          │
   ├ Warrant: POSITIVE/NEGATIVE/        │
   │   NOT_FOUND                        │
   ├ Trabalhista: POSITIVE/NEGATIVE/    │
   │   NOT_FOUND                        │
   ├ Score & Nível de Risco             │
   └ Veredito Sugerido                  │
          │                             │
          ▼                             │
   ANALISTA REVISA E CONCLUI           │
   └── mínima interação manual ────────┘
```

### Custo por Caso (estimativa)
| Cenário | FonteData | Escavador | Judit | Total |
|---------|:---------:|:---------:|:-----:|:-----:|
| Caso limpo (sem flag) | R$ 3.05 | R$ 0.015* | R$ 2.00 | **~R$ 5.07** |
| Caso com escalation | R$ 7.96 | R$ 0.015* | R$ 2.00 | **~R$ 10.00** |
| Caso com mandado | R$ 3.05 | R$ 0.015* | R$ 2.00 | **~R$ 5.07** |

_*Escavador: R$ 3.00/200 consultas = R$ 0.015/consulta_

### Bugs Conhecidos a Corrigir
1. ❌ Telefones/endereços exibem "[object Object]" — normalizer FonteData não serializa objetos aninhados
2. ❌ Warrant step não tem opção "INCONCLUSIVE"
3. ❌ Filtro tribunal Judit causa perda de processos
4. ❌ Judit `tags.criminal: false` para inquérito policial com AVERIGUADO
5. ❌ Escavador `incluir_homonimos=1` retorna NULL para nomes únicos (cpfsComEsseNome=1)
6. ❌ FonteData antecedentes-criminais sempre retorna 400
7. ❌ Judit execution não está no fluxo atual
8. ❌ Classificação criminal/trabalhista/mandado não pré-preenche automaticamente
9. ❌ Review step não mostra resumo consolidado dos enrichments
10. ❌ Sem rastreabilidade de provedor por campo na UI
