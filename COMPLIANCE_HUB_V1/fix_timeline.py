with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\client\SolicitacoesPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Encontrar a linha com 'label: Timeline' e adicionar '{' antes
for i in range(len(lines)):
    if "label: 'Timeline'" in lines[i]:
        # Verificar se a linha anterior tem '{'
        if '{' not in lines[i-1]:
            lines[i] = '        {\n' + lines[i]
        break

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\client\SolicitacoesPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Chave adicionada antes de Timeline')
