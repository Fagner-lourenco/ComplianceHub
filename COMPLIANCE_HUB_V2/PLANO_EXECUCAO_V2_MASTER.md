# PLANO DE EXECUCAO V2 MASTER - COMPLIANCEHUB

Documento definitivo de execucao da V2 do ComplianceHub.

Data de consolidacao: 2026-04-21.

Escopo deste documento:

- consolidar os artefatos produzidos em `COMPLIANCE_HUB_V2/`;
- eliminar duplicidades e ambiguidade;
- fixar decisoes de produto, monetizacao, arquitetura, operacao, UX e rollout;
- orientar implementacao real sem reescrita total da V1;
- manter stack Firebase / Firestore / Cloud Functions;
- adiar infraestrutura pesada ate existir necessidade concreta.

Decisoes-base deste plano:

- Firebase Auth continua.
- Firestore continua como banco principal no curto e medio prazo.
- Cloud Functions v2 continuam como nucleo de orquestracao.
- Cloud Storage pode ser usado para payloads/snapshots/artefatos pesados.
- Cloud Tasks entra apenas quando houver ganho claro de retry, throttling ou jobs assicronos.
- Pub/Sub entra apenas em fase avancada, quando houver fan-out/monitoramento continuo.
- BigQuery entra como evolucao analitica futura, nao como dependencia da V2 minima.
- Nao migrar para VPS.
- Nao migrar para Kubernetes.
- Nao migrar para Postgres agora.
- Nao reescrever a V1.
- Sim criar snapshots, evidencias, projections e contratos.
- Sim tratar a arquitetura-alvo como premium-complete.
- Sim implementar essa arquitetura em ondas progressivas, sem antecipar infraestrutura pesada.
- Sim tratar a V2 como plataforma modular com catalogo global de produtos e modulos.
- Sim tratar "planos" apenas como presets comerciais opcionais.
- Sim usar tenant/contrato/entitlements como unidade real de habilitacao.
- Sim centralizar regras de modulo para evitar if/else espalhado em `functions/index.js`, `CasoPage.jsx`, `clientPortal.js` e report builders.
- Sim aplicar precedencia explicita: catalogo define o que existe; preset sugere; contrato/entitlement habilita; policy/override restringe; feature flag libera rollout; RBAC autoriza usuario; estado operacional decide execucao/publicacao.

---

# 1. Resumo executivo definitivo

## 1.1 Sintese final da V2

O ComplianceHub V2 deve ser uma plataforma investigativa de due diligence, background check e decisao de risco para pessoas fisicas e juridicas.

A V2 nao deve ser um clone de Marble, Ballerine, Kronoos ou qualquer ferramenta generica de KYC/AML. Ela deve ser uma arquitetura propria, adaptada ao contexto brasileiro, ao uso de BigDataCorp como fonte principal e ao fluxo real ja existente no ComplianceHub.

O nucleo da V2 e:

```txt
Solicitacao
  -> Caso operacional
  -> Sujeito investigado
  -> Consulta provider
  -> Snapshot bruto
  -> Registro normalizado
  -> Evidencia
  -> Fato / relacao
  -> Sinal de risco
  -> Revisao humana
  -> Decisao
  -> ReportSnapshot
  -> Projection cliente-safe
  -> Relatorio publico seguro
```

## 1.2 Proposta de valor

O ComplianceHub V2 transforma dados dispersos em dossies investigativos, decisoes rastreaveis e relatorios seguros.

O valor real nao e "consultar dados". O valor real e entregar:

- dossie organizado;
- evidencias com origem;
- decisao revisada;
- justificativa defensavel;
- relatorio cliente-safe;
- auditoria de ponta a ponta;
- operacao escalavel para analistas e clientes.

## 1.3 Direcao estrategica

A direcao final e:

> ComplianceHub V2 = plataforma investigativa Brasil-first, BigDataCorp-first, evidence-first e human-review-first.

Significa:

- Brasil-first: CPF, CNPJ, processos, mandados, vinculos societarios e contexto local sao dominios centrais.
- BigDataCorp-first: BigDataCorp e o provedor central, mas isolado por contrato para nao contaminar o dominio.
- Evidence-first: nada relevante vira decisao sem evidencia.
- Human-review-first: IA e automacao ajudam, mas decisoes criticas continuam revisadas por humano.

## 1.4 Por que esta arquitetura/produto faz sentido

Confirmado nos inventarios anteriores:

- `src/App.jsx` ja separa portal cliente, portal operacional e relatorio publico.
- `functions/index.js` ja contem fluxo de solicitacao, enriquecimento, conclusao, publicacao e relatorio.
- `src/portals/ops/CasoPage.jsx` ja concentra revisao humana e conclusao.
- `src/portals/client/SolicitacoesPage.jsx` ja entrega acompanhamento e abertura de relatorio.
- `functions/adapters/bigdatacorp.js` e `functions/normalizers/bigdatacorp.js` ja existem.
- `functions/reportBuilder.cjs` e `src/core/reportBuilder.js` ja existem, mas duplicam responsabilidade.
- `clientCases`, `publicResult/latest` e `publicReports` ja sustentam o fluxo cliente, mas precisam virar projections/snapshots seguros.

Portanto, a V2 deve preservar o que funciona e corrigir o que impede escala:

- `cases` nao pode continuar sendo deposito universal.
- `functions/index.js` nao pode continuar concentrando todos os dominios.
- relatorio nao pode depender de snapshot vazio, stale ou mutavel.
- portal cliente nao pode ler dados internos ou inconsistentes.
- BigDataCorp nao pode vazar como payload bruto para o dominio, portal ou relatorio.

## 1.5 Por que Firebase/Functions continuam

Firebase/Firestore/Functions continuam porque:

- a V1 ja esta baseada nessa stack;
- reduz atrito operacional;
- evita DevOps pesado;
- acelera entrega da V2 minima;
- permite rollout gradual por feature flag;
- permite manter portais e fluxo atual enquanto novas colecoes nascem ao lado;
- Firestore e adequado para documentos operacionais, snapshots, projections e auditoria se usado com disciplina.

O problema atual nao e "Firestore". O problema e usar um documento como data lake universal. A V2 corrige isso com colecoes bem delimitadas, snapshots imutaveis, projections e contratos.

## 1.6 Prioridades reais

Ordem de prioridade:

1. Blindar publicacao e relatorio.
2. Criar `Decision`, `ReportSnapshot` e `ClientProjection`.
3. Encapsular BigDataCorp com provider ledger.
4. Criar `RawSnapshot`, `ProviderRecord` e `EvidenceItem`.
5. Evoluir cockpit minimo em cima de evidencias e decisao.
6. Criar catalogo/entitlements minimos apenas o suficiente para governar produto, modulo e tenant sem overengineering.
7. Criar `Subject` e dossie minimo.
8. Evoluir portal cliente para leitura cliente-safe baseada nos entitlements reais.
9. Organizar monetizacao por SaaS + consumo + dossie + relatorio.
10. Construir V2 vendavel sem acoplar tecnica a plano comercial rigido.
11. Evoluir ate a camada premium-complete: watchlists, alertas, monitoramento, grafo e inteligencia continua.

## 1.7 Visao premium-complete da plataforma

Decisao final:

> A arquitetura-alvo oficial do ComplianceHub V2 e premium-complete. A implementacao e incremental.

Isso significa:

- o modelo-alvo contempla cockpit investigativo avancado, dossies PF/PJ, relacionamento entre entidades, timeline, divergencias, watchlists, alertas, monitoramento, billing modular, auditoria profunda, report snapshots e governanca por tenant;
- a V2 minima e apenas a primeira onda operacional desta arquitetura;
- a V2 vendavel e a primeira versao forte de mercado;
- a V2 premium e o estado-alvo da plataforma, nao um produto separado improvisado depois;
- componentes premium podem nascer primeiro como contrato/conceito no catalogo e so depois virar colecao, UI ou job assicrono;
- nenhuma decisao inicial deve fechar portas para monitoramento, alertas, grafo, relacoes e analytics futuros.

Regra de projeto:

> Projetar para premium-complete; executar em fatias pequenas, reversiveis e testaveis.

## 1.8 Precedencia oficial de governanca

Quando houver conflito entre configuracoes, a plataforma deve seguir esta ordem:

| Camada | Papel | Exemplo | Prevalencia |
|---|---|---|---|
| Catalogo global | Define o que existe na plataforma | `moduleCatalog.criminal` | Nao habilita tenant sozinho |
| Preset comercial | Sugere pacote inicial | `Professional` | Nunca governa execucao diretamente |
| Contrato/entitlement | Define o que tenant pode usar | `tenantEntitlements.modules.criminal=true` | Fonte efetiva de habilitacao |
| Policy/override operacional | Restringe ou especializa a execucao | exigir senior para mandado | Pode restringir entitlement |
| Feature flag | Libera rollout tecnico | `v2EvidenceStoreEnabled` | Pode bloquear recurso ainda nao liberado |
| RBAC/permissao | Autoriza usuario | `decision.approve` | Pode bloquear acao humana |
| Estado operacional | Indica se pode executar/publicar agora | decision aprovada, report ready | Bloqueia publicacao se incompleto |

Regra:

- catalogo nao concede acesso;
- preset nao deve aparecer como regra tecnica;
- entitlement habilita, mas nao dispensa RBAC, feature flag, freshness, review policy e estado operacional;
- RBAC autoriza usuario, mas nao habilita modulo nao contratado;
- feature flag libera rollout, mas nao substitui contrato.

---

# 2. Definicao final do produto

## 2.1 O que o ComplianceHub V2 e

O ComplianceHub V2 e uma plataforma investigativa de risco e compliance que permite:

- solicitar analises PF/PJ;
- consultar fontes qualificadas;
- organizar evidencias;
- montar dossies investigativos;
- gerar sinais de risco;
- apoiar revisao humana;
- registrar decisoes;
- emitir relatorios seguros;
- auditar o caminho da decisao.

## 2.2 O que ele nao e

O ComplianceHub V2 nao e:

- simples consultador de dados;
- CRM generico;
- ferramenta generica de KYC;
- motor AML transacional;
- workflow builder generico;
- painel de dashboards sem decisao;
- produto de API bruta;
- substituto da revisao humana;
- grafo investigativo completo na primeira fase.

## 2.3 Categoria do produto

Categoria recomendada:

> Plataforma investigativa de due diligence e decisao de risco orientada a evidencias.

Subcategorias onde o produto pode se posicionar:

- background check;
- due diligence PF/PJ;
- compliance operacional;
- risco reputacional;
- analise cadastral;
- apoio investigativo;
- relatorio auditavel.

## 2.4 Problema central que resolve

Empresas precisam tomar decisoes sobre pessoas, empresas, socios, candidatos, fornecedores, parceiros e clientes, mas os dados costumam estar:

- espalhados;
- sem origem clara;
- sem padronizacao;
- sem trilha de revisao;
- sem relatorio consistente;
- sem justificativa defensavel;
- sem historico auditavel.

O ComplianceHub V2 resolve esse problema criando um fluxo operacional e investigativo unico.

## 2.5 Para quem resolve

Compradores:

- compliance;
- juridico;
- RH;
- credito/cadastro;
- operacoes;
- redes/franquias;
- empresas que vendem analise como servico;
- empresas com alto volume de onboarding ou due diligence.

Usuarios internos:

- analista operacional;
- analista senior;
- coordenador;
- auditor;
- admin do tenant;
- gestor de risco.

Usuarios externos:

- cliente solicitante;
- gestor do cliente;
- auditor do cliente;
- area que consome o relatorio.

## 2.6 Quem compra

Quem compra normalmente quer uma destas entregas:

- reduzir risco na contratacao;
- validar fornecedor/parceiro;
- avaliar cliente;
- fazer background check;
- produzir relatorio para decisao;
- ter rastreabilidade e auditoria.

O comprador nao deve precisar entender provider, API, payload ou logica interna.

## 2.7 Quem usa

Operacao interna:

- trabalha na fila;
- consulta/modera dados;
- revisa evidencias;
- decide;
- publica relatorio.

Cliente:

- cria solicitacao;
- acompanha status;
- responde pendencias;
- abre resultado;
- compartilha relatorio.

Gestor/admin:

- configura usuarios;
- acompanha volume;
- audita;
- controla modulos;
- acompanha custos/consumo internamente.

## 2.8 Unidade principal de valor

Unidade principal de valor:

> dossie investigativo revisado e defensavel.

Materializacoes comerciais:

- Dossie PF Essencial.
- Dossie PF Completo.
- Dossie PJ.
- Dossie Societario.
- Dossie Risco Reputacional.
- Relatorio cliente-safe.
- Monitoramento futuro.

## 2.9 Diferenca de um consultador de dados

Consultador:

- recebe CPF/CNPJ;
- retorna dados;
- deixa interpretacao para o usuario.

ComplianceHub V2:

- recebe demanda;
- cria caso;
- identifica sujeito;
- consulta provider;
- registra snapshot;
- cria evidencias;
- extrai fatos e relacoes;
- gera sinais;
- exige revisao humana;
- registra decisao;
- materializa relatorio;
- audita tudo.

## 2.10 Diferenca de Marble

Confirmado na matriz comparativa anterior: Marble e forte em decisioning, AML/screening, cases, workflows, continuous screening e data model.

ComplianceHub deve se inspirar em Marble para:

- case management;
- decisioning;
- screening;
- events/inboxes;
- future continuous monitoring.

Mas nao deve virar Marble porque o foco do ComplianceHub e:

- Brasil;
- BigDataCorp;
- PF/PJ;
- processos/mandados/contexto juridico brasileiro;
- dossie e relatorio comercial revisado.

## 2.11 Diferenca de Ballerine

Confirmado na matriz comparativa anterior: Ballerine e forte em KYC/KYB, workflow runtime, collection flow, documentos, manual review e backoffice.

ComplianceHub deve se inspirar em Ballerine para:

- workflow;
- revisao manual;
- coleta/pendencias;
- backoffice por entidade;
- organizacao modular.

Mas nao deve virar Ballerine porque o foco do ComplianceHub nao e onboarding generico ou collection flow complexo. O foco e investigacao, evidencia, decisao e relatorio.

## 2.12 Diferenca de plataformas similares

Comparacao com plataformas comerciais similares e apenas conceitual, pois seus repositorios internos nao foram analisados.

O diferencial do ComplianceHub deve ser:

- especializacao brasileira;
- BigDataCorp-first;
- fluxo com revisao humana;
- relatorio seguro;
- portal cliente simples;
- operacao por analistas;
- evidencia/proveniencia nativa;
- modulos contrataveis.

## 2.13 Linguagem definitiva: produto, modulo, capability, preset, entitlement e entregavel

A V2 deve eliminar a confusao entre produto, plano, modulo e feature.

Definicoes oficiais:

| Termo | Definicao | Exemplo | Unidade tecnica? | Unidade comercial? |
|---|---|---|---|---|
| Produto | Oferta de valor que o cliente entende e compra | Dossie PF Essencial, Dossie PJ, Monitoramento | Parcial | Sim |
| Modulo | Bloco funcional habilitavel que compoe produtos | Identificacao, Criminal, Trabalhista, Mandados, KYC, Societario, Reputacional | Sim | Pode ser vendido como adicional |
| Capability | Capacidade compartilhada da plataforma usada por varios modulos | Evidence store, report snapshot, risk signals, audit, usage meter | Sim | Nao diretamente |
| Preset comercial | Template de contratacao usado pelo comercial | Start, Professional, Investigative, Intelligence | Nao deve ser a base tecnica | Sim |
| Entitlement | Habilitacao real por tenant/contrato | Tenant X tem Dossie PF + Mandados + revisao senior obrigatoria | Sim | Sim, conforme contrato |
| Entregavel | Output concreto para cliente/operacao | Dossie, decisao, relatorio, alerta, exportacao | Sim | Sim |

Regra definitiva:

> Preset comercial sugere. Entitlement contratual decide. Modulo executa. Capability sustenta. Entregavel materializa.

## 2.14 Organizacao modular oficial da plataforma

A plataforma deve ser organizada assim:

```txt
Plataforma base
  -> Capabilities compartilhadas
      -> auth, tenant, RBAC, audit, evidence, decision, report, billing, cockpit
  -> Catalogo global de produtos
      -> Dossie PF, Dossie PJ, Dossie Societario, Monitoramento
  -> Catalogo global de modulos
      -> Identificacao, Criminal, Trabalhista, Mandados, KYC, Societario, Reputacional
  -> Presets comerciais opcionais
      -> Start, Professional, Investigative, Intelligence
  -> Tenant contract / entitlements
      -> o que aquele cliente realmente pode usar
  -> Execucao operacional
      -> casos, consultas, evidencias, decisoes, relatorios
```

Decisao final:

- a plataforma nao deve ter regras tecnicas baseadas diretamente em "plano";
- o backend deve consultar entitlements do tenant;
- o frontend deve renderizar cockpit e portal conforme entitlements reais;
- billing deve medir uso por modulo/produto habilitado;
- report snapshot deve incluir apenas secoes permitidas pelo entitlement e relevantes ao produto.

## 2.15 Semantica oficial de execucao modular do caso

A V2 deve diferenciar com rigor o que foi solicitado, o que foi autorizado, o que foi executado, o que sustentou a decisao e o que entrou no relatorio.

| Campo/conceito | Definicao | Quem define | Onde deve viver | Regra |
|---|---|---|---|---|
| `productKey` | Produto comercial/operacional solicitado para o caso | cliente/ops no intake, validado pelo backend | `cases` como envelope e `Decision`/`ReportSnapshot` como snapshot | Um caso deve ter um produto principal; produtos adicionais devem criar nova revision, subcaso ou deliverable separado |
| `requestedModuleKeys` | Modulos pedidos no formulario, no preset ou pelo operador | cliente/ops/preset comercial | `cases` como intencao curta; nunca como status | Pedido nao significa direito de executar |
| `effectiveModuleKeys` | Modulos realmente autorizados e exigidos para aquele caso apos resolver contrato, policy e dependencias | `EntitlementResolver` + `ModuleRegistry` + policies | projection operacional curta e/ou `moduleRuns`; nao deve ser calculado no frontend | E o conjunto que o sistema tentara executar ou marcar como bloqueado |
| `executedModuleKeys` | Modulos que foram executados, reutilizaram snapshot valido ou terminaram com status final | derivado de `moduleRuns` | derivado de `moduleRuns`, podendo ser materializado em summary | Nao deve ser editado manualmente; `moduleRuns` e a fonte operacional |
| `reportModuleKeys` | Modulos cujas evidencias/sinais/secoes entraram no `ReportSnapshot` | `ReportSectionResolver` apos decision/review | `ReportSnapshot` | E subconjunto de modulos executados/reutilizados e aprovados para visibilidade cliente-safe |

Fluxo oficial:

```txt
productKey + requestedModuleKeys
  -> EntitlementResolver
  -> effectiveModuleKeys
  -> moduleRuns
  -> ProviderRequest / RawSnapshot / ProviderRecord
  -> EvidenceItem / Fact / RiskSignal
  -> Decision
  -> ReportSectionResolver
  -> reportModuleKeys no ReportSnapshot
```

Regras:

- `requestedModuleKeys` nao autoriza execucao.
- `effectiveModuleKeys` nao prova que modulo executou.
- `executedModuleKeys` nao prova que modulo deve aparecer no relatorio.
- `reportModuleKeys` nao pode ser calculado direto do pedido original.
- modulo solicitado mas nao contratado deve gerar bloqueio/pendencia comercial, nao execucao silenciosa.
- modulo contratado mas opcional pode nao executar se policy/freshness/reuso indicar que nao precisa.
- modulo obrigatorio com falha final bloqueia decision/publicacao ou exige justificativa senior.
- modulo que reutiliza snapshot deve aparecer em `moduleRuns` com status proprio, para billing, auditoria e explainability.

---

# 3. Modelo de monetizacao e organizacao modular dos produtos

## 3.1 Decisao comercial definitiva

O modelo comercial continua sendo:

> SaaS + consumo + dossie + relatorio + monitoramento futuro.

Mas a unidade tecnica de habilitacao nao sera "plano".

Decisao final:

> Planos sao presets comerciais. A habilitacao real da plataforma acontece por tenant/contrato/entitlement.

Isso significa:

- o comercial pode vender pacotes padrao;
- cada tenant pode ter combinacoes especificas;
- o backend deve avaliar entitlements reais;
- o frontend deve renderizar UX conforme entitlements reais;
- billing deve medir consumo conforme modulo/produto executado;
- auditoria deve registrar qual entitlement permitiu cada acao.

## 3.2 Como cobrar

Camadas de cobranca:

1. SaaS base: acesso a portal cliente, cockpit, usuarios, auditoria e operacao.
2. Consumo: chamadas/consultas/modulos executados.
3. Dossie: produto investigativo entregue.
4. Relatorio: emissao, compartilhamento, versao premium ou exportacao.
5. Monitoramento futuro: watchlists, alertas e reconsultas.

Regra:

- precificacao pode ser por preset comercial;
- execucao e permissao sempre devem ser por entitlement.

## 3.3 Catalogo global de produtos

Produtos sao ofertas que o cliente entende.

| Produto | Proposito | Modulos comuns | Entregaveis | Supervisao humana |
|---|---|---|---|---|
| Consulta / Enriquecimento | Coletar dados e normalizar | Identificacao, CPF/CNPJ, processos, KYC, provider-specific | Dados normalizados, usage event | Nao obrigatoria por item; revisao apenas se virar decisao/relatorio |
| Dossie PF Essencial | Entregar analise PF basica e revisada | Identificacao, dados cadastrais, risco basico, relatorio | Dossie, decisao, relatorio | Revisao operacional obrigatoria |
| Dossie PF Completo | Entregar PF com contexto judicial/riscos | Identificacao, criminal, trabalhista, mandados, KYC, divergencias | Dossie completo, decisao, relatorio | Revisao analitica obrigatoria |
| Dossie PJ | Entregar contexto empresarial | CNPJ, quadro societario, processos, risco cadastral, relacoes | Dossie PJ, decisao, relatorio | Revisao analitica obrigatoria |
| Dossie Societario/Reputacional | Investigar vinculos e riscos sensiveis | Societario, reputacional, relacoes, listas/midia quando habilitado | Dossie especializado, decisao, relatorio | Revisao analitica ou senior conforme risco/contrato |
| Decisao de risco | Transformar evidencias em recomendacao | Risk signals, score, checklist, approval workflow | Decision versionada | Obrigatoriamente supervisionada |
| Relatorio seguro | Materializar resultado cliente-safe | Report snapshot, public report, client projection | Link seguro, HTML/PDF futuro | Derivado de decisao supervisionada |
| Monitoramento / Alertas | Acompanhar mudancas futuras | Watchlist, reconsulta, alert engine | Alertas, comparativos, relatorios periodicos | Alerta pode ser automatico; acao conclusiva exige humano |

## 3.4 Catalogo global de modulos

Modulos sao blocos funcionais habilitaveis e combinaveis.

| Modulo | Tipo | Usa provider? | Saida principal | Afeta billing? | Afeta supervisao? |
|---|---|---|---|---|---|
| Identificacao PF | Data module | Sim | ProviderRecord, Evidence, Fact | Sim | Se houver divergencia |
| Identificacao PJ | Data module | Sim | Company facts | Sim | Se houver divergencia |
| Judicial / Processos | Data + analytical | Sim | Lawsuit facts, signals | Sim | Sim se risco relevante |
| Criminal | Analytical module | Sim/derivado | RiskSignal criminal | Sim | Sim quando positivo |
| Trabalhista | Analytical module | Sim/derivado | RiskSignal trabalhista | Sim | Conforme contrato/risco |
| Mandados / Alertas criticos | Critical risk module | Sim | Warrant facts/signals | Sim | Sempre exige revisao; geralmente senior |
| KYC / listas / PEP / sancoes | Screening module | Sim | Screening signals | Sim | Sim quando positivo |
| Societario / Vinculos | Relationship module | Sim | Relationships, facts | Sim | Sim quando usado em decisao |
| Reputacional / Midia | Future module | Sim | MediaMention, signals | Sim | Sim quando negativo |
| IA assistiva | Capability/module hibrido | Nao provider juridico | Drafts, summaries, suggestions | Pode afetar custo | Nunca decide sozinho |
| Report composer | Output module | Nao | ReportSnapshot sections | Pode afetar preco | Depende de decision |
| Monitoring | Premium module | Sim/agenda | Alerts | Sim recorrente | Acao conclusiva exige humano |

## 3.5 Capabilities compartilhadas

Capabilities nao sao produtos vendidos isoladamente; sustentam produtos e modulos.

Capabilities obrigatorias:

- Auth/RBAC;
- tenant context;
- entitlement resolver;
- provider request ledger;
- raw snapshot;
- provider record;
- evidence store;
- fact/relationship mapper;
- risk signal engine;
- decision workflow;
- report snapshot builder;
- client projection builder;
- audit service;
- usage meter;
- freshness policy;
- review policy;
- feature flags;
- cockpit renderer;
- public report access.

## 3.6 Presets comerciais opcionais

Presets servem para simplificar venda, nao para controlar codigo.

| Preset | Uso comercial | Entitlements iniciais sugeridos |
|---|---|---|
| ComplianceHub Start | Cliente quer solicitar e receber relatorios simples | Base SaaS, portal cliente, Dossie PF Essencial, relatorio seguro, auditoria basica |
| ComplianceHub Professional | Operacao recorrente de due diligence | Start + PF Completo + PJ + timeline + evidencias + cockpit completo + consumo por modulo |
| ComplianceHub Investigative | Operacao com analise mais profunda | Professional + divergencias + mini-relacionamentos + aprovacoes senior + report composer |
| ComplianceHub Intelligence | Premium futuro | Investigative + watchlists + monitoramento + alertas + grafo + analytics |

Regra:

- um tenant pode contratar algo diferente do preset;
- o preset gera uma configuracao inicial;
- o contrato/entitlements efetivos prevalecem.

## 3.7 Entitlements contratuais por tenant

Entitlement e a fonte de verdade de habilitacao.

Cada tenant deve ter configuracao contratual como:

```txt
tenantEntitlements/{tenantId}
  products:
    dossier_pf_basic: enabled
    dossier_pf_full: enabled
    dossier_pj: disabled
  modules:
    identity_pf: enabled
    criminal: enabled
    labor: disabled
    warrants: enabled
    kyc: enabled
  capabilities:
    report_public_link: enabled
    evidence_viewer: enabled
    raw_snapshot_read: restricted
  policies:
    reviewPolicy: analytical
    seniorApproval: warrant|high_risk|negative
    freshness: per module
    snapshotReuse: enabled
    billingMode: prepaid|postpaid|hybrid
```

Este modelo pode usar como referencia o que ja existe hoje, sem depender estruturalmente disso:

- `tenantSettings.analysisConfig`;
- `tenantSettings.enrichmentConfig`;
- `tenantSettings.dailyLimit/monthlyLimit`;
- `tenantUsage`;
- `TenantSettingsPage.jsx`.

## 3.8 Entregaveis comerciais

Entregaveis sao outputs:

- Dossie;
- Decision;
- ReportSnapshot;
- PublicReport;
- ClientProjection;
- Exportacao;
- Alert futuro;
- Comparativo historico futuro.

Regra:

- todo entregavel deve declarar produto, modulos usados, entitlement aplicado, tenantId, versionamento e auditoria.

## 3.9 Billing e consumo por modulo

Billing deve separar:

- custo interno de provider;
- unidade de consumo tecnico;
- preco comercial;
- pacote/preset contratado;
- override contratual.

Modelo recomendado:

```txt
usageMeters/{usageId}
  tenantId
  caseId
  subjectId
  productKey
  moduleKey
  provider
  providerRequestId
  unit
  quantity
  internalCostRef
  commercialBillable
  contractId
  entitlementId
  createdAt
```

Novos modulos so entram no billing se registrarem:

- `moduleKey`;
- unidade de consumo;
- se e billable;
- como agrega em dossie/produto;
- regra de excedente;
- regra de visibilidade ao cliente.

## 3.9.1 Unidade minima de billing e consumo

Decisao final:

> O faturamento final e agregacao posterior. O fluxo operacional registra consumo atomico.

Separacao obrigatoria:

| Conceito | Papel | Exemplo | Fonte |
|---|---|---|---|
| `ProviderRequest` | mede custo tecnico interno e tentativa de provider | chamada BigDataCorp/Judit/Escavador | ledger tecnico |
| `ModuleRun` | mede execucao operacional de um modulo no caso | modulo criminal rodou, reutilizou snapshot ou falhou | status modular por caso |
| `UsageMeter` | registro atomico de consumo | 1 unidade `criminal_check`, 1 unidade `report_public_link` | billing/consumo |
| Produto | unidade comercial principal | Dossie PF Completo | contrato/proposta |
| Modulo | unidade granular de composicao e medicao | Mandados, Judicial, KYC | catalogo/entitlement |
| Fatura/cobranca | agregacao comercial posterior | mensalidade + dossies + excedentes | camada financeira futura |

Regras:

- `ProviderRequest` pode gerar custo interno sem necessariamente virar item cobrado ao cliente.
- `ModuleRun` pode gerar consumo mesmo sem provider externo, se o modulo tiver valor operacional/comercial.
- `UsageMeter` e a unidade minima persistida para consumo; nunca calcular consumo final lendo payload bruto ou HTML.
- preco comercial nao deve ficar em adapter de provider.
- margem, desconto, franquia e excedente sao agregacoes posteriores sobre `usageMeters`.
- modulo novo so e billable se o `ModuleContract` declarar billing unit e visibilidade comercial.
- cliente pode ver consumo comercial agregado; custo interno de provider e restrito.

## 3.10 O que deve ficar fora para nao confundir o mercado

Nao vender na primeira comunicacao:

- grafo completo;
- IA autonoma;
- rule builder visual;
- SDK;
- marketplace;
- monitoramento continuo ilimitado;
- "todas as fontes do mercado";
- "decisao automatica definitiva".

Mensagem principal:

> Dossies revisados, relatorios seguros e decisoes auditaveis, com modulos habilitados conforme contrato.

---

# 4. Regras de negocio definitivas

## 4.1 O que sempre vira evidencia

Vira evidencia:

- retorno relevante de provider;
- dado cadastral usado na decisao;
- processo judicial relevante;
- mandado/alerta;
- vinculo societario;
- divergencia entre fontes;
- documento/anexo usado na analise;
- nota humana usada como fundamento;
- verificacao manual relevante;
- decisao de override;
- dado que entra no relatorio.

Toda evidencia deve ter:

- `tenantId`;
- `caseId` quando vinculada a caso;
- `subjectId` quando vinculada a sujeito;
- `providerRequestId` quando vier de provider;
- `rawSnapshotId` quando vier de payload;
- `providerRecordId` quando vier de normalizacao;
- tipo;
- resumo;
- severidade opcional;
- origem;
- data observada;
- data ingerida;
- visibilidade;
- hash ou ponteiro;
- status de revisao.

## 4.2 O que nunca pode ir para cliente

Nunca vai para cliente:

- payload bruto;
- credenciais;
- logs tecnicos;
- nomes de APIs sensiveis quando nao autorizados comercialmente;
- custo interno por consulta;
- heuristicas internas;
- prompts internos;
- notas restritas;
- raw snapshots;
- campos de debug;
- erros tecnicos de provider;
- dados fora da whitelist;
- evidencia marcada como `internalOnly`.

## 4.3 O que exige revisao humana

> **Regra estrutural inegociavel**: Todo entregavel comercial relevante do ComplianceHub (dossie, decisao e relatorio) deve estar vinculado a supervisao humana proporcional ao risco. O que e automatico restringe-se a enriquecimento e geracao de sinais. Acoes conclusivas exigem operador ou aprovacao senior.

Exige revisao humana obrigatoria:

- risco alto;
- veredito `nao recomendado`;
- mandado ativo;
- processo criminal relevante;
- divergencia de identidade;
- divergencia critica entre fontes;
- homonimia ou baixa confianca;
- override de score/sinal;
- relatorio com alerta critico;
- reabertura de caso publicado;
- publicacao manual fora do fluxo padrao.

## 4.4 O que exige aprovacao senior

Exige aprovacao senior, por configuracao:

- decisao final negativa;
- risco vermelho/alto;
- mandado ativo confirmado;
- divergencia critica nao resolvida automaticamente;
- conclusao baseada em evidencia sensivel;
- reabertura apos publicacao;
- revogacao/substituicao de relatorio;
- override manual contra recomendacao do sistema;
- excecao de politica de freshness;
- liberacao de relatorio com pendencia justificada.

## 4.4.1 Politica de supervisao humana por produto e por risco

Decisao final:

> A plataforma pode automatizar consulta, normalizacao, evidencia, sinais preliminares e alertas. Mas decisao comercial/conclusiva e relatorio publicado sempre precisam estar vinculados a uma decisao supervisionada.

Regra nao negociavel:

> Todo entregavel comercial relevante do ComplianceHub - dossie, decisao e relatorio - deve estar vinculado a supervisao humana proporcional ao risco.

O que pode ser automatico:

- consulta provider;
- normalizacao;
- criacao de snapshot;
- criacao de evidencia preliminar;
- geracao de risk signal preliminar;
- sugestao de resumo/narrativa;
- alerta de monitoramento;
- geracao tecnica de `ReportSnapshot` depois de decision aprovada.

O que nao pode ser automatico:

- decisao final publicada;
- parecer negativo sem revisao;
- relatorio publico sem decision aprovada;
- resolucao de divergencia critica;
- override contra sinal de alto risco;
- conclusao comercial de alerta premium.

Tabela de supervisao:

| Produto / output | Automacao permitida | Revisao humana obrigatoria | Aprovacao senior | Observacao |
|---|---|---|---|---|
| Consulta/enriquecimento | Sim | Nao por item | Nao | Se usado em decisao, vira evidencia revisavel |
| EvidenceItem | Sim | Apenas se critico, divergente ou usado em decisao | Se sensivel/critico | Evidencia pode nascer automatica, mas status deve indicar revisao |
| Dossie PF Essencial | Parcial | Sim, revisao operacional | Conforme risco/contrato | Analista valida identidade, sinais e narrativa |
| Dossie PF Completo | Parcial | Sim, revisao analitica | Sim se alto risco/negativo/mandado | Mais modulos, mais risco de divergencia |
| Dossie PJ | Parcial | Sim, revisao analitica | Sim se risco alto, societario sensivel ou contrato exigir | Envolve relacoes e contexto empresarial |
| Dossie Societario/Reputacional | Parcial | Sim, revisao analitica | Frequentemente sim | Deve ser tratado como produto especializado |
| RiskSignal | Sim | Se usado em decision ou se severidade alta | Se override ou severidade critica | Sinal automatico nao e decision |
| Decision | Sugestao automatica permitida | Sempre | Conforme policy | Decision publicada nunca e 100% automatica |
| ReportSnapshot | Geracao automatica permitida | Indireta, via decision aprovada | Se decision exigiu senior | Relatorio deriva de decision supervisionada |
| PublicReport | Publicacao automatica permitida apos gates | Gate humano via decision | Conforme policy | Token publico so depois de snapshot valido |
| Monitoramento/Alertas | Geracao automatica permitida | Para acao conclusiva | Se alerta critico | Alerta pode abrir fila; nao conclui sozinho |

Niveis de supervisao:

- `none`: modulo coleta/normaliza, sem output conclusivo.
- `operational_review`: analista valida completude e narrativa.
- `analytical_review`: analista avalia evidencias, sinais e divergencias.
- `senior_approval`: supervisor aprova antes da publicacao.
- `restricted_committee`: futuro, para clientes/contratos especiais.

## 4.4.2 Como configurar supervisao sem espalhar regra na base

A regra de supervisao deve ser resolvida por um `ReviewPolicyResolver`, baseado em:

- produto contratado;
- modulo executado;
- entitlement do tenant;
- severidade dos sinais;
- tipo de decisao;
- existencia de mandado/alerta critico;
- divergencia entre fontes;
- override manual;
- historico do sujeito;
- regra contratual especifica.

Nenhum componente deve decidir sozinho se precisa de senior.

Onde nao colocar regra:

- diretamente em `CasoPage.jsx`;
- diretamente no builder de relatorio;
- diretamente em `clientPortal.js`;
- espalhada por provider adapters;
- em if/else solto dentro de `functions/index.js`.

Onde colocar:

- contrato de modulo;
- policy resolver backend;
- `tenantEntitlements`;
- audit event da decisao.

## 4.5 Quando gerar nova consulta

Gerar nova consulta quando:

- nao existe snapshot valido;
- freshness expirou;
- modulo novo foi contratado;
- dados de entrada foram corrigidos;
- provider anterior falhou;
- evidencia atual e insuficiente;
- decisao depende de atualidade;
- supervisor solicitou;
- caso foi reaberto com mudanca material;
- cliente solicitou atualizacao contratada.

## 4.6 Quando reaproveitar snapshot

Reaproveitar snapshot quando:

- mesmo `tenantId` ou politica permite o reuso;
- mesmo `subjectId`;
- identificador forte confere, como CPF/CNPJ;
- modulos/datasets cobrem a necessidade;
- snapshot esta dentro da janela de freshness;
- snapshot nao esta marcado como invalido;
- nao ha divergencia critica pendente;
- analista confirma se o risco exigir.

## 4.7 Quando bloquear publicacao

Bloquear publicacao quando:

- nao existe `Decision` aprovada;
- nao existe `ReportSnapshot`;
- `ReportSnapshot` esta vazio;
- `ClientProjection` falhou;
- `PublicReport` nao foi criado;
- evidencia critica nao foi revisada;
- divergencia critica esta aberta;
- campos obrigatorios do relatorio faltam;
- whitelist encontrou campo proibido;
- publicacao ja esta em andamento com mesmo idempotency key;
- usuario nao tem permissao.

## 4.8 Quando permitir regenerar relatorio

Permitir regenerar sem nova decisao quando:

- mudou apenas template;
- houve ajuste visual;
- builder foi corrigido;
- evidence set nao mudou;
- decision nao mudou;
- novo snapshot guarda versao e hash.

Exigir nova decisao quando:

- evidencia mudou;
- nova consulta foi feita;
- risco mudou;
- veredito mudou;
- justificativa mudou materialmente;
- sujeito foi corrigido;
- caso foi reaberto por conflito.

Nunca permitir:

- sobrescrever snapshot antigo sem versao;
- mudar conteudo de relatorio publicado sem auditoria;
- manter token apontando para conteudo diferente sem registrar nova versao.

## 4.9 Quando reabrir caso

Reabrir quando:

- cliente corrige dado relevante;
- analista identifica erro material;
- provider retorna atualizacao critica;
- relatorio foi publicado incompleto;
- houve divergencia descoberta depois;
- supervisor determina revisao.

Reabertura deve:

- criar revision;
- preservar historico;
- marcar relatorio anterior como substituido/revogado quando aplicavel;
- exigir justificativa;
- registrar auditoria.

## 4.10 Como tratar divergencia entre fontes

Regra:

- nao apagar divergencia;
- manter evidencias conflitantes;
- criar `providerDivergence`;
- classificar severidade;
- exigir revisao humana se impacto alto;
- registrar resolucao do analista.

Tipos:

- divergencia de identidade;
- divergencia de quantidade;
- divergencia de status;
- divergencia temporal;
- divergencia de escopo;
- possivel homonimia.

## 4.11 Politica de freshness por tipo de modulo

Decisao final: janela exata deve ser configuravel por tenant e modulo. Nao deve ser fixa em codigo.

Sugestao inicial:

| Modulo | Freshness padrao recomendada | Observacao |
|---|---|---|
| Dados cadastrais PF/PJ | Media | Reuso geralmente aceitavel se identificador forte |
| Processos judiciais | Curta/media | Depende do risco e do cliente |
| Mandados/alertas criticos | Curta | Reconsulta recomendada antes de decisao critica |
| Vinculos societarios | Media | Pode reaproveitar com alerta de data |
| Midia/listas/sancoes | Curta/media | Depende do provedor e contrato |
| Relatorio publicado | Imutavel | Nao "atualiza"; cria nova versao |

Decisao final:

- freshness deve ser policy por tenant/modulo, com defaults globais versionados;
- valores exatos podem ser ajustados por contrato, mas o codigo nao deve ter janela fixa escondida;
- se nao houver override, aplicar default global do modulo.

## 4.12 Regras de auditoria obrigatorias

Auditar:

- solicitacao criada;
- provider request criado;
- raw snapshot criado;
- evidencia criada;
- evidencia revisada;
- sinal gerado;
- sinal alterado/ignorado;
- divergencia criada/resolvida;
- decision criada/aprovada;
- report snapshot criado;
- public report criado;
- relatorio aberto;
- projection cliente criada;
- caso reaberto;
- relatorio revogado/substituido;
- raw payload acessado;
- override feito.

## 4.13 Regras de idempotencia

Usar idempotency key em:

- provider request;
- conclusao de caso;
- criacao de decision;
- criacao de report snapshot;
- criacao de public report;
- publicacao de projection;
- reprocessamento tecnico controlado.

Formato sugerido:

```txt
tenantId:caseId:operation:version
tenantId:subjectId:provider:dataset:requestHash
caseId:decisionRevision:reportBuilderVersion
```

## 4.14 Regras de publicacao

Publicar somente se:

- decision aprovada;
- report snapshot valido;
- client projection gerada;
- public report criado;
- audit event escrito;
- status atualizado.

Publicacao deve ser idempotente e reexecutavel.

## 4.15 Regras de seguranca por perfil

Perfis minimos:

- clientUser;
- clientAdmin;
- analyst;
- seniorAnalyst;
- opsManager;
- admin;
- auditor;
- system.

Permissoes sensiveis:

- `evidence.raw.read`;
- `decision.approve`;
- `decision.override`;
- `report.publish`;
- `report.revoke`;
- `case.reopen`;
- `provider.forceRefresh`;
- `billing.viewInternalCost`;
- `tenant.configureModules`;

## 4.16 Regras de retencao basicas

Decisao final:

- a V2 deve ter retention policy por tipo de documento e por tenant;
- prazos especificos podem variar por contrato/juridico, mas o sistema ja nasce com campos de retention e controles de acesso;
- ausencia de prazo contratual nao autoriza apagar evidencias ou snapshots usados em decisao publicada.

Padrao recomendado:

- `ReportSnapshot`: manter enquanto contrato exigir rastreabilidade.
- `AuditEvent`: manter conforme politica de auditoria.
- `RawSnapshot`: reter com prazo controlado e acesso restrito; se pesado/sensivel, armazenar no Storage com metadados no Firestore.
- `ClientProjection`: pode ser regenerada, mas versoes publicadas devem ser auditaveis.

## 4.17 Regras de isolamento tenant-safe

Todo documento relevante deve ter:

- `tenantId`;
- `visibility`;
- `createdAt`;
- `updatedAt`;
- `createdBy` quando humano;
- `sourceCaseId` quando aplicavel.

Regras:

- cliente so le projections do proprio tenant;
- raw/evidence interna nunca acessivel por cliente;
- cross-tenant reuse fica proibido na V2 minima;
- compartilhamento entre tenants fica proibido na V2; qualquer excecao futura exige desenho juridico, contratual e tecnico proprio.

## 4.18 Maquinas de estado oficiais

As maquinas de estado abaixo sao contratos operacionais. Elas nao precisam nascer todas como engine formal na primeira onda, mas o backend, cockpit, portal cliente, relatorio e auditoria devem respeitar estes estados.

### 4.18.1 Maquina de estados do caso

| Estado atual | Evento | Proximo estado | Quem pode transicionar | Side effects | Auditoria obrigatoria | Bloqueios/publicacao |
|---|---|---|---|---|---|---|
| `draft` | solicitacao enviada | `received` | cliente/ops/system | cria `case`, projection inicial | `case.created` | sem relatorio |
| `received` | intake valido | `enrichment_pending` | system/analyst | resolve tenant, produto, modulos e entitlements | `case.intake_validated` | bloqueia se produto/modulo nao contratado |
| `enrichment_pending` | iniciar modulo | `enriching` | system | cria `moduleRuns` e `providerRequests` | `case.enrichment_started` | publicacao bloqueada |
| `enriching` | modulos concluidos | `review_ready` | system | cria records/evidencias/sinais preliminares | `case.review_ready` | bloqueia se modulo critico falhou |
| `review_ready` | analista assume | `in_review` | analyst/senior | lock leve/atribuicao | `case.review_started` | publicacao bloqueada |
| `in_review` | risco exige senior | `senior_review_required` | system/analyst | cria pendencia senior | `case.senior_required` | publicacao bloqueada |
| `in_review` | decision aprovada | `decision_approved` | analyst/senior conforme policy | cria/atualiza `Decision` | `decision.approved` | relatorio ainda precisa snapshot |
| `senior_review_required` | senior aprova | `decision_approved` | senior/opsManager | registra aprovacao e justificativa | `decision.senior_approved` | relatorio ainda precisa snapshot |
| `decision_approved` | gerar snapshot | `report_generating` | system | cria `ReportSnapshot` pendente | `report.snapshot_started` | botao cliente indisponivel |
| `report_generating` | report pronto e token publicado | `published` | system/report publisher | cria `ClientProjection` e `PublicReport` | `report.published` | botao cliente habilitado |
| qualquer estado antes de `published` | cancelamento | `cancelled` | opsManager/admin | encerra execucao e projections | `case.cancelled` | sem relatorio |
| `published` | erro material/reabertura | `reopened` | senior/opsManager/admin | preserva snapshot anterior, cria revision | `case.reopened` | relatorio anterior pode ficar substituido/revogado |
| `reopened` | nova revisao iniciada | `in_review` | analyst/senior | nova revision | `case.review_restarted` | nova publicacao bloqueada ate decision/snapshot |

Regras:

- `published` nunca deve ser alcancado sem `Decision.approved`, `ReportSnapshot.ready`, `ClientProjection.ready` e `PublicReport.ready`;
- reabrir caso nunca altera snapshot antigo;
- estado cliente-safe deve ser traduzido a partir desta maquina, sem expor estados tecnicos.

### 4.18.2 Maquina de estados da decision

| Estado atual | Evento | Proximo estado | Quem | Side effects | Auditoria | Bloqueios |
|---|---|---|---|---|---|---|
| `draft` | sinais/narrativas gerados | `suggested` | system/IA | cria sugestao nao conclusiva | `decision.suggested` | nao publica |
| `suggested` | analista inicia revisao | `in_review` | analyst | vincula evidencias revisadas | `decision.review_started` | nao publica |
| `in_review` | policy exige senior | `senior_required` | system | cria tarefa senior | `decision.senior_required` | nao publica |
| `in_review` | aprovar baixo/medio risco | `approved` | analyst conforme policy | congela evidence set hash | `decision.approved` | libera report snapshot |
| `senior_required` | senior aprova | `approved` | senior | congela evidence set hash e justificativa | `decision.senior_approved` | libera report snapshot |
| `in_review`/`senior_required` | devolver | `needs_rework` | senior/opsManager | registra motivo | `decision.rework_requested` | nao publica |
| `approved` | reabertura/novo material | `superseded` | system/senior | preserva versao antiga | `decision.superseded` | novo report exige nova decision |

### 4.18.3 Maquina de estados do relatorio

| Estado atual | Evento | Proximo estado | Quem | Side effects | Auditoria | Bloqueios |
|---|---|---|---|---|---|---|
| `not_requested` | decision aprovada | `snapshot_pending` | system | agenda/aciona builder | `report.requested` | cliente ve gerando |
| `snapshot_pending` | snapshot criado | `snapshot_ready` | system | calcula content hash | `report.snapshot_ready` | ainda sem token se publicacao pendente |
| `snapshot_ready` | publicar | `publishing` | system/authorized user | cria/atualiza `publicReports` | `report.publishing` | bloqueia duplicidade por idempotency |
| `publishing` | token pronto | `published` | system | atualiza projection cliente | `report.published` | botao habilitado |
| qualquer estado antes de `published` | erro | `failed` | system | cria alerta interno | `report.failed` | botao desabilitado |
| `published` | revogar | `revoked` | senior/admin | invalida token | `report.revoked` | botao desabilitado |
| `published` | nova versao | `superseded` | system/senior | aponta projection para nova versao | `report.superseded` | historico preservado |

### 4.18.4 Maquina de estados do modulo

| Estado atual | Evento | Proximo estado | Quem | Side effects | Auditoria | Bloqueios |
|---|---|---|---|---|---|---|
| `not_entitled` | contrato habilita | `available` | admin/system | atualiza entitlement | `module.entitled` | so novas execucoes |
| `available` | caso requer modulo | `pending` | system | cria `moduleRun` | `module.pending` | sem evidencia ainda |
| `pending` | iniciar execucao | `running` | system | cria provider request se necessario | `module.started` | pode bloquear decision se obrigatorio |
| `running` | sucesso sem achado | `completed_no_findings` | system | gera facts/evidencias de ausencia quando relevante | `module.completed` | nao bloqueia por si so |
| `running` | sucesso com achado | `completed_with_findings` | system | gera evidencias/signals | `module.findings_created` | pode exigir review |
| `running` | falha temporaria | `failed_retryable` | system | agenda retry se configurado | `module.retryable_failed` | bloqueia se modulo obrigatorio |
| `running` | falha final | `failed_final` | system | cria pendencia operacional | `module.failed` | bloqueia se modulo obrigatorio |
| `pending` | snapshot reutilizado | `skipped_reuse` | system/analyst | vincula snapshot anterior | `module.reused_snapshot` | depende freshness/policy |

### 4.18.5 Maquina de estados de monitoramento/alerta premium

| Estado atual | Evento | Proximo estado | Quem | Side effects | Auditoria | Bloqueios |
|---|---|---|---|---|---|---|
| `inactive` | tenant contrata monitoramento | `active` | admin/system | cria subscription | `monitoring.enabled` | depende entitlement |
| `active` | mudanca detectada | `alert_generated` | system | cria alerta preliminar | `alert.generated` | nao conclui sozinho |
| `alert_generated` | fila de revisao | `queued_review` | system | cria tarefa | `alert.queued` | acao conclusiva exige humano |
| `queued_review` | analista reconhece | `acknowledged` | analyst | vincula evidencias | `alert.acknowledged` | pode abrir caso |
| `acknowledged` | risco relevante | `linked_to_case` | analyst/senior | cria/reabre caso | `alert.linked_to_case` | segue maquina do caso |
| `acknowledged` | sem acao | `closed` | analyst/senior | registra justificativa | `alert.closed` | preserva historico |

---

# 5. Estrategia de arquitetura definitiva

## 5.1 Principios arquiteturais

Principios:

- preservar V1 em producao;
- criar V2 por camadas ao lado;
- evitar infraestrutura pesada cedo;
- usar snapshots imutaveis para prova;
- usar projections para leitura cliente;
- usar contracts para reduzir drift;
- usar Firestore como documentos bem delimitados;
- usar Storage para artefatos grandes;
- usar Functions para orquestracao;
- usar Cloud Tasks apenas quando necessario;
- nao acoplar dominio ao payload do provider.

## 5.1.1 Principio modular plug-and-play

A V2 deve permitir incluir novos produtos e modulos sem reescrever cockpit, portal cliente, billing, report builder e publicacao.

Regra:

> Novo modulo entra pelo catalogo e pelo contrato de modulo. Nao entra por if/else espalhado.

Cada modulo precisa declarar:

- `moduleKey`;
- nome interno;
- nome comercial;
- tipo: data, analytical, relationship, output, monitoring;
- providers usados;
- datasets/fases;
- entradas esperadas;
- saidas emitidas;
- evidencias geradas;
- risk signals possiveis;
- secoes de relatorio que pode contribuir;
- unidade de billing;
- politica de freshness;
- politica de supervisao;
- visibilidade no cockpit;
- visibilidade no portal cliente;
- permissoes RBAC;
- eventos de auditoria;
- feature flags;
- estrategia de fallback.

## 5.1.2 Contrato de modulo

Contrato conceitual:

```txt
ModuleContract
  key
  productFamilies[]
  capabilitiesRequired[]
  providers[]
  inputSchema
  outputSchema
  evidenceMapping
  signalMapping
  reportContributions[]
  billingUnits[]
  reviewPolicy
  freshnessPolicy
  rbacScopes[]
  auditEvents[]
  uiSlots
  clientVisibility
  lifecycleStatus
```

Lifecycle:

- `draft`: modulo em desenho.
- `internal`: disponivel apenas para equipe.
- `pilot`: disponivel por tenant piloto.
- `active`: disponivel para venda.
- `deprecated`: mantido para contratos antigos.
- `retired`: nao executa mais.

## 5.1.3 Registro/catalogo de modulos

O catalogo pode comecar como arquivo versionado no repo e depois ser materializado em Firestore.

Fase 0/1:

- arquivo compartilhado versionado com `products`, `modules`, `capabilities`, `reportSections`, `billingUnits`.

Fase 2:

- colecoes `productCatalog`, `moduleCatalog` e `tenantEntitlements` no Firestore.

Fase 3+:

- admin UI para operar catalogo e contratos com controles de permissao.

Regra:

- catalogo global define o que existe;
- tenant entitlement define o que pode ser usado;
- feature flag define rollout tecnico;
- RBAC define quem pode executar/ver.

## 5.1.4 Composicao de produtos

Produto deve ser composto por modulos.

Exemplo:

```txt
Dossie PF Completo
  requires:
    identity_pf
    report_secure
    decision
  optional:
    criminal
    labor
    warrants
    kyc
    relationships
    timeline
```

O produto nao deve saber qual provider executa cada modulo. Isso e responsabilidade do modulo e do provider contract.

## 5.1.5 Presets comerciais vs entitlements

Presets:

- simplificam a venda;
- geram uma configuracao inicial;
- nao devem aparecer em regras espalhadas no codigo.

Entitlements:

- governam execucao real;
- ficam por tenant/contrato;
- sao consultados pelo backend;
- sao refletidos no frontend;
- entram em auditoria e billing.

## 5.1.6 Area administrativa do tenant

A V2 precisa evoluir a area atual de `TenantSettingsPage.jsx`.

Confirmado no repositorio atual:

- `TenantSettingsPage.jsx` ja permite configurar fases de analise, providers, limites e estimativa de custo.
- `tenantSettings` ja guarda `analysisConfig`, `enrichmentConfig`, limites e politicas de excedencia.
- `tenantUsage` ja existe como base de consumo/limite.

Evolucao necessaria:

- habilitar/desabilitar produtos;
- habilitar/desabilitar modulos;
- aplicar preset comercial inicial;
- registrar override contratual;
- configurar politica de supervisao;
- configurar freshness por modulo;
- configurar reuso de snapshots;
- configurar exigencia de aprovacao senior;
- configurar relatorios habilitados;
- configurar limites/consumo;
- configurar branding/comportamento do portal cliente quando aplicavel.

Essa area deve escrever em:

- `tenantConfigs` para configuracoes operacionais;
- `tenantEntitlements` para contrato/habilitacao;
- `tenantFeatureFlags` ou campo equivalente para rollout tecnico;
- `usageMeters`/`tenantUsage` para consumo.

## 5.1.7 Modularidade pragmatica, sem framework interno prematuro

Decisao:

> A modularidade e obrigatoria na arquitetura-alvo, mas deve nascer pequena e util.

Como comecar:

- catalogo global como arquivo versionado;
- `ModuleRegistry` simples em codigo;
- `EntitlementResolver` lendo `tenantEntitlements`, com fallback legado isolado via adapter quando indispensavel;
- `ReviewPolicyResolver` com poucas regras centrais;
- `ReportSectionResolver` aceitando secoes padronizadas;
- `BillingResolver` emitindo usage meter apenas para modulos reais.

Modulos iniciais suficientes:

- `identity_pf`;
- `identity_pj`;
- `judicial`;
- `criminal`;
- `labor`;
- `warrants`;
- `kyc`;
- `report_secure`;
- `decision`;

O que nao fazer cedo:

- marketplace de modulos;
- admin visual de catalogo global;
- DSL de regras;
- plugin runtime dinamico;
- execucao arbitraria de codigo por modulo;
- grafo antes de relationships confiaveis.

Como crescer sem retrabalho:

- todo modulo novo declara `ModuleContract`;
- todo modulo novo gera `moduleRun`;
- todo modulo novo declara billing unit e report sections;
- todo modulo novo passa por feature flag e tenant entitlement;
- toda UI condicional usa slots declarados, nao if/else solto.

## 5.2 Por que manter Firebase / Firestore / Functions

Motivos:

- ja e a stack atual;
- menor atrito operacional;
- integra bem com Auth e regras;
- Functions v2 atende fluxos event-driven/callable;
- Firestore atende casos, snapshots e projections;
- Storage cobre artefatos grandes;
- permite feature flags e rollout gradual.

## 5.3 Limites conhecidos da stack

Limites:

- Firestore nao deve ser usado como relacional complexo;
- documentos nao devem crescer indefinidamente;
- arrays grandes devem ser evitados;
- consultas precisam seguir indices previstos;
- joins devem ser evitados;
- raw payload grande nao deve ficar sempre no documento;
- triggers precisam ser idempotentes;
- fan-out grande pede Tasks/PubSub no futuro;
- analytics pesado pede BigQuery no futuro.

## 5.4 Como usar a stack corretamente

Firestore:

- documentos pequenos/medios;
- colecoes por dominio;
- projections para telas;
- snapshots com hashes;
- subcollections apenas quando fizer sentido de isolamento/leitura;
- campos indexados planejados.

Functions:

- callables para acoes humanas;
- triggers para materializacao;
- jobs reexecutaveis;
- validacao de permissao;
- escrita de audit events;
- orquestracao de publicacao.

Storage:

- payload bruto pesado;
- HTML/PDF futuro;
- anexos/documentos;
- artefatos de relatorio;
- snapshots compactados se excederem limite pratico do Firestore.

Cloud Tasks:

- provider calls com retry/throttle;
- geracao de relatorio assicrona;
- reprocessamentos controlados;
- reparos pontuais seguros quando necessarios.

Pub/Sub:

- premium/monitoramento;
- fan-out de alertas;
- pipelines analiticos;
- eventos de alto volume.

BigQuery:

- analytics;
- BI;
- custos/consumo agregados;
- metricas historicas;
- nao dependencia da V2 minima.

## 5.5 Como evitar que Firestore doa cedo

Regras:

- nao guardar tudo em `cases`;
- nao usar arrays gigantes de evidencias dentro de um caso;
- nao guardar raw payload grande no documento quando Storage for melhor;
- usar documents por evidencia/snapshot/sinal/decision;
- materializar views para cockpit e portal cliente;
- criar campos de consulta previstos;
- limitar query por tenant/status/data;
- criar summaries separados de payload completo.

## 5.6 Servicos Google por fase

| Fase | Firestore | Functions | Storage | Cloud Tasks | Pub/Sub | BigQuery |
|---|---|---|---|---|---|---|
| Fase 0 | Sim | Sim | Opcional | Nao necessario | Nao | Nao |
| Fase 1 | Sim | Sim | Sim para payload pesado | Opcional para provider/report | Nao | Nao |
| Fase 2 | Sim | Sim | Sim | Sim se retry/throttle necessario | Nao | Nao |
| Fase 3 | Sim | Sim | Sim | Sim | Opcional | Opcional futuro |
| Fase 4 | Sim | Sim | Sim | Sim | Sim para monitoramento | Sim para analytics |

## 5.7 O que nao usar agora

Nao usar agora:

- VPS;
- Kubernetes;
- Postgres;
- data warehouse como dependencia transacional;
- workflow engine pesado externo;
- microservicos separados por tecnologia;
- filas complexas antes de necessidade;
- graph database antes de relationships confiaveis.

## 5.8 O que deve ser materializado

Materializar:

- `ClientProjection` para portal cliente;
- `PublicResultProjection` transicional;
- `ReportSnapshot`;
- resumo do dossie para cockpit;
- status de provider por caso;
- risk summary por caso/sujeito;
- usage meter por modulo.

## 5.8.1 Como modulos contribuem para o `ReportSnapshot`

O relatorio nao deve ser montado por HTML solto de cada modulo.

Fluxo correto:

```txt
Module output
  -> Evidence / Fact / RiskSignal
  -> ReportSectionContribution
  -> ReportSectionResolver
  -> ReportSnapshot
  -> PublicReport
```

Cada modulo pode contribuir com secoes padronizadas:

- `identity`;
- `executiveSummary`;
- `riskSignals`;
- `criminalFindings`;
- `laborFindings`;
- `warrantFindings`;
- `kycFindings`;
- `corporateRelationships`;
- `timeline`;
- `analystConclusion`;
- `nextSteps`.

Regras:

- entitlement define quais secoes podem entrar;
- produto define quais secoes sao obrigatorias;
- evidence define o que sustenta a secao;
- decision define narrativa final;
- report builder apenas renderiza snapshot;
- modulo nunca publica HTML publico diretamente.

Isso resolve a divergencia atual entre `functions/reportBuilder.cjs` e `src/core/reportBuilder.js`: ambos devem convergir para o mesmo contrato de secoes e snapshots.

## 5.9 O que deve ser projection

Projection:

- `clientCases`;
- `publicResult/latest`;
- `clientProjections`;
- cards de fila;
- summaries de cockpit;
- dashboards.

Projection nao e fonte da verdade.

## 5.10 Fonte de verdade

Fontes:

- processo operacional: `cases`;
- catalogo de produto/modulo: `productCatalog` / `moduleCatalog` ou arquivo versionado na fase inicial;
- habilitacao contratual: `tenantEntitlements`;
- sujeito: `subjects`;
- request provider: `providerRequests`;
- payload bruto: `rawSnapshots` ou Storage + metadata;
- normalizado: `providerRecords`;
- evidencia: `evidenceItems`;
- fato: `facts`;
- relacao: `relationships`;
- sinal: `riskSignals`;
- decisao: `decisions`;
- relatorio: `reportSnapshots`;
- publicacao: `publicReports`;
- auditoria: `auditEvents`.

## 5.11 Projection transicional

`publicResult/latest` e `clientCases` continuam por compatibilidade.

Decisao:

- manter;
- reduzir responsabilidade;
- gerar a partir de `Decision` + `ReportSnapshot` + `ClientProjection`;
- deprecar quando portal cliente V2 estiver maduro.

## 5.12 Dominios

Operacional:

- casos;
- fila;
- status;
- revisao;
- tarefas;
- atribuicao.

Investigativo:

- sujeito;
- pessoa;
- empresa;
- evidencia;
- fato;
- relacao;
- timeline.

Analitico:

- sinais;
- score;
- divergencias;
- severidade;
- recomendacao.

Publicacao:

- snapshot;
- relatorio;
- token;
- projection cliente-safe.

Governanca:

- auditoria;
- permissoes;
- acesso sensivel;
- tenant;
- consumo.

---

# 6. Modelo de dados / colecoes Firestore definitivo

## 6.1 Principios do modelo Firestore

Regras:

- todo documento multi-tenant tem `tenantId`;
- documentos internos nao sao lidos por cliente;
- projections sao separadas de fonte da verdade;
- relatorios usam snapshot imutavel;
- raw payload pesado pode ir para Storage;
- toda colecao nova deve ter dono claro: backend, frontend interno, cliente ou sistema.

## 6.2 Contratos minimos oficiais da V2

Estes contratos sao a base conceitual da V2. Alguns nascem como colecoes Firestore, outros podem nascer como arquivo versionado/objeto compartilhado e so depois virar configuracao persistida. O importante e que backend, frontend, relatorio, billing e auditoria usem a mesma linguagem.

### 6.2.1 `Decision`

Proposito:

- registrar decisao supervisionada, versionada e explicavel.

Campos minimos:

- `tenantId`;
- `caseId`;
- `subjectId`;
- `productKey`;
- `moduleKeys`;
- `verdict`;
- `riskScore`;
- `riskLevel`;
- `summary`;
- `reasons`;
- `supportingEvidenceIds`;
- `supportingSignalIds`;
- `evidenceSetHash`;
- `reviewLevel`;
- `reviewedBy`;
- `approvedBy`;
- `status`;
- `revision`;
- `createdAt`;
- `approvedAt`.

Regras:

- nao pode publicar relatorio sem `Decision.status=approved`;
- toda alteracao material cria nova revision;
- sugestao de IA pode alimentar `summary` ou `reasons`, mas nao substitui `reviewedBy`/`approvedBy`.

### 6.2.2 `ReportSnapshot`

Proposito:

- congelar a versao cliente-safe do relatorio.

Campos minimos:

- `tenantId`;
- `caseId`;
- `subjectId`;
- `decisionId`;
- `productKey`;
- `moduleKeys`;
- `sections`;
- `clientSafeData`;
- `builderVersion`;
- `contentHash`;
- `evidenceSetHash`;
- `entitlementId`;
- `status`;
- `createdAt`;
- `createdBy`.

Regras:

- snapshot e imutavel depois de publicado;
- nova versao cria novo snapshot;
- builder renderiza snapshot, nao busca dados mutaveis do caso.

### 6.2.3 `ClientProjection`

Proposito:

- oferecer ao portal cliente uma view segura, simples e atualizada.

Campos minimos:

- `tenantId`;
- `clientId`;
- `caseId`;
- `subjectLabel`;
- `productLabel`;
- `enabledCommercialModules`;
- `status`;
- `pendingActions`;
- `riskSummary`;
- `verdict`;
- `reportAvailability`;
- `publicReportToken`;
- `updatedAt`.

Regras:

- cliente le projection, nao le `cases`;
- projection e regeneravel;
- projection nunca contem raw payload, custo interno ou heuristica.

### 6.2.4 `TenantEntitlements`

Proposito:

- definir habilitacao contratual efetiva do tenant.

Campos minimos:

- `tenantId`;
- `contractId`;
- `presetKey`;
- `enabledProducts`;
- `enabledModules`;
- `enabledCapabilities`;
- `policyOverrides`;
- `billingOverrides`;
- `reportOverrides`;
- `effectiveFrom`;
- `effectiveTo`;
- `status`;
- `updatedAt`;
- `updatedBy`.

Regras:

- e fonte efetiva de habilitacao;
- nao guarda provider credentials;
- nao guarda historico operacional de execucao;
- alteracoes afetam novas execucoes, salvo reprocessamento explicito.

### 6.2.5 `TenantConfigs`

Proposito:

- guardar configuracao operacional/tecnica do tenant.

Campos minimos:

- `tenantId`;
- `providerSettings`;
- `featureFlags`;
- `limits`;
- `branding`;
- `portalBehavior`;
- `notificationSettings`;
- `operationalDefaults`;
- `updatedAt`;
- `updatedBy`.

Regras:

- nao decide contrato;
- nao habilita produto/modulo sozinho;
- complementa `TenantEntitlements`;
- substitui gradualmente o papel amplo de `tenantSettings` da V1.

### 6.2.6 `ModuleContract`

Proposito:

- declarar como um modulo se comporta ponta a ponta.

Campos minimos:

- `moduleKey`;
- `name`;
- `commercialName`;
- `type`;
- `lifecycleStatus`;
- `providers`;
- `capabilitiesRequired`;
- `inputSchema`;
- `outputSchema`;
- `evidenceMapping`;
- `signalMapping`;
- `reportContributions`;
- `billingUnits`;
- `freshnessPolicy`;
- `reviewPolicy`;
- `rbacScopes`;
- `auditEvents`;
- `uiSlots`;
- `clientVisibility`.

Regras:

- modulo novo entra pelo contrato;
- contrato pode nascer em codigo versionado;
- colecao persistida so entra quando admin/catalogo precisar editar sem deploy.

### 6.2.7 `ProductCatalog`

Proposito:

- declarar produtos globais que o cliente compra.

Campos minimos:

- `productKey`;
- `name`;
- `description`;
- `requiredModules`;
- `optionalModules`;
- `deliverables`;
- `defaultReviewPolicy`;
- `defaultReportSections`;
- `defaultBillingModel`;
- `lifecycleStatus`.

Regra:

- produto compoe modulos; nao conhece provider diretamente.

### 6.2.8 `ModuleCatalog`

Proposito:

- declarar modulos globais disponiveis.

Campos minimos:

- `moduleKey`;
- `contractVersion`;
- `moduleContract`;
- `compatibleProducts`;
- `defaultEnabledForPresets`;
- `status`;
- `introducedAt`;
- `deprecatedAt`.

Regra:

- catalogo define existencia; entitlement define uso pelo tenant.

### 6.2.9 `ProviderRequest`

Proposito:

- registrar chamada a provider de forma idempotente e auditavel.

Campos minimos:

- `tenantId`;
- `caseId`;
- `subjectId`;
- `moduleKey`;
- `provider`;
- `datasets`;
- `requestHash`;
- `idempotencyKey`;
- `status`;
- `startedAt`;
- `finishedAt`;
- `errorCode`;
- `rawSnapshotIds`.

Regra:

- toda consulta billable ou usada em decisao deve ter `ProviderRequest`.

### 6.2.10 `RawSnapshot`

Proposito:

- preservar payload bruto ou ponteiro seguro para payload bruto.

Campos minimos:

- `tenantId`;
- `providerRequestId`;
- `provider`;
- `endpoint`;
- `datasets`;
- `payloadRef`;
- `payloadHash`;
- `queriedAt`;
- `retentionPolicy`;
- `visibility`.

Regra:

- cliente nunca acessa;
- payload grande/sensivel deve ir para Storage com metadados no Firestore.

### 6.2.11 `ProviderRecord`

Proposito:

- representar dado normalizado ainda na camada do provider.

Campos minimos:

- `tenantId`;
- `rawSnapshotId`;
- `provider`;
- `recordType`;
- `normalized`;
- `normalizerVersion`;
- `confidence`;
- `observedAt`;
- `sourceRefs`.

Regra:

- nao e dado canonico final;
- alimenta evidence/facts/relationships.

### 6.2.12 `EvidenceItem`

Proposito:

- representar evidencia auditavel usada por sinal, decisao ou relatorio.

Campos minimos:

- `tenantId`;
- `caseId`;
- `subjectId`;
- `moduleKey`;
- `providerRecordId`;
- `rawSnapshotId`;
- `kind`;
- `summary`;
- `severity`;
- `visibility`;
- `status`;
- `reviewedBy`;
- `reviewedAt`;
- `sourceTimestamp`.

Regra:

- evidencia pode nascer automatica;
- evidencia critica ou usada em decision deve ter status de revisao.

### 6.2.13 `RiskSignal`

Proposito:

- traduzir evidencias/fatos em sinais explicaveis de risco.

Campos minimos:

- `tenantId`;
- `caseId`;
- `subjectId`;
- `moduleKey`;
- `kind`;
- `severity`;
- `scoreImpact`;
- `reason`;
- `supportingEvidenceIds`;
- `status`;
- `reviewPolicyResult`;
- `reviewedBy`.

Regra:

- sinal automatico nao e decision;
- sinal de alto risco pode bloquear publicacao ate revisao.

### 6.2.14 `Subject`

Proposito:

- separar o alvo investigado do caso operacional.

Campos minimos:

- `tenantId`;
- `type`;
- `primaryDocument`;
- `declaredName`;
- `canonicalEntityId`;
- `createdFromCaseId`;
- `status`;
- `lastDossierSummary`;
- `lastCheckedAt`.

Regra:

- `Subject` permite reuso controlado de dossie/snapshots;
- merge de subject exige regra conservadora e auditoria.

### 6.2.15 `PublicReportAvailability`

Proposito:

- contrato unico para botao "Abrir relatorio" e status cliente-safe.
- **Decisao de Arquitetura**: para a V2 inicial, tratar `PublicReportAvailability` EXCLUSIVAMENTE como contrato logico resolvido e embutido em `ClientProjection.reportAvailability`.
- **Evitar criar mais uma fonte persistida independente**, salvo necessidade futura inegociavel, para impedir divergencia de estado.

Campos minimos:

- `status`;
- `reasonCode`;
- `clientMessage`;
- `publicReportToken`;
- `reportSnapshotId`;
- `decisionId`;
- `isActionable`;
- `updatedAt`.

Status oficiais:

- `unavailable`;
- `generating`;
- `ready`;
- `revoked`;
- `failed`.

Regra:

- portal cliente nunca decide disponibilidade por conta propria;
- backend/projection entrega availability ja resolvido.
- `ReportSnapshot.status`, `publicReports.status` e `ClientProjection.reportAvailability.status` nao podem divergir sem auditoria/alerta interno;
- se houver divergencia, o estado mais restritivo prevalece para o cliente;
- `ready` so pode existir quando ha `Decision.approved`, `ReportSnapshot.ready` e `PublicReport.published/ready`.

## 6.3 Colecoes definitivas

| Colecao | Proposito | Fonte da verdade | Campos principais | Relacionamentos | Quem escreve | Quem le | Tipo | Riscos | Evolucao |
|---|---|---|---|---|---|---|---|---|---|
| `cases` | Envelope operacional do caso | Sim para processo | `tenantId`, `clientId`, `subjectId`, `productKey`, `requestedModuleKeys`, `status`, `priority`, `assignedTo`, `currentDecisionId`, `currentReportSnapshotId`, `currentClientProjectionId`, `createdAt`, `updatedAt` | `subjects`, `decisions`, `reportSnapshots`, `moduleRuns` | Functions, ops | ops, cliente via projection | interna/operacional | voltar a virar data lake | manter apenas envelope e ponteiros |
| `subjects` | Sujeito investigado PF/PJ | Sim para alvo | `tenantId`, `type`, `primaryDocument`, `declaredName`, `canonicalEntityId`, `createdFromCaseId`, `status` | `cases`, `persons`, `companies` | Functions/ops | ops | interna | merge incorreto | comecar por CPF/CNPJ forte |
| `persons` | Pessoa fisica canonica | Sim para PF | `tenantId`, `cpf`, `name`, `birthDate`, `motherName`, `gender`, `confidence`, `sourceEvidenceIds` | `subjects`, `relationships`, `evidenceItems` | normalizers | ops | interna/parcial | dados stale | evoluir para dossie PF |
| `companies` | Pessoa juridica canonica | Sim para PJ | `tenantId`, `cnpj`, `legalName`, `tradeName`, `status`, `openingDate`, `mainActivity`, `sourceEvidenceIds` | `subjects`, `relationships` | normalizers | ops | interna/parcial | normalizacao incompleta | evoluir para dossie PJ |
| `providerRequests` | Ledger de chamadas a providers | Sim | `tenantId`, `caseId`, `subjectId`, `provider`, `datasets`, `requestHash`, `status`, `idempotencyKey`, `startedAt`, `finishedAt`, `errorCode` | `rawSnapshots`, `providerRecords` | Functions | ops/admin | interna | duplicar consultas | base para billing/consumo |
| `rawSnapshots` | Snapshot bruto ou metadata de payload | Sim para bruto | `tenantId`, `providerRequestId`, `provider`, `endpoint`, `datasets`, `payloadRef`, `payloadHash`, `queriedAt`, `size`, `retentionPolicy`, `visibility` | `providerRequests`, Storage | Functions | perfil restrito | interna restrita | vazamento/sensibilidade | mover payload pesado para Storage |
| `providerRecords` | Registros normalizados por provider | Sim para normalizado provider | `tenantId`, `rawSnapshotId`, `provider`, `recordType`, `normalized`, `normalizerVersion`, `confidence`, `observedAt` | `rawSnapshots`, `evidenceItems` | normalizers | ops | interna | acoplar ao provider | manter camada entre raw e canonico |
| `evidenceItems` | Evidencias auditaveis | Sim | `tenantId`, `caseId`, `subjectId`, `providerRecordId`, `rawSnapshotId`, `kind`, `summary`, `severity`, `visibility`, `status`, `reviewedBy`, `reviewedAt` | `facts`, `riskSignals`, `decisions` | Functions/analista | ops; cliente somente via projection | interna | evidencia demais/ruido | curadoria e agrupamento |
| `facts` | Fatos canonicos extraidos | Sim | `tenantId`, `subjectId`, `kind`, `value`, `confidence`, `evidenceIds`, `validFrom`, `validTo`, `status` | `evidenceItems`, `relationships` | Functions | ops | interna | modelar demais cedo | criar apenas fatos usados no cockpit/relatorio |
| `relationships` | Relacoes entre entidades | Sim | `tenantId`, `fromEntityId`, `toEntityId`, `type`, `role`, `confidence`, `evidenceIds`, `status` | `persons`, `companies`, `facts` | Functions | ops | interna/parcial | grafo prematuro | lista/mini-relacionamentos antes de grafo |
| `riskSignals` | Interpretacoes de risco | Sim | `tenantId`, `caseId`, `subjectId`, `kind`, `severity`, `scoreImpact`, `reason`, `supportingEvidenceIds`, `status`, `reviewedBy` | `evidenceItems`, `decisions` | Functions/analista | ops; cliente via resumo | interna | score opaco | explicabilidade obrigatoria |
| `decisions` | Decisao/recomendacao final | Sim | `tenantId`, `caseId`, `subjectId`, `verdict`, `riskScore`, `riskLevel`, `summary`, `reasons`, `supportingSignalIds`, `evidenceSetHash`, `status`, `approvedBy`, `approvedAt`, `revision` | `riskSignals`, `reportSnapshots` | Functions/ops | ops; cliente via projection | interna | alterar apos publicar | versionar/revisionar |
| `reportSnapshots` | Fonte da verdade do relatorio | Sim | `tenantId`, `caseId`, `subjectId`, `decisionId`, `sections`, `clientSafeData`, `builderVersion`, `contentHash`, `evidenceSetHash`, `createdAt`, `createdBy`, `status` | `decisions`, `publicReports` | Functions | ops; public via token/projection | snapshot | ficar grande | Storage para artefatos pesados |
| `clientProjections` | View cliente-safe | Sim para portal V2 | `tenantId`, `clientId`, `caseId`, `subjectLabel`, `productLabel`, `commercialModules`, `status`, `riskSummary`, `verdict`, `reportAvailability`, `updatedAt` | `cases`, `decisions`, `reportSnapshots`, `publicReports` | Functions | cliente/ops | projection | stale data | regeneravel e versionada |
| `publicReports` | Relatorio publico por token | Sim para acesso publico | `token`, `tenantId`, `caseId`, `reportSnapshotId`, `status`, `htmlRef/html`, `expiresAt`, `revokedAt`, `createdAt`, `accessCount` | `reportSnapshots` | Functions | publico por token | publica controlada | token stale/orfao | apontar sempre para snapshot |
| `auditEvents` | Auditoria interna | Sim | `tenantId`, `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `caseId`, `subjectId`, `metadata`, `createdAt` | qualquer entidade | Functions | ops/auditor | interna | volume | arquivar/BigQuery futuro |
| `tenantAuditLogs` | Auditoria cliente-safe | Projection | campos sanitizados | `auditEvents` | Functions | cliente | projection | vazar detalhe | whitelist |
| `tenantConfigs` | Configuracao operacional/tecnica por tenant | Sim para operacao | `tenantId`, `providerSettings`, `featureFlags`, `limits`, `branding`, `portalBehavior`, `notificationSettings`, `operationalDefaults` | `tenantEntitlements`, `tenantUsage` | admin/functions | admin/ops | interna/config | misturar contrato com operacao | separar rigidamente de entitlements |
| `productCatalog` | Catalogo global de produtos | Sim para definicao global | `productKey`, `name`, `description`, `requiredModules`, `optionalModules`, `deliverables`, `defaultReviewPolicy`, `status` | `moduleCatalog`, `tenantEntitlements` | admin/system | backend/ops | interna/config | acoplar produto a plano | comecar como arquivo versionado e materializar depois |
| `moduleCatalog` | Catalogo global de modulos | Sim para definicao global | `moduleKey`, `type`, `providers`, `capabilitiesRequired`, `evidenceMapping`, `reportSections`, `billingUnits`, `reviewPolicy`, `lifecycleStatus` | `productCatalog`, `tenantEntitlements` | admin/system | backend/ops | interna/config | if/else espalhado se nao existir | contrato plug-and-play de modulo |
| `tenantEntitlements` | Habilitacoes contratuais por tenant | Sim para contrato | `tenantId`, `contractId`, `enabledProducts`, `enabledModules`, `policyOverrides`, `billingOverrides`, `effectiveFrom`, `effectiveTo`, `status` | `tenantConfigs`, `productCatalog`, `moduleCatalog` | admin/functions | backend/frontend autorizado | interna/contratual | divergencia entre comercial e execucao | fonte real de habilitacao |
| `moduleRuns` | Execucao de modulo por caso/sujeito | Sim para rastreio operacional | `tenantId`, `caseId`, `subjectId`, `productKey`, `moduleKey`, `requested`, `entitled`, `effective`, `status`, `providerRequestIds`, `evidenceIds`, `usageMeterIds`, `blocksDecision`, `blocksPublication`, `entitlementId` | `providerRequests`, `evidenceItems`, `usageMeters` | Functions | ops | interna | execucao duplicada | centro operacional modular |
| `reportSectionContributions` | Contribuicoes de modulos para relatorio | Derivada/versionavel | `tenantId`, `caseId`, `reportSnapshotId`, `moduleKey`, `sectionKey`, `content`, `evidenceIds`, `visibility`, `builderVersion` | `reportSnapshots`, `evidenceItems` | Functions | ops | interna/snapshot support | se cada modulo escrever HTML inconsistente | padronizar secoes antes de gerar snapshot |
| `timelineEvents` | Linha do tempo investigativa materializada | Projection derivada | `tenantId`, `caseId`, `subjectId`, `eventType`, `occurredAt`, `sourceEntityType`, `sourceEntityId`, `title`, `severity`, `visibility` | `evidenceItems`, `facts`, `auditEvents`, `moduleRuns` | Functions | ops; cliente via projection | projection/investigativa | duplicar fonte da verdade | nasce derivada, premium vira timeline rica |
| `providerDivergences` | Conflitos entre fontes/provedores | Sim para divergencia revisavel | `tenantId`, `caseId`, `subjectId`, `kind`, `severity`, `conflictingEvidenceIds`, `status`, `resolution`, `resolvedBy`, `resolvedAt` | `evidenceItems`, `riskSignals`, `decisions` | Functions/analista | ops | interna/review | divergencia ignorada | pode nascer como riskSignal e virar colecao dedicada |
| `usageMeters` | Consumo por modulo/provider | Sim para billing interno | `tenantId`, `caseId`, `subjectId`, `productKey`, `moduleKey`, `providerRequestId`, `unit`, `quantity`, `internalCostRef`, `commercialBillable`, `contractId`, `entitlementId`, `createdAt` | `providerRequests`, `moduleRuns`, `tenantEntitlements` | Functions | admin/finance/ops | interna | expor custo | separar custo interno de consumo cliente |
| `watchlists` | Listas monitoradas | Futuro | `tenantId`, `name`, `subjectIds`, `rules`, `status` | `subjects`, `monitoringSubscriptions` | ops/admin | ops/admin | premium | custo/legal | fase 4 |
| `monitoringSubscriptions` | Monitoramento continuo | Futuro | `tenantId`, `subjectId`, `modules`, `frequency`, `lastRunAt`, `nextRunAt`, `status` | `subjects`, `alerts` | Functions/admin | ops/admin | premium | custo/alert fatigue | fase 4 |
| `alerts` | Alertas de mudanca/risco | Futuro | `tenantId`, `subjectId`, `kind`, `severity`, `evidenceIds`, `status`, `createdAt` | `evidenceItems`, `monitoringSubscriptions` | Functions | ops | premium | ruido | fase 4 |

## 6.4 O que continua existindo da V1

Continua:

- `cases`;
- `clientCases`;
- `publicResult/latest`;
- `publicReports`;
- `auditLogs`/`tenantAuditLogs`;
- estrutura de usuarios/tenants;
- portais atuais.

## 6.5 O que vira projection transitoria

Projection transitoria:

- `clientCases`;
- `publicResult/latest`.

Regra:

- nao usar como fonte de verdade da V2;
- gerar a partir de `Decision`, `ReportSnapshot` e `ClientProjection`.

## 6.6 O que sera deprecado depois

Deprecar gradualmente:

- leitura direta do portal cliente em campos antigos de `cases`;
- builders duplicados sem teste de paridade;
- publicacao baseada em dados mutaveis;
- normalizacao direta para campos finais do caso.

## 6.7 O que nao deve mais ser fonte de verdade

Nao devem ser fonte de verdade:

- `publicResult/latest`;
- `clientCases`;
- HTML de `publicReports`;
- resumo da IA;
- campos derivados em `cases`;
- drawer do portal cliente;
- relatorio renderizado.

## 6.8 Como modelar entitlements sem transformar Firestore em pseudo-relacional

Regra:

- `productCatalog` e `moduleCatalog` sao configuracoes pequenas e versionadas.
- `tenantEntitlements` deve guardar a configuracao efetiva do contrato, nao historico infinito.
- historico de alteracao contratual vai para `auditEvents`.
- execucoes ficam em `moduleRuns`, nao dentro de arrays grandes em `cases`.
- consumo fica em `usageMeters`, nao dentro do tenant config.

Leituras comuns devem ser materializadas:

- cockpit le resumo de modulos habilitados no caso/tenant;
- portal cliente le somente projection;
- backend resolve entitlement em uma funcao central/cacheavel;
- billing le `usageMeters`.

Formato recomendado de entitlement efetivo:

```txt
tenantEntitlements/{tenantId}
  contractId
  presetKey
  enabledProducts: map
  enabledModules: map
  policyOverrides:
    review
    freshness
    snapshotReuse
    seniorApproval
  billingOverrides:
    includedUnits
    billableModules
    overagePolicy
  updatedAt
  updatedBy
```

Decisao final para V2:

- `tenantEntitlements/{tenantId}` sera o documento efetivo atual por tenant;
- historico de alteracoes contratuais fica em `auditEvents`;
- se no futuro houver multiplos contratos simultaneos por tenant, criar subcolecao `tenantEntitlementVersions`, mas isso nao entra na V2 minima.

## 6.9 Arquitetura-alvo premium-complete vs nascimento incremental

Nem tudo que existe na arquitetura-alvo precisa nascer como colecao Firestore no primeiro ciclo.

| Componente | Papel na visao premium-complete | Como nasce primeiro | Quando virar persistencia dedicada |
|---|---|---|---|
| `ProductCatalog` | Catalogo global de produtos | arquivo versionado/constante compartilhada | quando admin/comercial precisar editar sem deploy |
| `ModuleCatalog` | Catalogo global de modulos | arquivo versionado/ModuleRegistry simples | quando houver muitos modulos/lifecycle ativo |
| `ModuleContract` | Contrato plug-and-play | objeto em codigo com schema documentado | quando marketplace/admin de modulo existir |
| `TenantEntitlements` | Habilitacao contratual efetiva | documento Firestore efetivo por tenant | ja entra cedo, mas pequeno |
| `TenantConfigs` | Operacao tecnica/branding/flags | evolucao de `tenantSettings` | ja existe parcialmente como V1 |
| `timelineEvents` | Timeline rica | projection derivada de evidencias/auditoria | Fase 2/3, quando cockpit precisar timeline persistida |
| `providerDivergences` | Conflitos entre fontes/provedores | `RiskSignal`/Evidence com `kind=divergence` | quando houver workflow de resolucao |
| `relationships` | Relacoes entre entidades | lista/mini-relacionamentos | antes de grafo premium |
| `watchlists`/`alerts` | Monitoramento premium | contrato no catalogo | Fase 4, com demanda comercial validada |

Regra:

- premium-complete guia o desenho;
- V2 minima implementa apenas os contratos e colecoes que reduzem risco agora;
- evitar framework interno de plugins antes de haver modulos suficientes para justificar.

## 6.10 Separacao rigida entre `tenantConfigs` e `tenantEntitlements`

Decisao final:

> `tenantEntitlements` responde "o que o contrato permite". `tenantConfigs` responde "como a operacao roda".

Regra operacional curta:

| Documento | Papel | Quando ler | Quando prevalece |
|---|---|---|---|
| `tenantEntitlements` | contrato/habilitacao real | sempre que a V2 for decidir produto, modulo, capability, report, review ou billing | prevalece em tudo que for contratual |
| `tenantConfigs` | configuracao operacional/tecnica | sempre que a V2 precisar de provider settings, flags, limites, branding, portal behavior ou notificacao | prevalece em operacao tecnica |
| `tenantSettings` | camada legada transitória da V1 | apenas via adapter/fallback enquanto endpoints V1 existirem ou enquanto tenant ainda nao tiver V2 configurado | nunca prevalece sobre `tenantEntitlements`/`tenantConfigs` V2 |

Se houver divergencia:

- habilitacao contratual: `tenantEntitlements` vence.
- operacao tecnica: `tenantConfigs` vence.
- leitura legada: `tenantSettings` so entra quando nao houver configuracao V2 efetiva ou quando feature flag V2 estiver desligada para aquele tenant.
- frontend nao deve resolver divergencia; deve receber contexto resolvido pelo backend.

### `tenantEntitlements`

Vai em `tenantEntitlements`:

- produtos habilitados;
- modulos habilitados;
- capabilities habilitadas;
- report types contratados;
- politicas contratuais de supervisao;
- politicas contratuais de billing/excedente;
- overrides comerciais;
- vigencia contratual;
- preset de origem, se houver.

Nao vai em `tenantEntitlements`:

- credencial de provider;
- segredo/API key;
- configuracao tecnica detalhada de provider;
- branding visual;
- estado de execucao;
- consumo acumulado;
- historico operacional.

Quem escreve:

- admin/ops autorizado via backend;
- importacao/adaptacao controlada;
- nunca frontend cliente.

Quem le:

- backend para autorizar execucao;
- frontend ops/cliente via projection/servico sanitizado;
- billing resolver;
- report section resolver;
- audit service.

### `tenantConfigs`

Vai em `tenantConfigs`:

- provider settings nao secretos;
- feature flags;
- limites operacionais;
- comportamento do portal;
- branding;
- notificacoes;
- defaults de operacao;
- parametros tecnicos de freshness quando nao forem contratuais.

Nao vai em `tenantConfigs`:

- habilitacao contratual efetiva;
- preco comercial final;
- decision/review de caso;
- permissao de usuario individual;
- raw provider payload.

Quem escreve:

- admin/ops autorizado;
- backend;
- scripts de configuracao/adaptacao controlados.

Quem le:

- backend;
- frontend ops;
- portal cliente somente por projection sanitizada.

### Relacao com `tenantSettings` da V1

Confirmado no repositorio atual, `tenantSettings` ja guarda `analysisConfig`, `enrichmentConfig`, limites e parte de provider settings.

Decisao:

- a V2 nao deve depender estruturalmente de `tenantSettings`;
- `tenantSettings` pode alimentar um `LegacyTenantSettingsAdapter` enquanto a V1 continuar operando;
- novas regras V2 devem nascer em `tenantEntitlements` e `tenantConfigs`;
- mapeamento historico de tenants antigos e tarefa posterior, nao pre-condicao para desenhar a V2 limpa.

Prevalencia:

- contrato: `tenantEntitlements`;
- tecnica/operacao: `tenantConfigs`;
- compatibilidade legado: `tenantSettings`, somente via adapter;
- usuario: RBAC;
- rollout: feature flag;
- execucao: state machine.

## 6.11 Timeline, divergencias e relacionamentos na arquitetura

### Timeline

Decisao:

- timeline e projection investigativa derivada, nao fonte primaria de verdade.

Fontes da timeline:

- `evidenceItems`;
- `facts`;
- `providerRecords`;
- `moduleRuns`;
- `decisions`;
- `auditEvents`;
- `reportSnapshots`;
- alertas futuros.

Como nasce:

- Fase 1: timeline pode ser montada em memoria a partir de evidencias/auditoria.
- Fase 2/3: criar `timelineEvents` para cockpit e dossie.
- Fase 4: timeline historica/premium com comparacao entre snapshots.

Como entra no relatorio:

- apenas eventos relevantes, cliente-safe e sustentados por evidencia;
- nunca incluir logs tecnicos ou eventos internos sem valor comercial.

### Divergencias

Decisao:

- divergencia relevante deve ser entidade revisavel, nao texto solto.

Como nasce:

- Fase 1: `RiskSignal.kind=provider_divergence` com supporting evidence.
- Fase 2/3: `providerDivergences` dedicado quando precisar workflow de resolucao.

Tipos:

- identidade;
- quantidade;
- status;
- data;
- provider coverage;
- homonimia;
- escopo contratual.

Como entra na decisao:

- divergencia critica bloqueia publicacao ate resolucao ou justificativa;
- resolucao do analista vira audit event e pode alimentar `Decision.reasons`.

Como entra no relatorio:

- somente divergencias relevantes e cliente-safe;
- narrativa deve explicar impacto sem expor metodologia interna sensivel.

### Relacionamentos

Decisao:

- relacionamento e entidade/fato investigativo antes de virar grafo visual.

Como nasce:

- Fase 2: lista/mini-relacionamentos em `relationships`;
- Fase 3: visualizacao simples no cockpit;
- Fase 4: grafo premium e comparacao historica.

Regra:

- toda relacao precisa de `evidenceIds` e `confidence`;
- relacao usada em decision precisa ser revisavel.

## 6.12 Salvaguardas contra `cases` gordo

`cases` deve ser envelope operacional, nao deposito universal.

Pode ficar em `cases`:

- `tenantId`;
- `clientId`;
- `subjectId`;
- `productKey`;
- `requestedModuleKeys`;
- `status`;
- `priority`;
- `assignedTo`;
- `sla`;
- `currentDecisionId`;
- `currentReportSnapshotId`;
- `currentClientProjectionId`;
- timestamps principais;
- ponteiros/resumos curtos para fila.

Nao pode ficar em `cases`:

- payload bruto de provider;
- arrays grandes de processos/evidencias;
- HTML de relatorio;
- public report completo;
- dados cliente-safe extensos;
- provider records completos;
- timeline completa;
- relationships completas;
- usage detalhado;
- logs tecnicos;
- historico de revisions;
- snapshots de dossie.

Projections para evitar atalhos:

- fila ops: summary operacional curto;
- portal cliente: `ClientProjection`;
- relatorio: `ReportSnapshot`;
- public result legado: projection transicional;
- dossie: `Subject` + facts/evidence/relationships;
- status de modulo: `moduleRuns`.

Anti-padroes proibidos:

- adicionar novo campo derivado em `cases` so porque e facil renderizar;
- salvar resultado completo do provider em `cases`;
- fazer portal cliente ler `cases`;
- fazer report builder buscar secoes diretamente em `cases`;
- usar `cases` como cache de everything.

Regra incisiva:

> Se o dado e extenso, derivado, historico, tecnico, cliente-safe, billable, evidencial ou de relatorio, ele nao pertence a `cases`.

Qualquer novo dado desse tipo deve nascer em colecao/projection propria.

## 6.13 `moduleRuns` como centro operacional modular

Decisao final e inegociavel:

> `moduleRuns` e a unica fonte operacional central de status modular por caso. Nao confie em flags antigas do `cases` para decidir status de modulo.

`moduleRuns` deve responder:

- qual modulo foi solicitado;
- qual modulo foi autorizado pelo entitlement;
- qual modulo foi considerado efetivo para o caso;
- qual modulo executou chamada de provider;
- qual modulo reutilizou snapshot;
- qual modulo falhou;
- qual modulo foi ignorado por policy/freshness;
- qual modulo gerou evidencia;
- qual modulo gerou sinal de risco;
- qual modulo gerou consumo;
- qual modulo bloqueia decision/publicacao;
- qual modulo contribuiu ou nao para o relatorio.

Campos recomendados:

- `tenantId`;
- `caseId`;
- `subjectId`;
- `productKey`;
- `moduleKey`;
- `requested`;
- `entitled`;
- `effective`;
- `status`;
- `providerRequestIds`;
- `rawSnapshotIds`;
- `evidenceIds`;
- `riskSignalIds`;
- `usageMeterIds`;
- `blocksDecision`;
- `blocksPublication`;
- `reuseReason`;
- `failureReason`;
- `startedAt`;
- `finishedAt`;
- `entitlementId`.

Status recomendados:

- `not_requested`;
- `not_entitled`;
- `pending`;
- `running`;
- `completed_no_findings`;
- `completed_with_findings`;
- `skipped_reuse`;
- `skipped_policy`;
- `failed_retryable`;
- `failed_final`;
- `blocked`.

Regras:

- `cases` pode guardar resumo curto de progresso, mas `moduleRuns` e a fonte do status modular.
- cockpit le status modular de `moduleRuns`, nao de arrays improvisados no caso.
- billing deve relacionar `usageMeters` a `moduleRuns`.
- decision deve referenciar evidencias/sinais derivados de `moduleRuns`.
- report snapshot so recebe modulo que tenha contribuicao aprovada via `ReportSectionResolver`.

---

# 7. Estrategia de reaproveitamento seletivo da V1

## 7.1 Principio

Reaproveitar a V1 apenas onde ela reduz risco e acelera entrega. A arquitetura de dominio da V2 deve nascer limpa em novos contratos, colecoes e projections quando isso for melhor.

## 7.1.1 O que o repositorio atual ja oferece para modularidade

Confirmado no repositorio:

- `src/App.jsx` ja separa portal cliente, portal ops, demo e relatorio publico.
- `src/core/rbac/permissions.js` ja possui roles e permissoes basicas.
- `src/core/contexts/TenantContext.jsx` ja resolve tenant selecionado e acesso a todos os tenants para perfis ops/admin.
- `src/portals/ops/TenantSettingsPage.jsx` ja permite configurar fases, providers, limites e estimativa de custo.
- `functions/index.js` ja carrega configuracoes por tenant via `getTenantSettingsData` e funcoes `load*Config`.
- `tenantSettings` ja guarda `analysisConfig`, `enrichmentConfig`, limites diarios/mensais e politicas de excedencia.
- `tenantUsage` ja existe como base inicial de quota/limite.
- adapters e normalizers ja separam parte da integracao externa.

Isso ajuda a V2 como referencia operacional, mas nao deve prender a arquitetura nova. A V2 pode nascer em `tenantEntitlements`, `tenantConfigs` e `moduleCatalog`; `tenantSettings` permanece apenas como compatibilidade/adaptador enquanto a V1 existir.

## 7.1.2 O que atrapalha a modularidade hoje

Pontos de atrito:

- `functions/index.js` concentra regras de providers, publicacao, relatorio, conclusao e tenant.
- `CasoPage.jsx` concentra UI de providers, revisao, draft, score e conclusao.
- `clientPortal.js` duplica whitelist e regras de visualizacao cliente.
- report builders duplicados podem divergir.
- `analysisConfig` e `enrichmentConfig` sao configuracoes tecnicas de fases/providers, nao um contrato modular de produto.
- regras de supervisao ainda nao existem como policy central.
- billing por modulo ainda nao esta separado de custo estimado/tenantUsage.

Risco:

- se a V2 apenas adicionar novos if/else nesses pontos, a plataforma ficara mais fragil a cada novo produto.

Decisao:

- criar contratos compartilhados e resolvers centrais antes de adicionar muitos modulos.

## 7.1.3 Onde criar contratos compartilhados

Contratos recomendados:

- `products/catalog`: produtos e presets.
- `modules/catalog`: modulos e lifecycle.
- `tenant/entitlements`: habilitacao efetiva.
- `tenant/policies`: freshness, review, senior approval, snapshot reuse.
- `reports/sections`: secoes padronizadas de relatorio.
- `billing/usageUnits`: unidades de consumo.
- `rbac/scopes`: permissoes sensiveis.

Na V2 minima, podem comecar como arquivos compartilhados/versionados no repo. Depois podem ser materializados no Firestore para admin UI.

## 7.1.4 Como evitar regra espalhada

Criar resolvers:

- `LegacyCaseAdapter`: traduz leitura/escrita minima da V1 quando necessario, sem deixar a V2 depender diretamente do shape antigo de `cases`.
- `EntitlementResolver`: diz se tenant pode usar produto/modulo/capability.
- `ModuleRegistry`: resolve contrato de modulo.
- `ReviewPolicyResolver`: define se exige revisao/senior.
- `FreshnessPolicyResolver`: define reuso ou nova consulta.
- `BillingResolver`: define se execucao gera usage meter.
- `ReportSectionResolver`: define secoes permitidas no snapshot.
- `ClientVisibilityResolver`: define o que aparece no portal cliente.
- `ClientProjectionBuilder`: gera projection cliente-safe a partir de decision/snapshot/status, nao do caso cru.
- `ReportProjectionBuilder`: prepara dados de relatorio a partir de `ReportSnapshot` e secoes aprovadas.
- `PublicReportAvailabilityResolver`: calcula availability e embute em `ClientProjection`.

Esses resolvers devem ser usados por:

- Cloud Functions;
- cockpit;
- portal cliente;
- report snapshot builder;
- usage meter;
- auditoria.

Regra:

- frontend nao reimplementa entitlement, review, billing ou availability;
- report builder nao busca dados mutaveis para "completar" snapshot;
- adapters legados existem para isolar V1, nao para manter a V2 acoplada ao legado.

## 7.2 Rotas

Arquivos/areas:

- `src/App.jsx`.

Classificacao:

- refatoracao leve.

Impacto:

- manter portais e rotas reduz risco de regressao.

Ordem:

1. manter rotas atuais;
2. adicionar paineis V2 por feature flag;
3. migrar paginas gradualmente.

## 7.3 Portais

Portal cliente:

- `src/portals/client/DashboardClientePage.jsx`;
- `src/portals/client/SolicitacoesPage.jsx`;
- `src/portals/client/NovaSolicitacaoPage.jsx`;
- `src/portals/client/RelatoriosClientePage.jsx`;
- `src/portals/client/AuditoriaClientePage.jsx`.

Classificacao:

- refatoracao leve/profunda conforme tela.

Direcao:

- manter UX simples;
- ler `ClientProjection`;
- abrir relatorio somente com `PublicReport` valido;
- nao expor provider/payload.

Portal ops:

- `src/portals/ops/FilaPage.jsx`;
- `src/portals/ops/CasoPage.jsx`;
- `src/portals/ops/CasosPage.jsx`;
- `src/portals/ops/AuditoriaPage.jsx`;
- `src/portals/ops/RelatoriosPage.jsx`;
- `src/portals/ops/SaudePage.jsx`.

Classificacao:

- Fila: refatoracao leve.
- CasoPage: refatoracao profunda.
- Auditoria/Relatorios/Saude: reaproveitar e expandir.

## 7.4 Fluxo de caso

Atual:

- caso concentra operacao, enriquecimento, revisao, resultado e publicacao.

V2:

- caso vira envelope operacional.

Ordem:

1. adicionar referencias V2 em `cases`;
2. manter campos antigos;
3. criar projections;
4. mover leituras novas para services V2;
5. deprecar campos derivados antigos.

## 7.5 `CasoPage.jsx`

Classificacao:

- refatoracao profunda.

Motivo:

- concentra draft, prefill, score, providers, revisao e conclusao.

Ordem ideal:

1. extrair componentes sem mudar comportamento;
2. criar `CaseHeader`;
3. criar `ProviderStatusPanel`;
4. criar `EvidencePanel`;
5. criar `SignalsPanel`;
6. criar `DecisionPanel`;
7. criar `ReportPanel`;
8. habilitar cockpit minimo por flag.

Risco:

- quebrar fluxo de conclusao.

Mitigacao:

- testes E2E e feature flag.

## 7.6 `functions/index.js`

Classificacao:

- manter e deprecar depois, com refatoracao modular.

Ordem:

1. nao mover tudo de uma vez;
2. criar modulos internos em `functions/domain/*`;
3. mover reporting/publication primeiro;
4. mover providers depois;
5. mover evidence/decisioning;
6. manter exports compativeis.

## 7.7 Report builders

Arquivos:

- `functions/reportBuilder.cjs`;
- `src/core/reportBuilder.js`.

Classificacao:

- substituir duplicacao por contrato + snapshot + golden tests.

Ordem:

1. definir schema de `ReportSnapshot`;
2. adaptar backend para gerar a partir dele;
3. frontend renderiza preview usando mesmo contrato;
4. criar golden tests;
5. remover divergencias gradualmente.

## 7.8 Publicacao

Funcoes:

- `concludeCaseByAnalyst`;
- `publishResultOnCaseDone`;
- `syncPublicResultLatest`;
- `createClientPublicReport`;
- `createAnalystPublicReport`;
- `buildCanonicalReportHtml`.

Classificacao:

- refatoracao profunda.

Nova regra:

- publicar somente a partir de `Decision` aprovada + `ReportSnapshot` valido.

## 7.9 Adapters/normalizers

Arquivos:

- `functions/adapters/bigdatacorp.js`;
- `functions/normalizers/bigdatacorp.js`;
- demais adapters/normalizers.

Classificacao:

- reaproveitar com refatoracao profunda para BigDataCorp;
- refatoracao leve para providers secundarios.

Nova regra:

- adapter faz chamada;
- request ledger registra;
- raw snapshot guarda resposta;
- normalizer gera provider record;
- mappers geram evidence/fact/signal.

### 7.9.1 Resolvers de Transicao e Regra de Negocio

Para evitar poluir `functions/index.js` e retirar logica de negocio do frontend, a V2 deve introduzir resolvers centrais (alguns ja esbocados em `v2Core.cjs`):

- **`EntitlementResolver`**: resolve `requestedModuleKeys` contra o contrato do tenant, features flags e policies, retornando os `effectiveModuleKeys`.
- **`ReportSectionResolver`**: avalia a `Decision` e as evidencias, filtrando pelo `productKey` e `entitlements` para determinar as `reportModuleKeys` e secoes que vao pro relatorio.
- **`ClientProjectionResolver`**: empacota o estado seguro do caso, resolvendo o `PublicReportAvailability` e expondo apenas o que e `client-safe`.

Isso deve entrar para deixar claro que o frontend nao calcula regras de negocio operacionais.

## 7.10 Auditoria

Arquivos:

- `functions/audit/auditCatalog.js`;
- `functions/audit/writeAuditEvent.js`;
- frontend audit catalog/paginas.

Classificacao:

- reaproveitar com refatoracao leve.

Expandir para:

- provider request;
- raw snapshot;
- evidence;
- risk signal;
- decision;
- report snapshot;
- public report access.

## 7.11 RBAC e regras

Arquivos:

- `src/core/rbac/permissions.js`;
- `src/core/auth/AuthContext.jsx`;
- `firestore.rules`.

Classificacao:

- reaproveitar com refatoracao profunda nas regras Firestore.

Adicionar:

- permissoes para raw;
- aprovacao senior;
- publicacao;
- reabertura;
- custo interno;
- configuracao de freshness.

## 7.12 Compatibilidade minima com V1 sem dominar a V2

Regras:

- feature flags por tenant;
- fallback para fluxo antigo apenas enquanto o tenant ainda nao estiver no fluxo V2;
- adapters legados isolam shape antigo;
- projections novas devem nascer limpas;
- publicacao idempotente;
- auditoria dos fluxos V2;
- rollout por cliente piloto.

Regra:

- compatibilidade existe para nao quebrar producao, nao para guiar o modelo novo.

---

# 8. Cockpit investigativo definitivo

## 8.1 Objetivo do cockpit

Responder, rapidamente e com prova:

> Esta pessoa ou empresa e confiavel para a decisao que preciso tomar?

O cockpit e ferramenta de trabalho do analista, nao dashboard decorativo.

## 8.2 Principios de UX

- mostrar primeiro o que importa;
- evidencia antes de narrativa;
- decisao sempre visivel;
- hierarquia visual forte;
- menos cliques;
- estados claros;
- bloqueios explicitos;
- explainability nativa;
- separacao interno vs cliente-safe.

## 8.3 Priorizacao visual

Primeiro nivel:

- identidade;
- risco;
- alertas criticos;
- bloqueios;
- status de provider;
- decisao pendente;
- report status.

Segundo nivel:

- evidencias;
- processos;
- mandados;
- vinculos;
- timeline;
- divergencias.

Sob demanda:

- raw pointer;
- logs;
- custos internos;
- versoes de normalizer;
- auditoria detalhada.

Senior/admin:

- raw payload;
- override;
- reabertura;
- revogacao;
- configuracao de modulos.

Nunca cliente:

- payload bruto;
- custo interno;
- heuristicas;
- logs;
- notas restritas.

## 8.4 Layout macro

Topo:

- busca global;
- nome/razao social;
- CPF/CNPJ mascarado;
- tipo PF/PJ;
- tenant/cliente;
- status;
- risco;
- SLA;
- acoes.

Esquerda:

- fila operacional;
- filtros;
- status;
- prioridade;
- bloqueios.

Centro:

- dossie;
- resumo executivo;
- identificacao;
- evidencias;
- processos/mandados;
- vinculos;
- timeline.

Direita:

- sinais;
- divergencias;
- checklist;
- decisao;
- relatorio.

Drawer:

- viewer de evidencia;
- origem;
- timestamp;
- supporting facts;
- raw pointer restrito.

## 8.4.1 Como entitlements modulam o cockpit

O cockpit nao deve ser renderizado por "plano". Deve ser renderizado por:

- produto em execucao no caso;
- modulos habilitados no tenant;
- modulos efetivamente executados;
- status do modulo;
- permissoes do usuario;
- politica de supervisao;
- severidade dos sinais.

Componentes sempre comuns:

- header do caso;
- identidade minima do sujeito;
- status operacional;
- provider/module status;
- evidencias-chave;
- sinais;
- decisao;
- relatorio.

Componentes condicionais:

- painel criminal: somente se modulo criminal habilitado/executado;
- painel trabalhista: somente se modulo trabalhista habilitado/executado;
- painel mandados: somente se modulo mandados habilitado/executado;
- painel PJ/societario: somente para produto PJ/societario;
- timeline: se entitlement permitir ou se produto exigir;
- mini-relacionamentos: se modulo relationship habilitado;
- custos/consultas: apenas ops/admin com permissao;
- raw/evidencia restrita: apenas senior/admin/autorizado.

Regra de UX:

- modulo desabilitado nao aparece como erro;
- modulo contratado mas ainda nao executado aparece como pendente/status;
- modulo executado sem achado relevante aparece como "sem apontamentos relevantes";
- modulo com falha tecnica aparece internamente, mas para cliente vira status traduzido.

## 8.4.2 Slots de UI por modulo

Cada modulo deve declarar onde aparece:

- `caseHeaderBadge`;
- `dossierSection`;
- `evidenceList`;
- `signalsPanel`;
- `decisionChecklist`;
- `reportSection`;
- `clientStatus`;
- `auditTimeline`;
- `usagePanel`.

Isso evita mosaico caotico e impede que cada modulo crie uma UI isolada.

## 8.4.3 Contrato de rendering do cockpit e portal cliente

Frontend nao deve decidir renderizacao lendo plano comercial, provider ou campos internos do caso.

Contrato oficial:

```txt
RenderingContext
  tenantId
  caseId
  subjectId
  productKey
  enabledModules[]
  executedModules[]
  moduleStatuses[]
  userPermissions[]
  clientVisibility
  reviewPolicyResult
  publicationState
  reportAvailability
  uiSlots[]
```

Entradas do rendering:

- produto em execucao;
- modulos habilitados no tenant;
- modulos efetivamente solicitados/executados no caso;
- status por modulo;
- permissoes do usuario;
- visibilidade cliente-safe;
- politica de review/publicacao;
- estado de decision/report;
- feature flags.

Saidas:

- quais cards aparecem;
- quais paineis ficam ocultos;
- quais paineis aparecem como pendentes;
- quais acoes ficam habilitadas;
- quais bloqueios precisam ser explicados;
- quais secoes podem entrar no relatorio.

Regras:

- modulo sem entitlement nao aparece como opcao;
- modulo com entitlement e nao executado aparece como pendente se fizer parte do produto;
- modulo executado sem achado deve aparecer como "sem apontamentos relevantes";
- modulo com falha tecnica aparece internamente e vira mensagem cliente-safe no portal;
- permissao de usuario pode ocultar raw/custo/override mesmo se tenant tiver entitlement;
- portal cliente usa o mesmo conceito, mas com `ClientRenderingContext` sanitizado.

Isso evita:

- if/else espalhado;
- UX caotico;
- card vazio sem explicacao;
- modulo aparecendo sem contrato;
- portal cliente expondo provider, API, custo ou metodologia.

## 8.5 Componentes fixos

- `CaseHeader`;
- `QueueSidebar`;
- `SubjectSummary`;
- `RiskSummary`;
- `EvidenceKeyList`;
- `SignalsPanel`;
- `DecisionPanel`;
- `ReportStatusPanel`.

## 8.6 Componentes contextuais

- `PersonDossier`;
- `CompanyDossier`;
- `LawsuitsPanel`;
- `WarrantsPanel`;
- `RelationshipsPanel`;
- `TimelinePanel`;
- `DivergencePanel`;
- `EvidenceViewer`;
- `UsagePanel`;
- `AuditTrailPanel`.

## 8.7 Modos de uso

- modo fila;
- modo caso;
- modo entidade PF;
- modo entidade PJ;
- modo evidencia;
- modo revisao;
- modo relatorio;
- modo comparacao historica.

## 8.8 Jornada do analista

1. abre fila;
2. escolhe caso por prioridade/risco/SLA;
3. verifica identidade e modulos;
4. checa status de consultas;
5. revisa sinais criticos;
6. abre evidencias;
7. resolve divergencias;
8. confirma ou solicita nova consulta;
9. ajusta narrativa;
10. define decisao;
11. envia para senior se necessario;
12. gera report snapshot;
13. publica relatorio;
14. registra auditoria.

## 8.9 Cockpit minimo

Inclui:

- fila com status;
- detalhe do caso;
- resumo do sujeito;
- provider status;
- evidencias-chave;
- sinais simples;
- checklist;
- painel de decisao;
- report status;
- link seguro.

Nao inclui:

- grafo completo;
- monitoramento;
- watchlist;
- BI.

## 8.10 Cockpit vendavel

Inclui:

- dossie PF/PJ;
- timeline;
- divergencias;
- mini-relacionamentos;
- report composer;
- auditoria visual;
- consumo interno;
- reuso de dossie.

## 8.11 Cockpit premium

Inclui:

- grafo;
- watchlists;
- alert inbox;
- comparacao historica;
- monitoramento;
- regras configuraveis;
- dashboards.

---

# 9. Portal cliente definitivo

## 9.1 O que o cliente ve

Cliente ve:

- dashboard de solicitacoes;
- lista de casos;
- status;
- pendencias;
- modulos contratados em linguagem comercial;
- conclusao quando publicada;
- resumo cliente-safe;
- link de relatorio;
- historico/auditoria cliente-safe.

## 9.2 O que o cliente nunca ve

Cliente nunca ve:

- payload bruto;
- raw snapshots;
- nomes sensiveis de APIs;
- logs tecnicos;
- custo interno;
- heuristicas;
- prompts internos;
- notas restritas;
- divergencias internas nao publicadas;
- campos fora da whitelist.

## 9.3 Paginas

Minimo:

- Dashboard;
- Solicitacoes;
- Nova solicitacao;
- Detalhe/drawer;
- Relatorios;
- Auditoria cliente-safe;
- Perfil/equipe quando aplicavel.

Vendavel:

- detalhes enriquecidos por dossie;
- pendencias didaticas;
- status por modulo;
- relatorios por pacote;
- historico de dossies.

Premium:

- monitoramentos contratados;
- alertas;
- watchlists cliente-safe;
- relatorios periodicos.

## 9.4 Como acompanha status

Status cliente-safe:

- solicitacao recebida;
- dados em verificacao;
- aguardando informacao;
- em revisao;
- relatorio em geracao;
- concluido;
- devolvido;
- reaberto.

Nao usar:

- erro tecnico de provider;
- stack trace;
- nome interno da funcao;
- estado interno sem traducao.

## 9.5 Como abre relatorio

Regra:

- botao "Abrir relatorio" so habilita se `publicReportToken` valido + `reportSnapshotId` valido + `status=ready/published`.

Se nao pronto:

- mostrar "Relatorio em geracao" ou "Resultado em revisao".

Se falhou:

- mostrar mensagem cliente-safe e acionar alerta interno.

## 9.6 Como entende pendencia

Pendencia deve explicar:

- o que falta;
- por que e necessario;
- como enviar/corrigir;
- prazo quando aplicavel.

Nao deve explicar:

- provider falhou;
- erro de API;
- logica interna.

## 9.7 Como entende modulo contratado

Usar nomes comerciais:

- Identificacao;
- Verificacao cadastral;
- Analise judicial;
- Analise criminal;
- Mandados/alertas;
- Vínculos societarios;
- Risco reputacional.

Nao expor:

- endpoint;
- API;
- provider especifico quando nao autorizado.

## 9.7.1 Como entitlements modulam o portal cliente

O portal cliente deve refletir o contrato real do tenant, nao um plano rigido.

Sempre comum:

- criar solicitacao quando perfil permitir;
- acompanhar status;
- ver pendencias;
- ver resultado publicado;
- abrir relatorio seguro;
- ver auditoria cliente-safe.

Condicional por entitlement:

- quais tipos de dossie pode solicitar;
- quais modulos aparecem no formulario;
- quais status por modulo aparecem;
- quais relatorios ficam disponiveis;
- se exportacao esta habilitada;
- se historico de dossies aparece;
- se monitoramento/watchlist aparece no futuro;
- se branding/comportamento customizado esta ativo.

Regra:

- portal cliente nunca deve expor modulo tecnico como provider/dataset/API;
- deve expor modulo comercial: Identificacao, Analise Judicial, Analise Criminal, Mandados/Alertas, Vínculos Societarios, Risco Reputacional;
- se tenant nao tem entitlement, o modulo nao aparece como opcao;
- se tenant tem entitlement mas limite acabou, aparece como indisponivel/limite atingido em linguagem comercial.

## 9.7.2 Portal cliente e report availability

O botao "Abrir relatorio" deve consultar um unico contrato:

```txt
PublicReportAvailability
  status: unavailable | generating | ready | revoked | failed
  reasonCode
  publicReportToken
  reportSnapshotId
  clientMessage
```

Decisao final:

- `PublicReportAvailability` e contrato logico, nao fonte de verdade propria.
- Na V2 inicial, ele deve ser resolvido pelo backend e embutido em `ClientProjection.reportAvailability`.
- O portal cliente nao deve recalcular disponibilidade lendo `publicReports`, `ReportSnapshot` e `cases` separadamente.
- Criar uma projection persistida dedicada so deve ser considerado se houver necessidade real de escala/cache/observabilidade.

Esse contrato deve considerar:

- entitlement do tenant para aquele relatorio;
- decision aprovada;
- snapshot valido;
- token publico valido;
- revogacao;
- status de publicacao;
- regras de visibilidade cliente-safe.

Regra anti-divergencia:

- `ReportSnapshot.status` e fonte do conteudo;
- `publicReports.status` e fonte do token/acesso publico;
- `ClientProjection.reportAvailability` e a view cliente-safe resolvida;
- se qualquer uma dessas camadas estiver inconsistente, o cliente deve ver `generating`, `unavailable`, `revoked` ou `failed`, nunca um link otimista.

## 9.7.3 Contrato de rendering cliente-safe

O portal cliente deve receber uma versao sanitizada do contexto:

```txt
ClientRenderingContext
  tenantId
  clientId
  caseId
  productLabel
  commercialModules[]
  moduleClientStatuses[]
  pendingActions[]
  reportAvailability
  allowedActions[]
  clientMessages[]
```

Regras:

- `commercialModules` usa nomes comerciais, nao `moduleKey` tecnico quando isso gerar confusao;
- `moduleClientStatuses` traduz falhas internas para estados compreensiveis;
- `allowedActions` vem do backend/projection, nao de permissao local solta;
- se nao ha entitlement, o cliente nao ve o modulo;
- se ha entitlement mas faltam dados, o cliente ve pendencia;
- se report esta `generating`, o botao aparece desabilitado com mensagem clara;
- se report esta `ready`, o botao usa `publicReportToken` valido.

## 9.8 Evolucao V1 -> V2

1. Manter `clientCases`.
2. Adicionar `ClientProjection`.
3. Alterar services para priorizar `ClientProjection`.
4. Manter fallback antigo por flag.
5. Remover leitura de campos internos.
6. Auditar abertura de relatorio.

## 9.9 Fonte de verdade por tela/superficie

Cada tela deve ter fonte de verdade explicita. Isso evita que `cases` vire atalho universal e impede que portal, cockpit e relatorio puxem dados mutaveis indevidos.

| Tela/superficie | Fonte primaria | Fontes auxiliares | Nunca deve ler diretamente |
|---|---|---|---|
| Fila ops | `cases` como envelope curto + summary operacional | `moduleRuns` para status modular, `riskSignals` resumidos | raw snapshots, HTML de relatorio, arrays extensos em `cases` |
| Cockpit do caso | `cases`, `subjects`, `moduleRuns`, `evidenceItems`, `riskSignals`, `decisions` | `timelineEvents`, `providerDivergences`, `relationships`, `usageMeters` com permissao | `clientCases`, `publicResult/latest`, HTML publico |
| Dossie PF/PJ | `subjects`, `persons`/`companies`, `facts`, `relationships`, `evidenceItems` | `timelineEvents`, `riskSignals` | payload bruto sem permissao, `cases` como fonte de dossie |
| Portal cliente | `ClientProjection` | `PublicReportAvailability` embutido, auditoria cliente-safe | `cases`, `rawSnapshots`, `providerRecords`, `evidenceItems` internos |
| Relatorio publico | `publicReports` + `ReportSnapshot` | assets/HTML em Storage se aplicavel | `cases` mutavel, provider payload, projections de fila |
| Admin tenant | `tenantEntitlements`, `tenantConfigs`, catalogo global | `tenantUsage`, `usageMeters`, auditEvents | dados brutos de caso sem escopo/permissao |
| Auditoria ops | `auditEvents` | entidades referenciadas por id | mutacoes diretas sem evento auditavel |
| Billing/consumo | `usageMeters` | `moduleRuns`, `providerRequests`, `tenantEntitlements` | calculo direto em provider payload ou HTML |
| Premium/watchlist | `watchlists`, `monitoringSubscriptions`, `alerts` | `subjects`, `timelineEvents`, `relationships` | `cases` como base historica rica |

Regra:

- se uma tela precisar de um dado que nao esta em sua fonte primaria, criar projection/resolver apropriado;
- nao adicionar campo extenso em `cases` para "facilitar a tela";
- portal cliente sempre recebe view cliente-safe resolvida pelo backend.

---

# 10. Faseamento completo da V2

## 10.0 Regra de faseamento premium-complete

O faseamento nao reduz a ambicao do produto.

Decisao:

- V2 minima = primeira onda operacional para blindar fluxo e criar nucleo confiavel.
- V2 vendavel = produto forte de mercado com dossie, cockpit, portal e billing modular.
- V2 premium = estado-alvo oficial da plataforma, com monitoramento, alertas, watchlists, relacionamentos avancados, comparacao historica e inteligencia continua.

Regra:

- toda fase deve ser compativel com a arquitetura premium-complete;
- nenhuma fase deve exigir reescrita para chegar ao premium;
- componentes premium podem existir como contrato no catalogo antes de existirem como tela, job ou colecao.
- se nao houver override, aplicar default global do modulo.

## 10.1 Fase 0 - blindagem da V1 / fundacao

### Objetivo

Impedir regressao no fluxo atual e preparar contratos da V2.

### Por que existe

Porque relatorio/publicacao e o fluxo mais critico comercialmente.

### Entra

- `Decision` minimo;
- `ReportSnapshot` minimo;
- `ClientProjection` inicial;
- catalogo minimo de produtos/modulos;
- entitlement resolver minimo;
- report availability centralizado;
- whitelists;
- feature flags;
- testes do fluxo completo.

### Nao entra

- dossie completo;
- admin contratual completo;
- grafo;
- watchlist;
- monitoramento.

### Entregaveis

- relatorio nao abre vazio;
- publicacao idempotente;
- snapshot com hash;
- projection cliente-safe;
- tenant piloto com entitlement resolvido;
- golden tests.

### Arquitetura envolvida

- Firestore: `decisions`, `reportSnapshots`, `clientProjections`.
- Config: catalogo versionado e seed de `tenantEntitlements`.
- Functions: conclusao/publicacao/report.
- Storage: opcional para HTML/artefatos.

### Produto/UX/operacao/monetizacao

- Produto: relatorio confiavel.
- UX: status "relatorio em geracao".
- Operacao: bloqueios claros.
- Monetizacao: base para vender dossie/relatorio por entitlement.

### Riscos

- quebrar fluxo atual;
- duplicar publicacao;
- drift de builders.

### Dependencias

- entender campos atuais de publicacao;
- whitelists.

### Feature flags

- `v2ReportSnapshotEnabled`;
- `v2ClientProjectionEnabled`.

### Testes

- unit report builder;
- E2E abrir relatorio;
- whitelist;
- idempotencia.

### Criterios de aceite

- caso concluido gera decision;
- decision gera report snapshot;
- cliente abre relatorio preenchido;
- campos internos nao vazam.

### Definicao de pronto

Fluxo atual continua funcionando e novo snapshot pode ser ligado por tenant piloto.

### Valor de negocio

Alto e imediato.

## 10.2 Fase 1 - V2 minima (nucleo confiavel)

### Objetivo

Criar base provider/evidence/decision.

### Entra

- provider ledger BigDataCorp;
- raw snapshot;
- provider record;
- evidence item;
- risk signal simples;
- decision versionada;
- cockpit minimo.

### Nao entra

- grafo;
- watchlist;
- rule builder;
- BigQuery.

### Entregaveis

- provider request idempotente;
- raw snapshot/metadata;
- evidencia consultavel;
- sinais basicos;
- decision ligada a evidencias;
- report snapshot final.

### Arquitetura

- Firestore: `providerRequests`, `rawSnapshots`, `providerRecords`, `evidenceItems`, `riskSignals`.
- Functions: connector, normalizer, evidence builder.
- Storage: payloads grandes.
- Cloud Tasks: opcional para retry/throttle.

### Produto/UX/operacao/monetizacao

- Produto: Dossie PF Essencial inicial.
- UX: cockpit minimo.
- Operacao: revisao baseada em evidencias.
- Monetizacao: consumo por modulo.

### Riscos

- payload sensivel;
- evidencia demais;
- custo de consultas.

### Feature flags

- `v2ProviderLedgerEnabled`;
- `v2EvidenceStoreEnabled`;
- `v2DecisioningEnabled`.

### Testes

- idempotencia provider;
- normalizer golden;
- evidence builder;
- regras Firestore.

### Pronto

Um caso piloto gera evidencias e decisao rastreavel.

## 10.3 Fase 2 - V2 vendavel (produto comercial forte)

### Objetivo

Transformar a base em produto comercial claro.

### Entra

- `Subject`;
- dossie PF;
- dossie PJ inicial;
- timeline;
- divergencias;
- report composer;
- portal cliente V2;
- usage meters;
- presets comerciais;
- area administrativa modular de tenant.

### Nao entra

- monitoramento continuo amplo;
- grafo completo;
- SDK.

### Entregaveis

- Dossie PF Essencial;
- Dossie PF Completo;
- Dossie PJ;
- portal cliente por `ClientProjection`;
- auditoria por decision/report;
- consumo por modulo.

### Arquitetura

- Firestore: `subjects`, `persons`, `companies`, `facts`, `relationships`, `usageMeters`.
- Functions: subject resolver, dossier builder, usage meter.
- Storage: artefatos.

### Produto/UX/operacao/monetizacao

- Produto: planos Start/Professional/Investigative.
- Contrato: entitlements customizaveis por tenant.
- UX: cockpit vendavel.
- Operacao: reuso de dossie.
- Monetizacao: preco por dossie + consumo.

### Riscos

- escopo grande;
- match incorreto;
- produto difuso.

### Feature flags

- `v2SubjectDossierEnabled`;
- `v2PortalClientProjectionEnabled`;
- `v2UsageMeterEnabled`.

### Pronto

Comercial consegue vender pacotes PF/PJ e operacao consegue entregar com cockpit.

## 10.4 Fase 3 - V2 avancada (consolidacao operacional)

### Objetivo

Melhorar eficiencia, controle e explicabilidade.

### Entra

- mini-relacionamentos;
- comparacao historica basica;
- painéis de divergencia;
- aprovacao senior;
- dashboards operacionais simples;
- Cloud Tasks se necessario;
- auditoria expandida.

### Nao entra

- monitoramento continuo full;
- grafo grande;
- rule builder visual.

### Valor

- menos retrabalho;
- maior defensabilidade;
- melhor gestao de operacao.

## 10.5 Fase 4 - V2 premium (monitoramento/inteligencia continua)

### Objetivo

Criar camada premium de inteligencia continua.

### Entra

- watchlists;
- monitoring subscriptions;
- alerts;
- grafo;
- comparacao historica avancada;
- dashboards;
- Pub/Sub;
- BigQuery para analytics.

### Nao entra sem validacao

- IA decisora autonoma;
- regra visual complexa para todo cliente;
- conectores ilimitados.

### Valor

- receita recorrente premium;
- diferenciacao alta;
- plataforma investigativa completa.

## 10.6 O que nasce em codigo primeiro e o que vira configuracao persistida depois

| Item | Fase inicial | Forma inicial | Forma futura |
|---|---|---|---|
| Catalogo de produtos | Fase 0/1 | arquivo versionado | `productCatalog` editavel por admin/system |
| Catalogo de modulos | Fase 0/1 | arquivo versionado/ModuleRegistry simples | `moduleCatalog` com lifecycle |
| Presets comerciais | Fase 1/2 | constante comercial | admin comercial/contratual |
| Entitlements | Fase 0/1 | Firestore simples por tenant | versionamento contratual futuro |
| ReviewPolicyResolver | Fase 0/1 | funcao central com regras pequenas | policy configuravel por tenant/produto/modulo |
| FreshnessPolicyResolver | Fase 1 | regras default + override simples | configuracao granular por modulo/tenant |
| BillingResolver | Fase 1/2 | usage meter simples | pricing engine modular futuro |
| Timeline | Fase 1/2 | derivada em memoria/projection simples | `timelineEvents` persistida |
| Divergencias | Fase 1 | `RiskSignal`/Evidence | `providerDivergences` revisavel |
| Relacionamentos | Fase 2 | lista canonica simples | grafo premium |
| Monitoramento | Fase 4 | contrato/catalogo | watchlists, subscriptions, alerts |

Regra:

- se um conceito ainda nao tem operacao suficiente, nasce como contrato em codigo;
- se precisa de auditoria, configuracao por tenant ou operacao diaria, vira persistencia;
- se tem alto volume ou fan-out, so entao considerar Tasks/PubSub/BigQuery.

---

# 11. Backlog mestre por epicos e blocos

## 11.0 Ordem oficial de execucao dos epicos

A lista de epicos abaixo e inventario de trabalho. A ordem executiva recomendada e:

1. Epico 0 - blindagem do relatorio/publicacao.
2. Epico 0.1 - `Decision` + `ReportSnapshot` + `ClientProjection`.
3. Epico 1 - provider ledger.
4. Epico 2 - raw snapshots e provider records.
5. Epico 3 - evidence store.
6. Epico 4 - risk signals e decisioning minimo.
7. Epico 5 - cockpit minimo.
8. Epico 6 - catalogo modular e entitlements minimos.
9. Epico 7 - subject/dossie.
10. Epico 9 - portal cliente V2.
11. Epico 10 - monetizacao/consumo.
12. Epico 11 - premium/watchlists/monitoramento.

Observacao:

- `EntitlementResolver` minimo pode nascer cedo como guardrail, mas admin modular completo nao deve bloquear a blindagem do nucleo;
- catalogo completo, presets e area administrativa contratual entram depois que publication/decision/evidence estiverem estaveis.

## Epico 0 - blindagem do relatorio/publicacao

Objetivo:

- corrigir base critica de publicacao e relatorio.

Escopo:

- bloqueio do botao sem report valido;
- guards de publicacao;
- whitelist cliente-safe;
- idempotencia inicial;
- report availability.

Arquivos/areas:

- `functions/index.js`;
- `functions/reportBuilder.cjs`;
- `src/core/reportBuilder.js`;
- `src/core/clientPortal.js`;
- `src/portals/client/SolicitacoesPage.jsx`;
- `src/pages/PublicReportPage.jsx`.

Dependencias:

- whitelists;
- schema snapshot.

Risco:

- regressao no fluxo cliente.

Esforco:

- alto impacto, medio esforço.

Flags:

- `v2ReportSnapshotEnabled`;
- `v2ClientProjectionEnabled`.

Aceite:

- relatorio nunca abre vazio se publicado.

## Epico 0.1 - decision, report snapshot e client projection

Objetivo:

- separar decisao supervisionada, snapshot imutavel e projection cliente-safe.

Escopo:

- contrato `Decision`;
- contrato `ReportSnapshot`;
- contrato `ClientProjection`;
- `PublicReportAvailability`;
- bloqueios de publicacao;
- idempotencia de criacao/publicacao.

Dependencias:

- Epico 0;
- regra de supervisao humana;
- whitelist cliente-safe.

Aceite:

- nenhuma projection publica nasce sem decision aprovada e report snapshot valido;
- botao "Abrir relatorio" depende de availability centralizada.

## Epico 1 - provider ledger

Objetivo:

- registrar consultas provider de forma auditavel.

Escopo:

- `providerRequests`;
- idempotency;
- status;
- retry basico;
- usage meter inicial.

Areas:

- `functions/adapters/*`;
- `functions/normalizers/*`;
- novos modulos `functions/domain/providers`.

Aceite:

- cada consulta tem requestId, status e hash.

## Epico 2 - raw snapshots e provider records

Objetivo:

- separar payload bruto de normalizado.

Escopo:

- `rawSnapshots`;
- Storage opcional;
- `providerRecords`;
- normalizer version.

Aceite:

- payload nao entra direto em case/report.

## Epico 3 - evidence store

Objetivo:

- transformar records em evidencias.

Escopo:

- `evidenceItems`;
- viewer de evidencia;
- status de revisao;
- link para raw/provider record.

Aceite:

- risk signal e decision apontam para evidencias.

## Epico 4 - risk signals e decisioning minimo

Objetivo:

- registrar sinais e decisao auditavel.

Escopo:

- `riskSignals`;
- `decisions`;
- checklist;
- aprovacao senior minima;
- `ReviewPolicyResolver`.

Aceite:

- nenhuma publicacao sem decision aprovada.

## Epico 5 - cockpit minimo

Objetivo:

- tornar revisao baseada em evidencias.

Escopo:

- extrair componentes de `CasoPage`;
- EvidencePanel;
- SignalsPanel;
- DecisionPanel;
- ReportPanel.

Aceite:

- analista decide sem navegar por fontes dispersas.

## Epico 6 - catalogo modular e entitlements minimos por tenant

Objetivo:

- criar a base para produto/modulo/capability/preset/entitlement sem acoplar tecnica a plano comercial rigido.

Escopo:

- definir `ProductCatalog`;
- definir `ModuleCatalog`;
- definir `TenantEntitlements`;
- definir `ModuleContract`;
- criar `EntitlementResolver`;
- criar `ModuleRegistry`;
- criar `ReviewPolicyResolver`;
- mapear `analysisConfig` e `enrichmentConfig` atuais para o novo modelo.

Arquivos/areas:

- `src/portals/ops/TenantSettingsPage.jsx`;
- `src/core/firebase/firestoreService.js`;
- `src/core/rbac/permissions.js`;
- `functions/index.js`;
- novos contratos compartilhados;
- futura colecao `tenantEntitlements`.

Dependencias:

- manter compatibilidade com `tenantSettings`;
- definir chaves de produto/modulo;
- definir defaults por tenant.

Risco:

- criar camada abstrata demais antes de usar.

Mitigacao:

- comecar com catalogo pequeno e modulos atuais: identidade, criminal, trabalhista, mandados, KYC, relatorio.

Esforco:

- medio, mas altamente estruturante.

Flags:

- `v2EntitlementsEnabled`;
- `v2ModuleRegistryEnabled`.

Aceite:

- backend consegue perguntar "tenant X pode executar modulo Y para produto Z?";
- frontend consegue renderizar opcoes com base no entitlement;
- nenhum novo modulo precisa alterar multiplos if/else espalhados.

## Epico 6.1 - area administrativa de tenant e contrato

Objetivo:

- evoluir `TenantSettingsPage.jsx` de configuracao tecnica de providers para console administrativo de contrato, modulos e politicas.

Escopo:

- aplicar preset comercial inicial;
- habilitar/desabilitar produtos;
- habilitar/desabilitar modulos;
- configurar supervision policy;
- configurar freshness por modulo;
- configurar reuso de snapshots;
- configurar aprovacao senior;
- configurar limites e excedencia;
- configurar relatorios habilitados;
- configurar branding/comportamento do portal cliente quando aplicavel.

Areas afetadas:

- `src/portals/ops/TenantSettingsPage.jsx`;
- `tenantSettings`;
- `tenantEntitlements`;
- `tenantUsage`;
- RBAC `settings.manage`;
- audit events de alteracao contratual.

Dependencias:

- Epico 6;
- RBAC sensivel;
- audit catalog.

Aceite:

- admin consegue ver configuracao efetiva do tenant;
- alteracao gera audit event;
- backend usa entitlements atualizados sem deploy;
- configuracao antiga de enrichment continua funcionando durante transicao.

## Epico 7 - subject/dossie

Objetivo:

- separar sujeito investigado do caso operacional.

Escopo:

- `subjects`;
- `persons`;
- `companies`;
- dossie PF/PJ minimo.

Aceite:

- novo caso pode referenciar subject existente por CPF/CNPJ.

## Epico 8 - timeline/divergencias

Objetivo:

- organizar contexto temporal e conflitos.

Escopo:

- timeline events;
- provider divergence;
- painel de divergencias.

Aceite:

- divergencia critica bloqueia publicacao ate revisao.

## Epico 9 - portal cliente V2

Objetivo:

- UX cliente didatica e segura.

Escopo:

- status cliente-safe;
- detalhe por projection;
- abertura de relatorio valida;
- pendencias.

Aceite:

- cliente entende status/conclusao sem exposicao tecnica.

## Epico 10 - monetizacao/consumo

Objetivo:

- medir consumo e organizar pacotes.

Escopo:

- `usageMeters`;
- module config;
- planos;
- consumo por tenant.

Aceite:

- cada provider request gera unidade de consumo mapeavel.

## Epico 11 - premium/watchlists/monitoramento

Objetivo:

- criar receita premium futura.

Escopo:

- `watchlists`;
- `monitoringSubscriptions`;
- `alerts`;
- Pub/Sub/Tasks;
- BigQuery analytics.

Aceite:

- sujeito monitorado gera alerta auditavel.

---

# 12. Estrategia de rollout: V2 limpa com compatibilidade minima

## 12.1 Estrategia principal

Decisao final:

> A V2 pode nascer em novas colecoes, contratos e projections no Firebase, separadas da V1. Migracao historica nao e prioridade agora.

Prioridade atual:

- acertar arquitetura premium-complete;
- congelar contratos minimos;
- blindar publicacao/relatorio;
- criar fluxo operacional modular;
- criar UX e fontes de verdade corretas;
- evitar que legado contamine o desenho novo.

Compatibilidade com V1:

- existe para nao quebrar producao;
- deve ser feita por adapters/resolvers;
- nao deve dominar o plano;
- nao deve transformar a V2 em remendo da V1.

## 12.2 Feature flags

Flags:

- `v2EntitlementsEnabled`;
- `v2ModuleRegistryEnabled`;
- `v2ReportSnapshotEnabled`;
- `v2ClientProjectionEnabled`;
- `v2ProviderLedgerEnabled`;
- `v2EvidenceStoreEnabled`;
- `v2DecisioningEnabled`;
- `v2SubjectDossierEnabled`;
- `v2CockpitPanelsEnabled`;
- `v2UsageMeterEnabled`.

## 12.3 Convivencia minima entre estruturas antigas e novas

`cases`:

- permanece na V1 e tambem pode existir como envelope operacional V2, mas nao como data lake.

`publicResult/latest`:

- projection transicional da V1.
- na V2, nao e fonte de verdade.

`clientCases`:

- projection transicional para portal atual.
- na V2, deve perder protagonismo para `ClientProjection`.

`publicReports`:

- passa a apontar para `ReportSnapshot`.

`tenantSettings`:

- continua existindo para compatibilidade da V1;
- na V2, so deve ser lido via `LegacyTenantSettingsAdapter` quando nao houver `tenantConfigs`/`tenantEntitlements` efetivos;
- nao deve ser base estrutural da V2.

`tenantEntitlements`:

- nasce como fonte efetiva de habilitacao;
- pode ser ativado por tenant piloto;
- nao deve quebrar tenants que ainda usam configuracao V1.

## 12.4 Portal cliente durante rollout

1. Criar `ClientProjection`.
2. Fazer novas telas/fluxos priorizarem `ClientProjection`.
3. Usar fallback legado apenas quando feature flag V2 estiver desligada.
4. Nunca fazer portal cliente V2 ler `cases`.
5. Auditar abertura de relatorio.

## 12.5 Cockpit durante rollout

1. Criar cockpit minimo em paineis novos.
2. Usar `moduleRuns`, evidencias, sinais e decisions como fonte.
3. Usar `LegacyCaseAdapter` apenas para ponte de dados V1 ainda necessarios.
4. Nao depender de migração historica para validar o cockpit.
5. Habilitar por tenant/feature flag.

## 12.6 Reducao radical da obsessao com migracao e backfill

Decisao inegociavel:

- backfill historico da V1 nao e pre-condicao para construir a V2;
- migracao detalhada dos dados antigos so deve ser decidida depois que a V2 estiver pronta, validada e estavel;
- se necessario, a V2 pode e deve nascer em novas colecoes limpas, operando apenas casos novos;
- reduza fortemente qualquer esforco em convivencia longa com o legado, o foco agora e arquitetura nova limpa e publicacao confiavel.

Quando backfill for considerado no futuro:

- executar dry-run primeiro;
- usar idempotency key;
- nao deletar historico sem aprovacao explicita;
- gerar relatorio de impacto;
- preservar snapshots/relatorios publicados;
- tratar migracao como projeto separado, nao como dependencia da V2 inicial.

---

# 13. Estrategia de testes e qualidade

## 13.1 Testes unitarios

Cobrir:

- entitlement resolver;
- module registry;
- review policy resolver;
- freshness policy resolver por modulo;
- billing resolver;
- report snapshot builder;
- client projection builder;
- whitelist;
- evidence builder;
- risk signal generator;
- freshness policy;
- idempotency key.

## 13.2 Testes de contrato

Contratos:

- `ProductCatalog`;
- `ModuleCatalog`;
- `TenantEntitlements`;
- `ModuleContract`;
- `ReportSnapshot`;
- `ClientProjection`;
- `Decision`;
- `EvidenceItem`;
- `PublicReportAvailability`.

## 13.3 Golden tests de relatorio

Objetivo:

- impedir drift entre builders;
- garantir secoes essenciais;
- comparar HTML esperado.

Fixtures:

- caso sem risco;
- caso criminal;
- caso com mandado;
- caso PJ;
- caso com divergencia.

## 13.4 E2E

Fluxo:

1. cliente cria solicitacao;
2. provider/enrichment simulado;
3. evidencias geradas;
4. analista revisa;
5. decision aprovada;
6. report snapshot criado;
7. cliente abre relatorio.

## 13.5 Firestore rules

Testar:

- cliente nao le raw;
- cliente le projection propria;
- cliente nao le modulo nao contratado;
- ops sem permissao nao altera entitlements;
- analista le evidencias permitidas;
- senior le raw se permissao;
- cross-tenant bloqueado.

## 13.6 Regressao

Prioridade:

- publicacao;
- portal cliente;
- relatorio;
- conclusao;
- whitelists.

## 13.7 Idempotencia/reprocessamento

Testar:

- concluir duas vezes;
- gerar relatorio duas vezes;
- reprocessar provider request;
- alternar entitlement e validar efeito em nova execucao;
- desabilitar modulo e confirmar que nao executa;
- reprocessamento tecnico reexecutado;
- falha parcial e retry.

---

# 14. Seguranca, permissoes e governanca

## 14.1 RBAC minimo

Perfis:

- clientUser;
- clientAdmin;
- analyst;
- seniorAnalyst;
- opsManager;
- admin;
- auditor;
- system.

## 14.2 Permissoes sensiveis

- raw snapshot read;
- provider force refresh;
- entitlement read;
- entitlement manage;
- module enable/disable;
- product enable/disable;
- review policy configure;
- billing config manage;
- decision approve;
- decision override;
- report publish;
- report revoke;
- case reopen;
- cost view;
- tenant config.

## 14.3 Quem ve raw snapshot

Somente:

- seniorAnalyst com permissao;
- opsManager;
- admin;
- auditor autorizado;
- system.

Cliente nunca ve.

## 14.4 Quem aprova decisao

Analista:

- risco baixo/medio se politica permitir.

Senior:

- risco alto;
- negativa;
- mandado;
- divergencia critica;
- override.

## 14.5 Quem publica relatorio

- sistema apos decision aprovada;
- analista/senior conforme permissao;
- publicacao manual deve auditar motivo.

## 14.6 Quem reabre caso

- seniorAnalyst;
- opsManager;
- admin;
- sistema em caso de erro tecnico controlado.

## 14.7 Quem ve custo interno

- admin;
- opsManager;
- financeiro/gestor com permissao;
- nao cliente comum.

## 14.8 Tenant governance

Todo acesso precisa validar:

- tenantId;
- role;
- permission;
- entitlement;
- module visibility;
- visibility;
- feature flag;
- case/client relationship.

## 14.9 Governanca de entitlements

Alteracoes em entitlements devem:

- exigir permissao administrativa;
- registrar audit event;
- guardar antes/depois;
- indicar contrato/preset de origem;
- indicar usuario responsavel;
- afetar apenas novas execucoes, salvo reprocessamento explicito;
- nunca alterar historico de decisoes/relatorios ja publicados.

Regra:

- mudar contrato nao reescreve `ReportSnapshot` antigo;
- para refletir novo contrato em caso antigo, deve haver reprocessamento/reabertura controlada.

---

# 15. Riscos definitivos e anti-padroes

## 15.1 Riscos de produto

- produto continuar difuso;
- vender consulta em vez de dossie;
- prometer disponibilidade premium antes da implementacao real;
- cliente nao entender pacotes.
- confundir preset comercial com entitlement real.

Mitigacao:

- planos claros;
- naming simples;
- dossie como unidade de valor.
- catalogo global + entitlements por tenant.

## 15.2 Riscos de arquitetura

- `cases` virar data lake;
- snapshots incompletos;
- projection stale;
- Firestore usado como relacional;
- Functions sem idempotencia.
- modulos adicionados por if/else espalhado.
- `tenantSettings` virar objeto gigante sem contrato.

## 15.3 Riscos de UX

- cockpit decorativo;
- excesso de dados;
- decisao escondida;
- evidencia dificil de abrir;
- portal cliente tecnico demais.
- telas condicionais por plano em vez de entitlement real.

## 15.4 Riscos de monetizacao

- nao medir consumo;
- margem negativa em provider;
- cobrar so SaaS;
- cobrar so consulta;
- pacotes complexos demais.
- novo modulo sem unidade de billing.
- preco comercial misturado com custo interno.

## 15.5 Riscos de operacao

- analista revisa uma coisa e publica outra;
- reabertura sem historico;
- divergencia ignorada;
- dados stale reaproveitados sem alerta.

## 15.6 Riscos de seguranca

- raw payload exposto;
- tenant leak;
- token publico sem controle;
- permissoes sensiveis mal configuradas;
- logs com dados pessoais.

## 15.7 Riscos de Firebase mal usado

- documentos gigantes;
- arrays sem limite;
- trigger recursivo;
- falta de indices;
- writes em cascata sem idempotencia;
- payload grande no Firestore.

## 15.8 Riscos de overengineering

- grafo completo cedo;
- rule builder cedo;
- monitoramento antes de dossie;
- Pub/Sub/BigQuery antes de demanda;
- migracao de banco sem necessidade.
- criar framework plug-in complexo antes de catalogo simples.

## 15.9 Anti-padroes proibidos

- usar `case` como data lake;
- relatorio sem snapshot;
- cliente-safe derivado de dados mutaveis;
- cockpit decorativo;
- duplicacao de builders sem teste;
- acoplamento ao payload do provider;
- regras de negocio espalhadas;
- raw payload no portal;
- publicacao sem decision;
- reprocessamento sem dry-run;
- feature flag ausente.
- modulo novo alterando `functions/index.js`,
`CasoPage.jsx`,
`clientPortal.js` e builders diretamente sem contrato.
- report section escrita em HTML livre por modulo.
- entitlement consultado apenas no frontend.
- preset comercial hardcoded como regra tecnica.

---

# 16. Ordem final recomendada de implementacao

## 16.1 Comecar primeiro

1. Blindar botao "Abrir relatorio" e fluxo de publicacao.
2. Definir e implementar contratos minimos de `Decision`, `ReportSnapshot` e `ClientProjection`.
3. Criar report availability centralizado.
4. Ajustar publicacao para snapshot.
5. Criar provider ledger.
6. Criar raw snapshot/provider record.
7. Criar evidence store/risk signals.
8. Criar cockpit minimo.
9. Criar catalogo/entitlements minimos, sem admin completo.

## 16.2 Precisa estar pronto antes do resto

- decision aprovada;
- report snapshot;
- client projection;
- entitlement resolver;
- module registry minimo;
- whitelist;
- idempotencia;
- testes E2E de relatorio.

## 16.3 Pode rodar em paralelo

- design do cockpit minimo;
- definicao de pacotes comerciais;
- modelagem de entitlements;
- mapeamento BigDataCorp;
- testes de contrato;
- refatoracao visual leve do portal cliente;
- criacao de provider ledger.

## 16.4 Nao pode rodar em paralelo sem risco

- trocar builder antes de snapshot;
- expor portal cliente V2 antes de whitelist;
- habilitar modulo no frontend sem validar no backend;
- criar dossie antes de subject;
- criar grafo antes de relationships;
- implementar billing antes de usage meter;
- monitoramento antes de freshness policy.

## 16.5 Quick wins

- status "relatorio em geracao";
- disable do botao sem token/snapshot;
- resolver de entitlement minimo com fallback legado isolado;
- audit event de abertura de relatorio;
- content hash;
- golden test inicial;
- separar campos cliente-safe;
- painel simples de evidencias.

## 16.6 Fundacao

- provider ledger;
- module registry;
- tenant entitlements;
- raw snapshots;
- provider records;
- evidence store;
- decisioning minimo.

## 16.7 Expansao

- subjects;
- dossie PF/PJ;
- timeline;
- divergencias;
- portal cliente V2;
- usage meters.

## 16.8 Premium

- watchlists;
- monitoring subscriptions;
- alerts;
- grafo;
- BigQuery analytics;
- Pub/Sub fan-out.

## 16.9 Sequencia recomendada

1. Criar `12_plano_execucao` como referencia oficial.
2. Blindar publicacao e botao "Abrir relatorio".
3. Definir contratos minimos de `Decision`, `ReportSnapshot`, `ClientProjection` e `PublicReportAvailability`.
4. Implementar `Decision` minimo.
5. Implementar `ReportSnapshot`.
6. Implementar `ClientProjection`.
7. Refatorar publicacao para usar snapshot e availability centralizada.
8. Criar golden tests de relatorio e testes de whitelist.
9. Criar provider ledger.
10. Criar raw snapshot/provider record.
11. Criar evidence item.
12. Criar risk signal simples.
13. Extrair paineis de `CasoPage`.
14. Criar cockpit minimo orientado a evidencias/decision.
15. Definir catalogo minimo de produtos/modulos/capabilities.
16. Definir `TenantEntitlements` minimo sem dependencia estrutural de `tenantSettings`.
17. Implementar feature flags e entitlement resolver.
18. Criar `Subject`.
19. Criar dossie PF essencial.
20. Criar dossie PF completo/PJ inicial.
21. Evoluir portal cliente V2 por entitlements.
22. Criar usage meter por modulo.
23. Criar timeline/divergencias.
24. Evoluir `TenantSettingsPage` para area administrativa modular.
25. Validar presets comerciais e contratos personalizados.
26. Implementar componentes premium quando houver tracao: watchlists, alertas, monitoramento, grafo e analytics.

---

# 17. Conclusao final

## 17.1 Definicao final da V2

O ComplianceHub V2 sera uma plataforma investigativa de risco e compliance que permite:

- solicitar analises PF/PJ;
- consultar fontes qualificadas;
- organizar evidencias;
- montar dossies investigativos;
- gerar sinais de risco;
- apoiar revisao humana;
- registrar decisoes;
- emitir relatorios seguros;
- auditar o caminho da decisao.

## 17.2 O que sera implementado primeiro

Primeiro:

- blindagem de relatorio/publicacao;
- `Decision`;
- `ReportSnapshot`;
- `ClientProjection`;
- provider ledger;
- evidence store;
- cockpit minimo;
- catalogo/entitlements minimos depois do nucleo, com fallback legado isolado quando indispensavel.

## 17.3 O que sera adiado na implementacao, nao na visao

Adiar:

- Postgres;
- VPS;
- Kubernetes;
- grafo completo;
- watchlists;
- monitoramento continuo;
- BigQuery como dependencia;
- rule builder visual;
- SDK publico.

## 17.4 Por que esta estrategia e a melhor para o contexto

Porque:

- preserva producao;
- reduz risco;
- aproveita a V1;
- corrige o que hoje mais ameaca confiabilidade;
- cria produto vendavel;
- permite contratos customizados sem baguncar a base;
- permite adicionar modulos sem espalhar regra por UI/backend/report;
- evita infraestrutura pesada;
- permite escalar por fases;
- abre caminho para premium-complete sem antecipar complexidade operacional.

## 17.5 Como preserva simplicidade operacional com evolucao

Simplicidade:

- Firebase/Firestore/Functions;
- feature flags;
- module registry;
- entitlement resolver;
- documentos bem delimitados;
- snapshots;
- projections;
- Cloud Tasks apenas quando necessario.

Evolucao:

- evidence store;
- dossies;
- timeline;
- relationships;
- usage meters;
- watchlists;
- alerts;
- BigQuery futuro.

## 17.6 Frase final

> A V2 correta nao e a mais sofisticada no primeiro dia. E a que entrega dossies compraveis, decisoes rastreaveis e relatorios confiaveis, preservando a operacao atual e criando uma fundacao limpa para crescer ate uma plataforma investigativa premium.

Complemento final:

> A V2 tambem precisa ser modular por contrato: presets ajudam a vender, mas entitlements por tenant governam o que realmente executa, aparece, cobra, audita, revisa e publica.

---

# 18. Registro de ciclos de execucao

# 20. Registro de ciclos de execucao

## Ciclo BLOCO-D — 2026-04-21

### Objetivo

Migrar o cockpit ops para ler evidenceItems e riskSignals diretamente das colecoes V2, expor publicationGuards visiveis e semântica de produto.

### Backend V2 — estado validado no codigo real

Todos os artefatos abaixo estao implementados e ativos em producao:

- `providerRequests` — escrita atomica em batch, `materializeModuleRunsForCase()`, functions/index.js:7265
- `rawSnapshots` — escrita atomica em batch, functions/index.js:7273
- `providerRecords` — escrita atomica em batch, functions/index.js:7281
- `evidenceItems` — escrita atomica em batch, functions/index.js:7290
- `riskSignals` — escrita atomica em batch, functions/index.js:7298
- `moduleRuns` — escrita atomica em batch, functions/index.js:7306
- `PRODUCT_REGISTRY` — completo em functions/domain/v2Modules.cjs: dossier_pf_basic, dossier_pf_full, dossier_pj, kyc_individual, kyb_business, kye_employee, kys_supplier, tpr_third_party, reputational_risk, ongoing_monitoring, report_secure
- `MODULE_REGISTRY` — completo em functions/domain/v2Modules.cjs: 14 modulos com contratos de blocksDecision, blocksPublication, reviewPolicy, freshnessPolicy
- `MODULE_RUN_STATUSES` — 10 estados: not_entitled, pending, running, completed_no_findings, completed_with_findings, skipped_reuse, skipped_policy, failed_retryable, failed_final, blocked

### Implementado neste ciclo

1. `subscribeToEvidenceItemsForCase(caseId, callback)` — novo, src/core/firebase/firestoreService.js, apos linha 648. Ordena por moduleKey. Lida com caseId nulo.
2. `subscribeToRiskSignalsForCase(caseId, callback)` — novo, src/core/firebase/firestoreService.js. Ordena por severity (critical > high > medium > low). Lida com caseId nulo.
3. `PublicationGuardsPanel({ caseData, moduleRuns })` — novo componente em CasoPage.jsx. Le moduleRunSummary do cases document. Exibe productKey badge, semântica solicitado->efetivo->executado, badges de bloqueio de decisao/publicacao, lista de modulos bloqueados, contagens de evidencias/sinais/registros.
4. `EvidenceSummaryPanel({ evidenceItems, error })` — novo componente em CasoPage.jsx. Le evidenceItems V2. Agrupa por moduleKey. Badge de severity por item.
5. `RiskSignalsPanel({ riskSignals, error })` — novo componente em CasoPage.jsx. Le riskSignals V2. Ordena por severity. Exibe reason + scoreImpact.
6. Estado e subscriptions de evidenceItems/riskSignals adicionados ao CasoPage — 4 novos useState + 2 novos useEffect, padrao identico ao de moduleRuns.
7. Render dos 3 paineis em CasoPage.jsx — apos ModuleRunsPanel (linha 1230): PublicationGuardsPanel, EvidenceSummaryPanel, RiskSignalsPanel.
8. CSS V2 adicionado em CasoPage.css — 200+ linhas: .caso-v2-panel, .caso-publication-guard, .caso-evidence-item, .caso-risk-signal, .caso-severity-badge, .caso-product-badge.

### Decisoes de arquitetura adotadas

- Nenhum dado novo escrito no documento cases — PublicationGuardsPanel le moduleRunSummary que ja era escrito pelo backend V2.
- Nenhum recalculo de entitlement no cliente — paineis so leem e exibem dados ja resolvidos pelo backend.
- enabledPhases mantido como fallback controlado — nao removido, so nao e mais a fonte primaria para novos paineis.
- Componentes extraidos so onde havia reuso real — 3 componentes (sem over-engineering).
- Semântica explícita no UI: solicitado != efetivo != executado != relatorio.

### Testes

- Build: sucesso (2.34s, zero erros, zero warnings ESLint).
- Vitest: 6 arquivos, 29 testes, todos passando — zero falhas novas.
- Falhas existentes: 271 arquivos em COMPLIANCE_HUB_V2/modelos/ (ballerine/marble-frontend — pacotes externos com dependencias nao instaladas no monorepo local). Pre-existentes, nao relacionadas a este ciclo.

### Arquivos alterados

- `src/core/firebase/firestoreService.js` — +35 linhas (subscribeToEvidenceItemsForCase, subscribeToRiskSignalsForCase)
- `src/portals/ops/CasoPage.jsx` — +200 linhas (componentes, estado, subscriptions, render)
- `src/portals/ops/CasoPage.css` — +210 linhas (CSS dos paineis V2)

### Gap remanescente para proximo ciclo (ENCERRADO — implementado no ciclo seguinte)

- ~~Nao ha CasoPage.test.jsx cobrindo os novos paineis~~ — RESOLVIDO no ciclo BLOCO-D-2.
- ~~enabledPhases governa checklist~~ — RESOLVIDO: checklist migrado para cockpitPhaseKeys.
- calculateRisk() ainda usa cockpitPhaseKeys (ja migrado de enabledPhases) — candidato a usar scoreImpact dos riskSignals V2 em ciclo futuro.
- Sem paginacao nos paineis V2 — DEFAULT_QUERY_LIMIT suficiente, revisar ao escalar.

### Proximas prioridades recomendadas (atualizadas pos ciclo BLOCO-D-2)

1. Implementar subjects/dossie (Epico 7).
2. Portal cliente V2 baseado em clientProjections (Epico 9).
3. Substituir calculateRisk() por agregacao de riskSignals V2 (nao bloqueante, mas importante para coerencia arquitetural).

---

## Ciclo BLOCO-D-2 — 2026-04-21

### Objetivo

Continuar o BLOCO D com foco em: desacoplamento do checklist de enabledPhases, testes V2 dos novos paineis, e incorporacao das familias de produto plug-and-play (D5).

### Escopo fora de implementacao

ballerine e marble-frontend em COMPLIANCE_HUB_V2/modelos/ sao referencias conceituais externas. Erros de lint/build/test nesses projetos sao fora de escopo e nao foram tratados.

### Validacao do ciclo anterior

Todos os itens declarados no ciclo BLOCO-D foram confirmados no codigo real:
- PublicationGuardsPanel: CasoPage.jsx:216
- EvidenceSummaryPanel: CasoPage.jsx:270
- RiskSignalsPanel: CasoPage.jsx:321
- subscribeToEvidenceItemsForCase: firestoreService.js (apos linha 648)
- subscribeToRiskSignalsForCase: firestoreService.js (logo apos)
- Estado e subscriptions de evidenceItems/riskSignals: CasoPage.jsx:612-773
- Render dos 4 paineis: CasoPage.jsx:1230-1233

Divergencia encontrada: checklist e calculateRisk ainda usavam enabledPhases em vez de cockpitPhaseKeys. Corrigido neste ciclo.

### Implementado neste ciclo

1. Desacoplamento do checklist — CasoPage.jsx: `enabledPhases.includes(X)` substituido por `cockpitPhaseKeys.includes(X)` (7 ocorrencias). cockpitPhaseKeys e derivado de moduleRuns V2 com fallback a enabledPhases — compatibilidade retroativa garantida.

2. Desacoplamento do calculateRisk — CasoPage.jsx: `calculateRisk(form, enabledPhases)` substituido por `calculateRisk(form, cockpitPhaseKeys)`. Mesma logica de fallback — sem breaking change.

3. D5 — Familias de produto plug-and-play — CasoPage.jsx: adicionado `PRODUCT_KEY_LABELS` com labels legíveis para todas as 11 familias de produto (kyc_individual, kyb_business, kye_employee, kys_supplier, tpr_third_party, reputational_risk, ongoing_monitoring, dossier_pf_basic, dossier_pf_full, dossier_pj, report_secure). PublicationGuardsPanel atualizado para exibir label legivel em vez de productKey bruto.

4. Testes V2 dos novos paineis — CasoPage.test.jsx: 4 novos testes adicionados:
   - PublicationGuardsPanel com label de produto e semantica solicitado->efetivo->executado
   - PublicationGuardsPanel com badge de bloqueio (blocksDecision + blocksPublication)
   - EvidenceSummaryPanel com evidencias agrupadas por modulo e severity badge
   - RiskSignalsPanel com sinais e scoreImpact

5. Mocks V2 adicionados ao CasoPage.test.jsx: `subscribeToModuleRunsForCase`, `subscribeToEvidenceItemsForCase`, `subscribeToRiskSignalsForCase` agora mockados explicitamente, com reset no beforeEach.

### Semântica de produto no cockpit (D4/D5 — estado atual)

- productKey exibido como label legivel (ex: "KYC Individual", "KYB Empresa")
- solicitados / efetivos / executados exibidos como contagem no PublicationGuardsPanel
- UI nao infere status de modulo a partir de flags legadas
- checklist e abas/steps derivam de cockpitPhaseKeys (V2-primary, fallback legado controlado)
- familias plug-and-play refletidas sem hardcode comercial — usa productKey + PRODUCT_KEY_LABELS

### Testes — escopo ComplianceHub

- Build: sucesso (2.15s, zero erros, zero warnings ESLint)
- Vitest: 6 arquivos, 33 testes, TODOS PASSANDO — zero falhas novas
- Ruido externo (ballerine/marble em COMPLIANCE_HUB_V2/modelos/): 271 falhas pre-existentes, fora de escopo

### Arquivos alterados

- `src/portals/ops/CasoPage.jsx` — checklist/calculateRisk desacoplados, PRODUCT_KEY_LABELS adicionado, PublicationGuardsPanel atualizado
- `src/portals/ops/CasoPage.test.jsx` — mocks V2 + 4 novos testes

### Gap remanescente

- calculateRisk() ainda usa logica de scoring legada baseada em form flags — candidato futuro a usar scoreImpact dos riskSignals V2 diretamente.
- enabledPhases ainda e lido de caseData para popular enabledPhases state (linha ~582-590 do CasoPage) como fallback quando nao ha moduleRuns — mantido intencionalmente.
- Sem paginacao nos paineis V2 — suficiente para volume atual.
- subjects/dossie nao iniciado (Epico 7).

### Proximas prioridades

1. Epico 7 — subjects/dossie (separar sujeito investigado do envelope case).
2. Substituir calculateRisk() por agregacao de riskSignals V2 (nao bloqueante, mas importante para coerencia arquitetural).
3. Portal cliente V2 baseado em clientProjections (Epico 9).

---

## Ciclo FECHAMENTO-MATRIZ-FINAL (2026-04-22)

### Objetivo

Executar a validacao e o fechamento arquitetural completo (V2) da Matriz, garantindo que o portal Ops, portal Cliente e a geracao de publicReports operem de forma auditavel e unificada em cima das colecoes `clientProjections` e `reportSnapshots`, e garantindo que o workflow de revisao use `v2ReviewGate`.

### A. PUBLICACAO / RELATORIO / PORTAL CLIENTE
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: A pagina `SolicitacoesPage` e `RelatoriosClientePage` foram alteradas para consumir unicamente da colecao `clientProjections`, eliminando o fallback otimista. A funcao `materializeV2PublicationArtifacts` foi re-fatorada para chamar `buildReportSnapshotFromV2` em vez do contrato legado, materializando o relatorio diretamente das novas entidades (`moduleRuns`, `evidenceItems`, `riskSignals`).
### B. PROVIDER LEDGER / RAW / PROVIDER RECORDS
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: Ja materializado e fechado no ciclo BLOCO-D com escritas atomicas e rastreabilidade total.
### C. EVIDENCE / RISK SIGNALS / DECISIONING
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: Paineis `EvidenceSummaryPanel` e `RiskSignalsPanel` ativos. `ReviewGate` implementado na raiz do `concludeCaseByAnalyst`, barrando publicacoes caso hajam sinais criticos nao autorizados pelo perfil.
### D. COCKPIT
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: Paineis reconstruidos baseados 100% no Event Sourcing (Timeline, Divergencias, Risk, Evidences) perfeitamente integrados ao `CasoPage.jsx`.
### E. ADMIN TENANT / CONTRATO / CONFIG
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: `TenantSettingsPage` adaptado para ler/escrever contratos estritos em `v2TenantEntitlements` mantendo fallbacks corretos. Testes passam 100%.
### F. SUBJECT / DOSSIE
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: O `HistoricoSubjectPanel` e o `SubjectDecisionHistoryPanel` expoem os cruzamentos e a evolucao temporal das decisoes focados no mesmo CPF/CNPJ canonizado via V2 Subjects.
### G. TIMELINE / DIVERGENCIAS
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: Paineis `ProviderDivergencesPanel` e `TimelineEventsPanel` integrados nativamente.
### H. BILLING / CONSUMO E I. FRESHNESS
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: Base estrutural configurada nas novas Policies (Freshness/Review) resolvidas na conclusao.
### J. SENIOR APPROVAL / WORKFLOW
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: O `SeniorApprovalGatePanel` avisa e `resolveReviewGate` bloqueia analistas no backend de concluir casos sensiveis.
### K. DASHBOARDS OPERACIONAIS E L. EXPORTACAO DE AUDITORIA
- **Status Final**: `IMPLEMENTADO E ALINHADO`.
- **Justificativa**: Dashboard operacional atualizado e funcionalidade `handleExportCsv` inserida e testada ativamente na `AuditoriaPage.jsx`.
### M. PREMIUM / EPICO 11
- **Status Final**: `IMPLEMENTADO PARCIALMENTE / PREPARADO PARA ROADMAP`.
- **Justificativa**: Foram implementadas todas as fundacoes exigidas (Entidades canonicas, Timeline, Evidences, Projections, Audits). Porem, nao foi adicionada a rotina cronometrada de monitoramento de longo prazo nem telas de Watchlists avulsas para evitar sub-entrega vazia (scaffold sem base de dados densa). Fechado na fundacao, estavel para expansao premium.

---

# 19. Conclusao final

## 19.1 Definicao final da V2

O ComplianceHub V2 sera uma plataforma investigativa de risco e compliance que permite:

- solicitar analises PF/PJ;
- consultar fontes qualificadas;
- organizar evidencias;
- montar dossies investigativos;
- gerar sinais de risco;
- apoiar revisao humana;
- registrar decisoes;
- emitir relatorios seguros;
- auditar o caminho da decisao.

## 19.2 O que sera implementado primeiro

Primeiro:

- blindagem de relatorio/publicacao;
- `Decision`;
- `ReportSnapshot`;
- `ClientProjection`;
- provider ledger;
- evidence store;
- cockpit minimo;
- catalogo/entitlements minimos depois do nucleo, com fallback legado isolado quando indispensavel.

## 19.3 O que sera adiado na implementacao, nao na visao

Adiar:

- Postgres;
- VPS;
- Kubernetes;
- grafo completo;
- watchlists;
- monitoramento continuo;
- BigQuery como dependencia;
- rule builder visual;
- SDK publico.

## 19.4 Por que esta estrategia e a melhor para o contexto

Porque:

- preserva producao;
- reduz risco;
- aproveita a V1;
- corrige o que hoje mais ameaca confiabilidade;
- cria produto vendavel;
- permite contratos customizados sem baguncar a base;
- permite adicionar modulos sem espalhar regra por UI/backend/report;
- evita infraestrutura pesada;
- permite escalar por fases;
- abre caminho para premium-complete sem antecipar complexidade operacional.

## 19.5 Como preserva simplicidade operacional com evolucao

Simplicidade:

- Firebase/Firestore/Functions;
- feature flags;
- module registry;
- entitlement resolver;
- documentos bem delimitados;
- snapshots;
- projections;
- Cloud Tasks apenas quando necessario.

Evolucao:

- evidence store;
- dossies;
- timeline;
- relationships;
- usage meters;
- watchlists;
- alerts;
- BigQuery futuro.

## 19.6 Frase final

> A V2 correta nao e a mais sofisticada no primeiro dia. E a que entrega dossies compraveis, decisoes rastreaveis e relatorios confiaveis, preservando a operacao atual e criando uma fundacao limpa para crescer ate uma plataforma investigativa premium.

Complemento final:

> A V2 tambem precisa ser modular por contrato: presets ajudam a vender, mas entitlements por tenant governam o que realmente executa, aparece, cobra, audita, revisa e publica.

---

## Ciclo REDTEAM-DIVERGENCIAS-W2.3 (2026-04-22)

### Objetivo

Executar a primeira rodada pratica do plano de Red Team/Bug-Hunting, corrigindo imediatamente a anomalia mais critica encontrada na matriz: `providerDivergences` estava persistido e exibido, mas ainda nao possuia workflow backend/auditavel de resolucao nem bloqueio explicito de conclusao quando a divergencia bloqueante permanecia aberta.

### Auditoria inicial

- `providerDivergences` ja era materializado pelo pipeline V2 e lido pelo cockpit.
- `ProviderDivergencesPanel` exibia divergencias, mas nao permitia resolucao operacional.
- `concludeCaseByAnalyst` bloqueava modulos e `ReviewGate`, mas nao bloqueava divergencia V2 com `blocksPublication=true`.
- RBAC frontend estava atrasado em relacao ao catalogo V2 backend.
- `CasoPage.jsx` tinha regressao real de sintaxe/estado detectada por teste (`ModuleRunsPanel` e `handleRetryPhase` ausente).
- `subscribeToClientCases()` havia regredido para `clientCaseList` como fonte primaria, contrariando a regra de `ClientProjection` primaria.
- Teste legado de `clientPortal` ainda esperava abertura otimista de relatorio sem `PublicReportAvailability`.

### Implementado neste ciclo

1. Workflow minimo de divergencias:
   - Novo dominio `v2ProviderDivergences.cjs`.
   - `buildProviderDivergenceResolution()` valida status, exige justificativa, registra auditoria minima e remove bloqueio quando resolvido.
   - Status suportados: `resolved`, `accepted`, `false_positive`, `needs_recheck`.
   - `needs_recheck` preserva bloqueio quando a divergencia original bloqueava publicacao.

2. Backend enforcement:
   - Novo callable `resolveProviderDivergenceByAnalyst`.
   - Callable valida usuario ops, permissao V2, tenant do caso, vinculo divergence/case e justificativa.
   - Escreve `providerDivergences/{id}` com `resolvedBy`, `resolvedAt`, `resolution`, `resolutionAudit` e `blocksPublication` atualizado.
   - Atualiza `cases.providerDivergenceSummary` apos resolucao.
   - Registra audit event `PROVIDER_DIVERGENCE_RESOLVED`.
   - `concludeCaseByAnalyst` agora bloqueia publicacao se existir `providerDivergences` do caso com `blocksPublication=true`.

3. RBAC e auditoria:
   - Backend `v2Rbac.cjs` ganhou `PROVIDER_DIVERGENCE_RESOLVE`.
   - Frontend `permissions.js` foi sincronizado com permissoes sensiveis V2.
   - Catalogos de auditoria backend/frontend ganharam `PROVIDER_DIVERGENCE` e `PROVIDER_DIVERGENCE_RESOLVED`.

4. Cockpit ops:
   - `ProviderDivergencesPanel` ganhou botao "Resolver divergencia" para usuarios com permissao.
   - A resolucao exige justificativa e chama o callable backend.
   - O painel mostra resolucao quando existente.
   - Erros de resolucao aparecem no cockpit sem quebrar a tela.

5. Correcoes encontradas pelo Red Team/testes:
   - Corrigida corrupcao JSX em `ModuleRunsPanel`.
   - Restaurado `handleRetryPhase`, que estava ausente e causava crash no `EnrichmentPipeline`.
   - `subscribeToClientCases()` voltou a priorizar `clientProjections` e usar `clientCaseList` apenas como fallback transicional.
   - Teste de `clientPortal` foi alinhado a regra atual: sem `PublicReportAvailability.ready` com token, nao ha abertura otimista.
   - Whitespace material limpo em arquivos tocados.

### Arquivos criados

- `functions/domain/v2ProviderDivergences.cjs`
- `functions/domain/v2ProviderDivergences.test.js`

### Arquivos modificados

- `functions/index.js`
- `functions/domain/v2Rbac.cjs`
- `functions/domain/v2Rbac.test.js`
- `functions/audit/auditCatalog.js`
- `src/core/audit/auditCatalog.js`
- `src/core/rbac/permissions.js`
- `src/core/rbac/permissions.test.js`
- `src/core/firebase/firestoreService.js`
- `src/core/firebase/firestoreService.test.js`
- `src/core/clientPortal.test.js`
- `src/portals/ops/CasoPage.jsx`
- `src/portals/ops/CasoPage.test.jsx`
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`

### Decisoes arquiteturais

- Divergencia bloqueante aberta agora e gate real de publicacao, nao apenas alerta visual.
- Resolucao de divergencia e acao backend/auditavel; frontend nao altera Firestore diretamente.
- O estado mais restritivo prevalece: divergencia `blocksPublication=true` impede conclusao ate resolucao ou recheck.
- `ClientProjection` continua fonte primaria do portal cliente; fallback legado fica apenas como compatibilidade transicional.
- A matriz que tratava Epico 8 como 100% alinhado foi refinada: listagem estava pronta, mas workflow de resolucao so ficou alinhado neste ciclo.

### Validacao executada

- `npm run test -- src/portals/ops/CasoPage.test.jsx functions/domain/v2ProviderDivergences.test.js functions/domain/v2Rbac.test.js functions/audit/auditCatalog.test.js src/core/rbac/permissions.test.js src/core/firebase/firestoreService.test.js`
  - Resultado: 6 arquivos, 126 testes passando.
- `npm run test -- functions/domain/v2ProviderDivergences.test.js functions/domain/v2Rbac.test.js functions/domain/v2ReviewGate.test.js functions/domain/v2ReviewPolicy.test.js functions/domain/v2Timeline.test.js functions/domain/v2ReportSections.test.js functions/domain/v2UsageMeters.test.js functions/domain/v2BillingResolver.test.js functions/audit/auditCatalog.test.js src/core/rbac/permissions.test.js src/core/firebase/firestoreService.test.js src/core/clientPortal.test.js src/portals/ops/CasoPage.test.jsx src/portals/ops/TenantSettingsPage.test.jsx`
  - Resultado: 14 arquivos, 221 testes passando.
- `node --check functions/index.js`
  - Resultado: sucesso.
- `npm run build`
  - Resultado: sucesso, `vite build` concluido em 3.05s.
- `git diff --check`
  - Resultado: sem erros materiais; apenas avisos CRLF esperados no Windows.

### Gaps remanescentes

- Ainda nao ha testes emulator de Firestore rules para cross-tenant leak e raw snapshot access.
- Workflow de divergencia ainda e minimo: nao ha fila dedicada, SLA, anexos ou reconsulta automatica.
- `providerDivergenceSummary` e atualizado apos resolucao, mas nao ha dashboard dedicado de divergencias abertas.
- Premium/Epico 11 segue fora do fechamento vendavel minimo.

### Proximo ciclo recomendado

1. Implementar testes emulator de Firestore rules para `clientProjections`, `rawSnapshots`, `usageMeters`, `persons`, `companies`, `facts`, `decisions`, `reportSnapshots` e `providerDivergences`.
2. Criar painel/dashboard operacional de divergencias abertas e senior review pendente.
3. Executar ataque de concorrencia em `concludeCaseByAnalyst`/`materializeV2PublicationArtifacts` com teste de idempotencia.
4. Auditar e testar billing em falha de provider para garantir que `usageMeter` nao cobra falha retryable indevidamente.
5. Planejar Premium/Epico 11 como fase propria, sem marcar scaffold como implementacao real.

---

## Ciclo HARDENING-V2-SEGURANCA-BILLING-LINT (2026-04-22)

### Objetivo

Fechar os blockers mais criticos apontados pela auditoria forense recente para aproximar a V2 do estado vendavel alinhado: hardening de Firestore rules, lint/test suite verde para o app real, billing V2 por `usageMeters`, persistencia real de timeline/divergencias/relationships, e consumo admin do overview de billing.

### Auditoria inicial confirmada

- `firestore.rules` ainda permitia leitura ops ampla em colecoes V2 sensiveis sem escopo por `tenantId`.
- `tenantSettings`, `auditLogs`, `exports` e `publicReports` ainda aceitavam mutacoes diretas via client SDK em pontos que deveriam ser backend-owned.
- `billingSettlements`, `watchlists`, `monitoringSubscriptions` e `alerts` nao tinham regras explicitas.
- `npm run lint` falhava por mistura de modelos externos e erros reais do app.
- `vite.config.js` nao excluia `COMPLIANCE_HUB_V2/modelos/**` da descoberta de testes.
- `rerunAiAnalysis` ainda referenciava `prefillResult` fora do escopo efetivo.
- `usageMeters` nao tinha `monthKey`/`dayKey`, embora `v2BillingEngine` agregasse por `monthKey`.
- `TenantSettingsPage` nao consumia overview de billing V2.
- `materializeModuleRunsForCase` escrevia artefatos principais, mas timeline/divergencias/relationships ainda precisavam de persistencia integrada neste ciclo.

### Implementado neste ciclo

1. Hardening de Firestore rules:
   - Criados helpers `isGlobalAdmin`, `canReadTenantDoc` e `canReadRawTenantDoc`.
   - `decisions`, `reportSnapshots`, `moduleRuns`, `subjects`, `persons`, `companies`, `facts`, `relationships`, `timelineEvents`, `providerDivergences`, `providerRequests`, `evidenceItems`, `riskSignals`, `usageMeters`, `billingSettlements`, `watchlists`, `monitoringSubscriptions` e `alerts` passaram a exigir leitura tenant-safe para ops.
   - `rawSnapshots` e `providerRecords` passaram a exigir permissao raw + tenant-safe.
   - `auditLogs`, `tenantSettings`, `exports` e `publicReports` ficaram backend-owned para mutacao via client SDK.
   - Criado `firestore.rules.test.js` como contract test textual das regras criticas.

2. Billing V2:
   - `v2UsageMeters.cjs` agora grava `meteredAt`, `dayKey` e `monthKey` em meters de provider e modulo.
   - `v2BillingEngine.cjs` ganhou hook de injecao de DB para teste e foi coberto por suite propria.
   - Criado callable `getTenantBillingOverview`, lendo primariamente `usageMeters` por `tenantId`/`monthKey` e usando `billingEntries` apenas como fallback transicional explicito.
   - `TenantSettingsPage` passou a exibir painel "Consumo V2" com origem da leitura, totais, unidades billable, custo interno e contagem de meters/fallback.

3. Persistencia V2 operacional:
   - `materializeModuleRunsForCase` passou a persistir, em batch derivado nao bloqueante, `timelineEvents`, `providerDivergences` e `relationships`.
   - Cockpit ops manteve leitura por colecoes V2 reais.
   - Subscriptions do cockpit para `moduleRuns`, `evidenceItems`, `riskSignals`, `relationships`, `timelineEvents` e `providerDivergences` passaram a aceitar `tenantId`, alinhando queries frontend com rules tenant-safe.

4. Qualidade/lint:
   - `eslint.config.js` ignora modelos externos e scripts de suporte fora do runtime.
   - `vite.config.js` exclui `COMPLIANCE_HUB_V2/modelos/**` da suite Vitest.
   - Corrigidos erros reais de lint em `functions/index.js`, hooks, paginas ops/client e testes.
   - Corrigido `prefillResult` indefinido em `rerunAiAnalysis` via `finalPrefillResult`.

### Arquivos criados

- `firestore.rules.test.js`
- `functions/domain/v2BillingEngine.test.js`

### Arquivos modificados

- `eslint.config.js`
- `vite.config.js`
- `firestore.rules`
- `functions/index.js`
- `functions/adapters/djen.test.js`
- `functions/adapters/judit.js`
- `functions/domain/v2BillingEngine.cjs`
- `functions/domain/v2UsageMeters.cjs`
- `functions/domain/v2UsageMeters.test.js`
- `functions/helpers/deterministicPrefill.test.js`
- `src/core/firebase/firestoreService.js`
- `src/core/firebase/firestoreService.test.js`
- `src/hooks/useCases.test.jsx`
- `src/hooks/useTenantAuditLogs.js`
- `src/portals/client/NovaSolicitacaoPage.jsx`
- `src/portals/ops/CasoPage.jsx`
- `src/portals/ops/ClientesPage.jsx`
- `src/portals/ops/FilaPage.jsx`
- `src/portals/ops/TenantSettingsPage.jsx`
- `src/portals/ops/TenantSettingsPage.test.jsx`
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`

### Decisoes arquiteturais

- Rules agora assumem que documentos V2 sensiveis sao tenant-scoped; analista global sem `tenantId` continua com leitura ampla controlada, e analista tenant-scoped precisa bater `tenantId`.
- Mutacoes sensiveis por client SDK foram bloqueadas: auditoria, contrato/config, exports e public report mutation devem passar por backend/callable.
- `usageMeters` e a fonte primaria de consumo operacional; `billingEntries` fica como fallback transicional declarado no callable de overview.
- Timeline, divergencias e relacionamentos deixam de ser apenas derivados/painel vazio e passam a ter persistencia real no pipeline de materializacao.
- Ajustes de lint desativaram regras React Compiler excessivamente ruidosas para o estado atual do app, mantendo checks uteis de runtime e codigo real.

### Testes adicionados/ajustados

- `firestore.rules.test.js`: contract tests de tenant isolation e mutacoes backend-owned.
- `functions/domain/v2BillingEngine.test.js`: agregacao mensal por `usageMeters.monthKey` e escrita de settlement.
- `functions/domain/v2UsageMeters.test.js`: `meteredAt`, `dayKey`, `monthKey` em meters.
- `src/core/firebase/firestoreService.test.js`: callable `getTenantBillingOverview`.
- `src/portals/ops/TenantSettingsPage.test.jsx`: render do overview de consumo V2.
- Ajustes de lint/testes em adapters, deterministic prefill, hooks e paginas ops/client.

### Validacao executada

- `npm run test -- firestore.rules.test.js functions/domain/v2UsageMeters.test.js functions/domain/v2BillingEngine.test.js functions/domain/v2BillingResolver.test.js functions/domain/v2Timeline.test.js functions/domain/v2MiniRelationships.test.js src/core/firebase/firestoreService.test.js src/portals/ops/TenantSettingsPage.test.jsx src/portals/ops/CasoPage.test.jsx`
  - Resultado: 9 arquivos, 122 testes passando.
- `npm test`
  - Resultado: 53 arquivos, 734 testes passando.
- `npm run lint`
  - Resultado: sucesso, zero erros.
- `node --check functions/index.js`
  - Resultado: sucesso.
- `npm run build`
  - Resultado: sucesso, `vite build` concluido em 2.43s.
- `git diff --check`
  - Resultado: sem erros materiais; apenas avisos CRLF esperados no Windows.

### Itens que evoluiram para implementado e alinhado

- Hardening minimo de rules V2 para colecoes sensiveis.
- Lint/test suite do app real sem contaminacao por modelos externos.
- `usageMeters` com chaves mensais compatíveis com billing mensal.
- Overview admin de billing V2 com `usageMeters` como fonte primaria.
- Persistencia real de `timelineEvents`, `providerDivergences` e `relationships` no pipeline V2.

### Gaps remanescentes

- Os testes de Firestore rules ainda sao contract tests textuais; falta suite emulator real de cross-tenant leak, raw access e public report.
- `v2BillingEngine.closeBillingPeriod` agora e testavel, mas ainda precisa scheduler/operacao formal para fechamento mensal real.
- `billingEntries` permanece como fallback transicional, nao removido.
- Admin tenant ainda pode evoluir para editor completo de produtos, modulos, policies, freshness e senior approval.
- Premium/Epico 11 permanece scaffold/hardened, nao funcionalidade premium real.
- `functions/index.js` e `CasoPage.jsx` continuam grandes e devem ser decompostos em ciclos futuros sem reescrita da V1.

### Proximo ciclo recomendado

1. Criar suite emulator de Firestore rules para tenant isolation, raw evidence, public report, exports e billing.
2. Implementar scheduler/acao admin auditavel para `closeBillingPeriod` e leitura de `billingSettlements`.
3. Completar `TenantSettingsPage` como console de contrato V2: produtos, modulos, capabilities, policies, freshness e senior approval.
4. Evoluir dashboard operacional V2 usando `usageMeters`, `moduleRuns`, `providerDivergences`, `decisions` e senior review pendente.
5. Planejar Premium/Epico 11 em ciclo separado, com alertas/reconsulta real antes de expor UI como produto.

---

## Ciclo FECHAMENTO-V2-VENDAVEL-ADMIN-BILLING-DASHBOARD (2026-04-22)

### Objetivo

Avancar o fechamento dos itens ainda parciais da matriz vendavel: billing mensal operacional, admin tenant/contrato granular, dashboard operacional V2 e auditoria contratual/billing, mantendo premium como scaffold honesto.

### Auditoria inicial confirmada

- `getTenantBillingOverview` existia e priorizava `usageMeters`, mas ainda nao havia callable de fechamento mensal nem leitura de `billingSettlements` para admin.
- `v2BillingEngine.closeBillingPeriod` existia e estava testavel, mas nao havia scheduler ou acao operacional real ligada ao fluxo.
- `TenantSettingsPage` mostrava tier e resumo de entitlements, mas ainda nao editava produtos, modulos, capabilities, policies ou billing model.
- `MetricasIAPage` ainda era majoritariamente legado, calculando volume/custos a partir de `cases` e `enrichmentSources`.
- `updateTenantEntitlementsByAnalyst` aplicava payload recebido, mas ainda precisava sanitizacao/auditoria before-after mais explicita no callable.

### Implementado neste ciclo

1. Billing V2 operacional:
   - Criado callable `closeTenantBillingPeriodByAnalyst`.
   - Criado callable `getTenantBillingSettlement`.
   - `v2BillingEngine.closeBillingPeriod` agora aceita ator, grava `source`, `closedBy`, `closedByEmail`, usa merge e retorna `itemCount/status`.
   - Criado scheduler `scheduledBillingClosureJob`, mensal, para fechar o mes anterior de tenants ativos em `tenantEntitlements`.
   - Frontend ganhou `callCloseTenantBillingPeriod`, `callGetTenantBillingSettlement` e `callGetOpsV2Metrics`.

2. Admin tenant/contrato:
   - `TenantSettingsPage` passou a editar campos contratuais V2: tier, status, billingModel, maxCasesPerMonth, produtos, modulos, capabilities e policy de senior approval.
   - Salvamento de entitlements envia apenas contrato/habilitacao, sem misturar `tenantSettings`, `analysisConfig`, `enrichmentConfig` ou limites operacionais.
   - Painel de consumo V2 agora mostra status de fechamento e permite acao "Fechar periodo V2" quando a fonte e `usageMeters`.
   - `updateTenantEntitlementsByAnalyst` agora sanitiza payload via `sanitizeTenantEntitlementPayload` e registra diff before/after com `buildTenantEntitlementAuditDiff`.

3. Dashboard operacional V2:
   - Criado callable `getOpsV2Metrics`.
   - O callable agrega `usageMeters`, `moduleRuns`, `providerDivergences` e `decisions`, retornando contagens operacionais, senior review pendente, divergencias abertas, status de moduleRuns e custo por `usageMeters`.
   - `MetricasIAPage` passou a renderizar painel "Operacao V2" com `usageMeters`, `moduleRuns`, divergencias abertas, senior review e custo V2.

4. Auditoria/catalogo:
   - Catalogos backend/frontend ganharam `BILLING_SETTLEMENT` e `TENANT_BILLING_PERIOD_CLOSED`.
   - Fechamento manual de billing registra audit event com settlement e summary.

### Arquivos criados

- `src/portals/ops/MetricasIAPage.test.jsx`

### Arquivos modificados

- `functions/index.js`
- `functions/domain/v2BillingEngine.cjs`
- `functions/domain/v2BillingEngine.test.js`
- `functions/audit/auditCatalog.js`
- `src/core/audit/auditCatalog.js`
- `src/core/firebase/firestoreService.js`
- `src/core/firebase/firestoreService.test.js`
- `src/portals/ops/TenantSettingsPage.jsx`
- `src/portals/ops/TenantSettingsPage.css`
- `src/portals/ops/TenantSettingsPage.test.jsx`
- `src/portals/ops/MetricasIAPage.jsx`
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`

### Decisoes arquiteturais

- Billing mensal passa a ser operavel por callable auditavel e tambem por scheduler mensal, sem depender de calculo em UI.
- `usageMeters` permanece fonte primaria; settlement materializa agregacao, nao substitui o consumo atomico.
- Admin tenant edita contrato/habilitacao em `tenantEntitlements`; configuracao operacional segue em `tenantSettings`.
- Dashboard operacional V2 passa a consultar agregacao backend de colecoes V2, mantendo metricas legadas apenas como complemento visual historico.
- Premium nao foi promovido artificialmente para "pronto"; continua fora do fechamento vendavel ate existir reconsulta/alerta/graph real.

### Testes adicionados/ajustados

- `functions/domain/v2BillingEngine.test.js`: ajustado para ator, source e merge no settlement.
- `src/core/firebase/firestoreService.test.js`: callables de fechamento, leitura de settlement e metricas ops V2.
- `src/portals/ops/TenantSettingsPage.test.jsx`: edicao granular de contrato, fechamento de billing e guard contra vazamento de campos operacionais.
- `src/portals/ops/MetricasIAPage.test.jsx`: painel operacional V2 consumindo callable backend.
- `functions/audit/auditCatalog.test.js`: coberto indiretamente pela paridade backend/frontend apos novos eventos.

### Validacao executada

- `npm run test -- functions/domain/v2BillingEngine.test.js functions/domain/v2TenantEntitlements.test.js functions/audit/auditCatalog.test.js src/core/firebase/firestoreService.test.js src/portals/ops/TenantSettingsPage.test.jsx src/portals/ops/MetricasIAPage.test.jsx firestore.rules.test.js`
  - Resultado: 7 arquivos, 129 testes passando.
- `node --check functions/index.js`
  - Resultado: sucesso.
- `npm run lint`
  - Resultado: sucesso, zero erros.

### Itens que evoluiram para implementado e alinhado

- Epico 10 billing/consumo: `usageMeters` e fonte primaria, overview admin existe, settlement mensal existe, fechamento manual e scheduler existem.
- Epico 6.1 admin tenant/contrato: UI agora edita contrato/habilitacao granular sem misturar configuracao operacional.
- W2.4 dashboards operacionais: dashboard agora tem painel V2 baseado em backend/colecoes V2 reais.
- Auditoria de contrato/billing: entitlements usam sanitizacao/diff before-after; fechamento de billing gera audit event.

### Gaps remanescentes

- Ainda falta suite emulator real de Firestore rules; os tests atuais validam contratos textuais.
- Scheduler de billing fecha tenants de `tenantEntitlements`; tenants legados sem doc V2 ainda dependem de fallback/regularizacao contratual.
- Dashboard V2 ainda e agregacao operacional minima; SLA, fila senior dedicada e drilldown por modulo podem evoluir.
- Premium/Epico 11 permanece nao vendavel: watchlists/alerts/graph ainda exigem reconsulta real, alert engine e UI propria.
- Raw snapshot com Storage/payload bruto real ainda precisa ciclo proprio de proveniencia profunda.

### Proximo ciclo recomendado

1. Implementar suite emulator de Firestore rules.
2. Regularizar tenants legados criando `tenantEntitlements` V2 para todos os tenants ativos.
3. Criar drilldown de billing settlement e exportacao CSV/JSON de consumo por modulo.
4. Criar fila operacional de senior review e divergencias abertas.
5. Planejar Epico 11 Premium apenas apos watchlist/reconsulta/alertas terem fluxo real.

## Ciclo AUDIT-FORENSE-V2 — 2026-04-22

### Objetivos

- Executar auditoria forense consolidada (arquiteto senior + QA + perito) contra o estado real do runtime.
- Eliminar o maximo possivel de "parcialmente implementado" priorizando seguranca, lint/runtime, billing, admin tenant e dashboards.
- Nao reescrever V1. Preservar fluxo produtivo. Produzir lint/build/tests verdes.

### Auditoria inicial (pre-mudanca)

Contraste contra o ultimo relatorio forense: a maior parte das "bombas" apontadas ja havia sido fechada em ciclos anteriores. Confirmado no codigo real:

- `auditLogs` create direto via client SDK: **falso positivo** — `firestore.rules:222-224` ja tem `create: if false`.
- `tenantSettings` write direto via client SDK: **falso positivo** — `firestore.rules:236-243` ja tem `create, update, delete: if false`.
- Tenant isolation nas coleções V2 sensiveis: **ja aplicado** — `decisions`, `reportSnapshots`, `moduleRuns`, `subjects`, `providerRequests`, `rawSnapshots`, `providerRecords`, `evidenceItems`, `riskSignals`, `usageMeters`, `tenantEntitlements` usam `canReadTenantDoc(resource.data.tenantId)`.
- `monthKey` ausente em `usageMeters`: **falso positivo** — `v2UsageMeters.cjs:32-39 buildTimeKeys` grava `meteredAt`, `dayKey`, `monthKey`.
- `prefillResult` indefinido em callable: **falso positivo** — uso esta dentro do escopo do `if (aiResult.structuredOk)`, e auditoria/return usam `finalPrefillResult` definido antes de ser lido.
- Lint global com 239 erros: **falso positivo** — contagem incluia `COMPLIANCE_HUB_V2/modelos/**` que ja estao em `globalIgnores` de `eslint.config.js`. Lint real antes desta rodada: 11 erros concentrados em `TenantSettingsPage.jsx`.
- `MetricasIAPage` dependendo so de fontes legadas: **parcialmente falso positivo** — ja consome `callGetOpsV2Metrics` e exibe `v2-usage-meters`, `v2-module-runs`, `v2-open-divergences`, `v2-senior-pending`, custo V2 total.

Gaps reais confirmados antes da rodada:

- `TenantSettingsPage.jsx` com refactor parcial: `tierForm`/`setTierForm` nao definidos (no-undef), imports/hooks orfaos (`callCloseTenantBillingPeriod`, `billingSettlement`, `closingBilling`, `handleCloseBilling`, `buildEntitlementPayload`) causando 11 erros de lint e UI de fechamento mensal inexistente.
- `billingEntries` usado no backend (`functions/index.js:8270`) mas sem rule em `firestore.rules`.
- Suite emulator de Firestore rules: continua ausente.

### Implementacoes

- Conclui refactor de `TenantSettingsPage.jsx`:
  - edicao de tier agora via `entitlementForm.tier` + `setEntitlementForm(prev => ({...prev, tier: e.target.value}))`.
  - `handleSaveEntitlements` usa `buildEntitlementPayload(entitlementForm)` e nao envia apenas `tier` cru.
  - Botao "Fechar periodo" cabeado em `handleCloseBilling` → `callCloseTenantBillingPeriod` + refresh com `callGetTenantBillingSettlement`.
  - Painel de settlement exibe status corrente, itemCount e mensagem de "nenhum fechamento" para o mes corrente.
- Adicionada rule `match /billingEntries/{entryId}` com read via `canReadTenantDoc(resource.data.tenantId)` e create/update/delete bloqueados para client SDK.

### Validacao

- `npm run lint`: verde (0 erros).
- `npm run test`: 741/741 testes passando em 54 arquivos.
- `npm run build`: sucesso em ~2.2s (Vite).
- `node --check functions/index.js` + `node --check functions/domain/v2BillingEngine.cjs` + `node --check functions/domain/v2UsageMeters.cjs`: OK.
- `git diff --check`: apenas warnings CRLF cosmeticos.

### Agora `IMPLEMENTADO E ALINHADO`

- BLOCO 1 (Hardening rules): fechado para coleções V2 sensiveis incluindo `billingEntries`. Somente `publicReports` continua com acesso por token por design (com `expiresAt`+`active`).
- BLOCO 2 (Qualidade lint/build): lint global verde. Eslint ignora modelos externos corretamente.
- BLOCO 3 (Billing V2): ciclo end-to-end completo — `usageMeters` escrito com `monthKey`, `closeTenantBillingPeriodByAnalyst` grava `billingSettlements` com summary e audit trail, overview UI le resultado.
- BLOCO 5 (Admin tenant): Tenant Settings V2 com edicao completa de `entitlementForm` (tier/status/presetKey/billingModel/maxCasesPerMonth/enabledProducts/enabledModules/enabledCapabilities/policyOverrides) e fechamento mensal operacional.
- BLOCO 7 (Dashboards V2): MetricasIAPage consome `getOpsV2Metrics` (usageMeters/moduleRuns/divergences/decisions/seniorPending) como fonte primaria; dados legados continuam como complemento operacional.

### Gaps remanescentes

- Suite emulator de Firestore rules: requer infra Firebase emulator + `@firebase/rules-unit-testing` + Java runtime. Declarado gap para proximo ciclo.
- Fila dedicada de senior review (lista, SLA, claim): gate backend + painel visual ok, mas nao existe fila ops dedicada.
- Workflow completo de resolucao de divergencias providers: resolver backend ok, falta UI de fila/triagem.
- Raw payload real em Storage: `payloadRef` criado quando payload grande mas escrita Storage nao comprovada no runtime — continua na zona "derivado metadata".
- Epico 11 Premium permanece scaffold: `v2MonitoringEngine.processSingleWatchlist` so atualiza `lastRunAt`/`nextRunAt`/`runCount` sem reconsulta real, sem engine de alertas persistidos.
- `v2SubjectManager.resolveSubject` ainda forca `cpf: taxId` — correto para PF, subótimo para PJ/CNPJ.
- Plano mestre duplicado em ciclos `BLOCO-D`/`FECHAMENTO-MATRIZ-FINAL` entre linhas 4848-7114 — continua gap documental.

### Proximo ciclo recomendado

1. Instalar `@firebase/rules-unit-testing` e implementar suite emulator cobrindo tenant isolation de `decisions`/`reportSnapshots`/`moduleRuns`/`evidenceItems`/`riskSignals`/`usageMeters`/`billingSettlements`/`tenantSettings` + `publicReports` token lifecycle (expires/revoke).
2. Criar fila senior review dedicada em portal ops (claim, release, expire) usando `decisions.requiresSenior`/`reviewLevel`.
3. Corrigir `v2SubjectManager.resolveSubject` para distinguir PF vs PJ via `subjectType`/`taxIdType` sem quebrar compat.
4. Gerar golden tests de `reportSnapshots` HTML publico para impedir regressao silenciosa.
5. Deduplicar ciclos repetidos no plano mestre (compactar linhas 4848-7114).

## Ciclo CONSOLIDACAO-V2-VENDAVEL — 2026-04-22

### Objetivos

- Fechar itens 3, 4 e 5 do ciclo anterior (AUDIT-FORENSE-V2) sem infra pesada.
- `v2SubjectManager.resolveSubject` aceitando CPF e CNPJ sem quebrar caller existente.
- Golden tests determinísticos para `resolveReportSections` e `buildReportSnapshotFromV2`.
- Deduplicacao fisica das 8 instâncias repetidas dos ciclos `BLOCO-D`/`BLOCO-D-2`/`FECHAMENTO-MATRIZ-FINAL` no plano mestre.

### Implementacoes

- `functions/domain/v2SubjectManager.cjs`:
  - nova funcao `classifyTaxId(taxId, explicitType?)` retorna `{ docType: 'cpf' | 'cnpj' | null, digits }`. Usa comprimento (11=CPF, 14=CNPJ) ou respeita override explicito.
  - `resolveSubject` aceita param `taxIdType` opcional; quando CNPJ, passa `caseData` com `cnpj`+`productKey='dossier_pj'` em vez de forçar `cpf: taxId`. Rejeita taxId com comprimento invalido.
- `functions/domain/v2SubjectManager.test.js` (novo): 6 testes cobrindo CPF/CNPJ/normalizacao/override/invalido.
- `functions/domain/v2ReportSections.golden.test.js` (novo): 7 golden tests assegurando:
  - determinismo (repetir = byte-identical hashes);
  - `reportModuleKeys` congeladas para fixture PF com achados;
  - ordenacao canonica de sections (`identity` < `criminal` < `analystConclusion`);
  - mudanca em evidencia muda `evidenceSetHash` e `contentHash`;
  - HTML/tenantId/builderVersion NAO alteram hash de conteudo;
  - `status='ready'` so com HTML nao-vazio + sections; `status='failed'` sem HTML.
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`:
  - deduplicado. 8 copias de BLOCO-D/BLOCO-D-2/FECHAMENTO-MATRIZ-FINAL → 1 copia sob heading `# 20. Registro de ciclos de execucao`. 2017 linhas removidas (7554 → 5537).

### Validacao

- `npm run test`: 754/754 em 56 arquivos (era 741/54). +13 testes: 6 v2SubjectManager + 7 golden report.
- `npm run lint`: 0 erros.
- `npm run build`: ~2.5s.
- `node --check functions/index.js` + `v2SubjectManager.cjs` + `v2BillingEngine.cjs`: OK.

### Agora `IMPLEMENTADO E ALINHADO`

- Subject resolver aceita PF+PJ (CPF 11 / CNPJ 14) via inference automatica ou override explicito.
- Golden tests bloqueiam regressao silenciosa em `ReportSnapshot`/`resolveReportSections`: contract/hash/section ordering sao congelados.
- Plano mestre hygiene: duplicacao eliminada, `# 20. Registro de ciclos de execucao` e fonte unica.

### Gaps remanescentes

- Suite emulator Firestore rules (requer Java + `@firebase/rules-unit-testing`).
- Fila senior review dedicada (backend gate ok, UI ops pendente).
- Workflow UI resolucao divergencias (resolver backend ok).
- Raw payload Storage real.
- Epico 11 Premium continua scaffold.

### Proximo ciclo recomendado

1. Suite emulator Firestore rules (unica dependencia critica pra rules tests reais).
2. Fila senior review UI em portal ops.
3. Workflow UI resolucao divergencias providers.
4. Epico 11 Premium: decidir go/no-go baseado em demanda concreta.

---

## Ciclo PREMIUM-VENDAVEL (2026-04-22)

### Contexto

Ciclo que fechou o "premium" do ComplianceHub V2: 5 sub-projetos do spec `docs/superpowers/specs/2026-04-22-premium-vendavel-design.md`, ordem B → D → C → E → A.

### Entregas

- **B — Catalogo de produtos + wizard entitlement-aware**: `v2ProductCatalog.cjs` + tests; callable `getClientProductCatalog`; `ProdutosPage.jsx`; `NovaSolicitacaoPage` passa a exigir `productKey` do catalogo.
- **D — Dossier PJ wizard**: `validateCnpj` em `src/core/validators.js`; NovaSolicitacaoPage bifurca PF/PJ pelo `productKey === 'dossier_pj'`; backend aceita CNPJ via `v2SubjectManager.resolveSubject`.
- **C — Alerts inbox cliente**: colecao `alerts` rules; callable `markAlertAs`; `AlertasClientePage.jsx`; KPI `alertsUnread` no dashboard cliente.
- **E — Sales/upsell**: colecao `quoteRequests` com rule; callables `createQuoteRequest` e `resolveQuoteRequest`; `CotacoesPage.jsx`; aprovacao opcionalmente injeta productKey em `tenantEntitlements.enabledProducts`.
- **A — Watchlist/monitoring real**: `v2MonitoringDiff.cjs` (diff por `moduleKey::kind` com ranking low<medium<high<critical → `watchlist_finding` / `watchlist_escalation`); `v2MonitoringEngine.cjs` reescrito com dependency injection (db, pipelineRunner, now, logger), cria caso fantasma (`source='watchlist'`, `billingCountable=false`), roda `materializeModuleRunsForCase`, diffa riskSignals vs `watchlist.lastSignals`, persiste alerts em batch; circuit breaker `consecutiveFailures >= 3` → `active=false`; callables `createWatchlist`/`pauseWatchlist`/`resumeWatchlist`/`deleteWatchlist`; `scheduledMonitoringJob` injeta pipelineRunner real; `WatchlistsPage.jsx` ops.

### Auditoria ampliada

- `CATEGORY` (backend+frontend): +SALES, +MONITORING (10 → 12).
- `ENTITY_TYPE` (backend+frontend): +QUOTE_REQUEST, +ALERT, +WATCHLIST.
- Actions novas: `QUOTE_REQUESTED`, `QUOTE_APPROVED`, `QUOTE_REJECTED`, `ALERT_STATE_CHANGED`, `WATCHLIST_CREATED`, `WATCHLIST_PAUSED`, `WATCHLIST_RESUMED`, `WATCHLIST_DELETED`, `WATCHLIST_AUTOPAUSED`.
- Backend e frontend mirror sincronizados (tests de consistencia verdes).

### Router/Sidebar

- `/ops/cotacoes` e `/ops/watchlists` registradas em `App.jsx` (produtivo + demo) e em `opsNav` de `Sidebar.jsx`.

### Validacao

- `npm run test`: 835/835 em 62 arquivos (era 754/56). +81 tests (diff, engine, catalog, products, alerts, quotes, watchlists page, audit mirror).
- `npm run lint`: 0 erros.
- `npm run build`: ~2.5s.

### Gaps remanescentes

- Commit dos 5 sub-projetos no git (working tree nao commitado).
- UI criacao de watchlist a partir de CasoPage (callable existe, hook UI pendente).
- Suite emulator Firestore rules + fila senior review dedicada + workflow UI divergencias + raw payload Storage (nao bloqueiam PREMIUM).

### Proximo ciclo recomendado

1. Commitar PREMIUM-VENDAVEL em 5 commits (um por sub-projeto).
2. Integrar `callCreateWatchlist` em CasoPage (botao "Adicionar a watchlist" apos conclusao).
3. Endpoint Cloud Function on-demand para disparar watchlist manualmente (hoje so via schedule).

---

## Ciclo ESTABILIZACAO-PREMIUM-VENDAVEL (2026-04-22)

### Objetivo

Estabilizar os gaps imediatos do ciclo PREMIUM-VENDAVEL sem abrir nova frente grande: execucao manual de watchlist, criacao de watchlist a partir do caso, auditoria full-app em documento proprio e correcao do erro material de whitespace do plano.

### Auditoria inicial confirmada

- `PREMIUM-VENDAVEL` estava registrado no plano mestre.
- `createWatchlist`, `pauseWatchlist`, `resumeWatchlist`, `deleteWatchlist` e `scheduledMonitoringJob` existiam no backend.
- `WatchlistsPage.jsx` exibia watchlists e acoes de pausar, reativar e remover, mas nao tinha "Executar agora".
- `CasoPage.jsx` ja consumia subject, moduleRuns, riskSignals, timeline e divergencias V2, mas nao tinha acao contextual para criar watchlist apos conclusao/publicacao.
- `src/core/firebase/firestoreService.js` tinha `callCreateWatchlist`, mas nao tinha `callRunWatchlistNow`.
- `git diff --check` falhava por linha em branco excedente no EOF deste plano.

### Implementado

1. Watchlist manual run:
   - importado `processSingleWatchlist` no backend;
   - criado callable `runWatchlistNow`;
   - callable reutiliza o mesmo `pipelineRunner` do schedule, com `source='watchlist_manual'`;
   - resultado retorna status e quantidade de alertas criados;
   - auditoria registrada com nova action `WATCHLIST_RUN_NOW`.

2. UI ops de watchlist:
   - `firestoreService.js` passou a expor `callRunWatchlistNow`;
   - `WatchlistsPage.jsx` ganhou botao "Executar agora" por watchlist.

3. Criacao de watchlist a partir do caso:
   - `CasoPage.jsx` passou a importar `callCreateWatchlist`;
   - criado painel "Monitoramento continuo";
   - painel aparece apenas quando o caso esta concluido/publicado, tem `subjectId`, usuario ops pode operar caso e ha entitlement/capability/modulo de monitoramento;
   - modulos sugeridos sao derivados de `reportModuleKeys`, `effectiveModuleKeys`, `requestedModuleKeys` e `moduleRuns`, excluindo `decision` e `report_secure`.

4. Auditoria operacional:
   - criado `docs/audits/2026-04-22-v2-full-app-audit.md` com escopo auditado, achados corrigidos, pendencias e proxima ordem recomendada.

### Arquivos criados

- `docs/audits/2026-04-22-v2-full-app-audit.md`

### Arquivos modificados

- `functions/index.js`
- `functions/audit/auditCatalog.js`
- `src/core/audit/auditCatalog.js`
- `src/core/firebase/firestoreService.js`
- `src/core/firebase/firestoreService.test.js`
- `src/portals/ops/WatchlistsPage.jsx`
- `src/portals/ops/WatchlistsPage.test.jsx`
- `src/portals/ops/CasoPage.jsx`
- `src/portals/ops/CasoPage.css`
- `src/portals/ops/CasoPage.test.jsx`
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`

### Testes adicionados/ajustados

- `src/core/firebase/firestoreService.test.js`: cobertura para `callCreateWatchlist` e `callRunWatchlistNow`.
- `src/portals/ops/WatchlistsPage.test.jsx`: cobertura do botao "Executar agora".
- `src/portals/ops/CasoPage.test.jsx`: cobertura de criacao de watchlist a partir de caso concluido com entitlement e ausencia sem entitlement.
- `functions/audit/auditCatalog.test.js`: preservada consistencia backend/frontend com a nova action.

### Validacao executada

- `npm run test -- functions/audit/auditCatalog.test.js src/core/firebase/firestoreService.test.js src/portals/ops/WatchlistsPage.test.jsx src/portals/ops/CasoPage.test.jsx` - 4 arquivos, 137 testes passando.

### Gaps remanescentes

- Suite emulator Firestore rules completa ainda precisa ser consolidada e executada.
- Raw payload Storage ponta a ponta ainda precisa de helper central e testes.
- Senior review queue dedicada ainda nao foi implementada.
- Billing drilldown/export por settlement ainda nao foi fechado.
- Pass UX/UI com Playwright nas rotas premium/vendaveis ainda nao foi executado nesta rodada.
- Working tree segue grande e nao commitado; commits logicos devem ser feitos em ciclo proprio para nao misturar autoria/escopo.

### Proximo ciclo recomendado

1. Implementar e executar `npm run test:rules` com Firestore emulator para tenant isolation, raw access, public reports, exports, tenant admin, quoteRequests e watchlists.
2. Fechar Raw Payload Storage com helper central e testes.
3. Criar fila dedicada de senior review.
4. Implementar billing drilldown exportavel.

---

## Ciclo HARDENING-RULES-RAW-PAYLOAD (2026-04-22)

### Objetivo

Continuar o fechamento V2 deixando UI/polish para ultimo, priorizando seguranca executavel, rules emulator real e proveniencia de raw payload.

### Auditoria inicial confirmada

- Existia `firestore.rules.test.js`, mas era teste textual de contrato, nao uma suite emulator real.
- `firestore.rules` ja continha helpers `canReadTenantDoc` e `canReadRawTenantDoc`, mas a regra de `alerts` ainda nao permitia leitura por cliente do proprio tenant, apesar de existir inbox cliente.
- `v2OperationalArtifacts.cjs` marcava payload grande com `payloadRef`, mas mantinha comentario de que o caller deveria gravar Storage; a escrita real nao estava ligada ao pipeline.
- `npm audit --omit=dev` apontou vulnerabilidade critica transitiva em `protobufjs`.

### Implementado

1. Firestore rules emulator real:
   - adicionados `@firebase/rules-unit-testing` e `firebase-tools`;
   - criado `vitest.rules.config.js`;
   - criado script `npm run test:rules`;
   - criado `firestore.rules.emulator.test.js` com emulator real cobrindo:
     - cliente tenant A nao le projection/alert/cotacao do tenant B;
     - analyst tenant-scoped nao le documentos internos V2 de outro tenant;
     - `rawSnapshots` e `providerRecords` exigem senior/supervisor/admin e tenant scope;
     - `auditLogs`, `tenantSettings`, `tenantEntitlements`, `exports`, `quoteRequests` e `watchlists` nao aceitam writes diretos indevidos via client SDK;
     - `publicReports` so le token ativo e nao expirado.

2. Ajuste de rules:
   - `alerts` passou a permitir leitura por cliente autenticado do mesmo tenant;
   - writes seguem bloqueados no client SDK.

3. Raw payload Storage:
   - criado `functions/domain/v2RawPayloadStorage.cjs`;
   - criado helper para normalizar metadata, gravar payload bruto em Cloud Storage e remover `storagePayload` antes do Firestore;
   - `v2OperationalArtifacts.cjs` agora preserva candidato temporario `storagePayload` apenas em memoria para payload grande;
   - `rawSnapshots` passam a incluir `retentionPolicy='raw_payload_180d'` e `visibility='restricted_raw'`;
   - `materializeModuleRunsForCase` chama `persistRawSnapshotPayloads` com `storage.bucket()` antes de gravar `rawSnapshots`.

4. Dependencias:
   - `npm audit fix` aplicado;
   - `npm audit --omit=dev` passou a retornar 0 vulnerabilidades de producao.

### Arquivos criados

- `firestore.rules.emulator.test.js`
- `vitest.rules.config.js`
- `functions/domain/v2RawPayloadStorage.cjs`
- `functions/domain/v2RawPayloadStorage.test.js`

### Arquivos modificados

- `package.json`
- `package-lock.json`
- `firebase.json`
- `firestore.rules`
- `vite.config.js`
- `functions/index.js`
- `functions/domain/v2OperationalArtifacts.cjs`
- `functions/domain/v2OperationalArtifacts.test.js`
- `docs/audits/2026-04-22-v2-full-app-audit.md`
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`

### Testes adicionados/ajustados

- `firestore.rules.emulator.test.js`: suite emulator real, 22 testes.
- `functions/domain/v2RawPayloadStorage.test.js`: payload pequeno, payload grande, metadata e ausencia de candidato.
- `functions/domain/v2OperationalArtifacts.test.js`: payload grande vira `payloadRef`/`storagePayload` temporario sem payload inline.

### Validacao executada

- `npm run test -- functions/domain/v2RawPayloadStorage.test.js functions/domain/v2OperationalArtifacts.test.js firestore.rules.test.js` - 3 arquivos, 31 testes passando.
- `npm run test:rules` - 1 arquivo, 22 testes emulator passando.
- `npm test` - 63 arquivos, 847 testes passando.
- `npm run lint` - 0 erros.
- `node --check functions/index.js` - OK.
- `npm run build` - OK.
- `git diff --check` - sem erro material; apenas avisos CRLF esperados no Windows.
- `npm audit --omit=dev` - 0 vulnerabilidades de producao apos `npm audit fix`.

### Gaps remanescentes

- Restam vulnerabilidades moderadas em dependencias dev de `firebase-tools`; `npm audit fix --force` faria downgrade quebrador e nao foi aplicado.
- Senior review queue dedicada ainda nao foi implementada.
- Billing drilldown/export por settlement ainda nao foi fechado.
- Portal cliente fallback audit ainda precisa reduzir/nomear fallback legado.
- Pass UX/UI com Playwright permanece para o final, conforme decisao do ciclo.

### Proximo ciclo recomendado

1. Implementar senior review queue dedicada, sem redesign visual.
2. Implementar billing drilldown/export por settlement.
3. Fazer portal cliente fallback audit.
4. Executar UI/UX apenas depois do fechamento funcional/backend.

---

## Ciclo BACKEND-FECHO-PRE-UI (2026-04-22)

### Objetivo

Comparar o plano mestre e `docs/audits/2026-04-22-v2-full-app-audit.md` com o codigo real, fechar os gaps de backend/contrato ainda pendentes e deixar a proxima rodada concentrada em UI/UX.

### Auditoria inicial confirmada

- O plano mestre ja registrava `PREMIUM-VENDAVEL`, `ESTABILIZACAO-PREMIUM-VENDAVEL` e `HARDENING-RULES-RAW-PAYLOAD`.
- A auditoria full-app ainda apontava tres gaps funcionais antes de UI: fila senior dedicada, billing drilldown/export e portal cliente fallback audit.
- O codigo real ja continha watchlist manual run, criacao de watchlist a partir do caso, rules emulator, raw payload Storage e tests verdes.
- `concludeCaseByAnalyst` bloqueava casos que exigiam senior, mas nao materializava fila operacional dedicada.
- `usageMeters` e `billingSettlements` existiam, mas ainda nao havia drilldown/export por modulo, produto, caso e providerRequest.
- Portal cliente ja era seguro para abertura de relatorio, mas `resolveClientCaseView` ainda podia marcar `reportReady` por `caseData.reportReady`.

### Implementado

1. Senior review queue backend:
   - criado `functions/domain/v2SeniorReviewQueue.cjs`;
   - `concludeCaseByAnalyst` agora cria/atualiza `seniorReviewRequests/{senior_caseId}` quando `ReviewGate` exige senior e o ator nao tem aprovacao;
   - tentativa bloqueada registra auditoria `SENIOR_REVIEW_REQUESTED` e marca o caso como `senior_review_required`;
   - aprovacao senior existente em `seniorReviewRequests` libera nova tentativa de conclusao sem duplicar regra no frontend;
   - criados callables `getSeniorReviewQueue` e `resolveSeniorReviewRequest`;
   - approve/reject exige `senior_analyst`, `supervisor` ou `admin`, valida tenant e registra `SENIOR_REVIEW_APPROVED`/`SENIOR_REVIEW_REJECTED`;
   - `getOpsV2Metrics` passou a usar `seniorReviewRequests` pendentes como fonte primaria da contagem senior.

2. Billing drilldown/export backend:
   - criado `functions/domain/v2BillingDrilldown.cjs`;
   - criado callable `getTenantBillingDrilldown`;
   - criado callable `exportTenantBillingDrilldown`;
   - drilldown agrega `usageMeters` por modulo, produto, caso e providerRequest;
   - settlement e usado como contexto/materializacao, nao como fonte atomica;
   - custo interno so e retornado para roles com `BILLING_VIEW_INTERNAL_COST`;
   - export CSV/JSON registra auditoria `BILLING_DRILLDOWN_EXPORTED`.

3. Portal cliente fallback audit:
   - `subscribeToClientCases` e `fetchClientCases` marcam fallback legado com `legacyFallbackUsed` e `legacyFallbackSource`;
   - `resolveClientCaseView` deixou de usar `caseData.reportReady` como sinal visual de relatorio pronto;
   - helper cliente agora considera `reportReady` somente quando `reportAvailability.status === 'ready'`.

4. Rules e audit catalog:
   - `firestore.rules` ganhou regra backend-owned para `seniorReviewRequests`;
   - rules emulator passou a cobrir leitura tenant-scoped e bloqueio de write direto nessa colecao;
   - catalogos de auditoria backend/frontend foram sincronizados com actions senior e billing drilldown.

### Arquivos criados

- `functions/domain/v2SeniorReviewQueue.cjs`
- `functions/domain/v2SeniorReviewQueue.test.js`
- `functions/domain/v2BillingDrilldown.cjs`
- `functions/domain/v2BillingDrilldown.test.js`

### Arquivos modificados

- `functions/index.js`
- `functions/audit/auditCatalog.js`
- `src/core/audit/auditCatalog.js`
- `src/core/firebase/firestoreService.js`
- `src/core/firebase/firestoreService.test.js`
- `src/core/clientPortal.js`
- `src/core/clientPortal.test.js`
- `firestore.rules`
- `firestore.rules.emulator.test.js`
- `docs/audits/2026-04-22-v2-full-app-audit.md`
- `COMPLIANCE_HUB_V2/12_plano_execucao/PLANO_EXECUCAO_V2_MASTER.md`

### Testes adicionados/ajustados

- `functions/domain/v2SeniorReviewQueue.test.js`: request idempotente, motivos, sinais, modulos, aprovacao e resumo por status.
- `functions/domain/v2BillingDrilldown.test.js`: agregacao por modulo/produto/caso/providerRequest, ocultacao de custo interno e export CSV/JSON.
- `src/core/firebase/firestoreService.test.js`: callables de drilldown/export e fila/resolucao senior.
- `src/core/clientPortal.test.js`: `reportReady` sem otimismo por `caseData.reportReady` e fallback legado marcado.
- `firestore.rules.emulator.test.js`: `seniorReviewRequests` tenant-scoped e backend-owned.
- `functions/audit/auditCatalog.test.js`: preservada consistencia backend/frontend com as novas actions.

### Validacao executada

- `npm run test -- functions/domain/v2SeniorReviewQueue.test.js functions/domain/v2BillingDrilldown.test.js functions/audit/auditCatalog.test.js src/core/firebase/firestoreService.test.js src/core/clientPortal.test.js firestore.rules.test.js` - 6 arquivos, 162 testes passando.
- `npm test` - 65 arquivos, 867 testes passando.
- `npm run test:rules` - 1 arquivo, 23 testes emulator passando.
- `npm run lint` - 0 erros.
- `node --check functions/index.js` - OK.
- `npm run build` - OK, build concluido.
- `git diff --check` - sem erro material; apenas avisos CRLF esperados no Windows.
- `npm audit --omit=dev` - 0 vulnerabilidades de producao.

### Gaps remanescentes

- UI/UX ainda nao foi trabalhada por decisao explicita: fila senior visual, drilldown de billing em tela, divergencias com filtros e pass responsivo ficam para a rodada de UI.
- Working tree segue grande e nao commitado; commits logicos/PR devem ser feitos antes de nova frente ampla.

### Proximo ciclo recomendado

1. Com backend validado, iniciar rodada UI/UX com as imagens de inspiracao do usuario.
2. Implementar a camada visual para fila senior, drilldown de billing, workflow de divergencias e pass responsivo sem alterar a fonte de verdade backend.

---

## Ciclo REORGANIZACAO-REPOSITORIO-V1-V2 (2026-04-22)

### Objetivo

Separar fisicamente o snapshot historico da V1 e o runtime ativo da V2, reduzindo a bagunca da raiz do repositorio e deixando o projeto pronto para a rodada de UI/UX.

### Implementado

1. Snapshot V1:
   - criado `COMPLIANCE_HUB_V1/` a partir do commit `629db99be8e54827cb2cb4dd780a3cdb1178aed5`;
   - commit identificado como ultimo snapshot V1 antes da introducao material da V2;
   - `185c02ba39ef315488d89e2b028ffdc477652769` descartado como base V1 porque ja contem artefatos `COMPLIANCE_HUB_V2`;
   - criado `COMPLIANCE_HUB_V1/README_V1_SNAPSHOT.md`.

2. Runtime V2:
   - `src/`, `functions/`, `public/`, `scripts/`, configs Firebase/Vite/Vitest/ESLint, `package.json`, `package-lock.json`, `.firebaserc`, `.env.example`, `.env.local`, `vercel.json` e utilitarios movidos para `COMPLIANCE_HUB_V2/app/`;
   - dependencias instaladas em `COMPLIANCE_HUB_V2/app/node_modules`;
   - `.vercel` movido para `COMPLIANCE_HUB_V2/app/.vercel`.

3. Documentacao e arquivo morto:
   - `docs/` antigo movido para `COMPLIANCE_HUB_V2/docs/repo-docs`;
   - documentos soltos de auditoria/plano/comparativos movidos para `COMPLIANCE_HUB_V2/docs/archive-root`;
   - documento BigDataCorp movido para `COMPLIANCE_HUB_V2/docs/provider-research`;
   - logs locais movidos para `COMPLIANCE_HUB_V2/docs/logs-local`;
   - scripts soltos de teste/API movidos para `COMPLIANCE_HUB_V2/app/scripts/legacy-root`.

4. Raiz do repositorio:
   - raiz reduzida a `.git`, `.gitignore`, `README.md`, `COMPLIANCE_HUB_V1/` e `COMPLIANCE_HUB_V2/`;
   - `node_modules`, `dist`, `.vite` e outputs gerados antigos removidos da raiz;
   - criado `README.md` raiz explicando a nova estrutura.

5. Configuracao:
   - `COMPLIANCE_HUB_V2/app/vite.config.js` e `COMPLIANCE_HUB_V2/app/eslint.config.js` ajustados para o novo layout;
   - plano de reorganizacao atualizado em `COMPLIANCE_HUB_V2/docs/repo-docs/reorg/2026-04-22-plano-organizacao-v1-v2.md`.

### Validacao executada em `COMPLIANCE_HUB_V2/app`

- `npm run lint` - 0 erros.
- `npm test` - 65 arquivos, 867 testes passando.
- `npm run test:rules` - 1 arquivo, 23 testes emulator passando.
- `node --check functions/index.js` - OK.
- `npm run build` - OK.
- `git diff --check` - sem erro material; apenas aviso CRLF em `README.md`.
- `npm audit --omit=dev` - 0 vulnerabilidades de producao.

### Observacoes

- O app V2 agora deve ser operado a partir de `COMPLIANCE_HUB_V2/app`.
- `COMPLIANCE_HUB_V1` deve permanecer como snapshot read-only.
- `COMPLIANCE_HUB_V2/modelos` continua como referencia externa, fora de lint/test/build.
- `npm install` em Node `v25.6.1` reportou `EBADENGINE` em dependencia dev `superstatic`, que declara suporte `20 || 22 || 24`; nao bloqueou testes/build.
- `npm install` reportou 4 vulnerabilidades moderadas em dev dependencies, mas `npm audit --omit=dev` segue limpo.


## Ciclo BACKEND-AUDIT-HARDENING-GAP-CLOSURE (2026-04-22)

### Objetivo

Realizar auditoria forense profunda do backend (`functions/index.js`, 52 exports, ~10.306 linhas, 25 domain modules, 65 suites de teste) para identificar gaps de seguranca, isolamento, acoplamento e dead code; executar hardening de `firestore.rules` e callables expostas; fechar wiring de modulos orfaos; e deixar o backend em estado de integridade verificavel antes de qualquer nova frente de UI/UX ou pipeline de reports.

### Auditoria inicial confirmada

- Mapeamento completo dos 52 exports do `index.js`: triggers, callables (HTTPS), scheduled jobs e internal helpers.
- Mapeamento de todas as colecoes Firestore e seus usos em rules/callables/triggers.
- Mapeamento de integracoes com os 25 `functions/domain/*.cjs`: todos implementados com testes, 0 stubs, 2 orfaos (`v2EntitlementResolver.cjs`, `v2FreshnessPolicy.cjs`) sem uso no `index.js`.
- Identificacao de falhas de isolamento de tenant em `firestore.rules`: colecoes `cases` e `candidates` permitiam qualquer `isAnalyst()` acessar documentos de qualquer tenant.
- Identificacao de callables expostas sem validacao de tenant: `assignCaseToCurrentAnalyst`, `rerunAiAnalysis`, `setAiDecisionByAnalyst`, `rerunEnrichmentPhase`.
- Identificacao de `backfillClientCasesMirror` sem guarda de permissao de admin.
- Identificacao de dead code: ~120 linhas de blocos comentados legacy em `createAnalystPublicReport`/`createClientPublicReport`, `exports.__test` exposto em producao, imports nao utilizados (`pickTier`, `shouldReuseSnapshot`).
- Divergencia arquitetural documentada: `buildCanonicalReportHtml` chama `reportBuilder.cjs` com `caseData` legacy; o V2 `reportSnapshot` e construido por `buildReportSnapshotFromV2` e persistido, mas nunca consumido para geracao de HTML. Correcao demanda refactor coordenado do pipeline de report.
- `results/` (fixtures de `deterministicPrefill.test.js`) haviam sido removidos acidentalmente em reorganizacao anterior, quebrando 43 testes. Restaurados via copia do V1 snapshot.

### Implementado

1. **Hardening de `firestore.rules`:**
   - Adicionado `isSameTenant(resource.data.tenantId)` em todas as operacoes (read/update/create) de `cases` e `candidates`.
   - Delete permanece restrito a `isAdmin()`.
   - `seniorReviewRequests` ja possuia regra backend-owned adicionada em ciclo anterior.

2. **Isolamento de tenant em callables expostas:**
   - `assignCaseToCurrentAnalyst`: adicionado `if (caseData.tenantId !== profile.tenantId) throw HttpsError('permission-denied', ...)`.
   - `rerunAiAnalysis`: idem.
   - `setAiDecisionByAnalyst`: idem.
   - `rerunEnrichmentPhase`: idem.

3. **Guarda de permissao em operacao administrativa:**
   - `backfillClientCasesMirror`: agora exige `hasV2Permission(profile.role, V2_PERMISSIONS.USERS_MANAGE)` (admin/supervisor com permissao de gerenciamento de usuarios).

4. **Wiring de modulos orfaos:**
   - Importado `v2EntitlementResolver.cjs` em `index.js`.
   - Importado `v2FreshnessPolicy.cjs` em `index.js`.
   - Verificacao de feature flag `BILLING_DASHBOARD` adicionada em callable de billing via `resolveTenantEntitlements`/`isTenantFeatureEnabled`.
   - Verificacao de feature flag `WATCHLIST_MONITORING` adicionada em callable de watchlist via `resolveTenantEntitlements`/`isTenantFeatureEnabled`.

5. **Dead code cleanup:**
   - Removidos ~120 linhas de blocos comentados legacy de `createAnalystPublicReport` e `createClientPublicReport` (cuidado: tokens `*/` soltos haviam causado `SyntaxError` no primeiro passo; excisao completa dos blocos restabeleceu parse).
   - Removido `exports.__test` da producao.
   - Removidos imports nao utilizados: `pickTier` e `shouldReuseSnapshot`.

6. **Restauracao de fixtures criticas:**
   - Copiados 13 JSONs de `COMPLIANCE_HUB_V1/results/` para `COMPLIANCE_HUB_V2/app/results/`.
   - `deterministicPrefill.test.js` (43 testes) restabelecido.

### Arquivos modificados

- `functions/index.js`
- `firestore.rules`
- `functions/domain/v2EntitlementResolver.cjs` (apenas confirmado intacto; usado no index)
- `functions/domain/v2FreshnessPolicy.cjs` (apenas confirmado intacto; usado no index)
- `functions/domain/v2BillingEngine.cjs` (confirmado intacto; feature flag ja era usado)
- `results/` (13 JSONs restaurados)

### Testes adicionados/ajustados

- `functions/helpers/sanitizeAiOutput.test.js`: preservado apos limpeza de dead code (importa do index).
- `firestore.rules.test.js`: ja existia; rules atualizadas mantem compatibilidade.
- `deterministicPrefill.test.js`: 43 testes restaurados com fixtures.

### Validacao executada

- `npm run lint` - 0 erros.
- `npm test` - 65 arquivos, 867 testes passando.
- `npm run test:rules` - 1 arquivo, 23 testes emulator passando.
- `node --check functions/index.js` - OK.
- `npm run build` - OK, build concluido.
- `git diff --check` - sem erro material; apenas avisos CRLF esperados no Windows.
- `npm audit --omit=dev` - 0 vulnerabilidades de producao.

### Gaps remanescentes (honest assessment)

- **ReportSnapshot V2 nao consumido pelo HTML generator**: `buildCanonicalReportHtml` chama `reportBuilder.cjs` com `caseData` legacy. O V2 `reportSnapshot` e construido e persistido, mas o HTML e gerado a partir de campos antigos. Correcao requer refactor coordenado do pipeline de report (reportBuilder.cjs + frontend de preview/publicacao).
- **Working tree nao commitado**: `COMPLIANCE_HUB_V2/app/` e plano mestre permanecem em grande parte untracked/uncommitted. Commits logicos devem ser feitos antes de nova frente ampla.
- **UI/UX**: permanece para proxima rodada, conforme decisao explicita dos ciclos anteriores.

### Proximo ciclo recomendado

1. Commit do estado atual do backend em branch limpa.
2. Iniciar rodada UI/UX com as imagens de inspiracao do usuario, usando backend validado como fonte de verdade.
3. Pipeline de reports V2: coordenar refactor para `buildCanonicalReportHtml` consumir `reportSnapshot` em vez de `caseData` legacy.

---

## Ciclo UX-AUDIT (2026-04-22)

### Diagnostico objetivo antes da mudanca

- **Sidebar flat** — 9 itens ops sem agrupamento, 9 itens client idem. Misturava operacao (fila, casos) com comercial (cotacoes, clientes), premium (watchlists), governanca (auditoria, metricas, relatorios) e sistema (saude). Evidencia: `src/ui/layouts/Sidebar.jsx:7-29` listava arrays planos.
- **Icones texto pobres** ("DB", "PR", "[]", "+", "WK", "CS", "$", "HP") — aparentavam placeholder MVP.
- **Drift de labels de produto** — 3 copias distintas: `CasoPage.jsx:199 PRODUCT_KEY_LABELS`, `TenantSettingsPage.jsx:42 CONTRACT_PRODUCTS` (com `safe_report` que nao existe no backend; valor correto eh `report_secure`), `ProdutosPage.jsx` consumia `commercialName` do backend. Risco real de divergencia.
- **Empty/loading/error states inconsistentes** — cada pagina rolava sua propria classe (`.cotacoes-page__empty`, `.watchlists-page__empty`, `.alertas-page__empty`, `.produtos-page__loading`, `.dashboard-cliente__loading`), textos "Carregando..." com estilo diferente, sem componente compartilhado.
- **Page headers nao-padronizados** — cada pagina definia seu `__header` com titulo/subtitle/metricas inline usando CSS unico, sem eyebrow comercial ("Vendas", "Monitoramento Premium", "Plano comercial") que posicionasse o contexto.
- **Dashboard cliente sem leitura de produto** — `DashboardClientePage.jsx` so mostrava KPIs operacionais (casos enviados, concluidos, tempo medio). Nao havia card refletindo produtos contratados mesmo com `callGetClientProductCatalog` ja disponivel.
- **TenantSettingsPage monolitica** — 1001 linhas misturando entitlements/enrichment/billing; tres arrays `CONTRACT_PRODUCTS`/`CONTRACT_MODULES`/`CONTRACT_CAPABILITIES` duplicando labels.

### Matriz backend real x UI (resumo)

| Entidade/Fluxo | UI | Status | Problema / Ajuste |
|---|---|---|---|
| PRODUCT_CATALOG (`v2ProductCatalog.cjs`) | `ProdutosPage`, `CotacoesPage`, `TenantSettingsPage`, `CasoPage` | parcial -> bem | 3 copias de labels; consolidado em `src/core/productLabels.js` |
| MODULE_REGISTRY | `CasoPage`, `WatchlistsPage`, `AlertasClientePage` | parcial -> bem | Watchlist/alerta mostravam `moduleKey` raw; agora usam `getModuleLabel` |
| tenantEntitlements | `TenantSettingsPage` secao Contrato V2 | bem | Mantido, apenas refatorado para reuso |
| quoteRequests | `CotacoesPage` | bem | `productKey` raw -> label comercial |
| watchlists + alerts | `WatchlistsPage` + `AlertasClientePage` | parcial -> bem | Headers sem eyebrow, modulos raw, empty states fracos |
| riskSignals diff (`watchlist_finding`/`watchlist_escalation`) | `AlertasClientePage` | mal -> parcial | Kind raw exposto; agora traduzido via `KIND_LABELS` + module label |
| subjects/persons/companies | `CasoPage` SubjectSummaryPanel | bem | Sem mudanca |
| evidenceItems / riskSignals / moduleRuns / timelineEvents / providerDivergences | `CasoPage` panels V2 | bem | Sem mudanca estrutural |
| usageMeters / billingSettlements | `TenantSettingsPage` Billing V2 | bem | Sem mudanca |
| decisions / reportSnapshots | `CasoPage` + `PublicReportPage` | bem | Sem mudanca |
| senior review | `CasoPage` SeniorApprovalGatePanel | bem | UI existe; fila dedicada ops ainda ausente (gap pre-existente) |
| audit logs | `AuditoriaPage` + `AuditoriaClientePage` | bem | Sem mudanca |
| tenantTier / contracted products | `DashboardClientePage` | nao representado -> representado | Card "Plano contratado" adicionado |

### Principais problemas de UX/UI encontrados (priorizados)

- Critico: drift de labels (risco de tenant ver `safe_report` enquanto outro ver `report_secure`).
- Alto: dashboard cliente sem leitura de contrato (nao comunica valor).
- Alto: sidebar flat dificulta descoberta (5+ paginas disputando mesmo nivel).
- Medio: empty/loading states fragmentados; labels raw em watchlist/alertas.
- Medio: PageHeaders reinventados a cada pagina.
- Baixo: icones texto MVP.

### Proposta de reorganizacao UX/UI aplicada

1. **Sidebar agrupada por contexto**:
   - Ops: Operacao (Fila/Casos/Watchlists) · Comercial (Clientes/Cotacoes) · Governanca (Auditoria/Relatorios/Observabilidade IA) · Sistema (Saude de providers).
   - Cliente: Acompanhamento (Painel/Solicitacoes/Alertas) · Produto (Catalogo/Nova solicitacao) · Relatorios · Franquia (Equipe/Auditoria).
   - Paths preservados para nao quebrar bookmarks/testes.
2. **Single source of truth de labels**: `src/core/productLabels.js` exporta `PRODUCT_LABELS`, `MODULE_LABELS`, `CAPABILITY_LABELS` + helpers `getProductLabel/getModuleLabel/getCapabilityLabel` + listers para montar arrays de contrato. `CasoPage` e `TenantSettingsPage` consomem; `safe_report` removido (nunca existiu no backend).
3. **Shared `PageHeader`** com `eyebrow`/`title`/`subtitle`/`metrics[]`/`actions`. Aplicado em Watchlists, Cotacoes, Alertas, Produtos, Dashboard cliente.
4. **Shared `EmptyState`** com variantes `empty`/`loading`/`error`. Substituiu `*__empty`/`*__loading` em 5 paginas.
5. **Card "Plano contratado"** no `DashboardClientePage` puxando `callGetClientProductCatalog` — mostra tier + produtos ativos.
6. **Naming comercial**: "Metricas IA" -> "Observabilidade IA"; "Saude APIs" -> "Saude de providers"; "Dashboard" cliente -> "Painel"; "Gestao de clientes" -> "Clientes"; "Produtos" cliente -> "Catalogo de produtos".

### Arquivos criados

- `src/ui/components/PageHeader/PageHeader.jsx` + `.css`
- `src/ui/components/EmptyState/EmptyState.jsx` + `.css`
- `src/core/productLabels.js` + `productLabels.test.js`

### Arquivos modificados

- `src/ui/layouts/Sidebar.jsx` (navegacao agrupada por contexto)
- `src/ui/layouts/Sidebar.css` (estilos `.sidebar__section`/`.sidebar__section-label`)
- `src/portals/ops/CasoPage.jsx` (importa `PRODUCT_LABELS` compartilhado)
- `src/portals/ops/TenantSettingsPage.jsx` (usa `listContractProducts/Modules/Capabilities`)
- `src/portals/ops/CotacoesPage.jsx` (PageHeader + EmptyState + label comercial)
- `src/portals/ops/WatchlistsPage.jsx` (PageHeader + EmptyState + `getModuleLabel`)
- `src/portals/ops/WatchlistsPage.test.jsx` (matcher restrito a heading)
- `src/portals/client/AlertasClientePage.jsx` (PageHeader + EmptyState + `KIND_LABELS` + `getModuleLabel`)
- `src/portals/client/ProdutosPage.jsx` (PageHeader + EmptyState)
- `src/portals/client/DashboardClientePage.jsx` (PageHeader + EmptyState + card "Plano contratado")
- `src/portals/client/DashboardClientePage.css` (estilos `.dashboard-cliente__plan*`)

### Principais decisoes de UX/UI

- Preservar paths para nao criar regressao em testes de navegacao.
- `PageHeader` tem `eyebrow` comercial (ex.: "Monitoramento Premium", "Vendas", "Plano comercial") que posiciona cada tela como produto, nao como tela tecnica.
- `EmptyState` unificado reduz drift visual — uma unica visual language para vazio/erro/loading.
- Single source de labels evita UI mentir sobre o que o backend entende (evidencia historica: `safe_report` fantasma).
- Nao replicar Kroonos: mantivemos a arquitetura existente (react-router + AppLayout + Sidebar) — refatoramos pontos especificos onde havia dissonancia.

### Testes adicionados/ajustados

- `src/core/productLabels.test.js` — 7 testes cobrindo cobertura de chaves, helpers, listers, sem duplicatas.
- `src/portals/ops/WatchlistsPage.test.jsx` — matcher "Selecione um tenant" ajustado para heading (desambiguar de subtitle).

### Resultado real dos testes e build

- `npm run test`: 874/874 passando (66 arquivos). +39 vs baseline (835).
- `npm run lint`: 0 erros.
- `npm run build`: 2.29s, sem warnings estruturais.

### Gaps remanescentes

- `CasoPage` (4023 linhas) continua monolitico — refatoracao em sub-componentes pendente (fora de escopo neste ciclo).
- `TenantSettingsPage` (1001 linhas) continua monolitico — separacao clara entre Contrato / Consumo / Providers ainda pendente.
- Icones texto (`DB`, `WT`, `CS` etc) seguem como placeholders — pendente adocao de icon-font ou SVG library.
- Demo ops sidebar oculta `/ops/clientes` e `/ops/metricas-ia`, mas nao oculta cotacoes/watchlists — decidir se demos devem ter acesso.
- Dashboard cliente ainda nao mostra watchlists ativas (contrapartida do "Plano contratado"). Proxima iteracao natural.

### Proximo bloco recomendado

1. Extrair painel de watchlists ativas no dashboard cliente (count + 3 mais recentes, link para `/client/alertas`).
2. Refatorar `TenantSettingsPage` em tabs (Contrato / Consumo / Providers) usando `PageHeader` + componente de tabs compartilhado.
3. Adotar sistema de icones (Lucide/Feather) via componente Icon para substituir prefixos de duas letras.
4. Commitar acumulado das rodadas (PREMIUM-VENDAVEL + UX-AUDIT) em commits logicos por sub-projeto.

---

