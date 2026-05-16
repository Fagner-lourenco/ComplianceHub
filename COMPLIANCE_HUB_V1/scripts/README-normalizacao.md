# Migração de Dados - Normalização Unicode

## Contexto

Após a implementação da normalização Unicode no backend (PR #XXX), todos os novos dados que entram no sistema são automaticamente convertidos de caracteres Unicode problemáticos (smart quotes, em-dash, etc.) para ASCII equivalente.

Este script migra os dados **já existentes** no Firestore para aplicar a mesma normalização.

## Caracteres Normalizados

| Original | Unicode | Substituição |
|----------|---------|--------------|
| `"` | U+201C | `"` |
| `"` | U+201D | `"` |
| `'` | U+2018 | `'` |
| `'` | U+2019 | `'` |
| `—` | U+2014 | `--` |
| `–` | U+2013 | `-` |
| `…` | U+2026 | `...` |
| ` ` | U+00A0 | ` ` |

## Campos Afetados

- `executiveSummary`
- `keyFindings` (array de strings)
- `criminalNotes`
- `laborNotes`
- `warrantNotes`
- `analystComment`
- `finalJustification`
- `processHighlights`
- `warrantFindings`
- `prefillNarratives.*` (executiveSummary, keyFindings, etc.)
- `reviewDraft.*` (mesmos campos)
- `aiStructured.*` (resumo, justificativa, recomendacao)

## Pré-requisitos

1. Node.js instalado
2. Firebase CLI autenticado (`firebase login`)
3. Acesso ao projeto `compliance-hub-br`

## Uso

### 1. Simulação (Dry Run) - Recomendado primeiro

```bash
node scripts/normalize-firestore-cases.cjs --dry-run
```

Este modo:
- Analisa todos os casos
- Mostra quais campos seriam modificados
- **Não faz nenhuma alteração** no Firestore

### 2. Simulação por tenant específico

```bash
node scripts/normalize-firestore-cases.cjs --dry-run --tenant-id=tenant-123
```

### 3. Execução real

```bash
node scripts/normalize-firestore-cases.cjs
```

⚠️ **Atenção**: A execução real modifica dados no Firestore. Faça backup antes se necessário.

### 4. Execução por tenant específico

```bash
node scripts/normalize-firestore-cases.cjs --tenant-id=tenant-123
```

## Saída do Script

O script mostra:
- Progresso a cada batch de 50 casos
- Para cada caso modificado:
  - ID do caso
  - Nome do candidato
  - Campos modificados (com preview do texto)
- Resumo final com totais

## Segurança

- O script usa PATCH (não sobrescreve o documento inteiro)
- Apenas campos com caracteres Unicode são modificados
- Rate limiting de 100ms entre atualizações
- Processamento em batches de 50 documentos

## Rollback

Como o script apenas normaliza caracteres Unicode para ASCII equivalente, o rollback seria manual. Recomenda-se:
1. Executar `--dry-run` primeiro e revisar a saída
2. Fazer backup dos dados se necessário
3. Executar em ambiente de staging primeiro (se disponível)

## Monitoramento

Após execução, verificar no portal do analista (CasoPage) se os campos editáveis estão corretos sem caracteres estranhos.
