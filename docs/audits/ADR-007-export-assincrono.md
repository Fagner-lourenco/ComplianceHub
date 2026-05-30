# ADR-007: Exportação Assíncrona com Cloud Storage

**Status:** Accepted
**Data:** 2026-05-29
**Decisores:** Equipe de Engenharia ComplianceHub

## Contexto

A exportação síncrona de casos gera arquivos grandes diretamente na memória do Cloud Function, causando timeouts e alto uso de memória.

## Decisão

Implementar exportação assíncrona com:

1. **Coleção `exportJobs`** — cada export é um documento com lifecycle
2. **Cloud Storage** — arquivo gerado em bucket temporário
3. **Polling** — cliente consulta status periodicamente
4. **Link assinado** — download seguro via URL pré-assinada
5. **Worker inline** — processamento no mesmo callable (sem Cloud Tasks)

## Lifecycle do Job

```
PENDING → PROCESSING → DONE
                     → ERROR
                     → CANCELLED
```

## Limites de Segurança

- **Max 3 jobs pendentes** por usuário
- **TTL 7 dias** para arquivos em storage
- **Cross-tenant validation** em todos os estágios
- **Sanitização CSV** com BOM UTF-8 e escape de fórmulas

## Callables Criados

- `createExportJob` — cria job e inicia processamento
- `getExportJobStatus` — consulta status e URL de download
- `listExportJobs` — lista jobs do usuário
- `cancelExportJob` — cancela job pendente
- `processExportJob` — worker interno (não exposto ao cliente)

## Formatos Suportados

| Formato | Status | Implementação |
|---------|--------|---------------|
| CSV | ✅ Pronto | `exportManager.buildCsvContent()` |
| XLSX | 🔄 Pendente | Documentado, requer biblioteca |
| PDF | 🔄 Pendente | Documentado, requer biblioteca |

## Testes

- 17 tests para `exportManager` helper
- 1 placeholder test para worker (pendente refactor do index.js)

## Próximos Passos

1. Implementar UI de jobs no frontend (`ExportacoesPage.jsx`)
2. Adicionar suporte a XLSX e PDF
3. Implementar notificações por email quando job concluir
