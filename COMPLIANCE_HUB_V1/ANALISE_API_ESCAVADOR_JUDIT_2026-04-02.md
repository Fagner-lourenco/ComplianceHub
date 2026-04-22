# Análise Completa das APIs Escavador + Judit — ComplianceHub
**Data da execução:** 02 de abril de 2026  
**Escavador Token:** JWT Bearer (ativo)  
**Judit API Key:** `99884e54-16dd-4aea-85a9-70a7b0721767`  
**Base URLs:**
- Escavador: `https://api.escavador.com/api/v2`
- Judit Sync: `https://lawsuits.production.judit.io`
- Judit Async: `https://requests.prod.judit.io`

---

## SUMÁRIO EXECUTIVO

### Descobertas Críticas

1. **🔴 FRANCISCO tem MANDADO DE PRISÃO ATIVO no BNMP** — Judit confirmou: prisão civil por dívida de alimentos R$ 4.741,48, status "Pendente de Cumprimento", expedido em 17/11/2025. **FonteData retornou 503 para este CPF no endpoint `cnj-mandados-prisao`** — FALHA CRÍTICA.

2. **🔴 MATHEUS NÃO É "FICHA LIMPA"** — Judit encontrou 1 processo: `JUSTIÇA PÚBLICA X MATHEUS SANTOS GONÇALVES` (TJSP), onde ele é **AVERIGUADO** (sob investigação criminal) com uma VÍTIMA no processo. **FonteData retornou 0 processos. Escavador retornou 0 por CPF.** Somente o Judit detectou.

3. **🟡 RENAN é TESTEMUNHA, não parte** — Judit confirma: `person_type: "TESTEMUNHA"`, `side: "Unknown"` no processo trabalhista TRT-1. FonteData mostrou "2 processos" sem distinguir papel. Escavador não tem o processo penal.

4. **⚠️ ANDRE: Escavador e Judit retornaram ZERO processos por CPF** — FonteData encontrou 5 processos penais no TJ-SP. Escavador por nome encontra 23 processos, mas de **8 CPFs diferentes** (homônimos). Nenhum provider alternativo conseguiu confirmar os dados do FonteData.

5. **Escavador oferece dados mais ricos por processo** — Area, classe, assuntos normalizados, envolvidos com CPF, status predito, movimentações, diário oficial. Judit oferece **mandados de prisão** e **detecção de papel (TESTEMUNHA/RÉU/AVERIGUADO)**.

6. **Judit warrants é ASYNC e LENTO** — Polling de 40-60 segundos para completar. André e Diego deram timeout no primeiro attempt (>60s), completaram depois com re-check.

---

## CPFs UTILIZADOS NOS TESTES (mesmos do FonteData)

| # | Nome Completo | CPF | CPF Formatado |
|---|---|---|---|
| 1 | ANDRE LUIZ CRUZ DOS SANTOS | 48052053854 | 480.520.538-54 |
| 2 | DIEGO EMANUEL ALVES DE SOUZA | 10794180329 | 107.941.803-29 |
| 3 | RENAN GUIMARAES DE SOUSA AUGUSTO | 11819916766 | 118.199.167-66 |
| 4 | FRANCISCO TACIANO DE SOUSA | 05023290336 | 050.232.903-36 |
| 5 | MATHEUS GONCALVES DOS SANTOS | 46247243804 | 462.472.438-04 |

---

## ESCAVADOR — Processos por CPF

### Endpoint: `GET /envolvido/processos?cpf_cnpj={CPF}`
- **Auth:** `Authorization: Bearer {JWT}`
- **Headers extras:** `X-Requested-With: XMLHttpRequest`
- **Paginação:** cursor-based via `links.next`
- **Timeout:** 30s

### Estrutura da Resposta
```json
{
  "envolvido_encontrado": {
    "nome": "...",
    "outros_nomes": [],
    "tipo_pessoa": "FISICA",
    "quantidade_processos": 7,
    "cpfs_com_esse_nome": 1
  },
  "items": [
    {
      "numero_cnj": "0205659-11.2024.8.06.0167",
      "titulo_polo_ativo": "...",
      "titulo_polo_passivo": "...",
      "ano_inicio": 2024,
      "data_inicio": "2024-10-03",
      "estado_origem": { "nome": "Ceará", "sigla": "CE" },
      "unidade_origem": { "nome": "...", "cidade": "Sobral", "tribunal_sigla": "TJCE" },
      "data_ultima_movimentacao": "2025-10-08",
      "quantidade_movimentacoes": 3,
      "fontes_tribunais_estao_arquivadas": false,
      "tipo_match": "CPF",
      "match_documento_por": "NOME_EXATO_UNICO",
      "fontes": [
        {
          "sigla": "TJCE",
          "tipo": "TRIBUNAL",
          "status_predito": "ATIVO",
          "grau": 1,
          "sistema": "ESAJ",
          "capa": {
            "classe": "Cumprimento de Sentença...",
            "assunto": "Alimentos (4394)",
            "assunto_principal_normalizado": { "path_completo": "DIREITO CIVIL > Família > Alimentos" },
            "area": "CÍVEL",
            "orgao_julgador": "2ª Vara de Família...",
            "situacao": "Em andamento",
            "valor_causa": { "valor": "3204.7300" }
          },
          "envolvidos": [
            { "nome": "Francisco Taciano de Sousa", "tipo": "Executado", "polo": "PASSIVO", "cpf": "05023290336" }
          ]
        }
      ]
    }
  ],
  "links": { "next": null },
  "paginator": { "per_page": 20 }
}
```

### Campos Relevantes (diferenças vs FonteData)
| Campo Escavador | Equivalente FonteData | Observação |
|---|---|---|
| `capa.area` | `areaDireito` | Escavador: "CÍVEL", "CRIME". FonteData: "Direito Penal", "Direito Civil" |
| `capa.classe` | `classificacao.descricao` | Escavador inclui código entre parênteses |
| `capa.assunto_principal_normalizado.path_completo` | N/A | Escavador tem hierarquia completa do assunto |
| `status_predito` | `detalhesStatusProcesso.statusDetalhes` | Escavador: "ATIVO"/"INATIVO". FonteData: "em Tramitação"/"Arquivamento Definitivo" |
| `envolvidos[].tipo` / `tipo_normalizado` / `polo` | `partes[].polo` / `posicaoProcessual` | Escavador MUITO mais detalhado: "Réu", "Autor Do Fato", "Testemunha", "Vítima", "Executado" |
| `envolvidos[].cpf` | `partes[].documento` | Escavador retorna CPF de envolvidos ⭐ |
| `match_documento_por` | N/A | "NOME_EXATO_UNICO", "DOCUMENTO_TRIBUNAL" — indica confiança do match |
| `cpfs_com_esse_nome` | N/A | Indica risco de homônimos |
| `fontes[].tipo: "DIARIO_OFICIAL"` | N/A | Escavador monitora Diário Oficial ⭐ |

---

### Resultado CPF 1 — ANDRE LUIZ (48052053854)
- **HTTP:** 200 OK
- **Resultado:** `envolvido_encontrado: null`, `items: []`
- **⚠️ ZERO processos por CPF**
- **FonteData encontrou 5 processos penais no TJ-SP**

#### Busca por NOME: `?nome=ANDRE LUIZ CRUZ DOS SANTOS`
- **HTTP:** 200 OK
- **Resultado:** 23 processos encontrados, **8 CPFs diferentes com esse nome**
- **Risco:** Impossível distinguir quais processos são do CPF 48052053854
- **Primeiro resultado:** Ação Monitória cível em Campinas/SP (2025) — provavelmente de outro homônimo
- **Conclusão:** Busca por nome é inviável por causa de homônimos. O Escavador simplesmente não tem os processos deste CPF indexados no tribunal.

---

### Resultado CPF 2 — DIEGO EMANUEL (10794180329)
- **HTTP:** 200 OK
- **Processos:** 1
- **Envolvido:** `quantidade_processos: 1`, `cpfs_com_esse_nome: 1` (nome único)

| Campo | Valor |
|---|---|
| CNJ | 0001549-63.2024.8.06.0001 |
| Tribunal | TJCE (Fortaleza) |
| Classe | Reclamação Pré-processual |
| Assunto | Exoneração / Alimentos |
| Área | (não informada) |
| Status | **INATIVO** |
| Polo de Diego | Parte no `titulo_polo_passivo` (via mãe) |
| Valor | R$ 1.412,00 |
| Segredo de Justiça | **Sim** |
| Match | CPF → NOME_EXATO_UNICO |

**Comparação FonteData:** Coincide — 1 processo civil, R$ 1.412, TJ-CE. Escavador tem mais detalhes (assunto normalizado, envolvidos com CPF).

---

### Resultado CPF 3 — RENAN GUIMARAES (11819916766)
- **HTTP:** 200 OK
- **Processos:** 1
- **Envolvido:** `quantidade_processos: 1`, `cpfs_com_esse_nome: 1`

| Campo | Valor |
|---|---|
| CNJ | 0101976-21.2016.5.01.0007 |
| Tribunal | TRT-1 (7ª Vara do Trabalho do RJ) |
| Classe | Ação Trabalhista - Rito Ordinário |
| Assunto | Salário / Diferença Salarial + 16 sub-assuntos trabalhistas |
| Status | **INATIVO** (arquivado) |
| Match | CPF → DOCUMENTO_TRIBUNAL |
| Data início | 19/12/2016 |
| Última mov. | 09/06/2019 |

**⚠️ Escavador encontrou apenas 1 processo (trabalhista).** FonteData mostrou 2 (1 trabalhista + 1 penal TJ-RJ 2016). O processo penal NÃO aparece no Escavador.

**Detalhes do envolvido (do Judit):** Renan é listado como `TESTEMUNHA` com `side: "Unknown"` — ele NÃO é parte do processo, apenas testemunhou.

---

### Resultado CPF 4 — FRANCISCO TACIANO (05023290336)
- **HTTP:** 200 OK
- **Processos:** 7
- **Envolvido:** `quantidade_processos: 7`, `cpfs_com_esse_nome: 1`

| # | CNJ | Tribunal | Área | Classe | Assunto | Polo | Status |
|---|---|---|---|---|---|---|---|
| 1 | 0205659-11.2024.8.06.0167 | TJCE | CÍVEL | Cumprimento de Sentença Alimentos | Alimentos | PASSIVO (Executado) | **ATIVO** 🔴 |
| 2 | 0012198-45.2022.8.06.0167 | TJCE | **CRIME** | Ação Penal Ordinária | Contravenções Penais | PASSIVO (Autor do Fato) | ATIVO |
| 3 | 0013417-40.2021.8.06.0293 | TJCE | **CRIME** | Medidas Protetivas Maria da Penha | Contravenções Penais | PASSIVO (Requerido) | Arquivado ✅ |
| 4 | 0202743-72.2022.8.06.0167 | TJCE | **CRIME** | Ação Penal Ordinária | **Violência Doméstica Contra a Mulher** | PASSIVO (Réu) | **ATIVO** 🔴 |
| 5 | 3001575-02.2021.8.06.0167 | TJCE | **CRIME** | Termo Circunstanciado | **Porte de arma (branca)** | PASSIVO (Autor do Fato) | Encerrado ✅ |
| 6 | 0053023-02.2020.8.06.0167 | TJCE | CÍVEL | Procedimento Comum Cível | Fixação Alimentos | PASSIVO (Requerido) | INATIVO |
| 7 | 0204723-54.2022.8.06.0167 | TJCE | CÍVEL | Cumprimento de Sentença Alimentos | Alimentos | PASSIVO (Executado) | **ATIVO** 🔴 |

**Resumo:** 7 processos (vs 8 no FonteData). 4 criminais, 3 cíveis. Vítima recorrente: Josiane de Lima Monteiro. Outro processo de alimentos com Daiane do Nascimento Gomes (segunda parceira).

**⭐ Processo 7 (0204723-54.2022) é o que originou o MANDADO DE PRISÃO detectado pelo Judit.**

**Diferença vs FonteData:** FonteData encontrou 8 processos, Escavador 7. O processo faltante pode ser recursos de 2ª instância (FonteData conta instâncias separadamente).

---

### Resultado CPF 5 — MATHEUS GONCALVES (46247243804)
- **HTTP:** 200 OK
- **Resultado:** `envolvido_encontrado: null`, `items: []`
- **⚠️ ZERO processos por CPF**
- **FonteData também encontrou ZERO**
- **MAS Judit encontrou 1 processo!** (ver seção Judit abaixo)

#### Busca por NOME: `?nome=MATHEUS GONCALVES DOS SANTOS`
- **Resultado:** 322 processos, **289 CPFs diferentes** (!!!)
- **Completamente inviável** — nome extremamente comum
- **Conclusão:** Somente busca por CPF é confiável para este nome

---

## JUDIT — Lawsuits (Sync Datalake)

### Endpoint: `POST /lawsuits`
- **Auth:** `api-key: {KEY}` (header, NÃO Bearer)
- **Body:** `{ "search": { "search_type": "cpf", "search_key": "XXX.XXX.XXX-XX" }, "process_status": true }`
- **⚠️ CPF DEVE ser formatado com pontos e traço**
- **Resposta:** Imediata (sync)

### Estrutura da Resposta
```json
{
  "has_lawsuits": true,
  "request_id": "365fe934-...",
  "lawsuits": [
    {
      "code": "0202743-72.2022.8.06.0167",
      "instance": 1,
      "name": "JOSE WILLIAM DOMINGUES RIPARDO X FRANCISCO TACIANO DE SOUSA",
      "free_justice": false,
      "secrecy_level": 0,
      "courts": [{ "code": "84782", "name": "JUIZADO DA VIOLENCIA DOMESTICA..." }],
      "tribunal_acronym": "TJCE",
      "county": "3ª VARA CIVEL DA COMARCA DE SOBRAL",
      "state": "CE",
      "city": "SOBRAL",
      "distribution_date": "2022-05-03T15:51:03.000Z",
      "last_step": { "step_date": "2024-10-23T...", "content": "PROFERIDO DESPACHO...", "steps_count": 82 },
      "tags": { "criminal": true },
      "status": "Finalizado",
      "phase": "Arquivado",
      "area": "DIREITO PENAL",
      "justice_description": "JUSTIÇA ESTADUAL",
      "amount": 0.01,
      "classifications": [{ "code": "283", "name": "AÇÃO PENAL - PROCEDIMENTO ORDINÁRIO" }],
      "subjects": [
        { "code": "12542", "name": "REAL" },
        { "code": "10949", "name": "VIOLÊNCIA DOMÉSTICA CONTRA A MULHER" },
        { "code": "3402", "name": "AMEAÇA" }
      ],
      "parties": [
        { "main_document": "05023290336", "name": "FRANCISCO TACIANO DE SOUSA", "side": "Passive", "person_type": "REU", "documents": [...] },
        { "name": "JOSIANE DE LIMA MONTEIRO", "side": "Active", "person_type": "Autor" },
        { "main_document": "03532276330", "name": "JOSE WILLIAM DOMINGUES RIPARDO", "side": "Interested", "person_type": "TESTEMUNHA" }
      ]
    }
  ]
}
```

### Campos Exclusivos do Judit (vs FonteData e Escavador)
| Campo Judit | Observação |
|---|---|
| `tags.criminal` | Flag booleana de processo criminal ⭐ |
| `parties[].person_type` | Muito granular: "REU", "TESTEMUNHA", "AVERIGUADO", "RECLAMANTE", "PROMOTOR", "AUTORIDADE POLICIAL", "VÍTIMA" ⭐ |
| `parties[].side` | "Active", "Passive", "Unknown", "Interested" |
| `last_step.content` | Conteúdo da última movimentação |
| `last_step.steps_count` | Total de movimentações |
| `secrecy_level` | Nível de segredo de justiça (0 = público) |
| `phase` | Fase processual: "Arquivado", "Inicial", etc. |

---

### Resultado CPF 1 — ANDRE LUIZ (480.520.538-54)
```json
{ "has_lawsuits": false, "lawsuits": [] }
```
**⚠️ Judit NÃO encontrou nenhum processo.** FonteData encontrou 5 penais no TJ-SP.

---

### Resultado CPF 2 — DIEGO EMANUEL (107.941.803-29)
```json
{ "has_lawsuits": false, "lawsuits": [] }
```
**⚠️ Judit NÃO encontrou.** FonteData e Escavador encontraram 1 processo cível. O datalake do Judit pode não ter cobertura para este processo específico (CEJUSC de Fortaleza, pré-processual).

---

### Resultado CPF 3 — RENAN GUIMARAES (118.199.167-66)
- **has_lawsuits:** `true`
- **Processos:** 1

| Campo | Valor |
|---|---|
| CNJ | 0101976-21.2016.5.01.0007 |
| Nome | FLAVIO JORGE SANTOS DE ARAUJO X THE FIFTIES COMERCIO DE ALIMENTOS S.A |
| Tribunal | TRT1 (RJ) |
| Status | **Finalizado** / Arquivado |
| Valor | R$ 40.000,00 |
| Área | NÃO INFORMADO |
| Justiça | JUSTIÇA DO TRABALHO |

**⭐ PAPEL DE RENAN NO PROCESSO:**
```json
{
  "main_document": "11819916766",
  "name": "RENAN GUIMARAES DE SOUSA AUGUSTO",
  "side": "Unknown",
  "person_type": "TESTEMUNHA"
}
```

**🟢 RENAN É TESTEMUNHA — NÃO É PARTE.** Ele apenas testemunhou em um processo de outro reclamante (Flavio Jorge) contra uma empresa (The Fifties). O processo é entre empregado e empregador, Renan não é nem autor nem réu.

**Comparação:**
- FonteData `processos-agrupada`: Mostrou "Direito do Trabalho / Outros: 1 processo, R$ 40.000" — o "Outros" agora faz sentido, não é Ativo nem Passivo porque ele é testemunha
- FonteData também mostrou 1 processo penal TJ-RJ 2016 — **NEM Escavador NEM Judit encontraram este processo penal**

---

### Resultado CPF 4 — FRANCISCO TACIANO (050.232.903-36)
- **has_lawsuits:** `true`
- **Processos:** 1 (confirmado no JSON, pode haver mais no datalake completo)

| Campo | Valor |
|---|---|
| CNJ | 0202743-72.2022.8.06.0167 |
| Nome | JOSE WILLIAM DOMINGUES RIPARDO X FRANCISCO TACIANO DE SOUSA |
| Tribunal | TJCE |
| Status | **Finalizado** / Arquivado |
| Área | **DIREITO PENAL** |
| Tag criminal | **`true`** ⭐ |
| Classificação | AÇÃO PENAL - PROCEDIMENTO ORDINÁRIO |
| Assuntos | REAL, **VIOLÊNCIA DOMÉSTICA CONTRA A MULHER**, **AMEAÇA** |

**Partes do processo:**
| Nome | Side | person_type |
|---|---|---|
| MINISTÉRIO PÚBLICO DO ESTADO DO CEARÁ | Interested | PROMOTOR |
| DELEGACIA ESPECIALIZADA DDM SOBRAL | Interested | AUTORIDADE POLICIAL |
| DELEGACIA ESPECIALIZADA - DDM SOBRAL | Active | Autor |
| **FRANCISCO TACIANO DE SOUSA** | **Passive** | **REU** |
| JOSE WILLIAM DOMINGUES RIPARDO | Interested | TESTEMUNHA |
| CRISTIANE DE LIMA MONTEIRO | Interested | TESTEMUNHA |
| JOSIANE DE LIMA MONTEIRO | Active | Autor (Vítima) |
| DEFENSORIA PÚBLICA DO ESTADO DO CEARÁ | Passive | Advogado |

**Last step:** `"PROFERIDO DESPACHO DE MERO EXPEDIENTE | CUMPRA-SE O DETERMINADO PELO EGREGIO TRIBUNAL DE JUSTICA DO CEARA, COM A EXPEDICAO DA CARTA DE GUIA DEFINITIVA E A RESPECTIVA REMESSA AO JUIZO DAS EXECUCOES PENAIS (2 VARA CRIMINAL DA COMARCA DE SOBRAL-CE)."`

**⭐ REMETIDO À VARA DE EXECUÇÕES PENAIS — indica condenação transitada em julgado!**

---

### Resultado CPF 5 — MATHEUS GONCALVES (462.472.438-04)
- **has_lawsuits:** `true`
- **Processos:** 1

| Campo | Valor |
|---|---|
| CNJ | 1505327-09.2024.8.26.0001 |
| Nome | **JUSTIÇA PÚBLICA X MATHEUS SANTOS GONÇALVES** |
| Tribunal | TJSP |
| Comarca | 02 CIVEL DE SANTANA (São Paulo) |
| Status | **Ativo** / Fase Inicial 🔴 |
| Distribuição | 22/07/2024 |
| Valor | R$ 0,00 |

**⭐ PARTES DO PROCESSO:**
| Nome | Side | person_type |
|---|---|---|
| Justiça Pública | Active | **AUTOR** |
| **Matheus Santos Gonçalves** | **Passive** | **AVERIGUADO** |
| Rebeca Arcadi Amaral | Interested | **VÍTIMA** |

**🔴🔴 GRAVÍSSIMO:** Matheus é **AVERIGUADO** em um processo criminal ativo onde a Justiça Pública é autora e há uma VÍTIMA. Isso é um **inquérito/investigação criminal** ou **procedimento investigatório** ativo.

**FonteData retornou 0 processos para este CPF. Escavador retornou 0 por CPF.** Somente o Judit detectou este processo. Isso torna o Judit **indispensável** para detecção de investigações criminais ativas.

**Nota sobre o nome:** Judit retornou "MATHEUS SANTOS GONÇALVES" (sem "DOS" e com acento), enquanto nosso cadastro tem "MATHEUS GONCALVES DOS SANTOS". O match foi por CPF, não por nome — confirmando a importância da busca por CPF.

---

## JUDIT — Warrants (Async)

### Fluxo: 3 etapas
1. **`POST /requests`** — Cria request (body: `response_type: "warrant"`)
2. **`GET /requests/{id}`** — Poll status (a cada 3s, até `completed`)
3. **`GET /responses?request_id={id}`** — Fetch resultados

### Tempos de resposta observados

| CPF | Tempo até completed | Warrants |
|---|---|---|
| ANDRE | >60s (timeout), completed no retry | 0 |
| DIEGO | >60s (timeout), completed no retry | 0 |
| RENAN | ~42s (14 polls × 3s) | 0 |
| FRANCISCO | ~45s (15 polls × 3s) | **1** 🔴 |
| MATHEUS | ~12s (4 polls × 3s) | 0 |

**⚠️ Performance:** O polling é custoso. Warrants levam 12-60+ segundos para processar. Para o Cloud Function, o timeout default de 60s pode ser insuficiente para alguns CPFs. Recomendação: usar timeout de **120s** no function.

---

### Resultado FRANCISCO — MANDADO DE PRISÃO ATIVO 🔴

```json
{
  "warrant_id": "4c7b3371-bdda-4f1e-a92a-a77b4107bc85",
  "warrant_type": "warrant_of_arrest",
  "arrest_type": "provisional",
  "number": "0204723542022806016701000326",
  "code": "0204723-54.2022.8.06.0167",
  "status": "Pendente de Cumprimento",
  "issue_date": "2025-11-17T00:00:00.000Z",
  "tribunal_acronym": "TJCE",
  "court": "2ª VARA DE FAMILIA E SUCESSOES DA COMARCA DE SOBRAL",
  "duration_days": 0,
  "recapture": false
}
```

**Detalhes extraídos do campo `judgementSummary`:**
> "decreto a custodia civil de FRANCISCO TACIANO DE SOUSA em conformidade com o art. 5º, inc. LXVII da Constituição Federal e art. 528, § 3º, do CPC, pelo prazo de **60 (sessenta) dias** ou ate que seja pago o valor devido"

**Detalhes do campo `observations`:**
> "Expeca-se o mandado de prisao, a ser cumprida no **regime fechado** (prazo de dois anos) e consigne-se nele o valor da divida, cuja atualizacao consta carreada no ID 172498859 (**R$ 4.741,48**)"

**Detalhes do campo `post_warnings`:**
> "Decorrido o prazo contido neste Mandado, a autoridade responsavel pela custodia devera, independentemente de alvara de soltura, colocar o preso em liberdade"

**Entity (dados do foragido):**
| Campo | Valor |
|---|---|
| Nome | FRANCISCO TACIANO DE SOUSA |
| CPF | 050.232.903-36 |
| RJI | 256078251-03 |
| Gênero | Masculino |
| Nascimento | 16/08/1991 |
| Mãe | FRANCISCA CAETANA DE SOUSA |
| Etnia | Não Informada |
| Biometria | Não coletada |

**⭐ Tipo de prisão:** CIVIL (dívida de alimentos, art. 5º LXVII CF) — NÃO é mandado criminal. Mas é um mandado ATIVO com status "Pendente de Cumprimento" no BNMP 3.0.

**⭐ Processo de origem:** 0204723-54.2022.8.06.0167 — mesmo processo que aparece como #7 no Escavador (Cumprimento de Sentença de Alimentos, R$ 3.204,73 → agora atualizado para R$ 4.741,48).

---

## COMPARATIVO FINAL — FonteData × Escavador × Judit

### Processos por CPF

| CPF | Nome | FonteData (agrupada) | Escavador (CPF) | Judit (lawsuits) | Judit (warrants) |
|---|---|---|---|---|---|
| 48052053854 | ANDRE | **5** (penal) | **0** ⚠️ | **0** ⚠️ | 0 |
| 10794180329 | DIEGO | **1** (cível) | **1** (cível) ✅ | **0** ⚠️ | 0 |
| 11819916766 | RENAN | **2** (trab+penal) | **1** (trab) ⚠️ | **1** (trab, TESTEMUNHA) ⭐ | 0 |
| 05023290336 | FRANCISCO | **8** (cível+penal) | **7** (cível+penal) ✅ | **1** (penal) | **1 MANDADO** 🔴 |
| 46247243804 | MATHEUS | **0** | **0** | **1** (criminal, AVERIGUADO) 🔴 | 0 |

### Detecção de Risco Criminal

| Necessidade | FonteData | Escavador | Judit |
|---|---|---|---|
| Processos criminais | Via `processos-agrupada` (área penal) | Via `capa.area: "CRIME"` | Via `tags.criminal: true` |
| Papel no processo (réu/testemunha/vítima) | ❌ Não distingue * | ✅ `envolvidos[].tipo_normalizado` | ✅ `parties[].person_type` ⭐ |
| Mandados de prisão (BNMP) | Via `cnj-mandados-prisao` (instável) | ❌ Não tem | ✅ Via warrants async ⭐ |
| Processos trabalhistas | Via `trt-consulta` ou `agrupada` | ✅ Via processos | ✅ Via lawsuits |
| Dados do processo (partes, movimentações) | `processos-completa` (R$ 4,95) | ✅ Incluído no resultado | ✅ Incluído no resultado |
| Flag de homônimo | ❌ | ✅ `cpfs_com_esse_nome` ⭐ | ❌ `potential_homonym` (mas não vimos funcionar) |

\* FonteData `processos-agrupada` mostra "Ativo"/"Passivo"/"Outros" mas NÃO distingue RÉU de TESTEMUNHA ou AVERIGUADO.

### Cobertura de Dados (Fontes)

| CPF | FonteData | Escavador | Judit | Melhor cobertura |
|---|---|---|---|---|
| ANDRE (5 penais SP) | ✅ Encontrou 5 | ❌ 0 por CPF | ❌ 0 | **FonteData** |
| DIEGO (1 cível CE) | ✅ Encontrou 1 | ✅ Encontrou 1 | ❌ 0 | FonteData + Escavador |
| RENAN (trab RJ) | ✅ Encontrou 2 | ✅ Encontrou 1 | ✅ 1 (TESTEMUNHA) | **Judit** (papel) |
| FRANCISCO (8 CE) | ✅ Encontrou 8 | ✅ Encontrou 7 | ✅ 1 + **MANDADO** | **Judit** (mandado) |
| MATHEUS (investigação SP) | ❌ 0 | ❌ 0 | ✅ **Encontrou 1** | **Judit** ⭐ |

### Exclusividades por Provider

| Provider | Dado exclusivo | Exemplo |
|---|---|---|
| **FonteData** | Processos penais TJ-SP por CPF | ANDRE: 5 processos que ninguém mais encontrou |
| **FonteData** | Dados cadastrais + renda + telefones | Não é foco desta análise |
| **FonteData** | Status CPF na Receita Federal | REGULAR/SUSPENSA/FALECIDO |
| **Escavador** | Envolvidos com CPF + tipo detalhado | Francisco: todos os envolvidos com CPF e papel |
| **Escavador** | Flag de homônimo (`cpfs_com_esse_nome`) | ANDRE: 8 homônimos, MATHEUS: 289! |
| **Escavador** | Monitoramento via Diário Oficial | Publicações do DJCE para Francisco |
| **Escavador** | `status_predito` (ATIVO/INATIVO) | Predição de atividade do processo |
| **Judit** | **Mandados de prisão BNMP** | FRANCISCO: mandado ATIVO ⭐ |
| **Judit** | `person_type` granular | RENAN=TESTEMUNHA, MATHEUS=AVERIGUADO ⭐ |
| **Judit** | `tags.criminal` flag | Francisco: marcado como criminal |
| **Judit** | Detecção de investigações iniciais | MATHEUS: processo "Inicial" com VÍTIMA ⭐ |
| **Judit** | Dados do foragido (entity) | Nome da mãe, nascimento, documentos |

---

## DIVERGÊNCIAS CRÍTICAS ENTRE PROVIDERS

### 1. ANDRE — FonteData encontra, Escavador e Judit NÃO
| Provider | Processos | Observação |
|---|---|---|
| FonteData | 5 penais TJ-SP | Fonte primária confiável |
| Escavador | 0 (CPF) / 23 (nome, 8 homônimos) | Não indexou este CPF nos tribunais |
| Judit | 0 lawsuits + 0 warrants | Datalake não tem cobertura |

**Impacto:** Se usássemos APENAS Escavador ou Judit, ANDRE passaria como "ficha limpa" — **FALSO NEGATIVO CRÍTICO**.

### 2. MATHEUS — Judit encontra, FonteData e Escavador NÃO
| Provider | Processos | Observação |
|---|---|---|
| FonteData | 0 | **Não detectou investigação criminal ativa** |
| Escavador | 0 | **Não detectou** |
| Judit | 1 (AVERIGUADO, VÍTIMA no processo) | Única fonte que detectou |

**Impacto:** Se usássemos APENAS FonteData, MATHEUS passaria como "ficha limpa" — **FALSO NEGATIVO CRÍTICO**. O Judit é indispensável.

### 3. RENAN — Papel no processo diverge
| Provider | Dados | Papel |
|---|---|---|
| FonteData (agrupada) | 2 processos, "Outros" | **Não distingue** |
| Escavador | 1 processo trabalhista | (envolvido, mas papel não claro na paginação lida) |
| Judit | 1 processo | **TESTEMUNHA** (person_type explícito) |

**Impacto:** FonteData classificaria RENAN como risco por ter processo penal. Judit mostra que ele é apenas testemunha — **risco real é MENOR**.

### 4. FRANCISCO — Mandado de prisão só no Judit
| Provider | Mandado BNMP | Observação |
|---|---|---|
| FonteData (`cnj-mandados-prisao`) | **503 ERROR** | Endpoint falhou para este CPF! |
| Escavador | N/A | Não tem endpoint de mandados |
| Judit (warrants) | **1 mandado ATIVO** 🔴 | Prisão civil, R$ 4.741,48 |

**Impacto:** Se usássemos APENAS FonteData, o mandado BNMP de FRANCISCO seria invisível (o endpoint deu 503). Judit é a **única fonte confiável de mandados**.

---

## PERFIL DE RISCO ATUALIZADO (com dados de 3 providers)

### 🔴🔴 FRANCISCO TACIANO DE SOUSA — RISCO CRÍTICO
- **7-8 processos** judiciais (criminal + cível)
- **MANDADO DE PRISÃO ATIVO** — BNMP 3.0, dívida alimentos R$ 4.741,48
- **Condenado** por ameaça e violência doméstica (remetido à Vara de Execuções Penais)
- Medidas protetivas da Lei Maria da Penha
- Porte de arma branca (prescrito)
- Duas ações de alimentos (duas parceiras diferentes)
- **Confirmado por TODOS os 3 providers**

### 🔴 ANDRE LUIZ CRUZ DOS SANTOS — ALTO RISCO (MAS COM RESSALVA)
- **5 processos penais TJ-SP** conforme FonteData
- **NÃO CONFIRMADO por Escavador nem Judit** — possível limitação de cobertura dos outros providers
- 0 mandados de prisão
- Confiamos no FonteData para este CPF, mas devemos investigar se os processos são realmente deste CPF ou de homônimo (8 homônimos no Escavador)

### 🟡 MATHEUS GONCALVES DOS SANTOS — RISCO MÉDIO (ELEVADO)
- **1 investigação criminal ativa** — AVERIGUADO em processo com VÍTIMA (TJSP)
- **NÃO é "ficha limpa"** como FonteData sugeriu
- 0 mandados de prisão
- Status: fase inicial, ativo
- **Detectado EXCLUSIVAMENTE pelo Judit**

### 🟢 RENAN GUIMARAES DE SOUSA AUGUSTO — RISCO BAIXO (REBAIXADO)
- 1 processo trabalhista finalizado — era apenas **TESTEMUNHA**
- 1 processo penal TJ-RJ 2016 (apenas FonteData, não confirmado)
- 0 mandados de prisão
- **Risco real é menor que o indicado inicialmente pelo FonteData**

### 🟢 DIEGO EMANUEL ALVES DE SOUZA — RISCO BAIXO
- 1 processo cível finalizado (alimentos, R$ 1.412)
- 0 mandados de prisão
- **Confirmado por FonteData e Escavador, Judit não encontrou**

---

## RECOMENDAÇÕES TÉCNICAS

### 1. Estratégia Multi-Provider (RECOMENDADA)
Usar **TODOS os 3 providers** em paralelo:
- **FonteData**: Gate de identidade (receita-federal-pf) + panorama processual (processos-agrupada)
- **Escavador**: Detalhamento de processos com envolvidos e CPFs + flag de homônimos
- **Judit**: Mandados BNMP (INDISPENSÁVEL) + detecção de papel (TESTEMUNHA/AVERIGUADO) + investigações iniciais

### 2. Judit é INDISPENSÁVEL para mandados
O endpoint `cnj-mandados-prisao` do FonteData é instável (503 para FRANCISCO). O Escavador não tem mandados. **Judit é a ÚNICA fonte confiável de mandados de prisão BNMP.**

### 3. Judit detecta o que ninguém mais detecta
- MATHEUS: investigação criminal ativa (FonteData + Escavador: 0)
- RENAN: distinção TESTEMUNHA vs PARTE
- FRANCISCO: mandado ATIVO com detalhes completos

### 4. FonteData cobre lacunas do Escavador e Judit
- ANDRE: 5 processos penais que ninguém mais encontrou
- Dados cadastrais, renda, telefones para construção do perfil

### 5. Timeout do Judit Warrants
O polling de warrants leva 12-60+ segundos. O Cloud Function DEVE ter timeout de **120s mínimo** para warrants. Considerar usar `runWith({ timeoutSeconds: 120 })`.

### 6. Busca por nome: usar com cautela
- ANDRE: 8 homônimos → inviável distinguir
- MATHEUS: 289 homônimos → completamente inútil
- Escavador retorna `cpfs_com_esse_nome` que pode ser usado como flag de risco de homônimo

### 7. Custo estimado por caso (3 providers)
| Provider | Endpoints | Custo/caso |
|---|---|---|
| FonteData | receita-federal-pf + processos-agrupada | ~R$ 2,19 |
| Escavador | envolvido/processos | Depende do plano |
| Judit | lawsuits + warrants | Depende do plano |
| **Total** | | R$ 2,19 + Escavador + Judit |

---

## CHAMADAS REALIZADAS NESTA ANÁLISE

| API | Tipo | Chamadas | Resultado |
|---|---|---|---|
| Escavador GET /envolvido/processos (CPF) | GET | 5 | 2 com dados, 2 vazios, 1 com 7 procs |
| Escavador GET /envolvido/processos (NOME) | GET | 2 | Homônimos (inviável) |
| Judit POST /lawsuits (sync) | POST | 5 | 3 com dados, 2 vazios |
| Judit POST /requests (warrant create) | POST | 5 | 5 criados |
| Judit GET /requests/{id} (poll) | GET | ~56 | Polling até completed |
| Judit GET /responses (fetch) | GET | 5 | 1 com mandado, 4 vazios |
| Re-check warrant (timeout) | GET | 4 | Completaram no retry |
| **TOTAL** | | **~82** | |

**Data/hora:** 02/04/2026 21:35-21:45 UTC

---

*Documento gerado automaticamente em 02/04/2026. Dados obtidos em tempo real das APIs Escavador e Judit.*
*Resultados brutos salvos em `./results/` para referência.*
