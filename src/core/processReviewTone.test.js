import { describe, expect, it } from 'vitest';
import { getProcessReviewTone } from './processReviewTone';

describe('getProcessReviewTone', () => {
    it('does not treat labor discrimination subject as criminal (no substring CRIM match)', () => {
        const tone = getProcessReviewTone({
            isCriminal: false,
            area: 'TRABALHISTA',
            assunto: 'Discriminação racial',
            specificRole: 'RECLAMANTE',
        });

        expect(tone.level).toBe('neutral');
    });

    it('marks criminal defendant as material', () => {
        const tone = getProcessReviewTone({
            isCriminal: true,
            assunto: 'ROUBO MAJORADO',
            specificRole: 'REU',
            isDefendant: true,
        });

        expect(tone.level).toBe('material');
        expect(tone.className).toBe('caso-flag-chip--red');
    });

    it('marks traffic/environmental defendant as review, not material (aligned with backend policy)', () => {
        const tone = getProcessReviewTone({
            isCriminal: true,
            assunto: 'EMBRIAGUEZ AO VOLANTE (ART.306 - CTB)',
            specificRole: 'REU',
            isDefendant: true,
        });

        expect(tone.level).toBe('review');
    });

    it('marks compound victim role as low risk', () => {
        const tone = getProcessReviewTone({
            isCriminal: true,
            assunto: 'ESTELIONATO',
            specificRole: 'VITIMA DE ESTELIONATO',
        });

        expect(tone.level).toBe('low');
    });

    it('marks neutral role in criminal process as review', () => {
        const tone = getProcessReviewTone({
            isCriminal: true,
            assunto: 'HOMICIDIO QUALIFICADO',
            specificRole: 'INTERESSADO',
        });

        expect(tone.level).toBe('review');
        expect(tone.message).toMatch(/revis/i);
    });

    it('infers criminality from subject keywords when flag is absent', () => {
        const tone = getProcessReviewTone({
            assunto: 'HOMICIDIO SIMPLES',
            specificRole: 'REU',
        });

        expect(tone.level).toBe('material');
    });
});
