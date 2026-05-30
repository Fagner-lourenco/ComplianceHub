/**
 * tenantUserManagement.js — Módulo de gestão de usuários por tenant
 * Extraído do monolito index.js
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

/* =========================================================
   Constantes de roles
   ========================================================= */
const OPS_ROLES = new Set(['analyst', 'supervisor', 'admin', 'owner']);
const CLIENT_VIEW_ROLES = new Set(['CLIENT', 'client_viewer', 'client_operator', 'client_manager']);
const CLIENT_MANAGEABLE_ROLES = new Set(['client_viewer', 'client_operator', 'client_manager']);
const OPS_MANAGEABLE_ROLES = new Set(['analyst', 'supervisor', 'admin']);

/* =========================================================
   Funções puras / auxiliares
   ========================================================= */
function normalizeTenantSlug(value = '') {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

function sanitizeDisplayName(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeUserStatus(status) {
    const value = String(status || 'active').trim().toLowerCase();
    return ['active', 'inactive', 'suspended'].includes(value) ? value : 'active';
}

function canManageOpsUsers(profile = {}) {
    return ['supervisor', 'admin', 'owner'].includes(profile.role);
}

function assertOpsManager(profile) {
    if (!canManageOpsUsers(profile)) {
        throw new HttpsError('permission-denied', 'Sem permissao para gerenciar equipe operacional.');
    }
}

function getClientIp(request) {
    const rawIp = request?.rawRequest?.ip;
    if (rawIp) return String(rawIp).trim();
    const forwarded = request?.rawRequest?.headers?.['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
    return null;
}

/* =========================================================
   Lógica pura: createOpsClientUser
   ========================================================= */
async function createOpsClientUserLogic({
    db,
    getAuth,
    getOpsUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    DEFAULT_ANALYSIS_CONFIG,
    request,
}) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

    const operatorProfile = await getOpsUserProfile(uid);

    if (operatorProfile.role !== 'admin' && operatorProfile.role !== 'owner' && operatorProfile.role !== 'supervisor') {
        throw new HttpsError('permission-denied', 'Apenas administradores e supervisores podem criar clientes.');
    }

    const {
        email,
        password,
        displayName,
        tenantName,
        tenantId: requestedTenantId = null,
        role = 'client_manager',
    } = request.data || {};

    if (!CLIENT_VIEW_ROLES.has(role)) {
        throw new HttpsError('invalid-argument', 'Role invalida para usuario cliente.');
    }

    if (!email || !password || !displayName || !(requestedTenantId || tenantName)) {
        throw new HttpsError('invalid-argument', 'Dados obrigatorios ausentes para criar o cliente.');
    }

    const tenantId = requestedTenantId || normalizeTenantSlug(tenantName);
    if (!tenantId) {
        throw new HttpsError('invalid-argument', 'Nao foi possivel gerar tenantId valido.');
    }

    if (!requestedTenantId) {
        const existingTenant = await db.collection('tenantSettings').doc(tenantId).get();
        if (existingTenant.exists) {
            throw new HttpsError('already-exists', `Tenant "${tenantId}" ja existe. Selecione-o na lista ou escolha outro nome.`);
        }
    }

    const authUser = await getAuth().createUser({
        email,
        password,
        displayName,
    });

    try {
        await db.collection('userProfiles').doc(authUser.uid).set({
            email,
            displayName,
            role,
            tenantId,
            tenantName: tenantName || requestedTenantId,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await getAuth().setCustomUserClaims(authUser.uid, { role, tenantId });

        const tenantRef = db.collection('tenantSettings').doc(tenantId);
        const tenantDoc = await tenantRef.get();
        if (!tenantDoc.exists) {
            await tenantRef.set({
                name: tenantName || tenantId,
                analysisConfig: { ...DEFAULT_ANALYSIS_CONFIG },
                slaHours: 48,
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        await writeAuditEvent({
            action: 'USER_CREATED',
            tenantId: null,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: operatorProfile.email || uid },
            entity: { type: 'USER', id: authUser.uid, label: email },
            related: { userId: authUser.uid },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Cliente criado: ${tenantName || tenantId} (${email})`,
            templateVars: { tenantName: tenantName || tenantId },
        });

        return { uid: authUser.uid, tenantId };
    } catch (error) {
        await getAuth().deleteUser(authUser.uid).catch(() => {});
        throw error;
    }
}

function createOpsClientUserHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 120, cors: true },
        async (request) => createOpsClientUserLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: listTenantUsers
   ========================================================= */
async function listTenantUsersLogic({ db, getClientUserProfile, request }) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

    const callerProfile = await getClientUserProfile(uid);
    if (callerProfile.role !== 'client_manager') {
        throw new HttpsError('permission-denied', 'Apenas gestores podem listar usuarios da equipe.');
    }

    const snapshot = await db.collection('userProfiles')
        .where('tenantId', '==', callerProfile.tenantId)
        .get();

    const users = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (!CLIENT_VIEW_ROLES.has(data.role)) return;
        users.push({
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName || '',
            role: data.role,
            status: data.status || 'active',
            createdAt: data.createdAt || null,
        });
    });

    return { users };
}

function createListTenantUsersHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => listTenantUsersLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: createTenantUser
   ========================================================= */
async function createTenantUserLogic({
    db,
    getAuth,
    getClientUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    request,
}) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

    const callerProfile = await getClientUserProfile(uid);
    if (callerProfile.role !== 'client_manager') {
        throw new HttpsError('permission-denied', 'Apenas gestores podem criar usuarios.');
    }

    const { email, password, displayName, role = 'client_viewer' } = request.data || {};

    if (!CLIENT_MANAGEABLE_ROLES.has(role)) {
        throw new HttpsError('invalid-argument', 'Role invalida. Use client_viewer, client_operator ou client_manager.');
    }
    if (!email || !password || !displayName) {
        throw new HttpsError('invalid-argument', 'Email, senha e nome sao obrigatorios.');
    }

    const tenantId = callerProfile.tenantId;
    const tenantName = callerProfile.tenantName;

    const authUser = await getAuth().createUser({ email, password, displayName });

    try {
        await db.collection('userProfiles').doc(authUser.uid).set({
            email,
            displayName,
            role,
            tenantId,
            tenantName,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await getAuth().setCustomUserClaims(authUser.uid, { role, tenantId });

        await writeAuditEvent({
            action: 'TENANT_USER_CREATED',
            tenantId,
            actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: callerProfile.email || uid },
            entity: { type: 'USER', id: authUser.uid, label: email },
            related: { userId: authUser.uid },
            source: SOURCE.PORTAL_CLIENT,
            ip: getClientIp(request),
            detail: `Usuario ${email} criado pelo gestor ${callerProfile.email}.`,
            templateVars: { targetEmail: email },
        });

        return { uid: authUser.uid };
    } catch (error) {
        await getAuth().deleteUser(authUser.uid).catch(() => {});
        throw error;
    }
}

function createTenantUserHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 120, cors: true },
        async (request) => createTenantUserLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: updateTenantUser
   ========================================================= */
async function updateTenantUserLogic({
    db,
    getAuth,
    getClientUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    request,
}) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

    const callerProfile = await getClientUserProfile(uid);
    if (callerProfile.role !== 'client_manager') {
        throw new HttpsError('permission-denied', 'Apenas gestores podem modificar usuarios.');
    }

    const { targetUid, role, status, displayName } = request.data || {};
    if (!targetUid) {
        throw new HttpsError('invalid-argument', 'ID do usuario alvo e obrigatorio.');
    }

    const targetDoc = await db.collection('userProfiles').doc(targetUid).get();
    if (!targetDoc.exists) {
        throw new HttpsError('not-found', 'Usuario nao encontrado.');
    }
    const targetProfile = targetDoc.data();

    if (targetProfile.tenantId !== callerProfile.tenantId) {
        throw new HttpsError('permission-denied', 'Voce nao pode gerenciar usuarios de outra franquia.');
    }
    if (!CLIENT_VIEW_ROLES.has(targetProfile.role)) {
        throw new HttpsError('permission-denied', 'Este usuario nao pode ser gerenciado por aqui.');
    }
    if (targetUid === uid && role && role !== 'client_manager') {
        throw new HttpsError('invalid-argument', 'Voce nao pode remover seu proprio acesso de gestor.');
    }
    if (targetUid === uid && status === 'inactive') {
        throw new HttpsError('invalid-argument', 'Voce nao pode desativar a si mesmo.');
    }

    const updateData = { updatedAt: FieldValue.serverTimestamp() };

    if (role !== undefined) {
        if (!CLIENT_MANAGEABLE_ROLES.has(role)) {
            throw new HttpsError('invalid-argument', 'Role invalida. Use client_viewer, client_operator ou client_manager.');
        }
        updateData.role = role;
    }
    if (status !== undefined) {
        if (!['active', 'inactive'].includes(status)) {
            throw new HttpsError('invalid-argument', 'Status invalido. Use active ou inactive.');
        }
        updateData.status = status;
        if (status === 'inactive') {
            await getAuth().updateUser(targetUid, { disabled: true });
        } else {
            await getAuth().updateUser(targetUid, { disabled: false });
        }
    }
    if (displayName !== undefined) {
        if (typeof displayName !== 'string' || displayName.trim().length < 2) {
            throw new HttpsError('invalid-argument', 'Nome precisa ter pelo menos 2 caracteres.');
        }
        updateData.displayName = displayName.trim();
    }

    await db.collection('userProfiles').doc(targetUid).update(updateData);

    if (updateData.role) {
        const freshDoc = await db.collection('userProfiles').doc(targetUid).get();
        const freshData = freshDoc.data() || {};
        await getAuth().setCustomUserClaims(targetUid, {
            role: freshData.role,
            tenantId: freshData.tenantId,
        });
    }

    const changes = [];
    if (role) changes.push(`role=${role}`);
    if (status) changes.push(`status=${status}`);
    if (displayName) changes.push(`name=${displayName}`);

    await writeAuditEvent({
        action: 'TENANT_USER_UPDATED',
        tenantId: callerProfile.tenantId,
        actor: { type: ACTOR_TYPE.CLIENT_USER, id: uid, email: callerProfile.email || uid },
        entity: { type: 'USER', id: targetUid, label: targetProfile.email },
        related: { userId: targetUid },
        source: SOURCE.PORTAL_CLIENT,
        ip: getClientIp(request),
        detail: `${targetProfile.email}: ${changes.join(', ')}.`,
        templateVars: { targetEmail: targetProfile.email, changes: changes.join(', ') },
    });

    return { success: true };
}

function createUpdateTenantUserHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => updateTenantUserLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: syncUserClaims
   ========================================================= */
async function syncUserClaimsLogic({ db, getAuth, request }) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

    const callerDoc = await db.collection('userProfiles').doc(uid).get();
    const callerData = callerDoc.data() || {};
    const isAdmin = ['admin', 'owner', 'supervisor'].includes(callerData.role);
    if (!isAdmin) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem sincronizar claims.');
    }

    const { targetUid } = request.data || {};
    if (!targetUid) {
        throw new HttpsError('invalid-argument', 'targetUid e obrigatorio.');
    }

    const targetDoc = await db.collection('userProfiles').doc(targetUid).get();
    if (!targetDoc.exists) {
        throw new HttpsError('not-found', 'Usuario nao encontrado em userProfiles.');
    }

    const targetData = targetDoc.data();
    await getAuth().setCustomUserClaims(targetUid, {
        role: targetData.role,
        tenantId: targetData.tenantId,
    });

    return {
        success: true,
        uid: targetUid,
        role: targetData.role,
        tenantId: targetData.tenantId,
    };
}

function createSyncUserClaimsHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => syncUserClaimsLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: repairAllClaimsInner
   ========================================================= */
async function repairAllClaimsInner({ db, getAuth, request }) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

    const callerDoc = await db.collection('userProfiles').doc(uid).get();
    const callerData = callerDoc.data() || {};
    if (!['admin', 'owner'].includes(callerData.role)) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem executar reparo em massa.');
    }

    const BATCH_SIZE = 500;
    const CONCURRENCY = 10;
    let lastDoc = null;
    let fixed = 0;
    let skipped = 0;
    let errors = 0;
    let total = 0;

    while (true) {
        let q = db.collection('userProfiles')
            .orderBy('__name__')
            .limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);

        const snap = await q.get();
        if (snap.empty) break;

        const batch = snap.docs;
        total += batch.length;
        lastDoc = batch[batch.length - 1];

        for (let i = 0; i < batch.length; i += CONCURRENCY) {
            const chunk = batch.slice(i, i + CONCURRENCY);
            await Promise.all(chunk.map(async (doc) => {
                const data = doc.data();
                const targetUid = doc.id;

                if (!data.role || !data.tenantId) {
                    skipped++;
                    return;
                }

                try {
                    await getAuth().setCustomUserClaims(targetUid, {
                        role: data.role,
                        tenantId: data.tenantId,
                    });
                    fixed++;
                } catch {
                    errors++;
                }
            }));
        }
    }

    return { success: true, total, fixed, skipped, errors };
}

function createRepairAllClaimsHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 300, cors: true },
        async (request) => repairAllClaimsInner({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: listOpsUsers
   ========================================================= */
async function listOpsUsersLogic({ db, getOpsUserProfile, request }) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

    const callerProfile = await getOpsUserProfile(uid);
    assertOpsManager(callerProfile);

    const { tenantId } = request.data || {};
    let q = db.collection('userProfiles');

    if (callerProfile.role === 'supervisor') {
        q = q.where('tenantId', '==', callerProfile.tenantId);
    } else if (callerProfile.role === 'admin' && callerProfile.tenantId) {
        q = q.where('tenantId', '==', callerProfile.tenantId);
    } else if (callerProfile.role === 'admin' && tenantId) {
        q = q.where('tenantId', '==', tenantId);
    }

    const snapshot = await q.get();
    const users = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (!OPS_ROLES.has(data.role)) return;
        users.push({
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName || '',
            role: data.role,
            tenantId: data.tenantId || null,
            tenantName: data.tenantName || '',
            status: data.status || 'active',
            createdAt: data.createdAt || null,
        });
    });

    return { users };
}

function createListOpsUsersHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => listOpsUsersLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: createOpsUser
   ========================================================= */
async function createOpsUserLogic({
    db,
    getAuth,
    getOpsUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    request,
}) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

    const callerProfile = await getOpsUserProfile(uid);
    assertOpsManager(callerProfile);

    const { email, password, displayName, role = 'analyst', tenantId } = request.data || {};

    if (!OPS_MANAGEABLE_ROLES.has(role)) {
        throw new HttpsError('invalid-argument', 'Role invalida. Use analyst, supervisor ou admin.');
    }
    if (!email || !password || !displayName) {
        throw new HttpsError('invalid-argument', 'Email, senha e nome sao obrigatorios.');
    }

    if (callerProfile.role === 'supervisor' && role !== 'analyst') {
        throw new HttpsError('permission-denied', 'Supervisor so pode criar analistas.');
    }

    const targetTenantId = callerProfile.role === 'supervisor'
        ? callerProfile.tenantId
        : (tenantId || callerProfile.tenantId);
    if (!targetTenantId) {
        throw new HttpsError('invalid-argument', 'tenantId obrigatorio para criar usuario operacional.');
    }

    let tenantName = '';
    const tenantDoc = await db.collection('tenantSettings').doc(targetTenantId).get();
    if (tenantDoc.exists) tenantName = tenantDoc.data().name || '';

    const authUser = await getAuth().createUser({
        email,
        password,
        displayName: sanitizeDisplayName(displayName),
    });

    try {
        await db.collection('userProfiles').doc(authUser.uid).set({
            email,
            displayName: sanitizeDisplayName(displayName),
            role,
            tenantId: targetTenantId,
            tenantName,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });

        await getAuth().setCustomUserClaims(authUser.uid, { role, tenantId: targetTenantId });

        await writeAuditEvent({
            action: 'OPS_USER_CREATED',
            tenantId: targetTenantId,
            actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: callerProfile.email || uid },
            entity: { type: 'USER', id: authUser.uid, label: email },
            related: { userId: authUser.uid },
            source: SOURCE.PORTAL_OPS,
            ip: getClientIp(request),
            detail: `Usuario ops ${email} criado com role ${role} por ${callerProfile.email}.`,
            templateVars: { targetEmail: email },
        });

        return { uid: authUser.uid };
    } catch (error) {
        await getAuth().deleteUser(authUser.uid).catch(() => {});
        throw error;
    }
}

function createOpsUserHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', timeoutSeconds: 120, cors: true },
        async (request) => createOpsUserLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: updateOpsUser
   ========================================================= */
async function updateOpsUserLogic({
    db,
    getAuth,
    getOpsUserProfile,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    request,
}) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login necessario.');

    const callerProfile = await getOpsUserProfile(uid);
    assertOpsManager(callerProfile);

    const { targetUid, role, status, displayName, tenantId } = request.data || {};
    if (!targetUid) throw new HttpsError('invalid-argument', 'ID do usuario alvo e obrigatorio.');

    const targetDoc = await db.collection('userProfiles').doc(targetUid).get();
    if (!targetDoc.exists) throw new HttpsError('not-found', 'Usuario nao encontrado.');
    const targetProfile = targetDoc.data();

    if (!OPS_ROLES.has(targetProfile.role)) {
        throw new HttpsError('permission-denied', 'Este usuario nao pode ser gerenciado por aqui.');
    }
    if (callerProfile.role === 'supervisor' && targetProfile.tenantId !== callerProfile.tenantId) {
        throw new HttpsError('permission-denied', 'Voce nao pode gerenciar usuarios de outra franquia.');
    }
    if (callerProfile.role === 'supervisor' && targetProfile.role !== 'analyst') {
        throw new HttpsError('permission-denied', 'Supervisor so pode gerenciar analistas.');
    }
    if (targetUid === uid && role && role !== callerProfile.role) {
        throw new HttpsError('invalid-argument', 'Voce nao pode alterar seu proprio papel.');
    }
    if (targetUid === uid && status === 'inactive') {
        throw new HttpsError('invalid-argument', 'Voce nao pode desativar a si mesmo.');
    }

    const updateData = { updatedAt: FieldValue.serverTimestamp() };

    if (role !== undefined) {
        if (!OPS_MANAGEABLE_ROLES.has(role)) {
            throw new HttpsError('invalid-argument', 'Role invalida. Use analyst, supervisor ou admin.');
        }
        updateData.role = role;
    }
    if (status !== undefined) {
        const normalized = normalizeUserStatus(status);
        updateData.status = normalized;
        if (normalized === 'inactive') {
            await getAuth().updateUser(targetUid, { disabled: true });
        } else {
            await getAuth().updateUser(targetUid, { disabled: false });
        }
    }
    if (displayName !== undefined) {
        const trimmed = sanitizeDisplayName(displayName);
        if (trimmed.length < 2) throw new HttpsError('invalid-argument', 'Nome precisa ter pelo menos 2 caracteres.');
        updateData.displayName = trimmed;
    }
    if (tenantId !== undefined && callerProfile.role !== 'supervisor') {
        updateData.tenantId = tenantId;
        const tDoc = await db.collection('tenantSettings').doc(tenantId).get();
        if (tDoc.exists) updateData.tenantName = tDoc.data().name || '';
    }

    await db.collection('userProfiles').doc(targetUid).update(updateData);

    const freshDoc = await db.collection('userProfiles').doc(targetUid).get();
    const freshData = freshDoc.data() || {};
    await getAuth().setCustomUserClaims(targetUid, {
        role: freshData.role,
        tenantId: freshData.tenantId,
    });

    const changes = [];
    if (role) changes.push(`role=${role}`);
    if (status) changes.push(`status=${status}`);
    if (displayName) changes.push(`name=${sanitizeDisplayName(displayName)}`);
    if (tenantId) changes.push(`tenant=${tenantId}`);

    await writeAuditEvent({
        action: 'OPS_USER_UPDATED',
        tenantId: freshData.tenantId || targetProfile.tenantId || null,
        actor: { type: ACTOR_TYPE.OPS_USER, id: uid, email: callerProfile.email || uid },
        entity: { type: 'USER', id: targetUid, label: targetProfile.email },
        related: { userId: targetUid },
        source: SOURCE.PORTAL_OPS,
        ip: getClientIp(request),
        detail: `${targetProfile.email}: ${changes.join(', ')}.`,
        templateVars: { targetEmail: targetProfile.email, changes: changes.join(', ') },
    });

    return { success: true };
}

function createUpdateOpsUserHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => updateOpsUserLogic({ ...deps, request }),
    );
}

/* =========================================================
   Lógica pura: updateOwnProfile
   ========================================================= */
async function updateOwnProfileLogic({
    db,
    getAuth,
    writeAuditEvent,
    ACTOR_TYPE,
    SOURCE,
    request,
}) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Autenticacao necessaria.');

    const profileDoc = await db.collection('userProfiles').doc(uid).get();
    if (!profileDoc.exists) {
        throw new HttpsError('not-found', 'Perfil nao encontrado.');
    }

    const { displayName, portal } = request.data || {};
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
        throw new HttpsError('invalid-argument', 'Nome precisa ter pelo menos 2 caracteres.');
    }
    const trimmed = displayName.trim();
    if (trimmed.length > 80) {
        throw new HttpsError('invalid-argument', 'Nome pode ter no maximo 80 caracteres.');
    }

    await db.collection('userProfiles').doc(uid).update({
        displayName: trimmed,
        updatedAt: FieldValue.serverTimestamp(),
    });
    await getAuth().updateUser(uid, { displayName: trimmed });

    const profileData = profileDoc.data();
    const isOps = portal === 'ops' || String(profileData.role).startsWith('analyst') || String(profileData.role).startsWith('supervisor') || String(profileData.role).startsWith('admin');

    await writeAuditEvent({
        action: 'OWN_PROFILE_UPDATED',
        tenantId: profileData.tenantId || null,
        actor: { type: isOps ? ACTOR_TYPE.OPS_USER : ACTOR_TYPE.CLIENT_USER, id: uid, email: profileData.email || uid, displayName: trimmed },
        entity: { type: 'PROFILE', id: uid, label: trimmed },
        related: { userId: uid },
        source: isOps ? SOURCE.PORTAL_OPS : SOURCE.PORTAL_CLIENT,
        ip: getClientIp(request),
        detail: `displayName: ${trimmed}`,
        templateVars: { actorName: trimmed },
    });

    return { success: true, displayName: trimmed };
}

function createUpdateOwnProfileHandler(deps) {
    return onCall(
        { region: 'southamerica-east1', cors: true },
        async (request) => updateOwnProfileLogic({ ...deps, request }),
    );
}

/* =========================================================
   Exports
   ========================================================= */
module.exports = {
    // Factories
    createOpsClientUserHandler,
    createListTenantUsersHandler,
    createTenantUserHandler,
    createUpdateTenantUserHandler,
    createSyncUserClaimsHandler,
    createRepairAllClaimsHandler,
    createListOpsUsersHandler,
    createOpsUserHandler,
    createUpdateOpsUserHandler,
    createUpdateOwnProfileHandler,
    // Lógicas puras (para testes)
    createOpsClientUserLogic,
    listTenantUsersLogic,
    createTenantUserLogic,
    updateTenantUserLogic,
    syncUserClaimsLogic,
    repairAllClaimsInner,
    listOpsUsersLogic,
    createOpsUserLogic,
    updateOpsUserLogic,
    updateOwnProfileLogic,
    // Helpers
    normalizeTenantSlug,
    sanitizeDisplayName,
    normalizeUserStatus,
    canManageOpsUsers,
    assertOpsManager,
    getClientIp,
    OPS_ROLES,
    CLIENT_VIEW_ROLES,
    CLIENT_MANAGEABLE_ROLES,
    OPS_MANAGEABLE_ROLES,
};
