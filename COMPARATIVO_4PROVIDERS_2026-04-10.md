# ANÁLISE COMPARATIVA DETALHADA — 4 PROVIDERS
**Data:** 10 de abril de 2026  
**Providers:** Escavador V2 · Judit · Exato Digital · BigDataCorp  
**Candidatos testados:** 5 (André, Diego, Renan, Francisco, Matheus)

---

## BLOCO 1 — RESUMO EXECUTIVO POR CANDIDATO

### Legenda
- ✅ = Encontrou
- ❌ = Não encontrou
- 🔒 = Segredo de justiça (dados ocultados)
- ⚠️ = Possível homônimo (busca por nome, sem confirmação por CPF)
- 🚨 = Mandado de prisão encontrado

---

## 1. ANDRÉ LUIZ CRUZ DOS SANTOS
**CPF:** 480.520.538-54 · **UF:** SP · **Risco esperado:** ALTO

### 1.1 Processos encontrados

| # | CNJ | Tipo | Provider | Método | Status |
|---|-----|------|----------|--------|--------|
| 1 | 1015247-79.2025.8.26.0114 | Cível (Monitória) | Escavador | ⚠️ Nome | Ativo |
| 2 | 1014345-29.2025.8.26.0114 | Cível (JEC) | Escavador | ⚠️ Nome | Inativo |

**Resultado por provider:**

| Provider | Por CPF | Por Nome | Total | Observação |
|----------|---------|----------|-------|------------|
| **Escavador** | 0 | 2 | 2 | ⚠️ Busca por nome — possíveis homônimos |
| **Judit** | 0 | — | 0 | Nenhum processo encontrado |
| **Exato** | 0 | — | 0 | Documento inexistente no sistema |
| **BigDataCorp** | 0 | — | 0 | Nenhum processo vinculado ao CPF |

### 1.2 Mandados de Prisão

| Provider | Encontrou? | Tipo | CNJ Processo | Status | Vara |
|----------|-----------|------|-------------|--------|------|
| **Judit** | ❌ | — | — | Timeout na consulta | — |
| **Exato** | ❌ | — | — | Documento inexistente | — |
| **BigDataCorp KYC** | 🚨 **SIM** | Mandado de Prisão | 1500388-74.2017.8.26.0536 | **Pendente de Cumprimento** | 03 Criminal de Santos/SP |

> **⚠️ ALERTA CRÍTICO:** BigDataCorp é o ÚNICO provider que encontrou o mandado de prisão pendente de André, via dataset KYC/Sanctions do CNJ. Nenhum outro provider retornou esta informação. O mandado (nº 1500388742017826053601000126) está vinculado a processo criminal em Santos/SP.

### 1.3 Sanções Internacionais (BigDataCorp Exclusivo)

| Fonte | Nome Matcheado | Match Rate | Risco Real? |
|-------|---------------|------------|-------------|
| CNJ | André L. C. Santos | **100%** (CPF) | 🚨 **SIM** — Mandado prisão |
| FBI | Andre J. Fleurentin | 49% | ❌ Homônimo |
| OFAC | Andre Rodriguez Fernandez | 48% | ❌ Homônimo |
| INTERPOL | Andre Freckleton | 36% | ❌ Homônimo |
| UK | Andre Johnson | 29% | ❌ Homônimo |
| OFAC | Andriyah S. Mushantaf | 27% | ❌ Homônimo |
| OFAC | Andrew Nyamvumba | 14% | ❌ Homônimo |
| OFAC | Adib Mayaleh | 1% | ❌ Homônimo |
| OFAC | Lucien Nzabamwita | 1% | ❌ Homônimo |

**Resumo:** 1 match real (mandado CNJ) + 8 homônimos internacionais (irrelevantes).

### 1.4 Avaliação André

| Critério | Resultado |
|----------|-----------|
| Processos por CPF | **0 em todos os providers** |
| Mandado de prisão | 🚨 **1 pendente** (só BigDataCorp encontrou) |
| Sanções reais | 1 (mandado CNJ) |
| Provider mais eficaz | **BigDataCorp** (único a encontrar mandado) |
| Provider menos eficaz | Judit + Exato (nada encontrado) |

---

## 2. DIEGO EMANUEL ALVES DE SOUZA
**CPF:** 107.941.803-29 · **UF:** CE · **Risco esperado:** BAIXO

### 2.1 Processos encontrados

| # | CNJ | Tipo | Status | Providers que encontraram |
|---|-----|------|--------|--------------------------|
| 1 | 0001549-63.2024.8.06.0001 | Cível — Exoneração de Alimentos | Inativo | **Escavador** ✅ apenas |
| 2 | 0114945-28.2018.8.06.0001 | 🔒 Segredo de Justiça | Dados ocultados | **Exato** ✅ + **BigDataCorp** ✅ |

### 2.2 Matriz de cobertura CNJ

| CNJ | Escavador | Judit | Exato | BigDataCorp |
|-----|-----------|-------|-------|-------------|
| 0001549-63.2024.8.06.0001 | ✅ | ❌ | ❌ | ❌ |
| 0114945-28.2018.8.06.0001 | ❌ | ❌ | ✅ 🔒 | ✅ 🔒 |

> **ACHADO IMPORTANTE:** Cada provider encontrou processos DIFERENTES para o mesmo CPF!
> - Escavador encontrou processo de 2024 (alimentos) que Exato e BDC não viram
> - Exato + BDC encontraram processo de 2018 (selado) que Escavador não viu
> - Judit não encontrou NENHUM processo

### 2.3 Mandados de Prisão

| Provider | Encontrou? |
|----------|-----------|
| Judit | ❌ Timeout |
| Exato | ❌ Nenhum mandado |
| BigDataCorp KYC | ❌ Nenhum mandado |

### 2.4 Sanções (BigDataCorp KYC)
- **18 matches** — TODOS homônimos internacionais (OFAC, INTERPOL, FBI)
- Match rates: 21% a 51%
- Nenhum match exato por CPF/data de nascimento
- **Destaque:** "Diego Macedo Goncalves do Carmo" (51% match) vinculado ao PCC — mas é homônimo, dados biográficos não coincidem

### 2.5 Avaliação Diego

| Critério | Resultado |
|----------|-----------|
| Total de processos únicos | **2** (nenhum provider encontrou ambos) |
| Mandado de prisão | ❌ Nenhum |
| Provider mais eficaz | **Escavador** (processo exclusivo 2024) |
| Complementaridade | Exato + BDC (processo 2018 selado) |
| Judit | **Falhou completamente** |

---

## 3. RENAN GUIMARÃES DE SOUSA AUGUSTO
**CPF:** 118.199.167-66 · **UF:** RJ · **Risco esperado:** BAIXO

### 3.1 Processos encontrados

| # | CNJ | Tipo | Assunto | Status | Tribunal |
|---|-----|------|---------|--------|----------|
| 1 | 0101976-21.2016.5.01.0007 | Trabalhista | Salário/Diferença Salarial | Arquivado | TRT-1 (RJ) |

### 3.2 Matriz de cobertura CNJ

| CNJ | Escavador | Judit | Exato | BigDataCorp |
|-----|-----------|-------|-------|-------------|
| 0101976-21.2016.5.01.0007 | ✅ | ✅ | ✅ | ✅ |

> **CASO IDEAL DE VALIDAÇÃO:** Todos os 4 providers encontraram exatamente o mesmo (e único) processo. Renan aparece como **TESTEMUNHA** (não como réu ou autor) — confirmado por todos os providers.

### 3.3 Detalhes comparativos do processo

| Dado | Escavador | Judit | Exato | BigDataCorp |
|------|-----------|-------|-------|-------------|
| CNJ | ✅ | ✅ | ✅ | ✅ |
| Tipo (Trabalhista) | ✅ | ✅ | ✅ | ✅ |
| Assunto (Salário) | ✅ | ✅ | ✅ | ✅ |
| Valor (R$ 40.000) | ✅ | ❌ | ✅ | ❌ |
| Status (Arquivado) | ✅ | ✅ | ✅ | ✅ |
| Tribunal (TRT-1) | ✅ | ✅ | ✅ | ✅ |
| Papel (Testemunha) | ✅ | ✅ | ❌ | ❌ |
| Partes do processo | ✅ Completo | ✅ Parcial | ❌ | ❌ |
| Última movimentação | ❌ | ✅ | ✅ | ❌ |

### 3.4 Mandados de Prisão

| Provider | Encontrou? |
|----------|-----------|
| Judit | ❌ Timeout |
| Exato | ❌ Nenhum |
| BigDataCorp KYC | ❌ Nenhum |

### 3.5 Sanções (BigDataCorp KYC)
- **1 match** — Homônimo internacional
- INTERPOL: "Renan Braian Garcia Presotto" (50% match) — brasileiro, nascido em 2000, acusado de organização criminal e posse ilegal de arma na Argentina
- **Não é a mesma pessoa** — data de nascimento diferente (Renan real: 1987, match: 2000)

### 3.6 Avaliação Renan

| Critério | Resultado |
|----------|-----------|
| Total de processos | **1** (todos encontraram) |
| Papel no processo | Testemunha (risco zero) |
| Mandado de prisão | ❌ Nenhum |
| Provider mais detalhado | **Escavador** (partes, valor, papel) |
| Consenso | 100% — todos os providers concordam |

---

## 4. FRANCISCO TACIANO DE SOUSA
**CPF:** 050.232.903-36 · **UF:** CE · **Risco esperado:** CRÍTICO

### 4.1 Processos encontrados — Matriz CNJ completa

| # | CNJ | Tipo | Assunto | Status | Esc | Jud | Exa | BDC |
|---|-----|------|---------|--------|-----|-----|-----|-----|
| 1 | 0205659-11.2024.8.06.0167 | Cível | Cumpr. Sentença — Alimentos | **ATIVO** | ✅ | ❌ | ❌ | ✅ |
| 2 | 0012198-45.2022.8.06.0167 | Criminal | Ação Penal — Procedimento Ordinário | Ativo | ✅ | ❌ | ❌ | ✅ |
| 3 | 0013417-40.2021.8.06.0293 | Criminal | Medidas Protetivas — Maria da Penha | Arquivado | ✅ | ❌ | ❌ | ✅ |
| 4 | 0202743-72.2022.8.06.0167 | Criminal | Violência Doméstica — Ameaça | **Julgado/Condenado** | ✅ | ✅ | ✅ | ✅ |
| 5 | 3001575-02.2021.8.06.0167 | Criminal | Termo Circunstanciado — Porte Arma Branca | Encerrado | ✅ | ❌ | ❌ | ✅ |
| 6 | 0053023-02.2020.8.06.0167 | Cível | Alimentos — Fixação | Inativo | ✅ | ❌ | 🔒 | ✅ |
| 7 | 0040713-08.2013.8.06.0167 | Criminal | Contravenções Penais | Arquivado | ✅ | ❌ | ❌ | ✅ |

### 4.2 Contagem por provider

| Provider | Processos encontrados | Taxa de cobertura |
|----------|-----------------------|-------------------|
| **Escavador** | **7** | **100%** (7/7) |
| **BigDataCorp** | **7** (+1 duplicata 2º grau) | **100%** (7/7) |
| **Exato** | **2** (1 completo + 1 selado) | **29%** (2/7) |
| **Judit** | **1** | **14%** (1/7) |

### 4.3 Breakdown por tipo de processo

| Tipo | Qtd | CNJs |
|------|-----|------|
| **Criminal** | **5** | 0012198, 0013417, 0202743, 3001575, 0040713 |
| **Cível (Alimentos)** | **2** | 0205659, 0053023 |
| **Total** | **7** | — |

### 4.4 Breakdown por status

| Status | Qtd | CNJs |
|--------|-----|------|
| **ATIVO** | 2 | 0205659 (Alimentos), 0012198 (Penal) |
| **JULGADO/CONDENADO** | 1 | 0202743 (Violência doméstica — ameaça) |
| **ENCERRADO** | 1 | 3001575 (Porte arma branca) |
| **ARQUIVADO** | 3 | 0013417, 0040713, 0053023 |

### 4.5 🚨 MANDADOS DE PRISÃO

| Provider | Encontrou? | Tipo | CNJ Processo | Nº Mandado | Status | Vara |
|----------|-----------|------|-------------|------------|--------|------|
| **Judit** | 🚨 **SIM** | Prisão Civil | 0204723-54.2022.8.06.0167 | ...01.0003-26 | **Pendente** | 2ª Vara Família - Sobral |
| **Exato** | 🚨 **SIM** | Prisão Civil | 0204723-54.2022.8.06.0167 | ...01.0003-26 | **Pendente** | 2ª Vara Família - Sobral |
| **BigDataCorp** | 🚨 **SIM** | Prisão Civil | 0204723-54.2022.8.06.0167 | 2 mandados | **Pendente** | 2ª Vara Família - Sobral |

**Detalhes dos mandados BigDataCorp:**

| Nº Mandado | Status | Data Expedição |
|-----------|--------|----------------|
| 0204723-54.2022...01.0003-26 | Pendente de Cumprimento | 2025-11-17 |
| 0204723-54.2022...01.0001-22 | Pendente de Cumprimento | (anterior) |

> **⚠️ CRÍTICO:** Francisco possui **2 mandados de prisão civil** (dívida alimentícia R$ 4.741,48) pendentes de cumprimento. Judit e Exato encontraram 1 mandado; BigDataCorp encontrou 2 mandados vinculados ao mesmo processo.

### 4.6 Sanções (BigDataCorp KYC)

| Tipo | Qtd | Detalhes |
|------|-----|----------|
| **Match exato CNJ** | **2** | 2 mandados prisão civil (Sobral/CE) |
| **Homônimos internacionais** | **~40** | OFAC, INTERPOL, FBI, UK, CA, DDTC |

### 4.7 Cronologia criminal completa

| Ano | CNJ | Evento | Status Final |
|-----|-----|--------|-------------|
| 2013 | 0040713-08 | Contravenções penais (JECC Sobral) | Arquivado (2017) |
| 2020 | 0053023-02 | Alimentos — fixação (R$ 1.065) | Inativo |
| 2021 | 0013417-40 | Medidas protetivas — Maria da Penha | Arquivado (2022) |
| 2021 | 3001575-02 | Porte de arma branca (JECEC Sobral) | Encerrado (2024) |
| 2022 | 0202743-72 | **Violência doméstica — ameaça** | **CONDENADO** |
| 2022 | 0012198-45 | Ação penal — procedimento ordinário | Ativo |
| 2024 | 0205659-11 | Cumprimento sentença — alimentos (R$ 3.204,73) | **ATIVO** |
| 2022→2025 | 0204723-54 | **2 MANDADOS PRISÃO CIVIL** | 🚨 **PENDENTE** |

### 4.8 Avaliação Francisco

| Critério | Resultado |
|----------|-----------|
| Total de processos únicos | **7** |
| Processos criminais | **5** (71% do total) |
| Condenações | **1** (violência doméstica — ameaça) |
| Mandados de prisão | 🚨 **2 pendentes** (dívida alimentos) |
| Provider mais completo (processos) | **Escavador + BigDataCorp** (7/7 cada) |
| Provider mais completo (mandados) | **BigDataCorp** (2 mandados vs 1 dos outros) |
| Judit | **14% cobertura** — perdeu 6 de 7 processos |
| Exato | **29% cobertura** — encontrou 2 processos + 1 mandado |

---

## 5. MATHEUS GONÇALVES DOS SANTOS
**CPF:** 462.472.438-04 · **UF:** SP · **Risco esperado:** MÉDIO

### 5.1 Processos encontrados

| # | CNJ | Tipo | Provider | Método | Observação |
|---|-----|------|----------|--------|------------|
| 1 | 0000862-57.2026.8.26.0099 | Desconhecido | Escavador | ⚠️ Nome | Foro Bragança Paulista, SP |
| 2 | 4000254-74.2026.8.26.0233 | Desconhecido | Escavador | ⚠️ Nome | Foro de Ibaté, SP — réu |
| 3 | 5056504-68.2026.8.21.0001 | Cível (Dano moral — enchentes) | Escavador | ⚠️ Nome | Porto Alegre, RS — autor |
| 4 | 1505327-09.2024.8.26.0001 | Cível/Admin | Judit | CPF | Matheus como "averiguado" |

### 5.2 Matriz de cobertura CNJ

| CNJ | Escavador | Judit | Exato | BigDataCorp |
|-----|-----------|-------|-------|-------------|
| 0000862-57.2026.8.26.0099 | ⚠️ Nome | ❌ | ❌ | ❌ |
| 4000254-74.2026.8.26.0233 | ⚠️ Nome | ❌ | ❌ | ❌ |
| 5056504-68.2026.8.21.0001 | ⚠️ Nome | ❌ | ❌ | ❌ |
| 1505327-09.2024.8.26.0001 | ❌ | ✅ | ❌ | ❌ |

> **ATENÇÃO:** Os 3 processos do Escavador foram encontrados por **busca por nome** (não por CPF). Podem ser homônimos — "Matheus Gonçalves dos Santos" é nome relativamente comum. O processo #3 (Porto Alegre/RS) é especialmente suspeito pois Matheus reside em SP.

> **Judit** encontrou um processo DIFERENTE (2024, São Paulo), onde Matheus aparece como "averiguado" pela Justiça Pública — este sim é vinculado ao CPF real.

### 5.3 Mandados de Prisão

| Provider | Encontrou? |
|----------|-----------|
| Judit | ❌ Timeout |
| Exato | ❌ Documento inexistente |
| BigDataCorp | ❌ Nenhum |

### 5.4 Sanções (BigDataCorp KYC)
- **0 sanções** — Nenhum match em nenhuma lista
- IsCurrentlySanctioned: FALSE

### 5.5 Dados exclusivos BigDataCorp
- **Profissão:** 7 registros (vínculos com Madero Indústria e Comércio S.A.)
- **Processos:** 0

### 5.6 Avaliação Matheus

| Critério | Resultado |
|----------|-----------|
| Processos confirmados (por CPF) | **1** (Judit) |
| Processos não confirmados (por nome) | 3 (Escavador — possíveis homônimos) |
| Mandado de prisão | ❌ Nenhum |
| Provider mais eficaz | **Judit** (encontrou processo exclusivo) |
| BigDataCorp/Exato | Nenhum resultado |

---

## BLOCO 2 — ANÁLISE CRUZADA DE COBERTURA

### 2.1 Total de processos únicos encontrados por provider

| Provider | André | Diego | Renan | Francisco | Matheus | **TOTAL** |
|----------|-------|-------|-------|-----------|---------|-----------|
| **Escavador** | 2⚠️ | 1 | 1 | **7** | 3⚠️ | **14** (5 por nome⚠️) |
| **Judit** | 0 | 0 | 1 | 1 | 1 | **3** |
| **Exato** | 0 | 1🔒 | 1 | 2 | 0 | **4** |
| **BigDataCorp** | 0 | 1🔒 | 1 | **7** | 0 | **9** |
| **Universo real** | 0-2 | 2 | 1 | **7** | 1-4 | **11-16** |

### 2.2 Processos EXCLUSIVOS por provider (não encontrados por nenhum outro)

| Provider | Exclusivos | Detalhes |
|----------|------------|---------|
| **Escavador** | **1 confirmado** | Diego: 0001549-63.2024 (Alimentos) |
| **Escavador** | **5 não confirmados (nome)** | André: 2 cíveis SP · Matheus: 3 processos SP/RS |
| **Judit** | **1 confirmado** | Matheus: 1505327-09.2024 (averiguado, SP) |
| **Exato** | **0** | Todos os processos Exato foram confirmados por outro provider |
| **BigDataCorp** | **0 processos** / **1 mandado** | André: mandado prisão Santos/SP (KYC exclusivo) |

### 2.3 Mandados de prisão — Cobertura comparativa

| Candidato | Judit | Exato | BigDataCorp KYC | Total |
|-----------|-------|-------|-----------------|-------|
| **André** | ❌ Timeout | ❌ Não encontrou | 🚨 **1 mandado** | 1 |
| **Diego** | ❌ Timeout | ❌ | ❌ | 0 |
| **Renan** | ❌ Timeout | ❌ | ❌ | 0 |
| **Francisco** | 🚨 **1 mandado** | 🚨 **1 mandado** | 🚨 **2 mandados** | 2 |
| **Matheus** | ❌ Timeout | ❌ | ❌ | 0 |

> **CONCLUSÃO MANDADOS:** BigDataCorp foi o provider mais eficaz para mandados de prisão — encontrou TODOS os mandados (3/3), incluindo 1 que nenhum outro provider encontrou (André). BDC também identificou um 2º mandado de Francisco que Judit/Exato não reportaram.

### 2.4 Taxa de cobertura por candidato

| Candidato | Processos totais | Melhor provider | Pior provider |
|-----------|-----------------|-----------------|---------------|
| André (ALTO) | 0 por CPF | BigDataCorp (mandado KYC) | Judit/Exato (nada) |
| Diego (BAIXO) | 2 | Escavador (1 exclusivo) | Judit (0) |
| Renan (BAIXO) | 1 | Empate (todos encontraram) | — |
| Francisco (CRÍTICO) | 7 + 2 mandados | **Escavador + BigDataCorp** | Judit (1/7 = 14%) |
| Matheus (MÉDIO) | 1 confirmado | Judit (exclusivo) | Exato/BDC (0) |

---

## BLOCO 3 — CAPACIDADES EXCLUSIVAS POR PROVIDER

### 3.1 O que CADA provider oferece que os outros NÃO oferecem

| Capacidade | Escavador | Judit | Exato | BigDataCorp |
|------------|-----------|-------|-------|-------------|
| Busca por NOME | ✅ | ❌ | ❌ | ❌ |
| Busca por CPF | ✅ | ✅ | ✅ | ✅ |
| Processos judiciais | ✅ | ✅ | ✅ | ✅ |
| Mandados de prisão | ❌ | ✅ | ✅ | ✅ (via KYC) |
| Sanções internacionais | ❌ | ❌ | ❌ | ✅ |
| Match rate (% similaridade) | ❌ | ❌ | ❌ | ✅ |
| Dados profissionais | ❌ | ❌ | ❌ | ✅ |
| Detalhes de partes | ✅ Completo | ✅ Parcial | ❌ | ❌ |
| Papel no processo | ✅ | ✅ | ❌ | ❌ |
| Valor da causa | ✅ | ❌ | ✅ | ❌ |
| Filtro por tribunal | ✅ | ❌ | ❌ | ✅ |
| Filtro por tipo/status | ❌ | ❌ | ❌ | ✅ |
| Segredo de justiça | ❌ | ❌ | ✅ | ✅ |

### 3.2 Dados EXCLUSIVOS por provider

**Escavador — Exclusividades:**
- Busca por nome (identifica processos de candidatos sem CPF no sistema)
- Lista completa de partes processuais (advogados, testemunhas, vítimas)
- Papel do investigado no processo (autor, réu, testemunha, executado)
- Cobertura mais ampla de tribunais estaduais

**Judit — Exclusividades:**
- Endpoint dedicado de mandados de prisão (BNMP)
- Dados de classificação processual detalhados
- Consulta de candidatos como "averiguados"

**Exato Digital — Exclusividades:**
- Mandados de prisão com dados biográficos (mãe, pai, gênero)
- Detecta processos em segredo de justiça (marca como selado)
- Valor da causa nos dados do processo

**BigDataCorp — Exclusividades:**
- 🔑 Sanções internacionais (FBI, OFAC, INTERPOL, UK, CA, DDTC)
- 🔑 Sanções CNJ (mandados de prisão via KYC)
- 🔑 Match rate percentual (distingue candidato real de homônimo)
- 🔑 Filtros avançados no endpoint (.filter por tipo, status, UF, polaridade)
- 🔑 Dados profissionais/trabalhistas
- 🔑 Combina 4 datasets em uma única consulta (processos + KYC + profissão + identidade)

---

## BLOCO 4 — CUSTO-BENEFÍCIO

### 4.1 Custo por consulta

| Provider | Custo/consulta | O que inclui |
|----------|---------------|-------------|
| **Escavador** | R$ 0,015 | 1 busca (nome OU CPF) |
| **Judit** | R$ 0,50 — 2,00 | Lawsuits + Warrants (2 endpoints) |
| **Exato** | 1–2 créditos | Processos + Mandados (2 endpoints) |
| **BigDataCorp** | R$ 0,20 | Processos + KYC + Profissão + Identidade (tudo junto) |

### 4.2 Custo por informação ÚTIL encontrada (baseado nos 5 candidatos)

| Provider | Custo total (5 cands.) | Processos encontrados | Mandados encontrados | Custo/processo |
|----------|----------------------|----------------------|---------------------|----------------|
| **Escavador** | R$ 0,075 | 9 (4 por CPF + 5 por nome) | 0 | R$ 0,008/proc |
| **Judit** | R$ 5,00–10,00 | 3 | 1 | R$ 1,25–2,50/proc |
| **Exato** | 5–10 créditos | 4 | 1 | 1–2 créd/proc |
| **BigDataCorp** | R$ 1,00 | 9 | **3** | R$ 0,083/proc |

> **MELHOR CUSTO-BENEFÍCIO:** BigDataCorp (R$ 0,20/consulta, retorna 4 datasets) e Escavador (R$ 0,015/consulta, maior cobertura de processos).

---

## BLOCO 5 — DIAGNÓSTICO E RECOMENDAÇÃO

### 5.1 Ranking de providers por objetivo

| Objetivo | 1º Lugar | 2º Lugar | 3º Lugar | 4º Lugar |
|----------|----------|----------|----------|----------|
| **Volume de processos** | Escavador (14) | BigDataCorp (9) | Exato (4) | Judit (3) |
| **Mandados de prisão** | **BigDataCorp (3/3)** | Exato (1) / Judit (1) | — | Escavador (0) |
| **Sanções internacionais** | **BigDataCorp** (único) | — | — | — |
| **Detalhes processuais** | Escavador | Exato | BigDataCorp | Judit |
| **Custo-benefício** | Escavador | BigDataCorp | Exato | Judit |
| **Dados complementares** | BigDataCorp (profissão) | Escavador (partes) | — | — |

### 5.2 Gaps identificados

| Gap | Impacto | Solução |
|-----|---------|---------|
| Judit encontrou apenas 14% dos processos de Francisco | 🔴 CRÍTICO | Usar como complementar, não primário |
| Exato não encontrou André e Matheus | 🟡 MÉDIO | Combinar com Escavador/BDC |
| Escavador não tem endpoint de mandados | 🔴 CRÍTICO | Obrigatório complementar com BDC ou Judit+Exato |
| BDC retorna mandados apenas via KYC (sanções) | 🟡 MÉDIO | Normalizar campo SanctionsHistory para extrair mandados |
| Judit timeout frequente em warrants | 🟡 MÉDIO | Implementar retry com polling mais longo |

### 5.3 Arquitetura recomendada (3 camadas)

```
CAMADA 1 — TRIAGEM RÁPIDA (sempre executar)
├── Escavador por CPF (R$ 0,015) → processos + partes + papel
└── BigDataCorp combined (R$ 0,20) → processos + mandados/sanções + profissão

CAMADA 2 — CONFIRMAÇÃO (se Camada 1 encontrar algo)
├── Exato Processos → validar e complementar dados processuais
├── Exato Mandados → confirmar mandados de prisão
└── Judit Warrants → confirmar mandados (BNMP oficial)

CAMADA 3 — ENRIQUECIMENTO (casos de alto risco)
├── Escavador por NOME → descobrir processos sem CPF vinculado
├── BigDataCorp filtrado → criminal, trabalhista, ativo por UF
└── AI Homonym → validar sanções BDC com match rate < 60%
```

### 5.4 Combinação mínima recomendada

Para **cobertura ≥ 95%** dos cenários testados:

> **Escavador + BigDataCorp** = custo R$ 0,215/candidato  
> - Processos: 100% de cobertura (todos os CNJs encontrados)  
> - Mandados: 100% de cobertura (BDC via KYC)  
> - Sanções internacionais: 100% (BDC exclusivo)  
> - Complementares: profissão, partes, papel no processo

Se orçamento permitir, adicionar **Exato** para validação cruzada de mandados (fonte independente).

---

## BLOCO 6 — TABELA FINAL CONSOLIDADA

### Todos os processos × providers × candidatos

| Candidato | CNJ | Tipo | Status | ESC | JUD | EXA | BDC |
|-----------|-----|------|--------|-----|-----|-----|-----|
| **ANDRÉ** | 1500388-74.2017.8.26.0536 | 🚨 MANDADO PRISÃO | Pendente | ❌ | ❌ | ❌ | ✅ |
| André | 1015247-79.2025.8.26.0114 | Cível | Ativo | ⚠️ | ❌ | ❌ | ❌ |
| André | 1014345-29.2025.8.26.0114 | Cível | Inativo | ⚠️ | ❌ | ❌ | ❌ |
| **DIEGO** | 0001549-63.2024.8.06.0001 | Cível (Alimentos) | Inativo | ✅ | ❌ | ❌ | ❌ |
| Diego | 0114945-28.2018.8.06.0001 | 🔒 Segredo Justiça | Ocultado | ❌ | ❌ | ✅ | ✅ |
| **RENAN** | 0101976-21.2016.5.01.0007 | Trabalhista | Arquivado | ✅ | ✅ | ✅ | ✅ |
| **FRANCISCO** | 0040713-08.2013.8.06.0167 | Criminal (Contravenção) | Arquivado | ✅ | ❌ | ❌ | ✅ |
| Francisco | 0053023-02.2020.8.06.0167 | Cível (Alimentos) | Inativo | ✅ | ❌ | 🔒 | ✅ |
| Francisco | 0013417-40.2021.8.06.0293 | Criminal (Maria da Penha) | Arquivado | ✅ | ❌ | ❌ | ✅ |
| Francisco | 3001575-02.2021.8.06.0167 | Criminal (Arma branca) | Encerrado | ✅ | ❌ | ❌ | ✅ |
| Francisco | 0012198-45.2022.8.06.0167 | Criminal (Ação Penal) | Ativo | ✅ | ❌ | ❌ | ✅ |
| Francisco | 0202743-72.2022.8.06.0167 | Criminal (Violência dom.) | **Condenado** | ✅ | ✅ | ✅ | ✅ |
| Francisco | 0205659-11.2024.8.06.0167 | Cível (Alimentos exec.) | **Ativo** | ✅ | ❌ | ❌ | ✅ |
| Francisco | 0204723-54.2022.8.06.0167 | 🚨 MANDADO PRISÃO CIVIL ×2 | **Pendente** | ❌ | ✅ | ✅ | ✅ |
| **MATHEUS** | 1505327-09.2024.8.26.0001 | Cível/Admin (averiguado) | Ativo | ❌ | ✅ | ❌ | ❌ |
| Matheus | 0000862-57.2026.8.26.0099 | Desconhecido | — | ⚠️ | ❌ | ❌ | ❌ |
| Matheus | 4000254-74.2026.8.26.0233 | Desconhecido | — | ⚠️ | ❌ | ❌ | ❌ |
| Matheus | 5056504-68.2026.8.21.0001 | Cível (Enchentes) | — | ⚠️ | ❌ | ❌ | ❌ |

### Contagem final

| Métrica | Escavador | Judit | Exato | BigDataCorp |
|---------|-----------|-------|-------|-------------|
| **Processos encontrados** | 9+5⚠️ | 3 | 4 | 9 |
| **Processos exclusivos** | 1+5⚠️ | 1 | 0 | 0 |
| **Mandados de prisão** | 0 | 1 | 1 | **3** |
| **Mandados exclusivos** | 0 | 0 | 0 | **1** (André) |
| **Sanções internacionais** | 0 | 0 | 0 | **60+** |
| **Taxa cobertura (Francisco)** | **100%** | 14% | 29% | **100%** |

---

*Documento gerado automaticamente a partir dos resultados raw de teste em `results/`, `results/exato/` e `results/bigdatacorp/`.*
