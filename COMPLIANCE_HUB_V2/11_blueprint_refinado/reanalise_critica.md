# Reanalise critica dos materiais existentes

## 1. Objetivo desta reanalise

Este documento nao substitui o dossie anterior. Ele faz uma leitura critica dos artefatos ja gerados em `COMPLIANCE_HUB_V2/` para transformar a visao em um plano mais executavel.

O foco desta camada e separar:

- **confirmado nos inventarios/codigo**: evidencias ja mapeadas nos documentos anteriores, com caminhos e funcoes/componentes;
- **inferencia arquitetural**: conclusoes derivadas da estrutura observada;
- **decisao recomendada**: direcao proposta para a V2.

## 2. Fontes consolidadas

Foram consolidados especialmente:

- `10_resumo_executivo/resumo_executivo_v2.md`
- `10_resumo_executivo/decisao_final.md`
- `04_comparativo/matriz_comparativa.md`
- `05_blueprint_v2/blueprint_v2.md`
- `05_blueprint_v2/arquitetura_alvo.md`
- `05_blueprint_v2/modulos_backend.md`
- `05_blueprint_v2/modulos_frontend.md`
- `08_bigdatacorp_architecture/bigdatacorp_first_architecture.md`
- `08_bigdatacorp_architecture/provider_contract.md`
- `08_bigdatacorp_architecture/proveniencia_e_explainability.md`
- `07_modelagem_dominio/modelagem_dominio.md`
- `07_modelagem_dominio/entidades_canonicas.md`
- `07_modelagem_dominio/relacoes_e_evidencias.md`
- `06_roadmap/roadmap_v2.md`
- `06_roadmap/fases_priorizadas.md`
- `09_riscos_e_tradeoffs/riscos_arquiteturais.md`
- `01_inventario_compliancehub/*`
- `02_inventario_marble/*`
- `03_inventario_ballerine/*`

## 3. O que ja esta forte e maduro

### 3.1 Direcao estrategica

**Confirmado nos documentos:** `10_resumo_executivo/decisao_final.md` e `05_blueprint_v2/blueprint_v2.md` convergem para uma arquitetura propria, nao um clone de Marble nem de Ballerine.

**Leitura critica:** esta e a decisao mais importante do dossie. Marble e forte em decisioning/AML/cases/screening; Ballerine e forte em onboarding/KYC/KYB/workflows/revisao manual. O ComplianceHub precisa de uma terceira identidade: investigacao brasileira baseada em evidencias, dossie, decisao e relatorio.

**Decisao recomendada:** manter como principio nao negociavel: **ComplianceHub V2 = plataforma investigativa Brasil-first e BigDataCorp-first, inspirada parcialmente em Marble e Ballerine, mas com arquitetura propria.**

### 3.2 Encadeamento de valor

**Confirmado nos documentos:** a cadeia `Consulta -> Evidencia -> Fato -> Relacao -> Sinal -> Decisao -> Relatorio` aparece como eixo conceitual do blueprint e da arquitetura BigDataCorp-first.

**Leitura critica:** esta cadeia transforma o produto de um "consultador" em um sistema de decisao defensavel. Ela tambem reduz ambiguidade de implementacao, porque cada camada tem responsabilidade propria:

- consulta: chamada a provider;
- evidencia: material bruto ou normalizado com origem;
- fato: afirmacao canonica sustentada por evidencia;
- relacao: vinculo entre entidades;
- sinal: interpretacao de risco;
- decisao: conclusao revisada;
- relatorio: materializacao segura e auditavel para consumo.

**Decisao recomendada:** todo modulo novo da V2 deve declarar em qual camada atua. Se um recurso nao se encaixa em nenhuma camada, deve ser adiado ou repensado.

### 3.3 Separacao entre caso operacional e base investigativa

**Confirmado nos inventarios:** `01_inventario_compliancehub/inventario_compliancehub.md` aponta que `cases` hoje acumula dados operacionais, enriquecimento, revisao, resultado final e publicacao. Os arquivos citados incluem `functions/index.js`, `src/portals/ops/CasoPage.jsx`, `src/core/clientPortal.js`, `src/core/firebase/firestoreService.js`.

**Leitura critica:** o dossie acertou ao recomendar que `cases` deixe de ser deposito universal. Uma V2 investigativa precisa de `Subject`, `Person`, `Company`, `Evidence`, `RiskSignal`, `Decision` e `ReportSnapshot`.

**Decisao recomendada:** na transicao, `cases` deve continuar existindo como envelope operacional, mas novos dados investigativos devem nascer fora dele e ser referenciados por `caseId`, `subjectId`, `entityId`, `decisionId` e `reportSnapshotId`.

### 3.4 BigDataCorp-first em camadas

**Confirmado nos documentos:** `08_bigdatacorp_architecture/bigdatacorp_first_architecture.md` e `08_bigdatacorp_architecture/provider_contract.md` propuseram `RawSnapshot`, `ProviderRecord`, camada canonica, camada analitica e camada investigativa.

**Confirmado nos inventarios:** `functions/adapters/bigdatacorp.js` e `functions/normalizers/bigdatacorp.js` ja existem, mas ainda nao formam evidence store, raw snapshot versionado e entidade canonica reutilizavel.

**Leitura critica:** a direcao esta correta, mas precisa ser implementada incrementalmente. Nao e necessario criar todo o data lake no primeiro ciclo. O minimo e registrar cada consulta com request, endpoint/dataset, payload bruto, hash, timestamp, tenant, caseId/subjectId e versao do normalizador.

**Decisao recomendada:** a primeira fatia implementavel deve ser um `providerRequestLedger` + `rawProviderSnapshots` + `providerRecords` + `evidenceItems` focado inicialmente em BigDataCorp.

### 3.5 Roadmap em ondas

**Confirmado nos documentos:** `06_roadmap/roadmap_v2.md` propõe estabilizar V1, criar fundacao provider/evidencia, construir nucleo investigativo, depois sinais/decisoes e diferenciais.

**Leitura critica:** a ordem esta correta porque evita comecar por grafo, watchlist ou cockpit visual sofisticado. A lacuna e que o roadmap ainda precisa virar sequencia de sprints/blocos com dependencias e feature flags.

**Decisao recomendada:** manter a sequencia, mas adicionar cortes rigidos: V2 minima, V2 vendavel e V2 premium.

## 4. O que ainda esta generico

### 4.1 Produto vendavel

**Lacuna:** o material explica bem a arquitetura, mas ainda nao define com precisao o que o cliente compra.

**Risco:** equipe construir uma plataforma tecnicamente elegante, mas dificil de vender porque a oferta nao esta clara.

**Decisao recomendada:** posicionar a V2 como **plataforma de dossies investigativos e decisoes auditaveis para PF/PJ**, vendida por modulos de analise, volume de consultas/relatorios, revisao humana e governanca.

### 4.2 Fronteira entre V2 minima, vendavel e premium

**Lacuna:** os documentos citam fases, mas ainda deixam margem para interpretar que V2 inclui grafo, watchlist, monitoramento continuo e rule builder desde o inicio.

**Risco:** escopo explodir e atrasar a entrega do nucleo que gera valor.

**Decisao recomendada:**

- V2 minima: caso + BigDataCorp encapsulada + evidencias + decisao + relatorio auditavel.
- V2 vendavel: dossie PF/PJ + timeline + auditoria forte + portal cliente refinado + cockpit operacional.
- V2 premium: grafo, watchlist, monitoramento continuo, alertas historicos e rule builder visual.

### 4.3 Cockpit investigativo

**Lacuna:** o cockpit esta conceitualmente correto, mas pouco operacional. Falta explicitar a jornada do analista: fila, abertura, reaproveitamento de dossie, nova consulta, divergencias, sinais, revisao, decisao, publicacao e relatorio.

**Risco:** criar uma interface bonita que nao reduz tempo de analise nem melhora a defensabilidade.

**Decisao recomendada:** o cockpit deve ser desenhado a partir de tarefas e bloqueios operacionais, nao a partir de paineis esteticos.

### 4.4 Modelo canonico

**Lacuna:** as entidades estao bem listadas, mas faltava separar agregados, fatos, relacoes, evidencias, snapshots e materializacoes cliente-safe.

**Risco:** voltar a criar um `caseData` gigante com nomes novos.

**Decisao recomendada:** usar agregados claros:

- Operacional: `InvestigationCase`, `Task`, `AnalystReview`;
- Identidade: `Subject`, `Person`, `Company`, `EntityIdentifier`;
- Evidencia/provedor: `ProviderRequest`, `RawSnapshot`, `ProviderRecord`, `Evidence`;
- Conhecimento: `Fact`, `Relationship`, `RiskSignal`;
- Decisao/publicacao: `Decision`, `ReportSnapshot`, `ClientProjection`, `PublicReport`;
- Governanca: `AuditEvent`, `AccessEvent`, `PolicyDecision`.

### 4.5 Migracao da V1

**Lacuna:** o material anterior recomenda evolucao incremental, mas ainda nao classificava item por item o que reaproveitar, refatorar, substituir ou deprecar.

**Risco:** duas estrategias ruins:

- reescrever tudo e quebrar producao;
- manter tudo e pintar de V2 por cima.

**Decisao recomendada:** adotar uma estrategia de strangler fig: V1 continua operando, novos modulos nascem ao lado, contratos sao estabilizados, e fontes antigas viram projecoes ou adaptadores.

## 5. O que parece overengineering para agora

### 5.1 Rule builder completo

**Inspiracao:** Marble tem estrutura forte de rules/decisioning/workflows.

**Risco para ComplianceHub:** construir um motor visual de regras cedo demais consome tempo e exige maturidade de dominio que ainda deve ser validada no mercado brasileiro e nos modulos BigDataCorp.

**Decisao recomendada:** comecar com regras versionadas em codigo/configuracao e explainability por signal. Rule builder visual fica para premium ou V3.

### 5.2 Grafo investigativo completo

**Inspiracao:** a visao de relacoes pede grafo.

**Risco:** grafo bonito pode virar demonstracao comercial sem ganho operacional imediato.

**Decisao recomendada:** V2 vendavel deve ter lista de relacionamentos e mini-visualizacao simples. Grafo interativo completo fica para premium.

### 5.3 Watchlists e monitoramento continuo

**Inspiracao:** Marble tem continuous screening.

**Risco:** monitoramento continuo exige politicas de frequencia, custo, consentimento, governanca, notificacao, filas e auditoria mais maduras.

**Decisao recomendada:** preparar o modelo para `Watchlist` e `MonitoringSubscription`, mas nao prometer na V2 minima.

### 5.4 Monorepo/SDK/plugin marketplace no estilo Ballerine

**Inspiracao:** Ballerine tem apps, packages, SDKs e servicos especializados.

**Risco:** complexidade operacional alta antes de haver equipe/processo para sustentar.

**Decisao recomendada:** extrair contratos e modulos internos primeiro. Monorepo robusto e SDKs publicos so quando houver necessidade real.

### 5.5 Migracao imediata para Postgres

**Inspiracao:** Marble e Ballerine usam persistencia relacional robusta para parte relevante do dominio.

**Risco:** migrar banco antes de estabilizar modelo canonico aumenta risco e atrasa valor.

**Decisao recomendada:** manter Firestore no curto prazo, com colecoes mais disciplinadas, ids, snapshots imutaveis e materializacoes. Avaliar Postgres depois que o dominio canonico estabilizar.

## 6. Bom conceitualmente, fraco operacionalmente

### 6.1 Revisao humana

**Confirmado no ComplianceHub:** `src/portals/ops/CasoPage.jsx` concentra a revisao do caso; `functions/index.js:concludeCaseByAnalyst` conclui e aciona publicacao.

**Lacuna:** falta travar claramente qual snapshot foi revisado, qual decisao foi aprovada e qual relatorio foi gerado a partir dessa decisao.

**Recomendacao:** introduzir `decisionRevision`, `reviewedEvidenceSetHash`, `reportSnapshotId` e `clientProjectionHash`.

### 6.2 Publicacao e relatorio

**Confirmado no ComplianceHub:** o fluxo atual passa por `publicResult/latest`, `clientCases` e `publicReports`.

**Lacuna:** o dossie anterior ja apontou risco de drift entre revisao, publicacao e relatorio. Para V2, relatorio nao pode ser renderizacao dinamica de dados mutaveis sem snapshot.

**Recomendacao:** `publicReports` deve apontar para `ReportSnapshot` imutavel, nao para uma recomposicao solta de `caseData`.

### 6.3 Reaproveitamento de consultas

**Confirmado no ComplianceHub:** ha adaptadores e normalizadores, mas sem dossie persistente canonico.

**Lacuna:** falta regra operacional para quando reaproveitar dados antigos e quando consultar de novo.

**Recomendacao:** criar politica configuravel de freshness por tenant/modulo/dataset. No inicio, a politica pode ser conservadora e manualmente acionavel.

## 7. Bom arquiteturalmente, fraco comercialmente

### 7.1 Camadas de dados

**Forca:** raw, normalized, canonical, analytical e investigative estao corretas.

**Lacuna comercial:** cliente nao compra "camada canonica"; compra decisao confiavel, dossie claro, relatorio defensavel e reducao de risco.

**Recomendacao:** traduzir arquitetura em mensagens comerciais:

- "Cada decisao tem evidencias rastreaveis";
- "Relatorios padronizados com revisao humana";
- "Modulos ativados conforme a necessidade do cliente";
- "Historico auditavel de consultas, revisoes e conclusoes";
- "Dossies reutilizaveis para reduzir retrabalho e acelerar analises".

### 7.2 Provider-first

**Forca:** BigDataCorp-first e coerente com o contexto.

**Lacuna comercial:** a apresentacao nao deve expor API, endpoints ou logica interna.

**Recomendacao:** publicamente falar em "provedores de dados qualificados", "fontes externas especializadas", "camadas de verificacao" e "modulos de analise", mantendo nomes sensiveis apenas em contrato tecnico.

## 8. Pontos que podem gerar interpretacoes erradas

- "V2 investigativa" nao significa construir tudo de investigacao na primeira entrega.
- "BigDataCorp-first" nao significa acoplar o dominio ao payload da BigDataCorp.
- "Dossie" nao e relatorio PDF/HTML; dossie e base investigativa reutilizavel, relatorio e uma materializacao.
- "Evidencia" nao e qualquer texto exibido na tela; evidencia precisa de origem, timestamp, escopo, payload/trecho e cadeia de custodia.
- "IA" nao deve decidir sozinha; deve ajudar a resumir, estruturar e sugerir, com revisao humana e rastreabilidade.
- "Cliente-safe" nao e ocultar alguns campos na tela; e uma projecao propria com whitelist e snapshot.
- "Cockpit" nao e dashboard decorativo; e ambiente de trabalho para reduzir tempo, erro e risco decisorio.

## 9. Decisoes que precisam virar objetivas

| Tema | Status recomendado | Decisao objetiva |
|---|---|---|
| Identidade da V2 | Decidido | Arquitetura propria, Brasil-first, BigDataCorp-first |
| Fonte da verdade operacional | Decidido | `cases` continua como envelope operacional na transicao |
| Fonte da verdade investigativa | Decidido | Novos agregados canonicos fora de `cases` |
| Relatorio publico | Decidido | Gerado a partir de `ReportSnapshot` imutavel |
| `publicResult/latest` | Decidido | Projecao transicional e cliente-safe, nao dominio |
| Grafo | Em aberto | Mini-relacoes na vendavel; grafo completo premium |
| Watchlist | Em aberto | Preparar modelo, nao implementar na minima |
| Rule builder | Adiar | Regras versionadas primeiro; editor visual depois |
| Postgres | Depende de validacao | Nao migrar antes de estabilizar dominio |
| Cockpit | Decidido | Comecar por tarefas, evidencias, sinais e decisao |

## 10. Conclusao critica

O dossie anterior esta forte como direcao. O que faltava era disciplina de produto e traducao para execucao.

A V2 deve ser reduzida a um nucleo muito claro:

> **Receber uma demanda, identificar o sujeito, consultar provedores de forma auditavel, transformar dados em evidencias e sinais, permitir revisao humana, registrar decisao e emitir relatorio seguro.**

Tudo que nao fortalece esse nucleo deve ser questionado, adiado ou tratado como premium.

