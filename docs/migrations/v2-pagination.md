# Migration Guide: Cursor Pagination V2

> **Status:** Phase A implementada localmente
> **Data:** 2026-05-29

## Diferença V1 vs V2

| Aspecto | V1 | V2 |
|---------|-----|-----|
| Paginação | Numérica (`page`, `pageSize`) | Cursor (`cursor`, `limit`) |
| Memória | Carrega tudo em memória (até 10k docs) | Sem acumulação em memória |
| `total`/`totalPages` | Sim (calculado por scan) | `null` (não retornado) |
| `stats` | Sim (calculado por scan) | `null` (não retornado) |
| Filtros textuais | Suportado (em memória) | Rejeitado ou fallback para V1 |
| Tie-breaker | Nenhum | `__name__` (document ID) obrigatório |
| Performance | Degrada com volume (>2k docs) | Constante O(limit) |

## V1 Continua Ativa

- `listOpsCases` (V1) **não foi alterada**
- `listClientCases` (V1) **não foi alterada**
- Frontend pode migrar gradualmente

## V2: Novas Callables

- `listOpsCasesV2`
- `listClientCasesV2`

### Parâmetros V2

```typescript
{
  tenantId?: string;      // Ops apenas; client ignora (vem do profile)
  cursor?: string | null;  // Cursor da página anterior
  limit?: number;          // Default: 50, Max: 500
  filters?: object;        // Filtros indexáveis
  sortField?: string;      // Default: 'createdAt'
  sortDir?: 'asc' | 'desc'; // Default: 'desc'
  fallbackToV1?: boolean;  // Usar V1 se filtro não suportado
}
```

### Retorno V2

```typescript
{
  cases: Case[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
  stats: null;
  total: null;
  totalPages: null;
  meta: {
    source: 'server';
    version: 'V2' | 'V1-fallback';
    fallbackUsed: boolean;
    // ... outros campos contextuais
  };
}
```

## Exemplo: "Carregar Mais"

```javascript
let nextCursor = null;
const allCases = [];

while (true) {
  const result = await callListOpsCasesV2({
    limit: 100,
    cursor: nextCursor,
    filters: { status: 'PENDING' },
  });
  
  allCases.push(...result.cases);
  nextCursor = result.nextCursor;
  
  if (!result.hasMore) break;
}
```

## Filtros Suportados (V2 Nativo)

### listOpsCasesV2
- `status` — indexável
- `risk` (riskLevel) — indexável
- `verdict` (finalVerdict) — indexável
- `dateFrom` / `dateTo` — aplicado em memória após paginação
- `queueOnly` — aplicado em memória
- `assigneeUid` + `assignment` — aplicado em memória

### listClientCasesV2
- `status` — indexável
- `verdict` (finalVerdict) — indexável
- `dateFrom` / `dateTo` — aplicado em memória

## Filtros NÃO Suportados (Requerem Fallback)

### listOpsCasesV2
- `searchTerm` — busca textual
- `enrichment` — status de enriquecimento
- `sla` — estado de SLA
- `assignment` sem `assigneeUid`

### listClientCasesV2
- `searchTerm` — busca textual

## Fallback Explícito

Se um filtro não suportado for necessário:

```javascript
const result = await callListOpsCasesV2({
  filters: { searchTerm: 'João' },
  fallbackToV1: true,  // Obrigatório para filtros não suportados
});
// result.meta.version === 'V1-fallback'
// result.meta.fallbackUsed === true
```

**Nunca há fallback silencioso.** Sem `fallbackToV1: true`, filtros não suportados retornam erro `invalid-argument`.

## Rollback para V1

Se V2 apresentar problemas, o frontend pode voltar a chamar V1 imediatamente:

```javascript
// Antes (V1)
const result = await callListOpsCases({ page: 1, pageSize: 50 });

// Depois (V2 com rollback)
const result = await callListOpsCases({ page: 1, pageSize: 50 });
// V1 continua existindo e operante
```

## Depreciação de V1

**V1 só será depreciada após:**
1. Frontend migrado 100% para V2
2. Período de validação de 3 meses estável
3. Comunicação prévia aos clientes
4. Plano de rollback documentado

## Índices Necessários

Os seguintes índices foram adicionados ao `firestore.indexes.json`:

| Collection | Campos |
|------------|--------|
| `cases` | `(tenantId ASC, createdAt DESC, __name__ DESC)` |
| `cases` | `(tenantId ASC, status ASC, createdAt DESC, __name__ DESC)` |
| `cases` | `(tenantId ASC, riskLevel ASC, createdAt DESC, __name__ DESC)` |
| `cases` | `(tenantId ASC, finalVerdict ASC, createdAt DESC, __name__ DESC)` |
| `clientCases` | `(tenantId ASC, createdAt DESC, __name__ DESC)` |
| `clientCases` | `(tenantId ASC, status ASC, createdAt DESC, __name__ DESC)` |
| `clientCases` | `(tenantId ASC, finalVerdict ASC, createdAt DESC, __name__ DESC)` |

**Deploy de índices ainda não realizado.** Deve ser feito em etapa separada antes de ativar V2 em produção.

## Checklist de Migração Frontend

1. [ ] Criar hook `useOpsCasesQueryV2` side-by-side com `useOpsCasesQuery`
2. [ ] Testar com feature flag
3. [ ] Migrar `useClientCasesQuery` para V2
4. [ ] Validar cursor com "Carregar mais"
5. [ ] Testar filtros suportados
6. [ ] Testar fallback explícito
7. [ ] Remover V1 após 3 meses estável
