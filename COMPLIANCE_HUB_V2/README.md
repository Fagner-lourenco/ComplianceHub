# ComplianceHub V2

Diretorio limpo da V2 do ComplianceHub.

## Estrutura

- `app/`: runtime ativo da V2, com frontend React/Vite, Firebase, Firestore rules, Cloud Functions e testes.
- `PLANO_EXECUCAO_V2_MASTER.md`: plano mestre e registro historico essencial da execucao V2.

## Comandos

Execute a partir da raiz da V2:

```powershell
cd D:\ComplianceHub\COMPLIANCE_HUB_V2
npm run dev
npm test
npm run test:rules
npm run lint
npm run check:functions
npm run build
```

Os scripts da raiz encaminham para `app/`, onde o runtime React/Vite/Firebase esta instalado.

## Functions V2

Use somente os scripts da raiz para emulador/deploy de Functions:

```powershell
cd D:\ComplianceHub\COMPLIANCE_HUB_V2
npm run guard:firebase
npm run emulators:functions
npm run deploy:functions
```

Esses scripts sempre passam `--project compliance-hub-v2` para o Firebase CLI e executam um guard antes de operacoes sensiveis.

As Functions tambem usam `codebase: compliance-hub-v2` em `app/firebase.json`, evitando mistura logica com qualquer codebase legado.

As exports das Cloud Functions V2 tambem sao prefixadas com `v2`, por exemplo:

- `v2CreateClientSolicitation`
- `v2ConcludeCaseByAnalyst`
- `v2JuditWebhook`
- `v2ScheduledMonitoringJob`

Nao publique aliases sem prefixo na V2. Nomes sem `v2` pertencem ao legado/V1 ou a historico antigo.

## Firebase V2

- Projeto Firebase default: `compliance-hub-v2`.
- Config local: `app/.firebaserc` e `app/.env.local`.
- Nunca usar credenciais, Web App config ou service account do V1 nesta pasta.
- Antes de usar o banco real V2, preencha em `app/.env.local` a Web API Key, Messaging Sender ID e App ID do projeto Firebase `compliance-hub-v2`.

## Politica de limpeza

- Os inventarios, comparativos antigos, referencias externas, modelos Marble/Ballerine, logs, outputs e scripts legados foram removidos.
- `modelos/` nao faz mais parte da V2.
- Documentacao arquivada foi removida da V2 para manter apenas o plano mestre e a documentacao do app.
- Arquivos locais de ambiente permanecem no runtime quando necessarios para desenvolvimento local, mas devem continuar ignorados pelo Git.
