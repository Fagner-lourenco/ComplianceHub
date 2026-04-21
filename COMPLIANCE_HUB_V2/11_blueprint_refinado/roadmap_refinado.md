# Roadmap refinado e executavel

## 1. Principio do roadmap

O roadmap deve evitar dois extremos:

- construir so arquitetura sem produto vendavel;
- construir so UI comercial sem base de evidencia.

Ordem recomendada:

1. blindar fluxo atual;
2. criar snapshot e projection;
3. encapsular BigDataCorp;
4. criar evidencia;
5. criar dossie;
6. melhorar cockpit;
7. empacotar produto e monetizacao;
8. evoluir para premium.

## 2. Fase 0: estabilizacao e contratos

### Objetivo

Garantir que a V1 nao quebre e que a V2 tenha trilho seguro.

### Entregaveis

- mapa final dos campos cliente-safe;
- contrato de `ReportSnapshot`;
- contrato de `Decision`;
- contrato de `ClientProjection`;
- feature flags V2;
- testes do fluxo `concluir -> publicar -> abrir relatorio`;
- validacao de whitelists.

### Backend primeiro

- ajustar conclusao/publicacao para usar snapshot;
- criar validações de completude;
- tornar publicacao idempotente.

### Frontend primeiro

- bloquear botao "Abrir relatorio" quando nao houver token/snapshot valido;
- mostrar status claro de relatorio em processamento;
- evitar drawer stale no portal cliente.

### Risco

Quebrar fluxo atual de cliente.

### Mitigacao

Feature flag e fallback para fluxo atual.

## 3. Fase 1: fundacao BigDataCorp/provider

### Objetivo

Separar consulta bruta, normalizacao e dominio.

### Entregaveis

- `ProviderRequest`;
- `RawSnapshot`;
- `ProviderRecord`;
- `NormalizerVersion`;
- idempotency key por consulta;
- retry/rate limit documentado;
- logs de auditoria por request.

### Backend primeiro

- provider contract;
- BigDataCorp connector;
- persistencia de raw snapshot;
- normalizer output versionado.

### Frontend primeiro

- status de consulta por modulo;
- indicador de dado reaproveitado vs novo;
- painel interno de consultas.

### Risco

Armazenar payload sensivel sem governanca.

### Mitigacao

Regras de acesso, hashes, mascaramento e retencao definida.

## 4. Fase 2: evidence store minimo

### Objetivo

Transformar provider records em evidencias e sinais rastreaveis.

### Entregaveis

- `EvidenceItem`;
- `Fact` simples;
- `RiskSignal`;
- link signal->evidence;
- viewer de evidencia no cockpit;
- audit events de revisao.

### Backend primeiro

- evidence builder;
- risk signal generator inicial;
- divergencias basicas.

### Frontend primeiro

- lista de evidencias-chave;
- painel de sinais;
- abrir evidencia a partir de sinal;
- marcar evidencia revisada.

### Risco

Criar evidencias demais e poluir cockpit.

### Mitigacao

Curadoria por relevancia e agrupamento por modulo.

## 5. Fase 3: subject e dossie minimo

### Objetivo

Separar sujeito/caso e permitir reuso.

### Entregaveis

- `Subject`;
- `Person`/`Company` minimo;
- vinculo case->subject;
- politica inicial de freshness;
- visual de dossie minimo;
- historico de consultas por sujeito.

### Backend primeiro

- resolver subject por identificador;
- criar/atualizar dossie;
- buscar snapshot reutilizavel.

### Frontend primeiro

- mostrar dossie no caso;
- indicar dados reutilizados;
- acao "forcar nova consulta" com permissao.

### Risco

Match incorreto de sujeito.

### Mitigacao

Comecar com identificadores fortes: CPF/CNPJ. Nome sozinho nao deve fazer merge automatico.

## 6. Fase 4: cockpit minimo operacional

### Objetivo

Transformar `CasoPage` em ferramenta de decisao.

### Entregaveis

- header operacional;
- painel de dossie;
- painel de evidencias;
- painel de sinais;
- painel de decisao;
- checklist de conclusao;
- report preview/status.

### Paralelizavel

- design de UI;
- contratos de dados;
- componentes de painel;
- testes de fluxo.

### Nao paralelizavel

- painel de evidencias depende de schema de evidencia;
- report status depende de snapshot;
- decisao depende de evidence set.

### Risco

Refatorar `CasoPage` grande demais de uma vez.

### Mitigacao

Extrair componentes sem mudar comportamento primeiro.

## 7. Fase 5: V2 vendavel

### Objetivo

Empacotar produto com dossie, relatorio e portal cliente.

### Entregaveis

- Dossie PF Essencial;
- Dossie PF Completo;
- Dossie PJ inicial;
- report composer;
- portal cliente com detalhe enriquecido;
- auditoria por decisao/relatorio;
- metricas de consumo por modulo;
- pacotes comerciais documentados.

### Monetizacao

- plano SaaS;
- consumo por consulta/modulo;
- preco por dossie;
- relatorio incluso ou adicional;
- usuarios/tenants como camada operacional.

### Risco

Produto continuar dificil de explicar.

### Mitigacao

Cada pacote deve ter entrada, saida, preco e promessa clara.

## 8. Fase 6: premium controlado

### Objetivo

Adicionar recursos avancados apenas apos a V2 vendavel provar tracao.

### Entregaveis

- mini-grafo evoluindo para grafo;
- watchlists;
- alert inbox;
- monitoramento configuravel;
- comparacao historica;
- dashboards gerenciais;
- regras configuraveis.

### Risco

Overengineering e custo de provider.

### Mitigacao

Validar com cliente pagante antes de construir.

## 9. Quick wins

- bloquear abertura de relatorio sem snapshot/token valido;
- unificar disponibilidade de relatorio no portal cliente;
- adicionar status "relatorio em geracao";
- criar hash simples do conteudo publicado;
- extrair builders de relatorio para testes golden;
- adicionar audit event para abrir relatorio;
- separar whitelist cliente-safe backend/frontend;
- criar painel simples de evidencias-chave na revisao;
- criar indicator "dado novo" vs "dado reaproveitado";
- documentar pacotes comerciais.

## 10. O que pode rodar em paralelo

- definicao de pacotes comerciais;
- design do cockpit;
- contratos de snapshot/projection;
- testes do fluxo atual;
- mapeamento de campos BigDataCorp;
- refatoracao visual leve do portal cliente.

## 11. O que nao pode rodar em paralelo sem risco

- alterar conclusao e publicacao ao mesmo tempo sem testes;
- trocar builder de relatorio antes de snapshot;
- implementar dossie antes de resolver subject;
- criar grafo antes de relationships;
- abrir cliente para novos dados antes de whitelist.

## 12. Migrações/backfills provaveis

- backfill de `Subject` a partir de `cases`;
- backfill de `Decision` minimo para casos concluidos;
- rebuild de `ReportSnapshot` para relatorios afetados;
- validacao de `publicReports` orfaos;
- recriacao de `clientProjections` para casos publicados;
- catalogacao de snapshots existentes quando houver material bruto recuperavel.

## 13. Testes obrigatorios

- unitario de whitelist cliente-safe;
- unitario de report snapshot builder;
- golden tests de report HTML;
- teste de `concludeCaseByAnalyst` idempotente;
- teste de report availability no portal cliente;
- teste de rules Firestore para raw/projection;
- E2E: criar solicitacao, enriquecer, revisar, concluir, abrir relatorio.

## 14. Roadmap 30/60/90 dias

### 30 dias

- blindagem de relatorio/publicacao;
- contratos de snapshot/projection;
- primeiro report snapshot;
- status correto no portal cliente;
- pacotes comerciais definidos;
- design do cockpit minimo.

### 60 dias

- provider ledger BigDataCorp;
- raw snapshots;
- provider records;
- evidence items;
- risk signals simples;
- cockpit minimo com evidencia e decisao.

### 90 dias

- subject/dossie minimo;
- reuso controlado;
- Dossie PF Essencial;
- Dossie PF Completo inicial;
- portal cliente V2;
- metricas de consumo;
- auditoria por decisao/relatorio.

## 15. Conclusao

O caminho mais seguro e construir uma V2 que ja pode ser vendida antes de ser sofisticada.

Prioridade:

> **relatorio confiavel, dossie compravel, cockpit util e monetizacao simples.**

