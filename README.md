# ComplianceHub repository

Este repositorio esta organizado em dois blocos principais:

- `COMPLIANCE_HUB_V1/`: snapshot historico da V1, extraido do commit `629db99be8e54827cb2cb4dd780a3cdb1178aed5`.
- `COMPLIANCE_HUB_V2/`: runtime ativo da V2.

O app V2 roda a partir de:

```powershell
cd COMPLIANCE_HUB_V2/app
npm test
npm run test:rules
npm run lint
npm run build
```

Notas:

- `COMPLIANCE_HUB_V1/` deve ser tratado como snapshot read-only.
- `COMPLIANCE_HUB_V2/app/` contem o runtime ativo: `src`, `functions`, Firebase, Vite, Vitest e scripts.
- `COMPLIANCE_HUB_V2/PLANO_EXECUCAO_V2_MASTER.md` e o documento canônico de planejamento e execucao da V2.
