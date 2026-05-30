# ADR-005: Modularização Phase C — Estrutura de Módulos

**Status:** Proposed
**Data:** 2026-05-29
**Decisores:** Equipe de Engenharia ComplianceHub

## Contexto

O monolito `functions/index.js` atingiu ~13.848 linhas com 61 exports, tornando-se difícil de manter, testar e entender. A Phase C do roadmap de refatoração propõe extrair módulos coesos do monolito.

## Decisão

Criar estrutura de diretórios em `functions/modules/` com os seguintes módulos:

```
functions/modules/
├── _shared/           # Utilitários compartilhados (comparação, ordenação, permissões)
├── caseManager/       # CRUD, filtros, busca, estatísticas de casos
├── enrichmentPipeline/ # Pipeline de enriquecimento (BDC, Judit, Escavador, etc.)
├── reportEngine/      # Geração de relatórios (HTML, PDF)
├── userManager/       # Gestão de usuários, roles, permissions
├── clientPortal/      # Portal do cliente, exports, visualizações
├── auditManager/      # Logs de auditoria, eventos
└── notificationManager/ # Notificações, comunicações
```

## Consequências

### Positivas
- **Testabilidade:** Cada módulo pode ser testado isoladamente
- **Manutenibilidade:** Alterações em um módulo não afetam outros
- **Onboarding:** Novos devs entendem o sistema por partes
- **Reusabilidade:** Módulos podem ser importados por scripts e ferramentas

### Negativas
- **Overhead inicial:** Criar estrutura e mover código leva tempo
- **Ciclo de importação:** Risco de circular dependencies entre módulos
- **Duplicação temporária:** Durante transição, funções existem em dois lugares

## Estratégia de Migração

1. **Criar estrutura** (feito)
2. **Extrair módulos puros** primeiro (sem dependências Firebase)
3. **Testar cada módulo** isoladamente antes de integrar
4. **Importar gradualmente** no monolito
5. **Remover do monolito** apenas quando 100% dos consumidores migraram

## Módulos Extraídos

| Módulo | Arquivos | Testes | Status |
|--------|----------|--------|--------|
| caseManager | `caseFilters.js` | `caseFilters.test.js` (15 tests) | ✅ Extraído |
| _shared | `index.js` | — | ✅ Criado |

## Próximos Passos

- Extrair `enrichmentPipeline` (pipeline BDC-first)
- Extrair `reportEngine` (reportBuilder mirror)
- Extrair `auditManager` (writeAuditEvent, auditCatalog)
