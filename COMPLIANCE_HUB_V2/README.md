# ComplianceHub V2

Diretorio limpo da V2 do ComplianceHub.

## Estrutura

- `app/`: runtime ativo da V2, com frontend React/Vite, Firebase, Firestore rules, Cloud Functions e testes.
- `PLANO_EXECUCAO_V2_MASTER.md`: plano mestre e registro historico essencial da execucao V2.

## Comandos

Execute a partir de `app/`:

```powershell
cd COMPLIANCE_HUB_V2/app
npm test
npm run test:rules
npm run lint
node --check functions/index.js
npm run build
```

## Politica de limpeza

- Os inventarios, comparativos antigos, referencias externas, modelos Marble/Ballerine, logs, outputs e scripts legados foram removidos.
- `modelos/` nao faz mais parte da V2.
- Documentacao arquivada foi removida da V2 para manter apenas o plano mestre e a documentacao do app.
- Arquivos locais de ambiente permanecem no runtime quando necessarios para desenvolvimento local, mas devem continuar ignorados pelo Git.
