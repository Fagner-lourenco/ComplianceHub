import { describe, expect, it } from 'vitest';
import { buildProviderDivergenceResolution } from './v2ProviderDivergences.js';

describe('v2ProviderDivergences', () => {
    it('resolve divergencia aberta e remove bloqueio de publicacao com auditoria minima', () => {
        const result = buildProviderDivergenceResolution({
            divergence: { status: 'open', blocksPublication: true },
            payload: { status: 'resolved', resolution: 'Fonte principal confirmada manualmente.' },
            actor: { uid: 'senior-1', email: 'senior@example.com' },
            resolvedAt: '2026-04-22T00:00:00.000Z',
        });

        expect(result).toMatchObject({
            status: 'resolved',
            resolution: 'Fonte principal confirmada manualmente.',
            resolvedBy: 'senior-1',
            resolvedByEmail: 'senior@example.com',
            resolvedAt: '2026-04-22T00:00:00.000Z',
            blocksPublication: false,
            resolutionAudit: {
                previousStatus: 'open',
                previousBlocksPublication: true,
                nextStatus: 'resolved',
                nextBlocksPublication: false,
            },
        });
    });

    it('mantem bloqueio quando resolucao pede nova consulta', () => {
        const result = buildProviderDivergenceResolution({
            divergence: { status: 'open', blocksPublication: true },
            payload: { status: 'needs_recheck', resolution: 'Reconsultar provider antes da publicacao.' },
        });

        expect(result.status).toBe('needs_recheck');
        expect(result.blocksPublication).toBe(true);
    });

    it('rejeita status invalido', () => {
        expect(() => buildProviderDivergenceResolution({
            payload: { status: 'published', resolution: 'x' },
        })).toThrow('Status de divergencia invalido');
    });

    it('exige justificativa', () => {
        expect(() => buildProviderDivergenceResolution({
            payload: { status: 'resolved', resolution: '   ' },
        })).toThrow('Justificativa da resolucao obrigatoria');
    });
});
