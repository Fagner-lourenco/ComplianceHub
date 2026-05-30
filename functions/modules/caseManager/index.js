/**
 * caseManager/index.js — Módulo de gerenciamento de casos
 * Reúne funções de filtro, busca, serialização e estatísticas de casos
 */

const caseFilters = require('./caseFilters');

module.exports = {
    ...caseFilters,
};
