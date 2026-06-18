# ADR-006: Cursor Pagination V2 — Side-by-Side com V1

**Status:** Accepted
**Data:** 2026-05-29
**Decisores:** Equipe de Engenharia ComplianceHub

## Contexto

As listagens de casos (`listOpsCases` e `listClientCases`) carregavam todos os documentos em memória e filtravam no servidor. Isso não escala para grandes volumes.

## Decisão

Implementar cursor pagination real com:

1. **Helper `paginateFirestoreQuery`** com cursor composto (`fieldValue + docId`)
2. **Tie-breaker `__name__`** obrigatório para evitar duplicatas/omissões
3. **Encode Base64 URL-safe** para cursor opaque ao cliente
4. **V2 side-by-side com V1** — nenhuma breaking change
5. **Fallback explícito** para V1 quando filtros não suportados

## Contrato V2

```typescript
interface ListV2Request {
  filters?: {
    status?: string;
    dateFrom?: string;  // ISO date
    dateTo?: string;    // ISO date
  };
  sort?: {
    field: 'createdAt' | 'updatedAt' | 'concludedAt';
    direction: 'asc' | 'desc';
  };
  pagination?: {
    limit: number;      // 1-100, default 25
    cursor?: string;    // opaque Base64
  };
}

interface ListV2Response {
  data: Case[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
    limit: number;
  };
}
```

## Limitações Conhecidas

- **Sem `total` exato:** Não calcula total de documentos (evita scan)
- **Filtros textuais:** Requerem fallback para V1
- **Índices necessários:** Cada combinação `field + __name__` precisa de índice composto

## Índices Adicionados

7 índices compostos com `__name__` adicionados a `firestore.indexes.json` (não deployados).

## Callables Criadas

- `listOpsCasesV2` — portal ops com cursor pagination
- `listClientCasesV2` — portal cliente com cursor pagination

## Testes

- 21 tests para `paginateFirestoreQuery` helper
- 8 tests para `listOpsCasesV2`
- 7 tests para `listClientCasesV2`

## Próximos Passos

1. Deploy dos 7 índices Firestore
2. Migração gradual do frontend para V2
3. Deprecação de V1 em 3 meses
