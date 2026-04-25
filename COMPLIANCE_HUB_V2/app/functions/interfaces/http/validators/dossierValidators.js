/**
 * Validators: Dossier Input Validation
 */

const { validateDocument } = require('../../../helpers/cpfCnpj');

/**
 * Validate create dossier request body.
 * @param {object} body
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateCreateDossier(body = {}) {
  const errors = [];

  if (!body.document) {
    errors.push('document é obrigatório.');
  } else {
    const validation = validateDocument(body.document);
    if (!validation.valid) {
      errors.push('document deve ser um CPF ou CNPJ válido.');
    }
  }

  if (!body.name || body.name.trim().length < 2) {
    errors.push('name deve ter pelo menos 2 caracteres.');
  }

  const validPresets = ['compliance', 'internacional', 'financeiro', 'investigativo', 'juridico', 'pld', 'rh'];
  if (body.presetKey && !validPresets.includes(body.presetKey)) {
    errors.push(`presetKey inválido. Use: ${validPresets.join(', ')}.`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCreateDossier };
