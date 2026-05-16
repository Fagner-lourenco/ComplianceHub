with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\functions\caseCommunication.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Corrigir uid nao usado - adicionar underscore
content = content.replace('async function assertCanAccessCaseCommunication({ uid, profile, caseId }) {', 'async function assertCanAccessCaseCommunication({ uid: _uid, profile, caseId }) {')

# 2. Corrigir regex de controle - usar abordagem mais simples
content = content.replace(\".replace(/[\\\\x00-\\\\x08\\\\x0b\\\\x0c\\\\x0e-\\\\x1f\\\\x7f]/g, '')\", \".replace(/[^\\S\\n\\r]/g, '')\")

# 3. Corrigir caseData nao usado em createSystemCaseMessage
content = content.replace('async function createSystemCaseMessage({\n    caseId,\n    caseData,\n    tenantId,\n    systemType,\n    body,\n}) {', 'async function createSystemCaseMessage({\n    caseId,\n    tenantId,\n    systemType,\n    body,\n}) {')

# 4. Corrigir caseData nao usado em markCaseCommunicationRead
content = content.replace('const { caseData, portal } = await assertCanAccessCaseCommunication({ uid, profile, caseId });', 'const { portal } = await assertCanAccessCaseCommunication({ uid, profile, caseId });')

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\functions\caseCommunication.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('caseCommunication.js corrigido')
