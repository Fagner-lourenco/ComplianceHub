# Plano de Organizacao do Repositorio ComplianceHub V1/V2

Data: 2026-04-22

## Diagnostico confirmado

- Branch atual: `main`.
- Working tree atual: grande e nao commitado, com alteracoes V2 em runtime, docs, rules, tests, frontend e backend.
- Commit candidato a ultimo V1 puro:
  - `629db99be8e54827cb2cb4dd780a3cdb1178aed5`
  - Data: 2026-04-20 23:26:10 -0300
  - Mensagem: `feat: add script to fix Francisco Taciano's warrant data in Firestore`
- Commit `185c02ba39ef315488d89e2b028ffdc477652769` nao deve ser tratado como V1 puro, pois ja adiciona `COMPLIANCE_HUB_V2` e resultados gerados.

## Objetivo

Separar o repositorio em duas areas claras:

```txt
D:\ComplianceHub
  COMPLIANCE_HUB_V1\
    snapshot historico read-only da V1 no commit 629db99

  COMPLIANCE_HUB_V2\
    app\
      runtime real atual da V2
    docs\
      planejamento, auditorias, specs e registros de execucao
    modelos\
      referencias externas Marble/Ballerine, fora do runtime

  docs\
    documentos compartilhados de governanca/reorg, se necessario
```

## Principios de seguranca

- Nao usar `git reset --hard`.
- Nao usar `git checkout -- .`.
- Nao apagar arquivos da raiz antes de validar build/test na nova estrutura.
- Preservar working tree atual ate haver commit ou backup.
- Criar V1 por `git archive` ou `git worktree`, nunca por restauracao destrutiva.
- Migrar V2 em duas etapas: primeiro copiar/espelhar, depois mover/remover raiz so depois de validacao.

## Fase 0 - Congelar estado atual

Antes de mover runtime:

1. Rodar validacoes atuais:
   - `npm test`
   - `npm run test:rules`
   - `npm run lint`
   - `node --check functions/index.js`
   - `npm run build`
   - `git diff --check`
2. Criar commit ou branch de seguranca para o estado V2 atual.
3. Confirmar que `dist/`, logs e caches nao entram em commit.

Resultado esperado:

- estado atual recuperavel por commit/branch;
- nenhuma mudanca V2 importante perdida durante a reorganizacao.

## Fase 1 - Criar COMPLIANCE_HUB_V1

Fonte:

```txt
629db99be8e54827cb2cb4dd780a3cdb1178aed5
```

Comando recomendado:

```powershell
New-Item -ItemType Directory -Force -Path COMPLIANCE_HUB_V1
git archive 629db99be8e54827cb2cb4dd780a3cdb1178aed5 | tar -x -C COMPLIANCE_HUB_V1
```

Depois criar:

```txt
COMPLIANCE_HUB_V1/README_V1_SNAPSHOT.md
```

Conteudo minimo:

- commit de origem;
- data;
- mensagem do commit;
- aviso de snapshot historico read-only;
- instrucao para nao desenvolver V2 dentro dessa pasta.

## Fase 2 - Preparar COMPLIANCE_HUB_V2/app

Criar a pasta runtime V2:

```txt
COMPLIANCE_HUB_V2/app
```

Mover para `COMPLIANCE_HUB_V2/app`:

- `src/`
- `functions/`
- `public/`
- `scripts/`
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `vitest.rules.config.js`
- `eslint.config.js`
- `index.html`
- `vercel.json`
- `.env.example`
- configs necessarias ao runtime

Nao mover para `app`:

- `node_modules/`
- `dist/`
- logs (`*.log`);
- outputs temporarios;
- modelos externos;
- docs antigos soltos sem uso runtime.

## Fase 3 - Reorganizar documentacao V2

Manter ou consolidar dentro de `COMPLIANCE_HUB_V2/docs`:

- `00_execucao/` ate `12_plano_execucao/`;
- auditorias;
- specs;
- registros de ciclos;
- documentos de decisao arquitetural.

Mover documentos soltos da raiz para:

```txt
COMPLIANCE_HUB_V2/docs/auditorias-legadas/
COMPLIANCE_HUB_V2/docs/providers/
COMPLIANCE_HUB_V2/docs/roadmap/
```

Exemplos:

- `ANALISE_API_*.md`;
- `AUDITORIA_*.md`;
- `COMPARATIVO_*.md`;
- `PLANO_*.md`;
- `MATRIZ_RESULTADOS.md`.

## Fase 4 - Tratar modelos externos

`COMPLIANCE_HUB_V2/modelos/` deve ser explicitamente marcado como referencia externa.

Regras:

- nao entra em build/test/lint do runtime;
- nao deve ser importado pelo app;
- pode ficar como submodule, archive ou pasta de referencia;
- deve ter README proprio explicando que Marble/Ballerine sao referencia conceitual.

## Fase 5 - Ajustar comandos apos migracao

Opcoes:

### Opcao A - root apenas orquestrador

Criar `package.json` na raiz com scripts:

```json
{
  "scripts": {
    "v2:test": "npm --prefix COMPLIANCE_HUB_V2/app test",
    "v2:lint": "npm --prefix COMPLIANCE_HUB_V2/app run lint",
    "v2:build": "npm --prefix COMPLIANCE_HUB_V2/app run build",
    "v2:test:rules": "npm --prefix COMPLIANCE_HUB_V2/app run test:rules"
  }
}
```

### Opcao B - workspace npm

Usar workspaces apenas se houver necessidade real:

```json
{
  "workspaces": [
    "COMPLIANCE_HUB_V2/app"
  ]
}
```

Recomendacao inicial: Opcao A. Menos risco e menos refactor.

## Fase 6 - Validacao da nova estrutura

Dentro de `COMPLIANCE_HUB_V2/app`:

```powershell
npm install
npm test
npm run test:rules
npm run lint
node --check functions/index.js
npm run build
git diff --check
```

Validar tambem:

- Firebase rules ainda localizadas corretamente;
- `firebase.json` aponta para `functions`, `firestore.rules` e `firestore.indexes.json` dentro do novo cwd;
- Vite encontra `index.html` e `src`;
- tests nao descobrem `COMPLIANCE_HUB_V2/modelos`;
- imports relativos nao quebraram.

## Fase 7 - Limpeza da raiz

So apos build/test verde dentro de `COMPLIANCE_HUB_V2/app`:

- remover/copiar logs antigos para arquivo morto ou `.gitignore`;
- remover `dist/` do git se estiver rastreado;
- remover scripts experimentais obsoletos da raiz ou mover para `COMPLIANCE_HUB_V2/docs/scripts-legados`;
- deixar a raiz com:

```txt
.git/
.gitignore
README.md
COMPLIANCE_HUB_V1/
COMPLIANCE_HUB_V2/
docs/reorg/
```

## Ordem recomendada de execucao

1. Commit/branch de seguranca do estado atual.
2. Criar `COMPLIANCE_HUB_V1` via `git archive 629db99...`.
3. Criar `COMPLIANCE_HUB_V2/app` e copiar runtime atual para la.
4. Ajustar scripts/configs para rodar a partir de `COMPLIANCE_HUB_V2/app`.
5. Rodar validacoes completas no novo cwd.
6. Mover docs soltos para `COMPLIANCE_HUB_V2/docs`.
7. Limpar raiz.
8. Commit de reorganizacao.

## Criterios de pronto

- V1 restaurado como snapshot historico em `COMPLIANCE_HUB_V1`.
- V2 roda em `COMPLIANCE_HUB_V2/app`.
- `npm test`, `npm run test:rules`, `npm run lint`, `npm run build`, `node --check functions/index.js` verdes no app V2.
- Raiz nao contem runtime misturado com docs/prototipos.
- `COMPLIANCE_HUB_V2/modelos` fora de lint/test/build.
- Plano mestre atualizado com ciclo de reorganizacao.

## Decisao recomendada sobre o commit V1

Usar:

```txt
629db99be8e54827cb2cb4dd780a3cdb1178aed5
```

Nao usar como V1 puro:

```txt
185c02ba39ef315488d89e2b028ffdc477652769
```

Motivo: `185c02b` ja introduz material `COMPLIANCE_HUB_V2`; `629db99` e o ultimo commit imediatamente anterior a isso.

## Status executado em 2026-04-22

- `COMPLIANCE_HUB_V1/` criado a partir de `629db99be8e54827cb2cb4dd780a3cdb1178aed5`.
- `COMPLIANCE_HUB_V1/README_V1_SNAPSHOT.md` adicionado para documentar origem e uso read-only do snapshot.
- `185c02ba39ef315488d89e2b028ffdc477652769` confirmado como commit que ja contem artefatos V2, portanto nao usado para V1.
- Migração fisica do runtime V2 para `COMPLIANCE_HUB_V2/app` ainda nao executada neste passo porque o working tree atual esta grande e nao commitado. A proxima etapa deve ser um checkpoint/commit de seguranca seguido da mudanca de layout em bloco.

## Inventario inicial para migracao V2

Itens de runtime/config que devem ir para `COMPLIANCE_HUB_V2/app`:

- `src/`
- `functions/`
- `public/`
- `scripts/`
- `results/` se ainda for usado por testes/scripts; se for output historico, mover para docs/arquivo morto.
- `package.json`
- `package-lock.json`
- `firebase.json`
- `firestore.rules`
- `firestore.rules.test.js`
- `firestore.rules.emulator.test.js`
- `firestore.indexes.json`
- `vite.config.js`
- `vitest.rules.config.js`
- `eslint.config.js`
- `index.html`
- `.firebaserc`
- `.env.example`
- `vercel.json`
- `README.md` do app.

Itens que devem ir para `COMPLIANCE_HUB_V2/docs/archive-root/` ou `COMPLIANCE_HUB_V2/docs/providers/`:

- `ANALISE_API_*.md`
- `AUDITORIA_*.md`
- `COMPARATIVO_*.md`
- `PLANO_*.md`
- `MATRIZ_RESULTADOS.md`
- documentos `.docx` de provider/especificacao.

Itens que nao devem ser migrados como codigo-fonte:

- `node_modules/`
- `dist/`
- logs de deploy/debug/preview/vercel/firebase.
- arquivos `.env.local` e qualquer segredo local.

Regra para a proxima etapa:

- mover o runtime em uma unica rodada, ajustar scripts/configs, instalar dependencias dentro de `COMPLIANCE_HUB_V2/app` se necessario e so entao limpar a raiz.
