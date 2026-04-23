const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function severityToMinScore(severity) {
    if (severity === 'critical') return 85;
    if (severity === 'high') return 60;
    if (severity === 'medium') return 30;
    return 0;
}

export function resolveV2Risk(riskSignals = []) {
    if (!Array.isArray(riskSignals) || riskSignals.length === 0) {
        return { riskScore: 0, riskLevel: 'GREEN', topSignals: [], signalCount: 0 };
    }

    const sorted = [...riskSignals].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4),
    );

    const hasCritical = sorted.some((s) => s.severity === 'critical');
    const hasHigh = sorted.some((s) => s.severity === 'high');

    const baseScore = Math.max(...sorted.map((s) => {
        const impact = typeof s.scoreImpact === 'number' ? s.scoreImpact : severityToMinScore(s.severity);
        return Math.min(100, Math.max(0, impact));
    }));

    const secondary = sorted.slice(1).reduce((acc, s) => {
        const impact = typeof s.scoreImpact === 'number' ? s.scoreImpact : severityToMinScore(s.severity);
        return acc + Math.min(10, impact * 0.15);
    }, 0);

    const riskScore = Math.min(100, Math.round(baseScore + secondary));

    let riskLevel;
    if (hasCritical || riskScore >= 80) {
        riskLevel = 'RED';
    } else if (hasHigh || riskScore >= 30) {
        riskLevel = 'YELLOW';
    } else {
        riskLevel = 'GREEN';
    }

    return {
        riskScore,
        riskLevel,
        topSignals: sorted.slice(0, 3),
        signalCount: riskSignals.length,
    };
}
