# ComplianceHub V2 - Blueprint refinado master

## 1. Decisao executiva

O ComplianceHub V2 nao deve ser um clone de Marble, Ballerine ou de uma plataforma generica de KYC.

A decisao recomendada e construir uma arquitetura propria:

> **Brasil-first, BigDataCorp-first, investigativa, orientada a evidencias, revisao humana, decisao defensavel e relatorio cliente-safe.**

O eixo do produto deve ser:

`Consulta -> Evidencia -> Fato -> Relacao -> Sinal -> Revisao -> Decisao -> Relatorio`

Essa cadeia e o que separa o ComplianceHub de um simples consultador de dados.

## 2. O que o produto vende

### 2.1 Definicao

O ComplianceHub V2 vende dossies investigativos e decisoes auditaveis para due diligence PF/PJ, background check, avaliacao de risco, compliance operacional e relatorios comerciais.

### 2.2 O cliente compra

- dossie investigativo pronto;
- analise revisada;
- relatorio seguro;
- evidencias rastreaveis;
- auditoria;
- cockpit operacional;
- modulos ativados conforme necessidade.

### 2.3 O cliente nao compra

- API;
- payload bruto;
- tela de consulta isolada;
- grafico bonito sem decisao;
- automacao sem revisao.

## 3. Modelo de monetizacao recomendado

Modelo:

> **SaaS + consumo + dossie + relatorio + monitoramento futuro.**

### 3.1 Consulta/enriquecimento

Usado para cobrir custo de providers e margem.

Exemplos de cobranca:

- CPF basico;
- CNPJ basico;
- processos;
- vinculos;
- mandados/listas quando contratados;
- modulos adicionais.

### 3.2 Dossie investigativo

Produto central.

Pacotes sugeridos:

- Dossie PF Essencial;
- Dossie PF Completo;
- Dossie PJ;
- Dossie Societario;
- Dossie Risco Reputacional.

### 3.3 Plataforma SaaS

Camada recorrente:

- usuarios;
- tenants/clientes/franquias;
- cockpit;
- historico;
- auditoria;
- portal cliente;
- SLA/suporte.

### 3.4 Relatorio

Pode ser:

- incluso no dossie;
- cobrado por emissao;
- cobrado por pacote mensal;
- cobrado por relatorio revisado.

### 3.5 Monitoramento futuro

Premium:

- watchlist;
- alertas;
- reconsultas;
- mudancas historicas.

## 4. Produtos internos da plataforma

| Produto | Papel | Valor | Fase |
|---|---|---|---|
| Consulta/enriquecimento | Buscar dados | Baixo sozinho, necessario como insumo | Minima |
| Dossie investigativo | Consolidar contexto e evidencias | Core comercial | Minima/vendavel |
| Analise/decisao | Transformar evidencias em conclusao | Alto | Minima/vendavel |
| Relatorio | Entrega cliente-safe | Alto | Minima |
| Plataforma operacional | Produtividade e governanca | Fidelizacao | Vendavel |
| Monitoramento | Receita recorrente premium | Muito alto, futuro | Premium |

## 5. Fases da V2

### 5.1 V2 minima

Objetivo:

> Entregar analise revisada e relatorio seguro com base em evidencias rastreaveis.

Inclui:

- caso operacional;
- sujeito basico;
- BigDataCorp via provider contract;
- raw snapshot;
- provider record;
- evidence item;
- risk signal simples;
- decision;
- report snapshot;
- projection cliente-safe;
- public report valido;
- cockpit minimo.

Nao inclui:

- grafo completo;
- watchlist;
- monitoramento continuo;
- rule builder visual;
- SDK;
- migracao total de banco.

Valor:

- corrige fragilidade de relatorio vazio/stale;
- cria base defensavel;
- ja pode ser vendido como dossie/relatorio revisado.

### 5.2 V2 vendavel/intermediaria

Objetivo:

> Transformar a base tecnica em plataforma comercial clara de due diligence PF/PJ.

Inclui:

- dossie PF;
- dossie PJ;
- timeline;
- painel de evidencias;
- painel de divergencias;
- risk signals explicaveis;
- report composer;
- auditoria por decisao/relatorio;
- portal cliente enriquecido;
- modulos configuraveis por cliente;
- metrica de consumo.

Valor:

- produto mais facil de vender;
- dossie como unidade comercial;
- operacao mais produtiva;
- diferencial sobre consultadores simples.

### 5.3 V2 premium

Objetivo:

> Evoluir para inteligencia investigativa continua.

Inclui:

- grafo;
- watchlists;
- monitoramento;
- alert inbox;
- comparacao historica;
- dashboards gerenciais;
- regras configuraveis.

Valor:

- posiciona em categoria superior;
- cria receita recorrente avancada;
- aumenta barreira competitiva.

Condicao:

- so implementar apos V2 vendavel provar tracao.

## 6. Estrategia V1 -> V2

### 6.1 Manter

Manter e evoluir:

- portal cliente;
- portal operacional;
- fila de casos;
- fluxo de solicitacao;
- autenticacao/contexto;
- auditoria atual;
- relatorio publico;
- adapters existentes.

### 6.2 Refatorar

Refatorar profundamente:

- `src/portals/ops/CasoPage.jsx`;
- `functions/index.js`;
- `functions/reportBuilder.cjs`;
- `src/core/reportBuilder.js`;
- `src/core/clientPortal.js`;
- fluxo de `concludeCaseByAnalyst`;
- fluxo de `publishResultOnCaseDone`;
- `createClientPublicReport`;
- `createAnalystPublicReport`;
- normalizadores de provider.

### 6.3 Manter temporariamente e deprecar

- `publicResult/latest` como projection transicional;
- `clientCases` como projection cliente-safe;
- `cases` como envelope operacional, nao como deposito universal.

### 6.4 Substituir

Substituir duplicacao de builders por:

- modelo de `ReportSnapshot`;
- builder baseado em snapshot;
- testes golden;
- preview frontend com mesmo contrato.

## 7. Regras de negocio nao negociaveis

### 7.1 Tudo vira evidencia

Todo dado relevante precisa de origem, data, provider/fonte, contexto e snapshot.

### 7.2 Decisao sempre rastreavel

Toda decisao precisa apontar para evidencias, revisao, usuario, horario e versao publicada.

### 7.3 Cliente nunca ve dado bruto sensivel

Cliente ve apenas projection cliente-safe.

### 7.4 Caso nao e dado

Caso e processo. Dado investigativo vive no dossie, evidencias, fatos, relacoes e sinais.

### 7.5 Reuso de dados e obrigatorio quando seguro

Se ja existe snapshot valido, o sistema deve sugerir reuso antes de nova consulta.

### 7.6 Revisao humana em decisao critica

Risco alto, rejeicao, nao recomendacao, mandado, divergencia critica ou evidencia sensivel exigem revisao humana e possivelmente aprovacao senior.

## 8. Cockpit investigativo

### 8.1 Finalidade

Responder rapido:

> **"Essa pessoa ou empresa e confiavel para esta decisao?"**

### 8.2 Estrutura macro

Topo:

- busca global;
- sujeito;
- status;
- risco;
- modulos;
- acoes principais.

Esquerda:

- fila operacional;
- prioridade;
- SLA;
- bloqueios.

Centro:

- dossie;
- resumo executivo;
- identificacao;
- evidencias;
- processos/mandados/vinculos;
- timeline.

Direita:

- risk signals;
- divergencias;
- checklist;
- decisao;
- report status.

Drawer:

- viewer de evidencia;
- origem;
- timestamp;
- provider/fonte;
- fato/sinal relacionado.

### 8.3 Principio UX

> **Mostrar primeiro o que importa para decidir.**

Evitar:

- excesso de graficos;
- dados sem hierarquia;
- navegacao complexa;
- cockpit bonito e improdutivo.

### 8.4 Cockpit por fase

Minimo:

- painel de evidencias-chave;
- sinais simples;
- decisao;
- checklist;
- status do report snapshot.

Vendavel:

- dossie PF/PJ;
- timeline;
- divergencias;
- report composer;
- auditoria por decisao.

Premium:

- grafo;
- watchlists;
- monitoramento;
- comparacao historica.

## 9. Arquitetura implementavel

### 9.1 Dominios

Operacional:

- cases;
- filas;
- tarefas;
- revisao.

Investigativo:

- subjects;
- persons;
- companies;
- evidences;
- facts;
- relationships.

Provider/data:

- provider requests;
- raw snapshots;
- provider records;
- normalizers.

Analitico:

- risk signals;
- decisions;
- divergences.

Reporting:

- report snapshots;
- public reports;
- client projections.

Governanca:

- audit events;
- access events;
- policy decisions.

### 9.2 Fonte da verdade por camada

| Camada | Fonte da verdade |
|---|---|
| Processo operacional | `cases`/`InvestigationCase` |
| Consulta provider | `ProviderRequest` |
| Payload bruto | `RawSnapshot` |
| Dado normalizado | `ProviderRecord` |
| Prova/fato | `EvidenceItem`/`Fact` |
| Risco | `RiskSignal` |
| Conclusao | `Decision` |
| Relatorio | `ReportSnapshot` |
| Cliente | `ClientProjection`/`PublicReport` |

### 9.3 Anti-corruption layers

Criar:

- `LegacyCaseAdapter`;
- `ProviderPayloadAdapter`;
- `ReportProjectionBuilder`;
- `ClientProjectionBuilder`.

Esses adaptadores impedem que a V2 dependa diretamente de `caseData`, payload da BigDataCorp ou whitelists duplicadas.

## 10. Modelo operacional

### 10.1 Estados principais

- solicitado;
- aguardando dados;
- enriquecendo;
- evidencia pronta;
- revisao necessaria;
- em revisao;
- aguardando supervisor;
- decisao aprovada;
- relatorio gerando;
- relatorio pronto;
- publicado;
- reaberto.

### 10.2 Quando bloqueia publicacao

- sem decisao aprovada;
- sem report snapshot;
- snapshot vazio;
- evidencia critica sem revisao;
- divergencia critica aberta;
- projection cliente-safe falhou;
- public report/token ausente.

### 10.3 Quando gera novo relatorio

Sem nova decisao:

- mudanca visual;
- correcao de template;
- mesmo evidence set;
- mesma decisao.

Com nova decisao:

- evidencia mudou;
- nova consulta;
- veredito mudou;
- justificativa material mudou;
- caso reaberto.

## 11. Roadmap refinado

### 11.1 30 dias

- corrigir/blindar fluxo de relatorio;
- criar contratos de `Decision`, `ReportSnapshot`, `ClientProjection`;
- bloquear relatorio sem snapshot valido;
- definir pacotes comerciais;
- desenhar cockpit minimo.

### 11.2 60 dias

- provider ledger BigDataCorp;
- raw snapshots;
- provider records;
- evidence items;
- risk signals simples;
- cockpit minimo com evidencias e decisao.

### 11.3 90 dias

- subject/dossie minimo;
- reuso controlado;
- Dossie PF Essencial;
- Dossie PF Completo inicial;
- portal cliente V2;
- auditoria por decisao/relatorio;
- metricas de consumo.

## 12. Quick wins

- status "relatorio em geracao";
- report availability centralizado;
- audit event de abertura de relatorio;
- hash de conteudo publicado;
- whitelists testadas;
- preview de relatorio baseado em snapshot;
- painel de evidencias-chave;
- indicador de dado novo vs reaproveitado;
- pacotes comerciais documentados.

## 13. Riscos principais

### 13.1 Produto difuso

Risco:

- cliente nao entende o que compra.

Mitigacao:

- vender dossie/decisao/relatorio, nao API.

### 13.2 Overengineering

Risco:

- construir grafo/watchlist/rule builder cedo demais.

Mitigacao:

- premium fica fora da V2 minima.

### 13.3 Drift entre revisao e relatorio

Risco:

- analista revisa uma coisa e cliente ve outra.

Mitigacao:

- `Decision` + `ReportSnapshot` + hash.

### 13.4 Vazamento cliente

Risco:

- dados internos ou raw payload aparecerem no portal.

Mitigacao:

- projection cliente-safe e whitelists testadas.

### 13.5 Dependencia excessiva da BigDataCorp

Risco:

- dominio ficar acoplado ao payload.

Mitigacao:

- provider contract, raw snapshot, provider record, canonical facts.

## 14. O que deve ficar fora agora

- rule builder visual;
- grafo completo;
- watchlist;
- monitoramento continuo;
- SDK publico;
- marketplace de conectores;
- migracao total para Postgres;
- IA autonoma sem revisao.

## 15. Definicao de sucesso da V2 minima

A V2 minima esta pronta quando:

- um caso pode ser concluido com decision versionada;
- dados de provider ficam em snapshot;
- evidencias sustentam sinais;
- relatorio nasce de snapshot preenchido;
- portal cliente abre relatorio consistente;
- campos internos nao vazam;
- analista tem cockpit minimo para decidir;
- produto pode ser vendido como dossie revisado.

## 16. Definicao de sucesso da V2 vendavel

A V2 vendavel esta pronta quando:

- existem pacotes PF/PJ claros;
- dossie e unidade comercial;
- cockpit reduz trabalho real do analista;
- portal cliente entende status e relatorio;
- auditoria sustenta decisao;
- consumo por modulo e mensuravel;
- comercial consegue explicar em 2 minutos o que esta sendo vendido.

## 17. Frase final de direcao

> **A V2 vencedora nao e a mais cheia de funcionalidades; e a que transforma dados em dossies compraveis, decisoes explicaveis e relatorios confiaveis, com uma operacao que o analista consegue usar todos os dias.**

