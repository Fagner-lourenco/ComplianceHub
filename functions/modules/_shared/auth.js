/**
 * Módulo de autenticação e autorização (RBAC/Auth/Profile)
 * Extraído do monolito index.js — funções puras de perfil e permissão.
 *
 * Recebe dependências via factory para evitar hardcode de db.
 * O objeto deps é mantido por referência, permitindo que db seja
 * substituído dinamicamente (ex: em testes via _setDb).
 */

function createAuthModule(deps) {
    function canAssignCases(profile = {}) {
        return ['supervisor', 'admin', 'owner'].includes(profile.role);
    }

    function assertCanAssignCase(profile) {
        if (!canAssignCases(profile)) throw new deps.HttpsError('permission-denied', 'Sem permissao para atribuir casos.');
    }

    async function getOpsUserProfile(uid) {
        const profileDoc = await deps.db.collection('userProfiles').doc(uid).get();
        if (!profileDoc.exists || !deps.OPS_ROLES.has(profileDoc.data().role)) {
            throw new deps.HttpsError('permission-denied', 'Apenas analistas podem re-executar fases do pipeline.');
        }
        const profile = profileDoc.data();
        if (profile.status === 'inactive') {
            throw new deps.HttpsError('permission-denied', 'Conta desativada. Contate o gestor da franquia.');
        }
        return profile;
    }

    /**
     * Assert that an ops user can access a case.
     * Validates: case exists, tenant isolation, user is active.
     * Throws HttpsError with appropriate code if any check fails.
     */
    function assertOpsCanAccessCase(profile, caseData, caseId) {
        if (!caseData) {
            throw new deps.HttpsError('not-found', 'Caso nao encontrado.');
        }
        if (!caseData.tenantId) {
            throw new deps.HttpsError('failed-precondition', `Caso ${caseId || ''} sem tenantId.`);
        }
        if (!profile.tenantId && (profile.role === 'admin' || profile.role === 'owner')) {
            return;
        }
        if (caseData.tenantId && caseData.tenantId !== profile.tenantId) {
            throw new deps.HttpsError('permission-denied', 'Sem permissao para operar neste caso.');
        }
    }

    async function getClientUserProfile(uid, { requireRequester = false } = {}) {
        const profileDoc = await deps.db.collection('userProfiles').doc(uid).get();
        if (!profileDoc.exists) {
            throw new deps.HttpsError('permission-denied', 'Perfil do cliente nao encontrado.');
        }

        const profile = profileDoc.data() || {};
        const allowedRoles = requireRequester ? deps.CLIENT_REQUESTER_ROLES : deps.CLIENT_VIEW_ROLES;
        if (!allowedRoles.has(profile.role)) {
            throw new deps.HttpsError('permission-denied', 'Perfil do cliente sem permissao para esta operacao.');
        }
        if (!profile.tenantId) {
            throw new deps.HttpsError('failed-precondition', 'Cliente sem tenantId associado.');
        }
        if (profile.status === 'inactive') {
            throw new deps.HttpsError('permission-denied', 'Conta desativada. Contate o gestor da franquia.');
        }
        return profile;
    }

    function assertClientManager(profile) {
        if (profile?.role !== 'client_manager') {
            throw new deps.HttpsError('permission-denied', 'Operacao disponivel apenas para gestores.');
        }
    }

    return {
        canAssignCases,
        assertCanAssignCase,
        getOpsUserProfile,
        assertOpsCanAccessCase,
        getClientUserProfile,
        assertClientManager,
    };
}

module.exports = createAuthModule;
