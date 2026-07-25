/**
 * Testes para EnrichmentPipeline
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EnrichmentPipeline from './EnrichmentPipeline';

describe('EnrichmentPipeline', () => {
    const baseCase = {
        bigdatacorpEnrichmentStatus: 'DONE',
        juditEnrichmentStatus: 'DONE',
        escavadorEnrichmentStatus: 'DONE',
        escavador2EnrichmentStatus: 'DONE',
        djenEnrichmentStatus: 'DONE',
        enrichmentStatus: 'DONE',
        autoClassifiedAt: new Date(),
    };

    it('renderiza provider AI como SKIPPED quando IA desabilitada e sem resultados', () => {
        render(<EnrichmentPipeline caseData={baseCase} aiEnabled={false} />);
        const items = screen.getAllByText(/Análise assistida/i);
        const row = items[0].closest('.enrichment-pipeline__item');
        expect(row).toHaveClass('enrichment-pipeline__item--skipped');
        expect(screen.getByText('Ignorado')).toBeInTheDocument();
    });

    it('renderiza provider AI como PENDING quando IA habilitada e sem resultados', () => {
        render(<EnrichmentPipeline caseData={baseCase} aiEnabled />);
        const items = screen.getAllByText(/Análise assistida/i);
        const row = items[0].closest('.enrichment-pipeline__item');
        expect(row).toHaveClass('enrichment-pipeline__item--pending');
    });

    it('renderiza provider AI como DONE quando há resultado', () => {
        const caseData = {
            ...baseCase,
            aiClassificationReview: { summary: 'OK' },
        };
        render(<EnrichmentPipeline caseData={caseData} aiEnabled />);
        const items = screen.getAllByText(/Análise assistida/i);
        const row = items[0].closest('.enrichment-pipeline__item');
        expect(row).toHaveClass('enrichment-pipeline__item--done');
    });

    it('não exibe botão de reexecutar IA quando desabilitada', () => {
        render(<EnrichmentPipeline caseData={baseCase} aiEnabled={false} onRetryPhase={vi.fn()} />);
        const aiButton = screen.queryByTitle('Reexecutar Análise assistida');
        expect(aiButton).not.toBeInTheDocument();
    });

    it('exibe botão de reexecutar IA quando habilitada e concluída', () => {
        const caseData = {
            ...baseCase,
            aiClassificationReview: { summary: 'OK' },
        };
        render(<EnrichmentPipeline caseData={caseData} aiEnabled onRetryPhase={vi.fn()} />);
        expect(screen.getByTitle('Reexecutar Análise assistida')).toBeInTheDocument();
    });

    describe('provider Crédito e Restrições', () => {
        it('exibe linha quando fase habilitada no caso', () => {
            const caseData = {
                ...baseCase,
                enabledPhases: ['criminal', 'creditRestriction'],
                creditEnrichmentStatus: 'DONE',
                creditCostBRL: 1.8,
            };
            render(<EnrichmentPipeline caseData={caseData} />);
            const row = screen.getByText('Crédito e Restrições (Quod)').closest('.enrichment-pipeline__item');
            expect(row).toHaveClass('enrichment-pipeline__item--done');
        });

        it('oculta linha quando fase não habilitada e sem status', () => {
            const caseData = { ...baseCase, enabledPhases: ['criminal'] };
            render(<EnrichmentPipeline caseData={caseData} />);
            expect(screen.queryByText('Crédito e Restrições (Quod)')).not.toBeInTheDocument();
        });

        it('exibe linha mesmo sem fase habilitada quando ha status gravado (caso legado)', () => {
            const caseData = { ...baseCase, enabledPhases: ['criminal'], creditEnrichmentStatus: 'SKIPPED' };
            render(<EnrichmentPipeline caseData={caseData} />);
            expect(screen.getByText('Crédito e Restrições (Quod)')).toBeInTheDocument();
        });

        it('permite reexecutar quando terminal com erro', () => {
            const caseData = {
                ...baseCase,
                enabledPhases: ['creditRestriction'],
                creditEnrichmentStatus: 'FAILED',
                creditError: 'Quantum: erro interno (-1301)',
            };
            render(<EnrichmentPipeline caseData={caseData} onRetryPhase={vi.fn()} />);
            expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
        });
    });

    it('chama onRetryPhase com ai ao reexecutar IA habilitada', () => {
        const onRetry = vi.fn();
        const caseData = {
            ...baseCase,
            aiClassificationReview: { summary: 'OK' },
        };
        render(<EnrichmentPipeline caseData={caseData} aiEnabled onRetryPhase={onRetry} />);
        fireEvent.click(screen.getByTitle('Reexecutar Análise assistida'));
        expect(onRetry).toHaveBeenCalledWith('ai');
    });

    it('shows Escavador2 queued status when callback status is QUEUED', () => {
        render(<EnrichmentPipeline caseData={{
            bigdatacorpEnrichmentStatus: 'DONE',
            juditEnrichmentStatus: 'DONE',
            escavadorEnrichmentStatus: 'SKIPPED',
            djenEnrichmentStatus: 'SKIPPED',
            escavador2EnrichmentStatus: 'RUNNING',
            escavador2CallbackStatus: 'QUEUED',
            escavador2TaskId: 'projects/p/locations/l/queues/q/tasks/t1',
        }} />);

        expect(screen.getByText(/Escavador2/i)).toBeInTheDocument();
        expect(screen.getByText(/Em fila/i)).toBeInTheDocument();
    });
});
