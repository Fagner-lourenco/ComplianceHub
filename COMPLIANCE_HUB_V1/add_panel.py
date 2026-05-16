import codecs

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\ops\CasoPage.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

panel_code = "            {/* Case Communication Panel */}\n"
panel_code += "            <div className='caso-section' style={{ marginTop: 16 }}>\n"
panel_code += "                <CaseCommunicationPanel\n"
panel_code += "                    caseId={caseId}\n"
panel_code += "                    caseData={caseData}\n"
panel_code += "                    portal='ops'\n"
panel_code += "                />\n"
panel_code += "            </div>\n\n"

# Inserir apos a linha 1079 (indice 1078)
new_lines = lines[:1079] + [panel_code] + lines[1079:]

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\portals\ops\CasoPage.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Painel adicionado')
