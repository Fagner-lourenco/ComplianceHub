with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\functions\index.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Atualizar o require
content = content.replace(
    "const { createSystemCaseMessage } = require('./caseCommunication');",
    "const { createSystemCaseMessage, buildNotificationFunctions } = require('./caseCommunication');"
)

# 2. Adicionar inicializacao apos db = getFirestore()
old_init = '''initializeApp();
let db = getFirestore();'''
new_init = '''initializeApp();
let db = getFirestore();

const caseComm = buildNotificationFunctions(db);'''
content = content.replace(old_init, new_init)

# 3. Atualizar chamadas de createSystemCaseMessage para passar db
# Primeira ocorrencia (returnCaseToClient)
content = content.replace(
    '''await createSystemCaseMessage({
                caseId,
                caseData,
                tenantId: caseData.tenantId,
                systemType: 'CORRECTION_REQUESTED',''',
    '''await createSystemCaseMessage({
                caseId,
                caseData,
                tenantId: caseData.tenantId,
                db,
                systemType: 'CORRECTION_REQUESTED','''
)

# Segunda ocorrencia (submitClientCorrection)
content = content.replace(
    '''await createSystemCaseMessage({
                caseId,
                tenantId: caseData.tenantId,
                systemType: 'CORRECTION_SUBMITTED',''',
    '''await createSystemCaseMessage({
                caseId,
                tenantId: caseData.tenantId,
                db,
                systemType: 'CORRECTION_SUBMITTED','''
)

# 4. Atualizar exports no final
content = content.replace(
    "// Case Communication exports\nexports.sendCaseMessage = require('./caseCommunication').sendCaseMessage;\nexports.markCaseCommunicationRead = require('./caseCommunication').markCaseCommunicationRead;",
    "// Case Communication exports\nexports.sendCaseMessage = caseComm.sendCaseMessage;\nexports.markCaseCommunicationRead = caseComm.markCaseCommunicationRead;"
)

with open(r'D:\ComplianceHub\COMPLIANCE_HUB_V1\functions\index.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('index.js atualizado')
