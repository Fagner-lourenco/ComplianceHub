/**
 * Application: Create Custom Profile Use Case
 */

const { getFirestore } = require('firebase-admin/firestore');
const { COLLECTIONS } = require('../../constants/collections');
const { resolveSections, inferMacroAreasFromSections } = require('../../domain/dossierSchema');

const db = getFirestore();

/**
 * Create a custom profile for a tenant.
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.createdBy — UID
 * @param {string} params.name
 * @param {string} params.description
 * @param {'pf'|'pj'} params.subjectType
 * @param {string[]} params.sourceKeys
 * @returns {Promise<object>}
 */
async function execute(params) {
  const { tenantId, createdBy, name, description, subjectType, sourceKeys } = params;

  if (!name || name.length < 2) {
    const error = new Error('Nome do perfil deve ter pelo menos 2 caracteres.');
    error.code = 'INVALID_ARGUMENT';
    error.statusCode = 400;
    throw error;
  }

  if (!sourceKeys || sourceKeys.length === 0) {
    const error = new Error('Selecione pelo menos uma fonte.');
    error.code = 'INVALID_ARGUMENT';
    error.statusCode = 400;
    throw error;
  }

  // Resolve sections from sourceKeys via schema registry
  const { SECTION_REGISTRY } = require('../../domain/dossierSchema');
  const sectionKeys = [];
  for (const [sectionKey, section] of Object.entries(SECTION_REGISTRY)) {
    if (section.sourceKeys?.some(sk => sourceKeys.includes(sk))) {
      sectionKeys.push(sectionKey);
    }
  }

  const macroAreaKeys = inferMacroAreasFromSections(sectionKeys);

  const profileRef = db.collection('customProfiles').doc();
  const now = new Date();

  const data = {
    tenantId,
    createdBy,
    name,
    description: description || '',
    subjectType,
    sourceKeys,
    sectionKeys: [...new Set(sectionKeys)],
    macroAreaKeys: [...new Set(macroAreaKeys)],
    bdcDatasets: sourceKeys
      .filter(sk => sk.startsWith('bigdatacorp_'))
      .map(sk => sk.replace('bigdatacorp_', '')),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await profileRef.set(data);

  return { id: profileRef.id, ...data };
}

module.exports = { execute };
