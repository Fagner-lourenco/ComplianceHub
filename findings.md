# Findings: Classificacao Processual e Narrativas Seguras

## Auditoria De Fontes
- Judit retorna `juditRoleSummary` com `area`, `subjects`, `classifications`, `personType`, `side`, `hasExactCpfMatch`, `hasDivergentCpf`, `isCriminal`, `isPossibleHomonym` e `roleClassification`.
- BigDataCorp retorna `bigdatacorpProcessos` com `courtType`, `cnjBroadSubject`, `cnjSubject`, `cnjProcedure`, `specificRole`, `partyType`, `polo`, `isDirectCpfMatch`, `isCriminal`, `isLabor` e `roleClassification`.
- DJEN retorna `djenComunicacoes` com `area`, `polo`, `roleClassification`, `geoMatch`, `probabilityScore` e texto resumido. DJEN e busca por nome/comunicacao, portanto deve ser tratado com cautela.
- Escavador normalizer ja usa `area`, `classe` e tribunal (`TRT`/`TST`) de forma mais robusta que Judit/BDC.

## Problemas Confirmados
- `roleClassifier.js` nao normaliza acentos: `RÉU`, `VÍTIMA`, `VÍTIMA DO FATO`, `TESTEMUNHA DO JUÍZO` caem como `UNKNOWN/NEUTRAL`.
- Papeis criminais recursais/procedurais reais (`APELANTE`, `APELADO`, `RECORRENTE`, `RECORRIDO`, `FLAGRANTEADO(A)`, `DENUNCIADO(A)`, `AUTUADO`, `NOTICIADO`, `PACIENTE`) estao submapeados.
- Papeis trabalhistas recursais reais (`RECORRENTE`, `RECORRIDO`, `AGRAVANTE`, `AGRAVADO`, `POLO ATIVO (PRINCIPAL)`) estao submapeados.
- Judit tem muitos processos com `area = NÃO INFORMADO`; nesses casos, `subjects` e `classifications` precisam ajudar a inferir esfera.
- BigDataCorp usa `CourtType` para `isCriminal`/`isLabor`, mas `cnjBroadSubject`, `cnjSubject` e `cnjProcedure` trazem sinais fortes que devem ser considerados.
- `buildDetLaborNotes()` lista comunicacoes DJEN trabalhistas mesmo quando `laborFlag = NEGATIVE`.
- `buildDetExecutiveSummary()` usa `findingsSentences.join('. Ha ')`, gerando `Ha nenhum`.
- `sanitizeNarrativesForFlags()` precisa capturar frases reais como `Comunicacoes judiciais de natureza trabalhista localizadas`.

## Taxonomia Proposta

### Criminal Material
- `REU`, `REU/RE`, `ACUSADO`, `ACUSADO(A)`, `INDICIADO`, `INDICIADA`, `INVESTIGADO`, `INVESTIGADA`, `DENUNCIADO`, `DENUNCIADO(A)`, `AUTOR DO FATO`, `AUTOR FATO`, `AUTUADO`, `FLAGRANTEADO`, `FLAGRANTEADO(A)`, `SENTENCIADO`, `CONDENADO`, `AVERIGUADO`, `AVERIGUADA`, `NOTICIADO`, `EM APURACAO`, `POLO PASSIVO`, `PACIENTE`, `APELANTE`, `APELADO`, `RECORRENTE`, `RECORRIDO`, `AGRAVANTE`, `AGRAVADO`.

### Criminal Baixo Risco/Ignorar
- `VITIMA`, `VITIMA DO FATO`, `OFENDIDO`, `OFENDIDA`, `TESTEMUNHA`, `TESTEMUNHA DO JUIZO`, `TESTEMUNHA - POLO ATIVO`, `INFORMANTE`, `TERCEIRO`, `TERCEIRO INTERESSADO`, `ADVOGADO`, `PROCURADOR`, `DEFENSOR`.

### Criminal Parte Ativa Baixo Risco
- `AUTOR`, `REQUERENTE`, `IMPETRANTE`, desde que nao seja `AUTOR DO FATO` nem `PACIENTE`.

### Trabalhista Material
- `AUTOR`, `AUTORA`, `RECLAMANTE`, `EXEQUENTE`, `REQUERENTE`, `RECORRENTE`, `RECORRIDO`, `AGRAVANTE`, `AGRAVADO`, `APELANTE`, `APELADO`, `POLO ATIVO`, `POLO ATIVO PRINCIPAL`, `POLO ATIVO (PRINCIPAL)`, `REQTE`, `EXEQTE`, `EXEQTE.`, `PROMOVENTE`.

### Trabalhista Baixo Risco/Ignorar
- `RECLAMADO`, `REU`, `EXECUTADO`, `REQUERIDO`, `POLO PASSIVO`, `REQDO`, `REQDA`, `EXECTDO`, `EXECTDA`, `EXECDO.`, `TESTEMUNHA`, `ADVOGADO`, `PROCURADOR`, `REPRESENTANTE LEGAL`.

### Ambiguos
- `V`, `DEPRECADO(A)`, `DEPRECADO`, `D`, `T`, `HERDEIRO`, `CONSIGNATARIO`, ausentes.

## Sinais De Esfera Criminal
- `tags.criminal = true`, `CourtType` criminal/especial criminal, `DIREITO PENAL`, `DIREITO PROCESSUAL PENAL`, `DIREITO PENAL MILITAR`.
- Classes/procedimentos: `AÇÃO PENAL`, `APELAÇÃO CRIMINAL`, `CARTA PRECATÓRIA CRIMINAL`, `TERMO CIRCUNSTANCIADO`, `INQUÉRITO POLICIAL`, `AUTO DE PRISÃO EM FLAGRANTE`, `MEDIDAS PROTETIVAS ... CRIMINAL`, `HABEAS CORPUS CRIMINAL`, `EXECUÇÃO DA PENA`, `REPRESENTAÇÃO CRIMINAL/NOTÍCIA DE CRIME`, `PETIÇÃO CRIMINAL`, `PROCEDIMENTO INVESTIGATÓRIO CRIMINAL`.
- Assuntos fortes: `ROUBO`, `FURTO`, `TRÁFICO DE DROGAS`, `HOMICÍDIO`, `AMEAÇA`, `ESTELIONATO`, `VIOLÊNCIA DOMÉSTICA`, `MARIA DA PENHA`, `CONTRA A MULHER`, `POSSE DE DROGAS`, `RECEPTAÇÃO`, `DESACATO`, `CALÚNIA`, `INJÚRIA`, `EXTORSÃO`, `PENA PRIVATIVA DE LIBERDADE`, `PRISÃO EM FLAGRANTE`.
- `INTIMAÇÃO`, `CITAÇÃO`, `LEVE`, `GRAVE` sozinhos nao bastam.

## Sinais De Esfera Trabalhista
- `CourtType = TRABALHISTA`, `DIREITO DO TRABALHO`, `TRT`, `TST`.
- Classes/procedimentos: `AÇÃO TRABALHISTA`, `RECURSO ORDINÁRIO TRABALHISTA`, `RECURSO ORDINÁRIO - RITO SUMARÍSSIMO`, `RITO ORDINARIO`, `RITO SUMARISSIMO`, `AGRAVO DE INSTRUMENTO EM RECURSO DE REVISTA`, `RECLAMAÇÃO TRABALHISTA`, `DISSÍDIO`.
- Assuntos fortes: `HORAS EXTRAS`, `ADICIONAL DE INSALUBRIDADE`, `ADICIONAL DE PERICULOSIDADE`, `FGTS`, `RESCISÃO INDIRETA`, `VERBAS RESCISÓRIAS`, `ACÚMULO DE FUNÇÃO`, `DESVIO DE FUNÇÃO`, `DOENÇA OCUPACIONAL`, `ASSÉDIO MORAL`, `RECONHECIMENTO DE RELAÇÃO DE EMPREGO`, `VALE TRANSPORTE`, `AVISO PRÉVIO`, `MULTA DO ARTIGO 477 DA CLT`.
- `DIREITO PROCESSUAL CIVIL E DO TRABALHO` sozinho nao deve classificar como trabalhista.

## IA Revisora Da Autoclassificacao
- O fluxo atual tem tres usos de IA: `aiStructured` (analise geral), `aiHomonymStructured` (homonimos) e `prefillNarratives` (textos finais, hoje sobrescritos pelo prefill deterministico).
- `buildAiPrompt()` ja inclui candidato, identidade, Judit, BigDataCorp, Escavador, mandados, execucoes, autoclassificacao, cobertura, divergencia e homonimos, mas pede uma analise geral e nao uma auditoria explicita da autoclassificacao.
- O caso real `ARTHUR SILVA DE OLIVEIRA` mostrou utilidade e limitacao da IA atual: ela percebeu criminal positivo, divergencia media e sem mandado ativo, mas misturou trabalhista inconclusivo enquanto a flag final era negativa e nao retornou score.
- A nova IA deve receber payload estruturado e responder por eixo: criminal, trabalhista e mandado, com `assessment`, `evidenceStrength`, `rationale` e `possibleErrors`.
- Campos essenciais para alimentar a nova IA: flags finais, cobertura/divergencia, `juditRoleSummary`, `bigdatacorpProcessos`, `escavadorProcessos`, `djenComunicacoes`, mandados/execucoes e resultado consultivo de homonimos.
- A nova UI deve usar `aiClassificationReview` como fonte principal da analise assistida; dados legados devem ficar tecnicos ou invisiveis na experiencia principal.
- Consumidores secundarios tambem precisam migrar: portal cliente usa `aiClassificationReview || aiStructured` para progresso, metricas somam `aiClassificationReviewCostUsd` e tokens novos, e budget fallback do backend inclui o novo custo.
- `prefillNarratives` continua sendo sobrescrito pelo prefill deterministico e permanece util para campos finais/review draft, mas nao deve voltar como bloco principal de identificacao.

## IA Revisora: Achados Do Caso Real `mpvC4pwktOZ8iyL2KXWR`
- A resposta real da IA foi conceitualmente util: identificou CPF/match forte, processos majoritariamente civeis/administrativos, ausencia de mandado ativo e divergencia Judit vs BigDataCorp no eixo criminal.
- A IA detectou corretamente o ponto operacional principal: Judit marcou criminal positivo por uma acao penal arquivada, mas o papel do candidato aparece como vitima e `isDefendant=false`; isso justifica revisao antes de concluir, nao positivo automatico.
- A resposta quebrou o contrato tecnico: JSON invalido por aspas nao escapadas dentro de strings (`"vitima"`, `"isCriminal"`, `"criminalFlag"`) e caractere de controle em `papel\u001Aflag`.
- O parser atual caiu em `extractFallbackAiClassificationReviewResponse()` e persistiu o JSON bruto inteiro em `summary` e `consultativeSuggestion.rationale`, ainda com `aiClassificationReviewOk=true`.
- O prompt atual diz para nao usar nomes de implementacao, mas tambem expõe termos como `hasExactCpfMatch`, `isDirectCpfMatch`, `criminalFlag`, `assessment=AGREE`; a IA copiou esses termos para textos narrativos.
- `evidenceStrength` ficou semanticamente ambigua: para um negativo trabalhista coerente a IA marcou `INSUFFICIENT`, embora o texto explique ausencia de evidencia trabalhista nas fontes. O prompt deve dizer que o campo mede a forca da validacao da flag, nao a quantidade de achados negativos.
- UI precisa de defesa propria: mesmo que exista dado contaminado antigo no Firestore, `CasoPage` nao pode renderizar JSON bruto, enums internos ou redes sociais vazias para o analista.

## DJEN Clickable Modal
- Usuario pediu que `Comunicacoes judiciais DJEN (17)` nas abas criminal e trabalhista seja clicavel.
- Ao clicar em um processo DJEN, deve abrir modal semelhante ao comportamento de BigDataCorp/Judit.
- O modal DJEN deve agrupar/listar todas as movimentacoes/comunicacoes daquele mesmo processo, em vez de abrir apenas uma comunicacao isolada.
- Mudanca deve ser de inspecao/navegacao e nao deve alterar flags, classificacao deterministica ou narrativas finais.

## Inspecao De Implementacao Para Hardening
- `runStructuredAiAnalysis()` monta body OpenAI sem `response_format`; a opcao pode ser adicionada de forma opt-in para nao afetar outras IAs.
- `runAiClassificationReviewAnalysis()` e o ponto seguro para passar `responseFormat`/JSON mode apenas para a IA revisora.
- `extractFallbackAiClassificationReviewResponse()` sempre preenche `summary` e `consultativeSuggestion.rationale` com o conteudo bruto; este e o bug direto que permite `ok=true` com payload invalido.
- `sanitizeStructuredText()` remove HTML/CPF/telefone, mas nao remove caracteres de controle nem detecta JSON/schema/nome interno em texto narrativo.
- `CasoPage.jsx` renderiza `classificationReview.summary`, rationales e listas diretamente; precisa de blindagem para dados contaminados ja persistidos.

## IA Revisora Especializada Por Eixo
- Causa direta de ressalvas indevidas na UI: `applyClassificationReviewGuardrails()` em `CasoPage.jsx` promove todos os eixos `AGREE` para `AGREE_WITH_CAUTION` quando existe `reviewRecommended`, divergencia, ambiguidade ou baixa cobertura global.
- Esse comportamento contamina trabalhista e mandado mesmo quando a cautela real e apenas criminal.
- `buildFallbackClassificationReview()` marca `laborFlag=NEGATIVE` e `warrantFlag=NEGATIVE` com `evidenceStrength=INSUFFICIENT`, mesmo quando fontes consultadas retornaram zero achados; isso reforca a leitura errada de dado insuficiente.
- Regra operacional definida: fonte consultada com sucesso e zero achados sustenta negativo para aquele eixo; so existe ressalva quando ha falha/parcialidade da fonte, divergencia material, homonimo, papel ambiguo ou achado conflitante.
- DJEN por nome/comunicacao isolada e evidencia fraca; nao deve gerar ressalva material sozinho se as flags finais e fontes principais estao negativas.
- Implementado contexto deterministico por eixo no backend e na UI. O prompt agora recebe `reviewContext` e os guardrails pos-IA removem cautelas genericas de eixos negativos bem cobertos.
- O backend aplica `applyAiClassificationReviewGuardrails()` depois da resposta estruturada da IA, antes de persistir `aiClassificationReview`.
- A UI aplica guardrails equivalentes para dados ja persistidos e fallback, mantendo cautela apenas no eixo afetado.

## Incidente: Tag Criminal Consultiva Em Caso Concluido
- Caso informado: `/ops/caso/v5ef9RJ0wBmQLUz4HLf0`.
- Sintoma: caso concluido exibiu tag criminal `Precisa de revisao manual`, mas deveria estar como `Sem apontamento`.
- Regra de negocio definida: `Precisa de revisao manual` nao e resultado final criminal; e estado consultivo/operacional. Conclusao deve aceitar apenas estados finais como `Sem apontamento`, `Com apontamento` ou `Inconclusivo`.
- Risco: cliente interpreta `Precisa de revisao manual` como achado criminal, gerando questionamento indevido no relatorio/portal.
- Estado encontrado no Firestore: `criminalFlag=INCONCLUSIVE_HOMONYM`, `riskScore=45`, `riskLevel=YELLOW`, `suggestedVerdict=ATTENTION`, `finalVerdict=FIT`.
- Evidencia consultada do caso: Judit criminal negativo com count 0, BigDataCorp criminal negativo com count 0, mandado negativo, trabalhista negativo. O unico sinal criminal positivo era DJEN com 1 item em contexto de comunicacao/nome, marcado como `criminalEvidenceQuality=WEAK_NAME_ONLY`.
- `RiskChip`/copy do cliente traduz `INCONCLUSIVE_HOMONYM` como `Precisa de revisao manual`, por isso a tag consultiva vazou como resultado final no portal/relatorio.
- Causa de produto: `CRIMINAL_OPTIONS` permitia selecionar `INCONCLUSIVE_HOMONYM`, `INCONCLUSIVE_LOW_COVERAGE`, `NEGATIVE_PARTIAL` e `NOT_FOUND` no campo final criminal; `concludeCaseByAnalyst` aceitava a flag efetiva vinda do payload ou `reviewDraft`.
- Correcao de dados aplicada nos documentos `cases/v5ef9RJ0wBmQLUz4HLf0`, `cases/v5ef9RJ0wBmQLUz4HLf0/publicResult/latest` e `clientCases/v5ef9RJ0wBmQLUz4HLf0`: `criminalFlag=NEGATIVE`, `riskScore=0`, `riskLevel=GREEN`, `suggestedVerdict=FIT`, `finalVerdict=FIT`, justificativa final sem ressalva generica de homonimia.

## DJEN Como Fonte Consultiva
- Casos reais mostraram que DJEN isolado por nome/comunicacao pode gerar falso positivo/inconclusivo criminal quando Judit e BigDataCorp retornam negativo por CPF.
- Regra operacional consolidada: DJEN nao e motor de decisao sozinho; permanece visivel para inspeção do analista, mas nao deve alterar `criminalFlag`, `laborFlag`, `riskScore`, `finalVerdict` ou textos finais sem correlacao forte.
- Correlacao forte para prefill/autoclassificacao: comunicacao DJEN com mesmo CNJ de processo confirmado por CPF em Judit (`hasExactCpfMatch`) ou BigDataCorp (`isDirectCpfMatch`).
- `computeAutoClassification()` agora usa DJEN apenas quando `filterDjenComunicacoesByConfirmedProcess()` encontra CNJ confirmado para o eixo criminal/trabalhista.
- `buildDetCriminalNotes()` e `buildDetLaborNotes()` nao listam DJEN isolado; comunicacoes correlacionadas ao mesmo CNJ confirmado continuam podendo aparecer como contexto adicional.
