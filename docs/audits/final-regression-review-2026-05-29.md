# Revisao Final de Regressao — 2026-05-29

## Resultado

Status: aprovado para proxima etapa de deploy controlado.

Validacoes executadas:

- `npm run lint`: 0 erros, 0 warnings.
- `cd functions && npm run lint`: 0 erros, 0 warnings.
- `npm test -- --run`: 65 arquivos, 891 testes passando.
- `cd functions && npm test -- --run`: 25 arquivos, 571 testes passando.
- `npm run build`: build Vite concluido com sucesso.

## Correcoes adicionais feitas nesta revisao

1. CPF em publicResult vs clientCases
   - `publicResult/latest` sem login nao publica CPF completo.
   - `clientCases` autenticado por tenant mantem CPF completo para busca por CPF.
   - Teste adicionado: `functions/publicResultPrivacy.test.js`.

2. Backfill de clientCases
   - Removido `merge: true` para evitar campos antigos/stale em casos reabertos.
   - Adicionada restricao para admin escopado nao executar backfill de outro tenant.
   - Lock agora usa `create()` quando disponivel para evitar corrida de concorrencia.

3. Sync de clientCases em casos concluidos
   - Auto-classificacao antes de `DONE` continua sendo ignorada para reduzir writes.
   - Em `DONE`, alteracoes em campos visiveis ao cliente voltam a sincronizar o espelho.

4. CasoPage debounce
   - Timer de debounce agora e limpo no unmount.
   - Conclusao de caso chama `flushAllDebouncedFields()` e monta payload com `formRef.current`.
   - `toggleVector()` atualiza `formRef.current` sincronicamente.

5. Mensagens do caso
   - Limite de 50 mensagens agora retorna as 50 mais recentes mantendo ordem ascendente na UI (`limitToLast`).

6. PDF renderer
   - Erro transiente ao iniciar Chromium nao envenena a instancia warm para sempre.
   - Teste de retry adicionado.

7. Realtime query limit
   - Limite geral voltou a 500 para evitar custo/memoria excessivos em collections amplas.
   - `cases` e `clientCases` mantem limite explicito de 5.000.

## Riscos remanescentes de escala

A implementacao atual reduz riscos imediatos e deve suportar melhor o volume atual e crescimento moderado, mas ainda nao e arquitetura final para muitos milhares de casos por tenant.

Pontos que precisam de uma fase dedicada antes de crescimento grande:

- `listOpsCases` e `listClientCases` ainda fazem scan paginado e filtragem em memoria ate 10.000 docs.
- `getClientExportCases` ainda retorna todos os casos filtrados em uma callable; exportacoes grandes devem virar job assincorno com artefato em Storage.
- Metricas de dashboard ainda devem migrar para agregados mensais/diarios precomputados.
- Enriquecimento externo precisa de backpressure real por provedor (Cloud Tasks/Pub/Sub + `maxInstances`).

Conclusao: ok para deploy controlado das correcoes atuais. Para garantir 800 solicitacoes/dia com historico crescendo por meses, priorizar uma Fase 5 de escala com cursor pagination, indexes e export assincorno.
