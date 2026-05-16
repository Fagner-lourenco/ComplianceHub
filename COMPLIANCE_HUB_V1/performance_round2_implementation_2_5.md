# Performance Round 2.5 - Implementacao

Data: 2026-05-16
Escopo: otimizar relatorios e CasoPage - reduzir DOM inicial pesado em tabelas e relatórios.

## App Confirmado

- Raiz: `D:\ComplianceHub\COMPLIANCE_HUB_V1`
- Stack: Vite, React, React Router, Firebase

## Baseline Local Antes Das Mudancas

- `npm test`: 627/627 passando (48 test files)
- `npm run build`: ok (2.35s)
- `npm run lint`: 0/0 (erros pre-existentes em functions/index.js ja corrigidos em rodada anterior)

## Arquivos Alvo

1. `src/portals/ops/CasoPage.jsx`
2. `src/pages/PublicReportPage.jsx`
3. `src/portals/client/ClientReportPage.jsx`
4. `src/core/reportBuilder.js` (auditoria apenas, sem alteracoes previstas)

## Achados Confirmados

### CasoPage.jsx
- 5 secoes `<details>` com conteudo pesado:
  1. Escavador processos (tabela, ~linha 1794)
  2. Judit papeis nos processos (lista, ~linha 1910)
  3. BigDataCorp outros processos (tabela, ~linha 2444)
  4. DJEN comunicacoes (tabela, ~linha 2482)
  5. Historico do caso (lista, ~linha 3236)
- 2 secoes `<details>` leves (sintese AI, comparativo) - nao precisam lazy render
- `checklist` reconstruido a cada render (~linha 613)
- Arquivo grande (~3291 linhas) mas estrutura clara

### PublicReportPage.jsx
- `stripActiveContent` usa `DOMParser` no main thread (~linha 32)
- Relatório inteiro entra em iframe `srcDoc`
- Sanitização essencial para seguranca

### ClientReportPage.jsx
- Memoizacao razoavel ja presente (`caseData`, `caseView`, `reportAvailability`, `reportHtml`, `iframeHtml`)
- Busca `cases.find()` em array completo
- iframe `srcDoc` para isolamento

### reportBuilder.js
- Gera HTML string completa sincrona
- Constantes de labels ja sao modulares
- CSS embutido por funcao

## Checklist De Implementacao

### FASE 3: CasoPage.jsx
- [x] Criar hook `useOpenedSections` para lazy render
- [x] Aplicar lazy render nas 5 secoes pesadas de `<details>`
- [x] Preservar comportamento nativo do `<details>`
- [x] Memoizar `checklist` com `useMemo`
- [x] Nao alterar secoes leves
- [x] Nao alterar regras de exibicao

### FASE 4: PublicReportPage.jsx
- [x] Memoizar resultado de `stripActiveContent` com `useMemo`
- [x] Preservar sanitizacao
- [x] Preservar iframe `srcDoc`
- [x] Nao alterar politica de seguranca

### FASE 5: ClientReportPage.jsx
- [x] Auditar memoizacoes existentes (ja estavam adequadas)
- [x] Verificar chamadas duplicadas (nenhuma encontrada)
- [x] Nao alterar fetch/payloads

### FASE 6: reportBuilder.js
- [x] Auditar apenas
- [x] Nao alterar - CSS ja e constante de modulo

### FASE 7: Testes
- [x] npm test passando: 627/627 (48 test files)
- [x] npm run build passando: 2.36s
- [x] npm run lint passando: 0/0

### FASE 8: Smoke
- [x] Verificar secoes abrem corretamente (codigo inspecionado)
- [x] Verificar dados aparecem ao abrir (lazy render com persistencia)
- [x] Verificar relatório público (iframe srcDoc preservado)
- [x] Verificar relatório cliente (memoizacoes confirmadas)

## Resultado Pos-Implementacao

- `npm test`: 627/627 passando (48 test files)
- `npm run build`: ok (2.36s)
- `npm run lint`: 0/0

### Mudancas Aplicadas

**CasoPage.jsx:**
- Criado hook `useOpenedSections` que rastreia secoes `<details>` abertas via evento `onToggle`
- Hook preserva estado apos primeira abertura (nao remonta conteudo ao fechar/reabrir)
- Aplicado lazy render em 5 secoes pesadas:
  1. `escavador-processos` - tabela de processos Escavador
  2. `judit-roles` - lista de papeis nos processos Judit
  3. `bdc-processos` - tabela de outros processos BigDataCorp
  4. `djen-comunicacoes` - tabela de comunicacoes judiciais DJEN
  5. `case-timeline` - lista do historico do caso
- Memoizado `checklist` com `useMemo` (deps: enabledPhases, form, caseData?.juditCriminalCount, activeWarrantCount, risk.riskScore)
- Memoizado `allOk` com `useMemo` (deps: checklist)
- Secoes leves (sintese AI, comparativo) mantidas sem lazy render

**PublicReportPage.jsx:**
- Adicionado `useMemo` ao import
- Criado estado `rawReportHtml` para HTML bruto
- Criado `reportHtml` memoizado via `useMemo(() => stripActiveContent(rawReportHtml), [rawReportHtml])`
- Sanitizacao `stripActiveContent` preservada integralmente
- iframe `srcDoc` preservado
- Nenhuma alteracao na politica de seguranca

**ClientReportPage.jsx:**
- Auditado: memoizacoes ja existentes estao adequadas (`caseData`, `caseView`, `reportAvailability`, `reportHtml`, `iframeHtml`)
- Efeitos possuem dependencias corretas (`caseData`, `isDemoMode`)
- Nenhuma alteracao necessaria

**reportBuilder.js:**
- Auditado: CSS ja e constante de modulo (`REPORT_CSS`)
- Nenhuma alteracao necessaria

### Decisoes De Seguranca

- `stripActiveContent` nao foi alterada - apenas seu resultado memoizado
- `iframe srcDoc` preservado em ambos os fluxos de relatorio
- Nenhuma sanitizacao removida ou relaxada
- Nenhum script ou handler de evento permitido

### Riscos Residuais

- CasoPage ainda e arquivo grande (~3317 linhas) - rodada futura pode dividir em componentes menores
- Lazy render nao e aplicavel a secoes leves (sintese AI, comparativo) - risco aceitavel
- Relatorio publico ainda usa DOMParser no main thread - memoizacao reduz chamadas mas nao elimina custo da primeira execucao

### Confirmacao De Nao-Alteracao

- [x] Nao alterou backend
- [x] Nao alterou Firebase
- [x] Nao alterou Firestore rules
- [x] Nao alterou Cloud Functions
- [x] Nao alterou payloads
- [x] Nao alterou RBAC/permissões
- [x] Nao alterou autenticacao
- [x] Nao alterou modelo de dados
- [x] Nao alterou COMPLIANCE_HUB_V2
- [x] Nao instalou dependências
- [x] Nao rodou git reset/checkout/clean/restore global
- [x] Nao mexeu em graphify-out
- [x] Nao removeu sanitizacao
- [x] Nao quebrou PDF/print intencionalmente
