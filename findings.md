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
