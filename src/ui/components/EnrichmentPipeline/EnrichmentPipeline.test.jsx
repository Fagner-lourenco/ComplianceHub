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
});
