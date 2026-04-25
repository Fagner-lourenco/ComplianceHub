/**
 * Helper: CPF / CNPJ validation and formatting.
 */

/**
 * Remove non-digit characters.
 * @param {string} value
 * @returns {string}
 */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Validate CPF (11 digits, check digits).
 * @param {string} cpf
 * @returns {boolean}
 */
function isValidCpf(cpf) {
  const clean = digitsOnly(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  let remainder;
  for (let i = 1; i <= 9; i++) sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11))) return false;

  return true;
}

/**
 * Validate CNPJ (14 digits, check digits).
 * @param {string} cnpj
 * @returns {boolean}
 */
function isValidCnpj(cnpj) {
  const clean = digitsOnly(cnpj);
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size += 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Auto-detect type and validate document.
 * @param {string} document
 * @returns {{valid: boolean, type: 'pf' | 'pj' | null}}
 */
function validateDocument(document) {
  const clean = digitsOnly(document);
  if (clean.length === 11 && isValidCpf(clean)) {
    return { valid: true, type: 'pf' };
  }
  if (clean.length === 14 && isValidCnpj(clean)) {
    return { valid: true, type: 'pj' };
  }
  return { valid: false, type: null };
}

/**
 * Format CPF: 05023290336 -> 050.232.903-36
 * @param {string} cpf
 * @returns {string}
 */
function formatCpf(cpf) {
  const clean = digitsOnly(cpf);
  if (clean.length !== 11) return clean;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Format CNPJ: 00001002000105 -> 00.001.002/0001-05
 * @param {string} cnpj
 * @returns {string}
 */
function formatCnpj(cnpj) {
  const clean = digitsOnly(cnpj);
  if (clean.length !== 14) return clean;
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Auto-format document based on length.
 * @param {string} document
 * @returns {string}
 */
function formatDocument(document) {
  const clean = digitsOnly(document);
  if (clean.length === 11) return formatCpf(clean);
  if (clean.length === 14) return formatCnpj(clean);
  return clean;
}

module.exports = {
  digitsOnly,
  isValidCpf,
  isValidCnpj,
  validateDocument,
  formatCpf,
  formatCnpj,
  formatDocument,
};
