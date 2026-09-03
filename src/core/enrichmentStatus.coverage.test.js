/**
 * Cobertura por fonte — o aviso que o analista passa a ver.
 *
 * Contexto (2026-09): o painel do caso só listava provedores com status DONE,
 * então uma fonte que falhou desaparecia da tela. Em 42,6% dos casos "limpos"
 * concluídos havia alguma fonte em FAILED/SKIPPED/PENDING, e ninguém via.
 *
 * Regra de produto: avisar, nunca bloquear. E fonte que a empresa não contratou
 * não é lacuna — é escopo, e não pode virar alarme falso.
 */
import { describe, it, expect } from 'vitest';
import { getCoverageGaps, hasCoverageGap, describeCoverageReason } from './enrichmentStatus';

describe('getCoverageGaps', () => {
    it('não acusa lacuna quando todas as fontes responderam', () => {
        const gaps = getCoverageGaps({
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavador2EnrichmentStatus: 'DONE',
            djenEnrichmentStatus: 'DONE',
        });
        expect(gaps).toEqual([]);
        expect(hasCoverageGap({ bigdatacorpEnrichmentStatus: 'DONE', juditEnrichmentStatus: 'DONE' })).toBe(false);
    });

    it('não trata fonte não contratada pela empresa como lacuna', () => {
        const caseData = {
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            escavadorSkippedReason: 'disabled_for_tenant',
            aiStatus: 'SKIPPED',
        };
        const gaps = getCoverageGaps(caseData);
        expect(gaps.map((g) => g.provider)).not.toContain('Escavador');
    });

    it('não acusa lacuna quando a fonte não era necessária no caso', () => {
        const gaps = getCoverageGaps({
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            escavadorSkippedReason: 'not_needed',
        });
        expect(gaps).toEqual([]);
    });

    it('acusa alta severidade quando o fornecedor estava fora do ar', () => {
        const gaps = getCoverageGaps({
            juditEnrichmentStatus: 'SKIPPED',
            juditSkippedReason: 'circuit_open',
        });
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toEqual(expect.objectContaining({
            provider: 'Judit',
            status: 'SKIPPED',
            reason: 'circuit_open',
            severity: 'alto',
        }));
        expect(gaps[0].reasonLabel).toMatch(/indispon/i);
    });

    it('acusa alta severidade quando a fonte falhou', () => {
        const gaps = getCoverageGaps({ juditEnrichmentStatus: 'FAILED' });
        expect(gaps[0]).toEqual(expect.objectContaining({ provider: 'Judit', status: 'FAILED', severity: 'alto' }));
    });

    it('distingue SKIPPED por configuração de SKIPPED por circuito aberto', () => {
        const porConfig = getCoverageGaps({
            escavador2EnrichmentStatus: 'SKIPPED',
            escavador2SkippedReason: 'sub_phase_disabled',
        });
        const porCircuito = getCoverageGaps({
            escavador2EnrichmentStatus: 'SKIPPED',
            escavador2SkippedReason: 'circuit_open',
        });
        expect(porConfig).toEqual([]);
        expect(porCircuito).toHaveLength(1);
        expect(porCircuito[0].severity).toBe('alto');
    });

    it('SKIPPED sem motivo gravado ainda aparece — dado legado não pode virar silêncio', () => {
        const gaps = getCoverageGaps({ juditEnrichmentStatus: 'SKIPPED' });
        expect(gaps).toHaveLength(1);
        expect(gaps[0].reason).toBeNull();
        expect(gaps[0].severity).toBe('medio');
    });

    it('acusa fase que ficou pendente ou rodando', () => {
        expect(getCoverageGaps({ escavador2EnrichmentStatus: 'PENDING' })[0].severity).toBe('medio');
        expect(getCoverageGaps({ escavador2EnrichmentStatus: 'RUNNING' })[0].severity).toBe('medio');
    });

    it('reporta PARTIAL como cobertura incompleta', () => {
        const gaps = getCoverageGaps({ escavador2EnrichmentStatus: 'PARTIAL' });
        expect(gaps[0]).toEqual(expect.objectContaining({ status: 'PARTIAL', severity: 'medio' }));
    });

    it('lista várias lacunas de uma vez', () => {
        const gaps = getCoverageGaps({
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'FAILED',
            escavador2EnrichmentStatus: 'SKIPPED',
            escavador2SkippedReason: 'circuit_open',
            djenEnrichmentStatus: 'PARTIAL',
        });
        expect(gaps.map((g) => g.provider).sort()).toEqual(['DJEN', 'Escavador2', 'Judit']);
        expect(hasCoverageGap({ juditEnrichmentStatus: 'FAILED' })).toBe(true);
    });

    it('tolera caso vazio', () => {
        expect(getCoverageGaps(null)).toEqual([]);
        expect(getCoverageGaps({})).toEqual([]);
    });
});

describe('describeCoverageReason', () => {
    it('traduz os motivos para linguagem do analista', () => {
        expect(describeCoverageReason('disabled_for_tenant')).toMatch(/contratada/i);
        expect(describeCoverageReason('circuit_open')).toMatch(/indispon/i);
        expect(describeCoverageReason('identity_gate_not_passed')).toMatch(/identidade/i);
        expect(describeCoverageReason('motivo_inexistente')).toBeNull();
    });
});
