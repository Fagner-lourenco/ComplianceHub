with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\ui\components\CaseCommunication\CaseCommunicationPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover caseData dos props
content = content.replace('caseId, caseData, portal', 'caseId, portal')

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\ui\components\CaseCommunication\CaseCommunicationPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Props corrigidos')
