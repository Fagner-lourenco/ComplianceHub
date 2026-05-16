with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\client\SolicitacoesPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_import = "import CaseCommunicationPanel from '../../ui/components/CaseCommunication/CaseCommunicationPanel';\n"

# Inserir apos a linha 20 (indice 19)
new_lines = lines[:20] + [new_import] + lines[20:]

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\client\SolicitacoesPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Import adicionado')
