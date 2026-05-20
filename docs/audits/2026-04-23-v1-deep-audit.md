# Auditoria profunda V1 - 2026-04-23

## Escopo

Auditoria e correcoes na V1 em `D:\ComplianceHub\COMPLIANCE_HUB_V1`.

Nao houve deploy, leitura ou escrita no Firebase real. A V2 ficou fora do escopo deste ciclo.

## Baseline

- Base restaurada previamente do commit `185c02ba39ef315488d89e2b028ffdc477652769`.
- Backup preservado em `D:\ComplianceHub\COMPLIANCE_HUB_V1_BACKUP_20260423_001439`.
- Projeto Firebase da V1 confirmado em `.firebaserc`: `compliance-hub-br`.
- Estado inicial conhecido:
  - `npm test`: 477 testes passando.
  - `npm run build`: passando.
  - `node --check functions/index.js`: passando.
  - `npm run lint`: falhando com 35 erros e 3 warnings.

## Correcoes aplicadas

- Lint/config:
  - Ajustado `eslint.config.js` para permitir testes ESM dentro de `functions/**/*.test.js` sem mudar o runtime CommonJS das Functions.
  - Removido import nao usado `defineString` em `functions/index.js`.
  - Removidas variaveis nao usadas em testes, paginas e adapters.
  - Corrigidos `catch {}` vazios em `functions/fix-tenant-configs.js` com limpeza e aviso controlado.

- Backend/Functions:
  - Corrigido `prefillResult` fora de escopo em `rerunAiForCase`.
  - Mantidos nomes/export das Functions da V1 sem prefixo V2.
  - Adicionado guard de conteudo minimo para criacao de public report a partir de caso concluido.
  - Mantidos erros de auditoria como nao bloqueantes nos pontos automaticos de enriquecimento.
  - Ajustada mensagem de timeout do adapter Judit para usar a contagem real de tentativas.

- Frontend/hooks:
  - Corrigida ordem de hooks em `useTenantAuditLogs`.
  - Ajustado `useMediaQuery` para evitar setState sincronico desnecessario em effect.
  - Mantida normalizacao sincronica de tenant em `TenantContext`, com excecao local documentada, porque evita renderizar filhos com tenant incorreto.
  - Ajustados `Drawer`, `AppLayout` e `MetricasIAPage` para satisfazer regras de pureza/render.
  - Removidos imports/variaveis nao usados em `NovaSolicitacaoPage`, `ClientesPage`, `FilaPage` e testes.

- Firestore rules:
  - Mantido modelo V1: `cases` ops-only, `clientCases` tenant-safe, `tenantAuditLogs` tenant-safe, `tenantUsage` tenant-safe e `publicReports` por token ativo/nao expirado.
  - Bloqueadas mutacoes diretas via client SDK em `auditLogs`, `tenantSettings`, `exports`, `tenantUsage`, `clientCases`, `tenantAuditLogs` e `publicReports`.
  - Criado teste textual `firestore.rules.test.js` para congelar os contratos sensiveis.

## Validacoes executadas

Comandos executados em `D:\ComplianceHub\COMPLIANCE_HUB_V1`:

```powershell
node --check functions/index.js
npm run lint
npm run test -- firestore.rules.test.js src\core\clientPortal.test.js src\core\firebase\firestoreService.test.js functions\audit\auditCatalog.test.js functions\audit\writeAuditEvent.test.js functions\helpers\deterministicPrefill.test.js functions\helpers\aiCalibration.test.js
npm test
npm run build
```

Resultados:

- `node --check functions/index.js`: sucesso.
- `npm run lint`: sucesso, zero erros.
- Testes focados: 7 arquivos, 187 testes passando.
- `npm test`: 34 arquivos, 481 testes passando.
- `npm run build`: sucesso.

Smoke local:

```powershell
npm run dev -- --host 127.0.0.1 --port 5174
```

Rotas verificadas com HTTP 200:

- `http://127.0.0.1:5174/`
- `http://127.0.0.1:5174/demo/client`
- `http://127.0.0.1:5174/demo/ops`
- `http://127.0.0.1:5174/demo/r/CASE-001`

Smoke com Playwright headless:

- `/`: 200.
- `/demo/client`: 200.
- `/demo/ops`: 200.
- `/demo/r/CASE-001`: 200.
- Sem `console.error` ou `pageerror` critico.

## Riscos remanescentes

- Os testes de rules sao textuais, nao emulator. Para garantia mais forte, criar suite com `@firebase/rules-unit-testing`.
- Alguns arquivos do working tree da V1 ja estavam alterados/removidos antes desta rodada por restauracao/reorganizacao; esta auditoria focou estabilizacao de runtime, lint, tests, build e seguranca basica.
- Nao houve teste contra Firebase real por decisao de escopo.
- O guard de conteudo minimo protege novas criacoes de public report, mas casos historicos ja publicados continuam dependentes do estado existente em `publicReports`.
- `functions/index.js` segue grande e legado. Nao foi decomposto para evitar reescrita arquitetural da V1.

## Como rodar local

```powershell
cd D:\ComplianceHub\COMPLIANCE_HUB_V1
npm run dev -- --host 127.0.0.1 --port 5174
```

Abrir:

- `http://127.0.0.1:5174/`
- `http://127.0.0.1:5174/demo/client`
- `http://127.0.0.1:5174/demo/ops`
- `http://127.0.0.1:5174/demo/r/CASE-001`

## Confirmacoes

- V1 continua apontando para Firebase project `compliance-hub-br`.
- Nenhuma Function da V1 foi renomeada.
- Nenhum prefixo V2 foi introduzido na V1.
- A V2 nao foi modificada neste ciclo de auditoria da V1.
