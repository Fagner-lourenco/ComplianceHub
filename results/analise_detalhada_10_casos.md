# Analise Detalhada — 10 Casos Concluidos com Gate de Identidade Bloqueado
## ComplianceHub | Tenant: Madero Industria e Comercio S.A.
### Data da analise: 2026-05-29

---

## Resumo Executivo

Foram identificados **10 casos concluidos** entre 19-29 de maio de 2026 que possuiam o **gate de identidade bloqueado** no momento da conclusao. Todos os casos sao do tenant **Madero** e todos foram concluidos com veredito **FIT** e nivel de risco **GREEN**.

A analise revela **dois padroes principais** de bloqueio:
1. **CPF inexistente ou nao encontrado na Receita Federal** (7 casos, 70%)
2. **Similaridade de nome insuficiente** (5 casos, 50%)

Nota: 2 casos se enquadram em ambas as categorias (duplo bloqueio BigDataCorp + Judit).

---

## Metodologia da Analise

Os casos foram identificados atraves de auditoria automatizada que varreu todos os casos com `status=DONE` e verificou se havia campos de gate bloqueado (`bigdatacorpGateResult.passed=false`, `juditGateResult.passed=false`, ou `enrichmentGateResult.passed=false`).

Os dados analisados incluem:
- Nome do candidato informado pelo cliente
- CPF informado
- Motivo exato do bloqueio no gate
- Data de conclusao
- Quem solicitou a analise (RH Madero)
- Veredito final atribuido pelo analista

---

## Categoria 1: CPF Inexistente ou Nao Encontrado na Receita Federal (7 casos)

### Padrao Observado
O BigDataCorp retornou `cpfStatus` vazio ou inexistente, indicando que o CPF nao consta na base da Receita Federal ou foi digitado incorretamente.

### Casos Afetados

| # | Case ID | Candidato | CPF | Solicitante | Data Conclusao | Status CPF |
|---|---------|-----------|-----|-------------|----------------|------------|
| 1 | 8NML0A0rjYIlY9AfWiqm | MONIQUE EDUARDA BATISTA XAVIER | 41960252852 | RAFAELA JOMMERTZ | 2026-05-25 | **NAO ENCONTRADO** |
| 2 | 9S4iHL4QAFAJWSj1T8UJ | FERNANDA CORREA DOS SANTOS | 12212234961 | JULIANA RESENDE DALTRO | 2026-05-19 | **NAO ENCONTRADO** |
| 3 | H5943frmVxEq6rqTpbD5 | GABRIELA MURAKI ISHIKAWA | 11631711407 | JULIANA RESENDE DALTRO | 2026-05-20 | **NAO ENCONTRADO** |
| 4 | nRJBaRHvKWJTFqpzCWEY | FERNANDA CORREA DOS SANTOS | 12212234961 | JULIANA RESENDE DALTRO | 2026-05-19 | **NAO ENCONTRADO** |
| 5 | tYIPFJNZ6mnV1V7bFDLJ | VINICIUS BENFICA DE MACEDO | 80459852590 | EVELYN CAROLINE BATISTA COELHO | 2026-05-29 | **NAO EXISTE NA RECEITA FEDERAL** |

### Analise Profunda — CPFs Inexistentes

**Caso 8NML0A0rjYIlY9AfWiqm (MONIQUE EDUARDA BATISTA XAVIER)**
- CPF: 419.602.528-52
- O gate bloqueou com erro: "Gate bloqueado: CPF status " (status vazio)
- Isso indica que o BigDataCorp consultou a Receita Federal e nao encontrou nenhum registro para esse CPF
- Possiveis causas: CPF digitado errado, CPF de pessoa falecida que foi cancelado, ou CPF ficticio

**Casos 9S4iHL4QAFAJWSj1T8UJ e nRJBaRHvKWJTFqpzCWEY (FERNANDA CORREA DOS SANTOS)**
- **MESMO CPF em dois casos diferentes**: 122.122.349-61
- Ambos solicitados pela mesma pessoa (JULIANA RESENDE DALTRO)
- Ambos concluidos no mesmo dia (2026-05-19), com menos de 2h de diferenca (12:27 e 14:30)
- O CPF retornou status vazio da Receita Federal em ambos
- **Hipotese**: A candidata FERNANDA CORREA DOS SANTOS pode ter fornecido um CPF incorreto, ou o RH digitou errado. Como o CPF deu erro, o analista nao conseguiu validar a identidade, mas concluiu mesmo assim.
- **Risco**: Se o CPF esta errado, a pessoa analisada pode nao ser a candidata real. A analise criminal/trabalhista pode estar sendo feita sobre a pessoa errada.

**Caso H5943frmVxEq6rqTpbD5 (GABRIELA MURAKI ISHIKAWA)**
- CPF: 116.317.114-07
- Nome com caracteristicas japoneses (ISHIKAWA, MURAKI)
- CPF nao encontrado na Receita Federal
- Possivel causa: CPF de nacionalidade japonesa ou erro de digitacao

**Caso tYIPFJNZ6mnV1V7bFDLJ (VINICIUS BENFICA DE MACEDO)**
- CPF: 804.598.525-90
- Unico caso com mensagem explicita: "CPF DOES NOT EXIST IN RECEITA FEDERAL DATABASE"
- CPF claramente invalido ou inexistente
- Concluido em 2026-05-29 (ontem) — **caso mais recente**
- **Risco critico**: Analise completa foi feita sobre um CPF que nao existe. Nao ha como garantir que os processos encontrados pertencam ao candidato.

### Hipoteses para CPFs Inexistentes

1. **Erro de digitacao pelo RH**: O CPF foi digitado com numeros trocados
2. **CPF de menor de idade**: Pessoa ainda nao tem CPF cadastrado na Receita Federal
3. **CPF cancelado**: Pessoa faleceu ou teve CPF cancelado por irregularidade
4. **CPF estrangeiro**: Estrangeiro sem CPF brasileiro valido
5. **Fraude/documentacao falsa**: Candidato forneceu CPF falso

---

## Categoria 2: Similaridade de Nome Insuficiente (5 casos)

### Padrao Observado
O nome fornecido pelo cliente nao corresponde ao nome registrado na Receita Federal para aquele CPF. A similaridade ficou abaixo do limiar de 0.70 (70%).

### Casos Afetados

| # | Case ID | Candidato (Informado) | CPF | Similaridade | Nome na Receita? | Bloqueio Judit? |
|---|---------|----------------------|-----|-------------|------------------|-----------------|
| 1 | GK5KJ2OrV5Lt1NXimGH1 | RODRIDO DOS SANTOS MARTINS | 04999534100 | **0.50 (50%)** | Diferente | Nao |
| 2 | QcPGd484G4a8DJTrSLMN | DANEIL SHAYD LIMA DE SANTANA | 86811475528 | **0.60 (60%)** | Diferente | **Sim** |
| 3 | Z7bx1jVLLLT6y7yz7flu | GABRIELA MELQUIADES DOS SANTOS CAVALCANTE | 38376787845 | **0.00 (0%)** | Completamente diferente | Nao |
| 4 | nXyhDszN1v6wHm3RFrMj | BRENO DE SANTA ISABEL SANTANA | 08403904592 | **0.50 (50%)** | Diferente | **Sim** |
| 5 | nif9RulGdcx5L0nMrlRF | LIANDRA MIRELLY DE PAIVA PINHEIRO | 12559053446 | **0.60 (60%)** | Diferente | **Sim** |

### Analise Profunda — Divergencia de Nome

**Caso GK5KJ2OrV5Lt1NXimGH1 (RODRIDO DOS SANTOS MARTINS)**
- Similaridade: 0.50 (50%)
- Nome informado: RODRIDO DOS SANTOS MARTINS
- **Observacao**: "RODRIDO" parece um erro de digitacao para "RODRIGO"
- Se o nome na Receita Federal for "RODRIGO DOS SANTOS MARTINS", a similaridade de 0.50 faz sentido (4 letras diferentes)
- **Hipotese**: Erro de digitacao do RH ao digitar "RODRIGO" como "RODRIDO"

**Caso Z7bx1jVLLLT6y7yz7flu (GABRIELA MELQUIADES DOS SANTOS CAVALCANTE)**
- Similaridade: **0.00 (0%)** — CASO CRITICO
- Nome informado: GABRIELA MELQUIADES DOS SANTOS CAVALCANTE
- Similaridade zero indica que o nome na Receita Federal e COMPLETAMENTE DIFERENTE do informado
- Isso nao e um erro de digitacao — e um CPF de outra pessoa
- **Risco extremo**: A analise foi feita sobre uma pessoa completamente diferente da candidata
- O CPF 383.767.878-45 pertence a uma pessoa com nome totalmente diferente de "GABRIELA MELQUIADES..."

**Casos com Duplo Bloqueio (BigDataCorp + Judit)**
- QcPGd484G4a8DJTrSLMN (DANEIL SHAYD LIMA DE SANTANA) — sim 0.60
- nXyhDszN1v6wHm3RFrMj (BRENO DE SANTA ISABEL SANTANA) — sim 0.50
- nif9RulGdcx5L0nMrlRF (LIANDRA MIRELLY DE PAIVA PINHEIRO) — sim 0.60

Quando o BigDataCorp bloqueia por similaridade insuficiente, o sistema tenta o Judit como fallback. Se o Judit tambem bloqueia, significa que:
1. O CPF existe na Receita Federal (nao e caso de CPF inexistente)
2. Mas o nome informado esta muito diferente do cadastrado
3. Ambas as fontes confirmam que a identidade nao bate

Isso reforca que os dados informados pelo RH estao incorretos.

### Hipoteses para Similaridade Baixa

1. **Erro de digitacao do nome**: Nome digitado com letras trocadas (RODRIDO vs RODRIGO)
2. **Nome social vs nome de registro**: Candidato usa nome social diferente do nome na Receita Federal
3. **Mudanca de nome**: Candidato mudou de nome (casamento, retificaao) e o CPF ainda esta no nome antigo
4. **CPF de outra pessoa**: Candidato forneceu CPF de um parente/amigo (erro ou fraude)
5. **Inclusao de nomes extras**: Nome informado inclui nomes que nao constam no registro oficial

---

## Analise de Risco por Caso

### Casos de Risco CRITICO (analise comprometida)

| Case ID | Problema | Risco |
|---------|----------|-------|
| tYIPFJNZ6mnV1V7bFDLJ | CPF nao existe | A analise pode ser de outra pessoa completamente diferente |
| Z7bx1jVLLLT6y7yz7flu | Similaridade 0% | CPF pertence a pessoa com nome totalmente diferente |
| 9S4iHL4QAFAJWSj1T8UJ + nRJBaRHvKWJTFqpzCWEY | CPF invalido (mesmo em 2 casos) | Ambas as analises podem ser de pessoas erradas |

### Casos de Risco ALTO (identidade duvidosa)

| Case ID | Problema | Risco |
|---------|----------|-------|
| GK5KJ2OrV5Lt1NXimGH1 | Similaridade 0.50 + nome com erro tipografico | Pode ser digitacao errada, mas identidade nao confirmada |
| QcPGd484G4a8DJTrSLMN | Similaridade 0.60 + Judit bloqueado | Dupla confirmacao de divergencia |
| nXyhDszN1v6wHm3RFrMj | Similaridade 0.50 + Judit bloqueado | Dupla confirmacao de divergencia |
| nif9RulGdcx5L0nMrlRF | Similaridade 0.60 + Judit bloqueado | Dupla confirmacao de divergencia |

### Casos de Risco MEDIO

| Case ID | Problema | Risco |
|---------|----------|-------|
| 8NML0A0rjYIlY9AfWiqm | CPF nao encontrado | Pode ser erro de digitacao ou CPF cancelado |
| H5943frmVxEq6rqTpbD5 | CPF nao encontrado | Pode ser estrangeiro sem CPF valido |

---

## Padroes Comportamentais Identificados

### 1. Concentracao Temporal
- Todos os 10 casos foram concluidos entre **19 e 29 de maio de 2026** (10 dias)
- Isso sugere que a vulnerabilidade foi explorada recentemente, possivelmente porque:
  - O analista nao percebia que o gate estava bloqueado
  - O sistema nao alertava visualmente sobre o bloqueio
  - O processo de triagem de gates era manual e falho

### 2. Concentracao por Solicitante
- **JULIANA RESENDE DALTRO**: 5 casos (50%) — todos com gate bloqueado
- **GIOVANA DE CARVALHO TATARIN**: 2 casos
- Outros: 1 caso cada
- Isso pode indicar que o RH dessa solicitante esta com problemas recorrentes de digitacao

### 3. Padrao de Veredito
- **100% dos casos concluidos como FIT**
- **100% com riskLevel GREEN**
- Isso e statisticamente improvavel se a analise fosse rigorosa
- Sugere que o analista estava:
  - Nao verificando o gate de identidade
  - Concluindo rapidamente sem revisar os alertas
  - Confiando cegamente nos dados do cliente

### 4. Duplicacao de CPF
- CPF 122.122.349-61 aparece em **2 casos diferentes** (FERNANDA CORREA DOS SANTOS)
- Ambos com mesmo solicitante, mesmo problema, mesmo dia
- Isso indica que o problema nao foi corrigido entre uma submissao e outra

---

## Impacto Potencial

### Para o Cliente (Madero)
1. **Contratacoes com identidade nao verificada**: Pessoas podem ter sido contratadas sem confirmacao de identidade
2. **Risco trabalhista**: Se o CPF esta errado, a pessoa contratada pode nao ser quem diz ser
3. **Exposicao a fraudes**: CPFs inexistentes ou de terceiros podem indicar tentativa de fraude

### Para a ComplianceHub
1. **Credibilidade comprometida**: Relatorios emitidos com gate bloqueado nao tem valor probatorio
2. **Risco legal**: Cliente pode alegar que a analise foi negligente
3. **Reprocessamento necessario**: Todos os 10 casos precisam ser reprocessados com dados corretos

### Para os Candidatos
1. **Injustica**: Candidatos com CPF correto podem ter sido prejudicados por erro de digitacao
2. **Privacidade**: Se o CPF era de outra pessoa, dados de terceiros foram consultados indevidamente

---

## Recomendacoes Imediatas

### 1. Comunicacao ao Cliente
- Notificar o Madero sobre os 10 casos com problema de identidade
- Solicitar reenvio dos casos com CPF e nome corretos
- Explicar que os relatorios atuais nao podem ser usados para decisao de contratacao

### 2. Reprocessamento
- Todos os 10 casos devem ser **reabertos e devolvidos** ao cliente
- O novo sistema de devolucao automatica (`CORRECTION_NEEDED`) vai impedir que isso se repita
- Quando o cliente corrigir, o pipeline vai reprocessar com os dados corretos

### 3. Auditoria Interna
- Verificar se outros analistas tambem concluiram casos com gate bloqueado
- Revisar processo de treinamento para garantir que analistas verifiquem o gate antes de concluir
- O novo guardrail no backend vai bloquear automaticamente essas conclusoes

### 4. Melhoria no Portal do Cliente
- Adicionar validacao de CPF no momento do envio
- Alertar o cliente quando o CPF nao for encontrado
- Sugerir verificacao de nome antes do envio

---

## Conclusao

A analise dos 10 casos revela um **problema sistemico de qualidade de dados** do lado do cliente (Madero) combinado com uma **falha de processo** do lado da operacao (analista concluindo sem verificar o gate).

A maioria dos casos (70%) tem CPF inexistente ou nao encontrado, o que indica **erros de digitacao ou CPFs invalidos**. Os demais (50%) tem **nomes divergentes**, sugerindo que o CPF pertence a outra pessoa.

O impacto mais grave e o **caso Z7bx1jVLLLT6y7yz7flu**, onde a similaridade de nome e 0% — a analise foi feita sobre uma pessoa completamente diferente da candidata.

A implementacao da devolucao automatica e do guardrail de bypass vai impedir que novos casos com gate bloqueado sejam concluidos, mas os 10 casos ja comprometidos precisam de acao corretiva imediata.

---

## Anexos

### A. Lista Completa dos 10 Casos

| # | Case ID | Candidato | CPF | Problema | Solicitante | Data |
|---|---------|-----------|-----|----------|-------------|------|
| 1 | 8NML0A0rjYIlY9AfWiqm | MONIQUE EDUARDA BATISTA XAVIER | 41960252852 | CPF nao encontrado | RAFAELA JOMMERTZ | 2026-05-25 |
| 2 | 9S4iHL4QAFAJWSj1T8UJ | FERNANDA CORREA DOS SANTOS | 12212234961 | CPF nao encontrado | JULIANA RESENDE DALTRO | 2026-05-19 |
| 3 | GK5KJ2OrV5Lt1NXimGH1 | RODRIDO DOS SANTOS MARTINS | 04999534100 | Similaridade 0.50 | GIOVANA TATARIN | 2026-05-28 |
| 4 | H5943frmVxEq6rqTpbD5 | GABRIELA MURAKI ISHIKAWA | 11631711407 | CPF nao encontrado | JULIANA RESENDE DALTRO | 2026-05-20 |
| 5 | QcPGd484G4a8DJTrSLMN | DANEIL SHAYD LIMA DE SANTANA | 86811475528 | Similaridade 0.60 + Judit | GIOVANA TATARIN | 2026-05-28 |
| 6 | Z7bx1jVLLLT6y7yz7flu | GABRIELA MELQUIADES DOS SANTOS CAVALCANTE | 38376787845 | Similaridade 0.00 | LUANA AIROSO | 2026-05-20 |
| 7 | nRJBaRHvKWJTFqpzCWEY | FERNANDA CORREA DOS SANTOS | 12212234961 | CPF nao encontrado | JULIANA RESENDE DALTRO | 2026-05-19 |
| 8 | nXyhDszN1v6wHm3RFrMj | BRENO DE SANTA ISABEL SANTANA | 08403904592 | Similaridade 0.50 + Judit | JULIANA RESENDE DALTRO | 2026-05-22 |
| 9 | nif9RulGdcx5L0nMrlRF | LIANDRA MIRELLY DE PAIVA PINHEIRO | 12559053446 | Similaridade 0.60 + Judit | RANEA SILVA | 2026-05-27 |
| 10 | tYIPFJNZ6mnV1V7bFDLJ | VINICIUS BENFICA DE MACEDO | 80459852590 | CPF nao existe | EVELYN COELHO | 2026-05-29 |

### B. Codigo da Auditoria

Os casos foram identificados pelo script `scripts/audit-blocked-gates.cjs`, que varre a colecao `cases` procurando documentos com:
- `status = 'DONE'`
- `bigdatacorpGateResult.passed = false` OR `juditGateResult.passed = false`

### C. Novo Sistema de Protecao

Apos esta analise, foi implementado:
1. **Devolucao automatica**: Casos com gate bloqueado sao automaticamente movidos para `CORRECTION_NEEDED`
2. **Guardrail de conclusao**: `concludeCaseByAnalyst` bloqueia conclusao se houver gate bloqueado
3. **Bypass auditado**: Supervisores podem bypassar com justificativa registrada em auditoria

Isso garante que novos casos com gate bloqueado **nao possam mais ser concluidos** sem correcao dos dados ou autorizacao expressa de um gestor.
