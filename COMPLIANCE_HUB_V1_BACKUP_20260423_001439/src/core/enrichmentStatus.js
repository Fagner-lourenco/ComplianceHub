export function getOverallEnrichmentStatus(caseData) {
    const statuses = [
        caseData?.juditEnrichmentStatus,
        caseData?.escavadorEnrichmentStatus,
        caseData?.enrichmentStatus,
    ].filter(Boolean);

    if (statuses.includes('RUNNING')) return 'RUNNING';
    if (statuses.includes('BLOCKED')) return 'BLOCKED';
    if (statuses.includes('PARTIAL')) return 'PARTIAL';
    // BUG-6 fix: If any provider DONE + another FAILED, report PARTIAL (not DONE).
    if (statuses.includes('FAILED') && statuses.includes('DONE')) return 'PARTIAL';
    if (statuses.includes('FAILED')) return 'FAILED';
    if (statuses.includes('DONE')) return 'DONE';
    return 'PENDING';
}
