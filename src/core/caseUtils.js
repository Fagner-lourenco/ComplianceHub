export function getCaseStats(cases) {
    if (!cases || !Array.isArray(cases)) {
        return { total: 0, done: 0, pending: 0, inProgress: 0, corrections: 0, red: 0, fit: 0, attention: 0, notRecommended: 0 };
    }

    const total = cases.length;
    const done = cases.filter((caseData) => caseData.status === 'DONE').length;
    const pending = cases.filter((caseData) => caseData.status === 'PENDING').length;
    const inProgress = cases.filter((caseData) => ['IN_PROGRESS', 'WAITING_INFO'].includes(caseData.status)).length;
    const corrections = cases.filter((caseData) => caseData.status === 'CORRECTION_NEEDED').length;
    const red = cases.filter((caseData) => caseData.riskLevel === 'RED').length;
    const fit = cases.filter((caseData) => caseData.finalVerdict === 'FIT').length;
    const attention = cases.filter((caseData) => caseData.finalVerdict === 'ATTENTION').length;
    const notRecommended = cases.filter((caseData) => caseData.finalVerdict === 'NOT_RECOMMENDED').length;

    return { total, done, pending, inProgress, corrections, red, fit, attention, notRecommended };
}
