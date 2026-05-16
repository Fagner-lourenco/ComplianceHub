with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\ops\CasoPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_import = "import CaseCommunicationPanel from '../../ui/components/CaseCommunication/CaseCommunicationPanel';\n"

# Inserir apos o ultimo import (procurar por 'from' nas primeiras 40 linhas)
insert_pos = 0
for i in range(min(40, len(lines))):
    if 'from ' in lines[i] and 'import ' in lines[i]:
        insert_pos = i + 1

new_lines = lines[:insert_pos] + [new_import] + lines[insert_pos:]

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\ops\CasoPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Import adicionado na linha', insert_pos)
