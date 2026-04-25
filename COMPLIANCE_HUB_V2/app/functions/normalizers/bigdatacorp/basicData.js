/**
 * Normalizer: BigDataCorp Basic Data
 * Transforms BDC basic_data response into canonical Subject fields.
 */

const {
  normalizeBasicDataPF,
  normalizeBasicDataPJ,
} = require('../../domain/v2NormalizationRules');

/**
 * Normalize BDC BasicData for a Person (PF).
 * @param {object} bdcResult — Result[0].BasicData from BDC
 * @returns {object} normalized basicData block
 */
function normalizeBasicDataPessoa(bdcResult) {
  if (!bdcResult) return null;
  return normalizeBasicDataPF(bdcResult);
}

/**
 * Normalize BDC BasicData for a Company (PJ).
 * @param {object} bdcResult — Result[0].BasicData from BDC
 * @returns {object} normalized basicData block
 */
function normalizeBasicDataEmpresa(bdcResult) {
  if (!bdcResult) return null;
  return normalizeBasicDataPJ(bdcResult);
}

/**
 * Normalize extended contact data.
 * @param {object} bdcResult — Result[0] with Emails, Phones, Addresses
 * @returns {object} { emails, phones, addresses }
 */
function normalizeContacts(bdcResult) {
  if (!bdcResult) return { emails: [], phones: [], addresses: [] };

  // Support both inline (basic_data combined) and extended dataset formats
  const rawEmails = bdcResult.Emails
    || (bdcResult.ExtendedEmails?.Emails)
    || [];
  const rawPhones = bdcResult.Phones
    || (bdcResult.ExtendedPhones?.Phones)
    || [];
  const rawAddresses = bdcResult.Addresses
    || (bdcResult.ExtendedAddresses?.Addresses)
    || [];

  const emails = rawEmails.map(e => ({
    email: e.Email || '',
    type: e.Type || '',
    validationStatus: e.ValidationStatus || '',
    lastSeen: e.LastSeen || null,
  }));

  const phones = rawPhones.map(p => ({
    phone: p.Phone || '',
    type: p.Type || '',
    ddd: p.DDD || '',
    validationStatus: p.ValidationStatus || '',
    lastSeen: p.LastSeen || null,
  }));

  const addresses = rawAddresses.map(a => ({
    street: a.Street || '',
    number: a.Number || '',
    neighborhood: a.Neighborhood || '',
    city: a.City || '',
    state: a.State || '',
    zipcode: a.Zipcode || '',
    type: a.Type || '',
    lastSeen: a.LastSeen || null,
  }));

  // Include aggregate stats when available from extended datasets
  const stats = {
    emails: {
      total: bdcResult.ExtendedEmails?.TotalEmails || emails.length,
      active: bdcResult.ExtendedEmails?.TotalActiveEmails || null,
      personal: bdcResult.ExtendedEmails?.TotalPersonalEmails || null,
      work: bdcResult.ExtendedEmails?.TotalWorkEmails || null,
      unique: bdcResult.ExtendedEmails?.TotalUniqueEmails || null,
      badPassages: bdcResult.ExtendedEmails?.TotalBadEmailPassages || null,
      newestPassageDate: bdcResult.ExtendedEmails?.NewestEmailPassageDate || null,
      oldestPassageDate: bdcResult.ExtendedEmails?.OldestEmailPassageDate || null,
    },
    phones: {
      total: bdcResult.ExtendedPhones?.TotalPhones || phones.length,
      active: bdcResult.ExtendedPhones?.TotalActivePhones || null,
      personal: bdcResult.ExtendedPhones?.TotalPersonalPhones || null,
      work: bdcResult.ExtendedPhones?.TotalWorkPhones || null,
      unique: bdcResult.ExtendedPhones?.TotalUniquePhones || null,
      badPassages: bdcResult.ExtendedPhones?.TotalBadPhonePassages || null,
      totalPassages: bdcResult.ExtendedPhones?.TotalPhonePassages || null,
      last3MonthsPassages: bdcResult.ExtendedPhones?.TotalLast3MonthsPassages || null,
      last6MonthsPassages: bdcResult.ExtendedPhones?.TotalLast6MonthsPassages || null,
      last12MonthsPassages: bdcResult.ExtendedPhones?.TotalLast12MonthsPassages || null,
      last18MonthsPassages: bdcResult.ExtendedPhones?.TotalLast18MonthsPassages || null,
      newestPassageDate: bdcResult.ExtendedPhones?.NewestPhonePassageDate || null,
      oldestPassageDate: bdcResult.ExtendedPhones?.OldestPhonePassageDate || null,
    },
    addresses: {
      total: bdcResult.ExtendedAddresses?.TotalAddresses || addresses.length,
      active: bdcResult.ExtendedAddresses?.TotalActiveAddresses || null,
      personal: bdcResult.ExtendedAddresses?.TotalPersonalAddresses || null,
      work: bdcResult.ExtendedAddresses?.TotalWorkAddresses || null,
      unique: bdcResult.ExtendedAddresses?.TotalUniqueAddresses || null,
      badPassages: bdcResult.ExtendedAddresses?.TotalBadAddressPassages || null,
      totalPassages: bdcResult.ExtendedAddresses?.TotalAddressPassages || null,
      newestPassageDate: bdcResult.ExtendedAddresses?.NewestAddressPassageDate || null,
      oldestPassageDate: bdcResult.ExtendedAddresses?.OldestAddressPassageDate || null,
    },
  };

  return { emails, phones, addresses, stats };
}

module.exports = {
  normalizeBasicDataPessoa,
  normalizeBasicDataEmpresa,
  normalizeContacts,
};
