# Faseamento detalhado: V2 minima, vendavel e premium

## 1. Principio de corte

A V2 nao deve ser tratada como uma entrega unica. Ela deve ser dividida em tres camadas:

- **V2 minima:** menor nucleo que entrega valor estrategico real e corrige a base estrutural.
- **V2 vendavel/intermediaria:** versao com forca comercial clara e diferenciacao relevante.
- **V2 premium:** plataforma investigativa avancada, com recursos de categoria superior.

O criterio de entrada e simples:

> Se o recurso nao fortalece consulta, evidencia, revisao, decisao ou relatorio, ele nao entra na V2 minima.

## 2. V2 minima

### 2.1 Objetivo

Estabilizar o nucleo de valor:

`Caso -> Sujeito -> BigDataCorp -> Evidencias -> Revisao humana -> Decisao -> ReportSnapshot -> Projecao cliente-safe`

### 2.2 Publico principal

- empresas que ja precisam de relatorios de background/due diligence;
- operacoes internas com analistas;
- franquias/clientes que solicitam analises;
- gestor que precisa acompanhar status e receber resultado seguro.

### 2.3 Casos de uso

- solicitar analise PF/PJ;
- consultar dados externos por modulo habilitado;
- revisar evidencias;
- aprovar decisao final;
- gerar relatorio preenchido e auditavel;
- disponibilizar resultado no portal cliente;
- consultar historico minimo de auditoria.

### 2.4 Modulos incluidos

- portal cliente existente refinado;
- fila operacional existente refinada;
- detalhe de caso com cockpit minimo;
- BigDataCorp provider contract inicial;
- raw snapshot inicial para BigDataCorp;
- evidence item inicial;
- decision record inicial;
- report snapshot imutavel;
- public report seguro;
- client-safe projection;
- audit events minimos;
- feature flags por tenant/modulo.

### 2.5 Modulos excluidos

- grafo interativo completo;
- watchlist;
- monitoramento continuo;
- rule builder visual;
- marketplace de conectores;
- SDK externo;
- migracao total para Postgres;
- BI avancado;
- automacoes complexas de workflow.

### 2.6 Fluxo operacional

1. Cliente cria solicitacao no portal.
2. Sistema cria `case` operacional.
3. Sistema cria ou localiza `subject` basico.
4. Analista ou pipeline aciona modulos habilitados.
5. BigDataCorp e outros providers sao chamados via contrato.
6. Sistema registra request, raw snapshot e provider record.
7. Normalizador extrai evidencias e fatos minimos.
8. Painel do analista mostra evidencias relevantes e divergencias.
9. Analista revisa, ajusta narrativas e aprova decisao.
10. Sistema cria `Decision` e `ReportSnapshot`.
11. Sistema materializa `clientCases`, `publicResult/latest` transicional e `publicReports`.
12. Cliente abre relatorio seguro preenchido.

### 2.7 Telas necessarias

- portal cliente: dashboard, solicitacoes, detalhe/drawer, abrir relatorio;
- portal ops: fila, caso/cockpit minimo, revisao/conclusao;
- relatorio publico;
- auditoria basica;
- configuracao simples de modulos por tenant/cliente.

### 2.8 Entidades necessarias

- `InvestigationCase` ou `case` legado com envelope operacional;
- `Subject`;
- `EntityIdentifier`;
- `ProviderRequest`;
- `RawSnapshot`;
- `ProviderRecord`;
- `EvidenceItem`;
- `RiskSignal` simples;
- `Decision`;
- `ReportSnapshot`;
- `ClientProjection`;
- `AuditEvent`.

### 2.9 Integracoes necessarias

- BigDataCorp como provider principal;
- providers atuais mantidos via adaptadores existentes quando ja estiverem operacionais;
- Firebase Auth/Firestore/Functions mantidos;
- IA apenas como apoio de sintese, nao como decisor autonomo.

### 2.10 Nivel de complexidade

Medio. A complexidade principal nao e UI; e coerencia entre dados revisados, dados publicados e relatorio.

### 2.11 Dependencias

- estabilizar fluxo de publicacao atual;
- definir contratos cliente-safe;
- criar report snapshot;
- criar provider request ledger;
- mapear campos minimos da BigDataCorp;
- testes de regressao do fluxo de conclusao e relatorio.

### 2.12 Riscos

- duplicar dominio sem descontinuar fluxo antigo;
- continuar gerando relatorio de dados mutaveis;
- criar `EvidenceItem` generico demais;
- subestimar regras de seguranca do portal cliente;
- misturar payload bruto com dado exibivel.

### 2.13 Esforco relativo

Medio-alto, mas controlavel. E a etapa mais importante porque cria o trilho da V2 sem exigir reescrita total.

### 2.14 Valor de negocio

Alto. Ja permite vender confiabilidade, revisao humana, relatorio seguro e auditoria.

### 2.15 Diferenciacao competitiva

Moderada a alta. O diferencial nao e amplitude de funcionalidades, mas qualidade do fluxo: evidencias rastreaveis e relatorio consistente.

### 2.16 Obrigatorio, opcional e fora

**Obrigatorio:**

- provider contract BigDataCorp;
- snapshot bruto;
- evidencia minima;
- decisao versionada;
- report snapshot;
- projecao cliente-safe;
- cockpit minimo de revisao.

**Opcional:**

- timeline simples;
- comparacao basica com consulta anterior;
- painel simples de custo/consulta.

**Fora:**

- grafo completo;
- watchlist;
- monitoramento continuo;
- rule builder.

## 3. V2 vendavel/intermediaria

### 3.1 Objetivo

Transformar o nucleo tecnico em produto comercial forte:

`Dossie PF/PJ -> Timeline -> Modulos configuraveis -> Evidencias -> Sinais -> Decisao -> Relatorio executivo -> Portal cliente`

### 3.2 Publico principal

- empresas com recorrencia de analises;
- clientes que precisam comparar pessoas/empresas ao longo do tempo;
- operacoes multi-cliente ou multi-franquia;
- areas que precisam justificar decisoes para auditoria ou diretoria.

### 3.3 Casos de uso

- due diligence PF;
- due diligence PJ;
- background check com revisao humana;
- dossie de fornecedor/parceiro;
- analise de socios e vinculos empresariais;
- reuso de dados recentes;
- nova consulta por modulo;
- relatorio executivo customizavel;
- auditoria de decisao.

### 3.4 Modulos incluidos

- dossie PF;
- dossie PJ;
- timeline investigativa;
- lista de relacoes/vinculos;
- risk signals com explainability;
- painel de divergencias entre fontes;
- report composer;
- controle de revisao/aprovacao;
- portal cliente com detalhe rico;
- auditoria operacional ampliada;
- configuracao de planos/modulos por cliente.

### 3.5 Modulos excluidos

- monitoramento continuo automatico em escala;
- grafo interativo avancado;
- automacao complexa de workflow;
- rules editor visual;
- modelos preditivos complexos;
- SDK publico.

### 3.6 Fluxo operacional

1. Demanda entra como caso.
2. Sistema identifica se ja existe dossie do sujeito.
3. Mostra freshness dos dados existentes.
4. Analista decide reaproveitar, atualizar ou complementar.
5. Pipeline consulta modulos necessarios.
6. Evidencias entram na timeline e no dossie.
7. Sinais sao gerados com origem e peso.
8. Analista resolve divergencias e bloqueios.
9. Supervisor aprova quando risco exige.
10. Relatorio executivo e composto a partir de snapshot.
11. Cliente ve resumo, status, decisao e relatorio seguro.

### 3.7 Telas necessarias

- cockpit investigativo completo em nivel intermediario;
- dossie PF;
- dossie PJ;
- timeline;
- painel de evidencias;
- painel de sinais;
- painel de decisao;
- report composer;
- configuracao de modulos;
- auditoria por caso/sujeito/relatorio.

### 3.8 Entidades necessarias

Todas da V2 minima, adicionando:

- `Person`;
- `Company`;
- `Address`;
- `Phone`;
- `Email`;
- `Lawsuit`;
- `Warrant`;
- `CorporateRole`;
- `Shareholding`;
- `Relationship`;
- `Fact`;
- `TimelineEvent`;
- `ReviewTask`;
- `ReportSection`;
- `ReportVersion`.

### 3.9 Integracoes necessarias

- BigDataCorp com mais datasets/modulos;
- providers atuais harmonizados ao mesmo contrato;
- IA para resumo assistido, sugestao de narrativa e deteccao de divergencia;
- exportacao/relatorio seguro.

### 3.10 Nivel de complexidade

Alto, mas com ROI claro. A complexidade passa a estar na consistencia do dossie e na experiencia do analista.

### 3.11 Dependencias

- V2 minima estabilizada;
- evidencia e snapshot funcionando;
- contrato de relatorio consolidado;
- entidades canonicas basicas;
- politica de freshness;
- RBAC e auditoria adequados.

### 3.12 Riscos

- tentar modelar todo o mundo juridico/cadastral de uma vez;
- criar timeline poluida;
- misturar dados internos e cliente-safe;
- excesso de campos no cockpit;
- subestimar custo de normalizacao PF/PJ.

### 3.13 Esforco relativo

Alto. Deve ser implementada em blocos, priorizando PF/PJ e relatorio antes de grafo.

### 3.14 Valor de negocio

Muito alto. Esta e a camada que torna a V2 mais facil de vender como plataforma, nao apenas fluxo operacional.

### 3.15 Diferenciacao competitiva

Alta. Dossie reutilizavel + evidencias + revisao + relatorio e uma proposta comercial forte.

### 3.16 Obrigatorio, opcional e fora

**Obrigatorio:**

- dossie PF/PJ;
- timeline;
- painel de evidencias;
- risk signals explicaveis;
- report composer;
- auditoria por decisao;
- modulos por cliente.

**Opcional:**

- mini-grafo simples;
- score configuravel;
- comparacao historica basica.

**Fora:**

- monitoramento continuo amplo;
- grafo investigativo completo;
- regras visuais para usuario final.

## 4. V2 premium

### 4.1 Objetivo

Elevar o ComplianceHub para plataforma investigativa continua:

`Dossies -> Vínculos -> Watchlists -> Monitoramento -> Alertas -> Investigacao continua -> Inteligencia operacional`

### 4.2 Publico principal

- empresas com alto volume;
- operacoes de risco estruturadas;
- redes/franquias com muitos clientes;
- times de investigacao corporativa;
- empresas que precisam monitorar fornecedores, socios, clientes ou parceiros.

### 4.3 Casos de uso

- monitoramento continuo de sujeitos;
- alertas de mudanca de risco;
- watchlists internas;
- investigacao por rede de vinculos;
- comparacao historica de dossies;
- priorizacao automatica de filas;
- relatorios periodicos;
- inteligencia de carteira.

### 4.4 Modulos incluidos

- grafo interativo;
- watchlist;
- monitoring subscriptions;
- alert engine;
- regras configuraveis;
- cockpit analitico;
- comparacao historica;
- dashboards gerenciais;
- governanca avancada;
- automacoes de workflow.

### 4.5 Modulos excluidos

- tudo que exija virar uma plataforma generica horizontal demais sem relacao com due diligence/investigacao;
- plugin marketplace antes de demanda real;
- SDK publico sem cliente integrador validado;
- IA autonoma sem revisao humana.

### 4.6 Fluxo operacional

1. Sujeitos entram em watchlist por regra, decisao ou acao manual.
2. Sistema agenda verificacoes por politica.
3. Mudancas relevantes geram `Alert`.
4. Alertas entram em fila priorizada.
5. Analista abre contexto historico e grafo.
6. Sistema compara evidencias novas vs antigas.
7. Decisao pode ser mantida, revisada ou reaberta.
8. Cliente recebe comunicacao segura se contratado.

### 4.7 Telas necessarias

- grafo;
- watchlists;
- alert inbox;
- monitoramento por carteira;
- comparador historico;
- dashboards executivos;
- rules/configuracoes avancadas;
- cockpit premium.

### 4.8 Entidades necessarias

Todas das fases anteriores, adicionando:

- `Watchlist`;
- `MonitoringSubscription`;
- `Alert`;
- `AlertDefinition`;
- `GraphProjection`;
- `EntityCluster`;
- `HistoricalComparison`;
- `RuleDefinition`;
- `AutomationRun`;
- `OperationalMetric`.

### 4.9 Integracoes necessarias

- BigDataCorp com politica de reconsulta;
- fila/jobs duraveis;
- notificacoes;
- possivel banco relacional/analitico para consultas complexas;
- observabilidade mais forte.

### 4.10 Nivel de complexidade

Muito alto. Deve ser construida somente depois que a V2 vendavel estiver provando tracao.

### 4.11 Dependencias

- dominio canonico estavel;
- dossies reutilizaveis;
- evidencias versionadas;
- custos de provider controlados;
- operacao com processos maduros;
- contrato comercial premium.

### 4.12 Riscos

- custo operacional alto;
- alert fatigue;
- juridico/privacidade;
- falsos positivos;
- grafo sem utilidade pratica;
- aumento de suporte e manutencao.

### 4.13 Esforco relativo

Muito alto. Nao deve ser misturado com a V2 minima.

### 4.14 Valor de negocio

Altissimo se houver cliente certo e volume. Baixo ROI se implementado antes de demanda validada.

### 4.15 Diferenciacao competitiva

Muito alta, mas so se houver base investigativa confiavel. Sem evidence store e dossie, premium vira superficie bonita sobre dados frageis.

### 4.16 Obrigatorio, opcional e fora

**Obrigatorio:**

- alertas com origem;
- monitoramento com custo controlado;
- grafo util para investigacao;
- comparacao historica;
- governanca e auditoria fortes.

**Opcional:**

- rules editor visual;
- dashboards customizaveis;
- integracoes outbound.

**Fora:**

- autonomia decisoria sem revisao;
- monitoramento sem politica de consentimento/contrato;
- conectores ilimitados sem estrategia.

## 5. Tabela comparativa resumida

| Dimensao | V2 minima | V2 vendavel | V2 premium |
|---|---|---|---|
| Promessa | Analise revisada e relatorio seguro | Plataforma de dossies PF/PJ | Inteligencia investigativa continua |
| Core | Evidencia, decisao, snapshot | Dossie, timeline, sinais | Watchlist, grafo, alertas |
| Cliente compra | Confiabilidade operacional | Due diligence escalavel | Monitoramento e investigacao avancada |
| Complexidade | Media | Alta | Muito alta |
| Diferencial | Relatorio auditavel | Dossie reutilizavel | Inteligencia continua |
| Risco | Drift de publicacao | Excesso de modelagem | Overengineering/custo |
| Deve entrar agora | Sim | Parcialmente, em ondas | Nao |

## 6. Corte executivo recomendado

Para execucao imediata, a equipe deve tratar:

- **V2 minima** como obrigatoria;
- **V2 vendavel** como alvo comercial dos proximos ciclos;
- **V2 premium** como direcao, nao como escopo inicial.

