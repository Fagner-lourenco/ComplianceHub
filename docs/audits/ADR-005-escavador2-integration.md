# ADR-005: Escavador2 como Provedor Complementar Separado

**Status:** Accepted  
**Data:** 2026-06-12  
**Decisores:** Equipe de Engenharia ComplianceHub

## Contexto

A integração oficial com o Escavador (`escavador*`) está desabilitada em produção, mas permanece histórica e inalterada no código. Paralelamente, surgiu a necessidade de consultar uma API interna separada, referida como **Escavador2**, hospedada no Cloud Run (`escavador2-api-*.a.run.app`). A Escavador2 não é uma evolução ou substituta da integração oficial: ela é um provedor independente que deve coexistir sem modificar os campos e comportamentos legados do Escavador.

## Decisão

Implementar a Escavador2 como **provedor complementar e separado**, com seu próprio adapter, normalizer, helper de deduplicação, configuração por tenant, fase de enriquecimento e trigger. Toda a persistência nova deve usar **apenas campos `escavador2*`**.

- Adapter: `functions/adapters/escavador2.js` (HTTP client para a API interna).
- Normalizer: `functions/normalizers/escavador2.js` (mapeamento para `escavador2*`).
- Dedupe: `functions/helpers/deduplicateEscavador2.js` (comparação com BigDataCorp, Judit, DJEN e Escavador oficial).
- Config: `functions/modules/_shared/providerConfigs.js` (`enrichmentConfig.escavador2` por tenant).
- Fase de enriquecimento: `runEscavador2EnrichmentPhase` em `functions/modules/enrichmentPhases.js`.
- Trigger: `createEnrichEscavador2OnCaseHandler` em `functions/modules/enrichmentTriggers.js`.

A Escavador2 executa como **última fase do pipeline**, após BigDataCorp, Judit, Escavador (oficial, quando habilitado) e DJEN estiverem terminalizados.

## Regras

- **Segredo:** a chave `ESCAVADOR2_API_KEY` deve ser configurada via Firebase Secret / variável de ambiente e nunca commitada.
- **Custo:** `escavador2CostBRL` é sempre `0`.
- **Status terminal:**
  - `consulta.status = "DONE"` → `escavador2EnrichmentStatus = "DONE"`.
  - `consulta.status = "PARTIAL"` → `escavador2EnrichmentStatus = "PARTIAL"` (terminal, persiste dados parciais).
  - HTTP `502` ou erro local da API → `escavador2EnrichmentStatus = "FAILED"`, persiste `escavador2Error` e dispara classificação automática.
- **FAILED é não-bloqueante:** o pipeline continua e a classificação prossegue.
- **Classificação automática aguarda** enquanto `escavador2EnrichmentStatus` estiver em estado não-terminal (`PENDING`/`RUNNING`). Libera quando estiver `DONE`, `PARTIAL`, `SKIPPED` ou `FAILED`.
- **Desabilitação por tenant:** leitura de `tenantSettings/{tenantId}.enrichmentConfig.escavador2.enabled`. Quando desabilitado, a fase marca `SKIPPED`.
- **Deduplicação:** prioridade é (1) número CNJ completo, (2) número CNJ completo extraído, (3) metadados (área, tribunal, UF, classe/assunto, data) com tolerância de **90 dias**.
- **Raw payloads:** salvos apenas para auditoria interna (`escavador2RawPayloads`) e **nunca** expostos em snapshots públicos/cliente (`publicResult`, `clientCases`, etc.).
- **Campos `escavador*`** da integração oficial não devem ser reutilizados para a Escavador2.

## Consequências

### Positivas

- A integração oficial do Escavador permanece intacta para referência histórica e possível reativação futura.
- A Escavador2 pode ser ligada/desligada por tenant sem afetar outros provedores.
- Falhas na Escavador2 não quebram o pipeline nem bloqueiam a classificação.
- Deduplicação evita poluir o relatório com processos já encontrados por outras fontes.

### Negativas

- **Latência extra:** a fase roda ao final do enriquecimento, aumentando o tempo total do caso.
- **Timeout:** como é a fase final, a função Cloud Run/Functions deve suportar até **540s** para acomodar a consulta.
- **Manutenção duplicada:** report builder (`src/core/reportBuilder.js` e `functions/reportBuilder.cjs`) e prefill determinístico precisam espelhar os novos campos.
- **Relatório:** o relatório público/ops só menciona a Escavador2 quando há achados novos e não-duplicados; achados duplicados servem apenas para comparação.
- **Classificação:** a lógica de prontidão (`readiness`) e os sinais determinísticos precisam reconhecer `escavador2*` como entrada válida.

## Atualização 2026-06-28 — Modo assíncrono

A integração operacional do Escavador2 passou a preferir o endpoint `/escavador2/consultar/async`, com fila Cloud Tasks no serviço Escavador2 e callback para o ComplianceHub. A decisão detalhada está registrada em `docs/audits/ADR-011-escavador2-async-callback.md`.

## Próximos Passos

1. Criar adapter, normalizer e helper de deduplicação com testes unitários.
2. Adicionar configuração por tenant em `providerConfigs.js`.
3. Implementar fase e trigger finais em `enrichmentPhases.js` / `enrichmentTriggers.js`.
4. Integrar em `functions/index.js`, incluindo secret `ESCAVADOR2_API_KEY` e suporte a reprocessamento.
5. Atualizar `autoClassification.js`, `aiOrchestrator.js`, `aiHomonym.js`, report builders e allowlists de campos públicos.
6. Documentar no `AGENTS.md` que a Escavador2 é um provedor separado e não deve reutilizar campos `escavador*`.
