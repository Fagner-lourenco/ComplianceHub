# Avaliacao de Capacidade — 800 Solicitacoes/Dia

**Data:** 2026-06-01
**Escopo:** capacidade operacional do app para suportar 800 novas solicitacoes/dia, sem teste contra producao.

## Resposta curta

O app tem base tecnica para suportar 800 solicitacoes/dia em volume medio, mas isso ainda nao esta comprovado end-to-end para rajadas reais com enriquecimento externo.

800/dia equivale a aproximadamente:

- 33 solicitacoes/hora em media.
- 0,56 solicitacao/minuto em media.
- 1 solicitacao a cada ~108 segundos em media.

Esse volume medio e baixo para Firebase Functions Gen2 + Firestore. O risco nao e o CRUD principal; o risco esta em picos simultaneos, no documento unico `tenantUsage/{tenantId}`, no fan-out de triggers de enriquecimento e nas cotas/latencia dos providers externos.

## Evidencia local executada

Comando executado em emulador Firestore:

```bash
LOAD_TEST_TOTAL_CASES=800 LOAD_TEST_PAGE_SIZE=100 firebase emulators:exec --only firestore "node scripts/load-test-pagination.cjs"
```

Resultado:

```text
[SEED] Criando 800 casos...
[SEED] 500 casos criados...
[SEED] 800 casos criados.
[TEST] Pagina 1..8: 100 docs por pagina
[OK] Total correto: 800
[OK] Sem duplicatas
[RESULTADO] 8 paginas, 800 documentos, zero duplicatas
[CLEANUP] 800 documentos removidos.
[SUCESSO] Teste de carga concluido.
```

O script foi corrigido antes da execucao para respeitar o limite de 500 writes por batch do Firestore.

## O que essa evidencia prova

- A paginacao por cursor em `cases` aguenta um conjunto de 800 documentos sem duplicatas ou omissoes no emulador.
- O script de seed/cleanup local consegue criar e remover 800 documentos respeitando batches de 500 writes.
- O padrao de query `tenantId + createdAt + __name__` esta funcional para esse volume.

## O que essa evidencia nao prova

- Nao prova criacao real via `createClientSolicitation` sob carga.
- Nao prova execucao simultanea dos triggers de enriquecimento.
- Nao prova throughput contra Judit, Escavador, FonteData, BigDataCorp, DJEN ou OpenAI.
- Nao prova comportamento P95/P99 em staging/producao.
- Nao prova PDF/export sob concorrencia.

## Gargalos identificados

### 1. Hot document em `tenantUsage/{tenantId}`

Cada nova solicitacao chama `enforceTenantSubmissionLimits`, que executa uma transacao e escreve no mesmo documento `tenantUsage/{tenantId}` para incrementar `dailyCount` e `monthlyCount`.

Impacto:

- Para 800/dia distribuidos ao longo do dia, tende a ser seguro.
- Para importacao em massa ou muitos usuarios criando ao mesmo tempo para o mesmo tenant, pode haver contencao transacional.
- Esse e o principal gargalo interno para rajadas.

Recomendacao:

- Para suportar rajadas grandes, trocar contador unico por contador sharded por dia/tenant ou agregacao assíncrona.

### 2. Rate limit por usuario

`createClientSolicitation` usa `withRateLimit({ maxRequests: 10, windowMs: 60000, key: 'createSolicitation' })`.

Impacto:

- Um unico usuario nao consegue criar mais que 10 solicitacoes/minuto pelo callable.
- Varios usuarios do mesmo tenant ainda podem gerar concorrencia no mesmo `tenantUsage/{tenantId}`.

### 3. Fan-out de enriquecimento

Uma solicitacao pode disparar multiplas fases:

- Judit
- BigDataCorp
- Escavador condicional
- DJEN condicional
- FonteData como fallback
- OpenAI para classificacao/triagem

Impacto:

- 800 solicitacoes/dia podem virar milhares de chamadas externas/dia.
- A capacidade real depende mais das cotas e latencia dos providers do que do Firebase.

### 4. Functions Gen2 sem limites explicitos de instancia/concorrencia

As funcoes Gen2 usam timeouts altos e memoria adequada em partes pesadas, mas nao ha configuracao explicita de `maxInstances`/`concurrency` no arquivo auditado.

Impacto:

- Autoscaling ajuda em picos.
- Sem controle, picos podem pressionar providers externos e custo.
- Com `maxInstances` baixo demais, pode haver backlog/latencia.

### 5. Export/PDF sao fluxos separados

Export async e PDF tem funcoes dedicadas, com memoria maior em rotas pesadas. Isso reduz risco de bloquear criacao de solicitacao, mas ainda precisa de teste de concorrencia.

## Veredito

**Capacidade media de 800 solicitacoes/dia: provavelmente sim.**

**Capacidade comprovada end-to-end para 800/dia com picos, enriquecimento completo e providers reais: ainda nao.**

A arquitetura deve aguentar o volume medio, mas eu nao declararia producao pronta para SLA sem um teste de staging com:

- 800 criacoes via callable `createClientSolicitation` ou harness equivalente.
- Distribuicao realista: baseline constante e rajadas de 50-100 em poucos minutos.
- Providers mockados ou sandbox para medir o app sem depender de terceiros.
- Medicao de P50/P95/P99, erros, cold starts, contencao em `tenantUsage`, tempo ate caso `DONE` ou enriquecimento terminal.

## Recomendacoes antes de prometer 800/dia

1. Implementar load test de criacao via callable, nao apenas paginacao.
2. Adicionar contador sharded para `tenantUsage` se houver expectativa de importacao em massa ou rajadas.
3. Definir `maxInstances`/estrategia de concorrencia por provider para nao derrubar APIs externas.
4. Adicionar metricas para `createClientSolicitation`, cada trigger de enriquecimento e `runAutoClassifyAndAi`.
5. Testar em staging com providers mockados e dataset de 800-2.000 casos.
6. Separar capacidade em dois SLAs: "aceitar solicitacoes" e "concluir enriquecimento".
