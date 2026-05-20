// =============================================================================
// SYNC: Este arquivo é o mirror ESM de functions/shared/riskCalculator.js.
// Deve ser mantido idêntico ao arquivo backend correspondente (exceto export style).
// Qualquer alteração aqui DEVE ser espelhada em functions/shared/riskCalculator.js.
// =============================================================================

export const LEGACY_PHASES = ['criminal', 'labor', 'warrant', 'osint', 'social', 'digital', 'conflictInterest'];

export const BASE_SCORES = {
    NEGATIVE: 0,
    NEGATIVE_PARTIAL: 18,
    NOT_FOUND: 5,
    INCONCLUSIVE: 40,
    INCONCLUSIVE_HOMONYM: 45,
    INCONCLUSIVE_LOW_COVERAGE: 38,
    POSITIVE: 90,
    LOW: 0,
    UNKNOWN: 20,
    MEDIUM: 50,
    HIGH: 90,
    APPROVED: 0,
    NEUTRAL: 10,
    CONCERN: 50,
    CONTRAINDICATED: 90,
    CLEAN: 0,
    NOT_CHECKED: 10,
    ALERT: 45,
    CRITICAL: 85,
    NO: 0,
    YES: 60,
};

/**
 * Calcula riskScore, riskLevel e suggestedVerdict a partir das flags do formulário.
 *
 * Regras de score:
 *  - Cada fase habilitada contribui com um score base (BASE_SCORES[flag]).
 *  - Criminal POSITIVE com severity override: HIGH=95, LOW=75, MEDIUM=90.
 *  - riskScore = máximo dos scores de fase.
 *  - Sinais amarelos (ambiguidade/atenção): se >= 2, adiciona +15 ao score (cap 100).
 *  - CPF pendente de regularização (P2-011): conta como 1 sinal amarelo.
 *    Se isolado (score < 30), força score mínimo de 25 e nível YELLOW.
 *  - riskLevel: RED se phaseScore >= 80; YELLOW se score >= 30; GREEN caso contrário.
 *  - suggestedVerdict: NOT_RECOMMENDED se score >= 70; ATTENTION se >= 30; FIT caso contrário.
 *
 * @param {Object} form
 *   @param {string} [form.criminalFlag]
 *   @param {string} [form.criminalSeverity]   HIGH | MEDIUM | LOW
 *   @param {string} [form.laborFlag]
 *   @param {string} [form.warrantFlag]
 *   @param {string} [form.osintLevel]
 *   @param {string} [form.socialStatus]
 *   @param {string} [form.digitalFlag]
 *   @param {string} [form.conflictInterest]
 *   @param {boolean} [form.cpfPendingRegularization]  do pipeline de enriquecimento
 * @param {string[]} [enabledPhases]  padrão: LEGACY_PHASES
 * @returns {{ riskScore: number, riskLevel: string, suggestedVerdict: string }}
 */
export function calculateRisk(form, enabledPhases) {
    const ep = Array.isArray(enabledPhases) && enabledPhases.length > 0
        ? enabledPhases
        : LEGACY_PHASES;

    // ── 1. Scores por fase ───────────────────────────────────────────────────
    const phaseScores = [];

    if (ep.includes('criminal')) {
        let criminalScore = BASE_SCORES[form.criminalFlag] || 0;
        if (form.criminalFlag === 'POSITIVE') {
            if (form.criminalSeverity === 'HIGH') criminalScore = 95;
            else if (form.criminalSeverity === 'LOW') criminalScore = 75;
            // MEDIUM mantém 90
        }
        phaseScores.push(criminalScore);
    }
    if (ep.includes('labor'))            phaseScores.push(BASE_SCORES[form.laborFlag]        || 0);
    if (ep.includes('warrant'))          phaseScores.push(BASE_SCORES[form.warrantFlag]      || 0);
    if (ep.includes('osint'))            phaseScores.push(BASE_SCORES[form.osintLevel]       || 0);
    if (ep.includes('social'))           phaseScores.push(BASE_SCORES[form.socialStatus]     || 0);
    if (ep.includes('digital'))          phaseScores.push(BASE_SCORES[form.digitalFlag]      || 0);
    if (ep.includes('conflictInterest')) phaseScores.push(BASE_SCORES[form.conflictInterest] || 0);

    let riskScore = Math.max(...phaseScores, 0);

    // ── 2. Sinais amarelos (+15 se >= 2) ─────────────────────────────────────
    const yellowSignals = [
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE',
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE_HOMONYM',
        ep.includes('criminal') && form.criminalFlag === 'INCONCLUSIVE_LOW_COVERAGE',
        ep.includes('criminal') && form.criminalFlag === 'NEGATIVE_PARTIAL',
        ep.includes('labor')    && form.laborFlag    === 'INCONCLUSIVE',
        ep.includes('warrant')  && form.warrantFlag  === 'INCONCLUSIVE',
        ep.includes('osint')    && form.osintLevel   === 'MEDIUM',
        ep.includes('social')   && form.socialStatus === 'CONCERN',
        ep.includes('digital')  && form.digitalFlag  === 'ALERT',
        // P2-011: CPF pendente é sinal amarelo cadastral
        form.cpfPendingRegularization === true,
    ].filter(Boolean).length;

    if (yellowSignals >= 2) {
        riskScore = Math.min(100, riskScore + 15);
    }

    // ── 3. Nível de risco ─────────────────────────────────────────────────────
    // Alinhado com suggestedVerdict: score >= 70 → RED, >= 30 → YELLOW, < 30 → GREEN.
    // (Melhoria sobre o algoritmo anterior que usava phaseScores >= 80 para RED,
    //  causando POSITIVE LOW severity (score=75) aparecer como YELLOW em vez de RED.)
    let riskLevel = 'GREEN';
    if (riskScore >= 70) {
        riskLevel = 'RED';
    } else if (riskScore >= 30) {
        riskLevel = 'YELLOW';
    }

    // CPF pendente isolado em caso limpo: score mínimo 30 → automaticamente YELLOW
    if (form.cpfPendingRegularization === true && riskScore < 30) {
        riskScore = 30;
        riskLevel = 'YELLOW';
    }

    // ── 4. Veredito sugerido ──────────────────────────────────────────────────
    let suggestedVerdict = 'FIT';
    if (riskScore >= 70) {
        suggestedVerdict = 'NOT_RECOMMENDED';
    } else if (riskScore >= 30) {
        suggestedVerdict = 'ATTENTION';
    }

    // CPF pendente sozinho não pode ser FIT
    if (form.cpfPendingRegularization === true && suggestedVerdict === 'FIT') {
        suggestedVerdict = 'ATTENTION';
    }

    return { riskScore, riskLevel, suggestedVerdict };
}
