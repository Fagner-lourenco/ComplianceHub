/**
 * Normalizer: BigDataCorp Occupation
 * Transforms BDC occupation_data response into canonical professional data.
 */

/**
 * Normalize occupation data.
 * @param {object} occupationData — Result[0].ProfessionData or Result[0].OccupationData
 * @returns {object|null}
 */
function normalizeOccupation(occupationData) {
  if (!occupationData) return null;

  const jobs = (occupationData.Jobs || []).map(job => ({
    title: job.Title || '',
    company: job.Company || '',
    sector: job.Sector || '',
    startDate: job.StartDate || null,
    endDate: job.EndDate || null,
    isCurrent: !job.EndDate,
  }));

  return {
    jobs,
    incomeRange: occupationData.IncomeRange || '',
    employeesRange: occupationData.EmployeesRange || '',
    isPublicServer: occupationData.IsPublicServer === true,
    sector: occupationData.Sector || '',
  };
}

module.exports = { normalizeOccupation };
