# PDF_EXPORT_FIX_PROGRESS

## Objetivo
Implementar geração real de PDF server-side para relatórios do ComplianceHub, com marca d'água CONFIDENCIAL, paginação A4 controlada, armazenamento no Firebase Storage e download por URL assinada.

## Checklist
- [ ] 1. Confirmar implementação atual de ClientReportPage.jsx
- [ ] 2. Confirmar implementação atual de PublicReportPage.jsx
- [ ] 3. Confirmar buildCanonicalReportHtml em functions/index.js
- [ ] 4. Adicionar dependências PDF em functions/package.json
- [ ] 5. Criar functions/helpers/pdfRenderer.js
- [ ] 6. Criar functions/helpers/pdfHtml.js
- [ ] 7. Implementar generateClientCasePdf
- [ ] 8. Implementar generatePublicReportPdf
- [ ] 9. Atualizar firestoreService.js
- [ ] 10. Atualizar ClientReportPage.jsx
- [ ] 11. Atualizar PublicReportPage.jsx
- [ ] 12. Ajustar UX de botões e estados loading/error
- [ ] 13. Testar relatório curto
- [ ] 14. Testar relatório longo
- [ ] 15. Testar usuário sem permissão
- [ ] 16. Testar link público revogado/expirado
- [ ] 17. Rodar node --check
- [ ] 18. Rodar lint/test/build
- [ ] 19. Documentar limitações e pendências
