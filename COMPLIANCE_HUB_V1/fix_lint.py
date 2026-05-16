with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\ui\components\CaseCommunication\CaseCommunicationPanel.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover userProfile nao usado
content = content.replace('const { user, userProfile } = useAuth();', 'const { user } = useAuth();')

# Remover caseData dos props (nao esta sendo usado)
content = content.replace('caseData, portal = \"ops\"', 'portal = \"ops\"')

# Corrigir catch err nao usado
content = content.replace("catch (err) {\n            setError('Erro ao enviar mensagem. Tente novamente.');", "catch {\n            setError('Erro ao enviar mensagem. Tente novamente.');")

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\src\ui\components\CaseCommunication\CaseCommunicationPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('CaseCommunicationPanel corrigido')

# Corrigir caseCommunication.js - verificar erro de parse na linha 31
with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\functions\caseCommunication.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('Linha 31:', lines[30])
