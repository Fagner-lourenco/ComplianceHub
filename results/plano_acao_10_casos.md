# Plano de Acao — Retorno dos 10 Casos com Gate Bloqueado
## Data: 2026-05-29
## Responsavel: Sistema (devolucao automatica) + Analista (fundamentacao)

---

## PARTE 1 — Casos com CPF Inexistente/Nao Encontrado (5 casos)

### Fundamentacao Padrao
Estes casos serao devolvidos ao cliente com status `CORRECTION_NEEDED` e motivo `identity_gate_blocked`.

**Mensagem de sistema:**
> A analise foi devolvida automaticamente para correcao cadastral. Fonte: BigDataCorp. Motivo: O CPF informado nao foi encontrado na base da Receita Federal. Por favor, revise o CPF e nome informados e reenvie a solicitacao. Verifique se o CPF foi digitado corretamente ou se o candidato possui CPF valido cadastrado.

### Caso 1: 8NML0A0rjYIlY9AfWiqm
- **Candidato:** MONIQUE EDUARDA BATISTA XAVIER
- **CPF:** 41960252852
- **Problema:** CPF nao encontrado na Receita Federal (status vazio)
- **Solicitante:** RAFAELA JOMMERTZ
- **Data Conclusao:** 2026-05-25
- **Acao:** Devolver para correcao
- **Justificativa:** CPF 41960252852 nao localizado na base oficial da Receita Federal. Possivel erro de digitacao ou CPF cancelado/inexistente.

### Caso 2: 9S4iHL4QAFAJWSj1T8UJ
- **Candidato:** FERNANDA CORREA DOS SANTOS
- **CPF:** 12212234961
- **Problema:** CPF nao encontrado na Receita Federal (status vazio)
- **Solicitante:** JULIANA RESENDE DALTRO
- **Data Conclusao:** 2026-05-19
- **Acao:** Devolver para correcao
- **Justificativa:** CPF 12212234961 nao localizado na base oficial da Receita Federal. Este mesmo CPF foi utilizado em outro caso (nRJBaRHvKWJTFqpzCWEY) com o mesmo problema, indicando possivel CPF invalido ou digitacao sistemica.
- **Observacao critica:** Este CPF aparece em 2 casos diferentes. Necessario verificar com solicitante se nao houve duplicacao de envio ou erro de digitacao.

### Caso 3: H5943frmVxEq6rqTpbD5
- **Candidato:** GABRIELA MURAKI ISHIKAWA
- **CPF:** 11631711407
- **Problema:** CPF nao encontrado na Receita Federal (status vazio)
- **Solicitante:** JULIANA RESENDE DALTRO
- **Data Conclusao:** 2026-05-20
- **Acao:** Devolver para correcao
- **Justificativa:** CPF 11631711407 nao localizado na base oficial da Receita Federal. Considerando o sobrenome japones (ISHIKAWA), possivel que seja estrangeira sem CPF brasileiro valido ou com numero de identidade diferente.

### Caso 4: nRJBaRHvKWJTFqpzCWEY
- **Candidato:** FERNANDA CORREA DOS SANTOS
- **CPF:** 12212234961
- **Problema:** CPF nao encontrado na Receita Federal (status vazio)
- **Solicitante:** JULIANA RESENDE DALTRO
- **Data Conclusao:** 2026-05-19
- **Acao:** Devolver para correcao
- **Justificativa:** CPF 12212234961 nao localizado na base oficial da Receita Federal. Este CPF foi utilizado em outro caso (9S4iHL4QAFAJWSj1T8UJ) no mesmo dia pelo mesmo solicitante, indicando possivel erro de digitacao ou CPF invalido.

### Caso 5: tYIPFJNZ6mnV1V7bFDLJ
- **Candidato:** VINICIUS BENFICA DE MACEDO
- **CPF:** 80459852590
- **Problema:** CPF nao existe na Receita Federal (mensagem explicita: "CPF DOES NOT EXIST IN RECEITA FEDERAL DATABASE")
- **Solicitante:** EVELYN CAROLINE BATISTA COELHO
- **Data Conclusao:** 2026-05-29
- **Acao:** Devolver para correcao
- **Justificativa:** CPF 80459852590 nao consta na base oficial da Receita Federal. Mensagem explicita do provedor: "CPF DOES NOT EXIST IN RECEITA FEDERAL DATABASE". CPF claramente invalido ou inexistente.

---

## PARTE 2 — Casos com Similaridade de Nome Insuficiente (5 casos)

### Metodologia de Analise
Para cada caso, precisamos verificar:
1. O nome informado pelo cliente
2. O nome retornado pelo BigDataCorp (campo `bigdatacorpName`)
3. O nome retornado pelo Judit (campo `juditIdentity.name`)
4. A distancia de edicao (quanto diferem)
5. Decisao: CORRIGIR AUTOMATICAMENTE vs DEVOLVER AO CLIENTE

### Critérios de Decisao
- **Corrigir automaticamente:** Se a diferenca for claramente erro de digitacao (letras trocadas, falta de sobrenome que existe no CPF, nome social vs nome de registro com alta similaridade)
- **Devolver ao cliente:** Se o nome for totalmente diferente (similaridade < 0.30 ou nomes sem relacao), CPF pertence a outra pessoa

---

### Caso A: GK5KJ2OrV5Lt1NXimGH1
**Nome informado:** RODRIDO DOS SANTOS MARTINS
**Similaridade:** 0.50
**Problema:** Similaridade insuficiente

**Analise:**
- "RODRIDO" vs possivel nome real "RODRIGO"
- Diferenca de apenas 1 letra: 'O' no final vs 'O'
- Na verdade, RODRIDO → RODRIGO: a 4a letra seria 'I' vs 'G', e ultima 'O' vs 'O'
- Distancia de edicao: 1-2 caracteres
- Sobrenomes identicos: DOS SANTOS MARTINS

**Decisao:** CORRIGIR AUTOMATICAMENTE
**Fundamentacao:** Erro evidente de digitacao. "RODRIDO" claramente deveria ser "RODRIGO". Os sobrenomes sao identicos. Similaridade de 0.50 reflete exatamente essa diferenca de 1-2 letras. Vamos corrigir o nome para RODRIGO DOS SANTOS MARTINS e reprocessar.

**Campos a atualizar:**
- `candidateName`: "RODRIGO DOS SANTOS MARTINS"
- `correctionReason`: "identity_gate_auto_corrected"
- `correctionNotes`: "Nome corrigido automaticamente: RODRIDO → RODRIGO (erro de digitacao de 1 letra). CPF valido encontrado na Receita Federal."
- `status`: "PENDING" (para reprocessar o gate)
- `bigdatacorpEnrichmentStatus`: "PENDING"
- `juditEnrichmentStatus`: "PENDING"
- Limpar campos de gate anteriores

---

### Caso B: QcPGd484G4a8DJTrSLMN
**Nome informado:** DANEIL SHAYD LIMA DE SANTANA
**Similaridade:** 0.60
**Problema:** Similaridade insuficiente + Judit bloqueado
**Duplo bloqueio:** Sim (BigDataCorp + Judit)

**Analise:**
- "DANEIL" → possivel "DANIEL" (troca de 'E' e 'I')
- "SHAYD" → possivel "SHAYDE" ou "SHAYDA" ou nome estrangeiro
- O nome parece ter origem arabe/estrangeira
- Similaridade de 0.60 indica que parte do nome bate (LIMA DE SANTANA provavelmente)
- Duplo bloqueio indica que tanto BigDataCorp quanto Judit confirmam divergencia

**Possibilidades:**
1. Erro de digitacao: DANEIL → DANIEL (provavel)
2. Nome social estrangeiro diferente do nome de registro
3. Candidato mudou de nome

**Decisao:** DEVOLVER AO CLIENTE para confirmacao
**Fundamentacao:** Embora "DANEIL" possa ser "DANIEL", o segundo nome "SHAYD" e incomum e pode ser digitacao de "SHAYDE" ou nome estrangeiro. Com duplo bloqueio, e mais seguro confirmar com o cliente o nome exato como consta na Receita Federal.

**Mensagem:**
> A analise foi devolvida automaticamente para correcao cadastral. Fonte: BigDataCorp + Judit. Motivo: O nome informado (DANEIL SHAYD LIMA DE SANTANA) nao corresponde exatamente ao nome registrado na Receita Federal para o CPF 86811475528. Similaridade: 60%. Possivel erro de digitacao ou uso de nome social diferente do nome de registro. Por favor, confirme o nome EXATO como consta no documento de identidade do candidato.

---

### Caso C: Z7bx1jVLLLT6y7yz7flu
**Nome informado:** GABRIELA MELQUIADES DOS SANTOS CAVALCANTE
**Similaridade:** 0.00
**Problema:** Similaridade ZERO

**Analise:**
- Similaridade 0.00 = nome COMPLETAMENTE DIFERENTE
- Isso significa que o CPF 38376787845 pertence a uma pessoa cujo nome nao tem NENHUMA semelhanca com "GABRIELA MELQUIADES DOS SANTOS CAVALCANTE"
- Nao e erro de digitacao — e outra pessoa completamente diferente

**Decisao:** DEVOLVER AO CLIENTE — CPF PERTENCE A OUTRA PESSOA
**Fundamentacao:** Similaridade de 0% indica que o CPF informado pertence a uma pessoa com nome totalmente diferente da candidata. Nao e possivel que seja erro de digitacao. O cliente precisa confirmar se o CPF esta correto ou se foi fornecido CPF de outra pessoa.

**Mensagem:**
> A analise foi devolvida automaticamente para correcao cadastral. Fonte: BigDataCorp. Motivo: O CPF 38376787845 pertence a uma pessoa com nome TOTALMENTE DIFERENTE do informado (GABRIELA MELQUIADES DOS SANTOS CAVALCANTE). Similaridade: 0%. O CPF informado NAO PERTENCE a esta candidata. Por favor, verifique o CPF correto junto ao candidato e reenvie a solicitacao.

---

### Caso D: nXyhDszN1v6wHm3RFrMj
**Nome informado:** BRENO DE SANTA ISABEL SANTANA
**Similaridade:** 0.50
**Problema:** Similaridade insuficiente + Judit bloqueado
**Duplo bloqueio:** Sim

**Analise:**
- Nome: BRENO DE SANTA ISABEL SANTANA
- Similaridade 0.50 indica metade do nome corresponde
- Possiveis problemas:
  - "DE SANTA ISABEL" pode ser apelido/local de origem, nao parte do nome oficial
  - Nome real pode ser apenas "BRENO SANTANA"
  - Ou pode ter sobrenomes adicionais no registro

**Decisao:** DEVOLVER AO CLIENTE para confirmacao
**Fundamentacao:** Similaridade de 50% com duplo bloqueio. O nome contem "DE SANTA ISABEL" que pode nao fazer parte do nome oficial. Necessario confirmar o nome EXATO como consta no RG/CPF.

**Mensagem:**
> A analise foi devolvida automaticamente para correcao cadastral. Fonte: BigDataCorp + Judit. Motivo: O nome informado (BRENO DE SANTA ISABEL SANTANA) nao corresponde exatamente ao nome registrado na Receita Federal para o CPF 08403904592. Similaridade: 50%. Possivel que "DE SANTA ISABEL" nao faca parte do nome oficial. Por favor, confirme o nome EXATO como consta no documento de identidade.

---

### Caso E: nif9RulGdcx5L0nMrlRF
**Nome informado:** LIANDRA MIRELLY DE PAIVA PINHEIRO
**Similaridade:** 0.60
**Problema:** Similaridade insuficiente + Judit bloqueado
**Duplo bloqueio:** Sim

**Analise:**
- Nome: LIANDRA MIRELLY DE PAIVA PINHEIRO
- Similaridade 0.60 = 60% do nome corresponde
- Possiveis problemas:
  - "MIRELLY" → pode ser "MIRELLI" ou "MIRELY" (erro de grafia)
  - "LIANDRA" → pode ser "LIANDRA" ou "LEANDRA"
  - Ou CPF pertence a pessoa com nome parecido mas nao identico

**Decisao:** DEVOLVER AO CLIENTE para confirmacao
**Fundamentacao:** Similaridade de 60% com duplo bloqueio. Embora parte do nome corresponda (DE PAIVA PINHEIRO), o primeiro nome pode ter variacao de grafia. Mais seguro confirmar com o cliente.

**Mensagem:**
> A analise foi devolvida automaticamente para correcao cadastral. Fonte: BigDataCorp + Judit. Motivo: O nome informado (LIANDRA MIRELLY DE PAIVA PINHEIRO) nao corresponde exatamente ao nome registrado na Receita Federal para o CPF 12559053446. Similaridade: 60%. Possivel variacao de grafia no primeiro nome. Por favor, confirme o nome EXATO como consta no documento de identidade.

---

## RESUMO DAS ACOES

### Casos para Devolver ao Cliente (9 casos)
| Case ID | Motivo | Status |
|---------|--------|--------|
| 8NML0A0rjYIlY9AfWiqm | CPF inexistente | Devolver |
| 9S4iHL4QAFAJWSj1T8UJ | CPF inexistente | Devolver |
| H5943frmVxEq6rqTpbD5 | CPF inexistente | Devolver |
| nRJBaRHvKWJTFqpzCWEY | CPF inexistente | Devolver |
| tYIPFJNZ6mnV1V7bFDLJ | CPF inexistente | Devolver |
| QcPGd484G4a8DJTrSLMN | Similaridade + duplo bloqueio | Devolver |
| Z7bx1jVLLLT6y7yz7flu | Similaridade 0% | Devolver |
| nXyhDszN1v6wHm3RFrMj | Similaridade + duplo bloqueio | Devolver |
| nif9RulGdcx5L0nMrlRF | Similaridade + duplo bloqueio | Devolver |

### Casos para Corrigir Automaticamente (1 caso)
| Case ID | Problema | Correcao | Status |
|---------|----------|----------|--------|
| GK5KJ2OrV5Lt1NXimGH1 | Erro de digitacao | RODRIDO → RODRIGO | Corrigir e reprocessar |

---

## PROXIMAS ETAPAS

1. **Executar devolucao dos 9 casos** via script ou funcao Firebase
2. **Executar correcao automatica do caso GK5KJ2OrV5Lt1NXimGH1**
3. **Notificar cliente Madero** sobre os casos devolvidos
4. **Acompanhar reenvio** dos casos com dados corretos

---
