/**
 * modules/index.js — Registro central de módulos refatorados
 * Durante a transição, cada módulo pode re-exportar funções do monolito
 * ou conter implementações próprias.
 */

const caseManager = require('./caseManager');
const _shared = require('./_shared');
const tenantUserManagement = require('./tenantUserManagement');

module.exports = {
    caseManager,
    _shared,
    tenantUserManagement,
};
