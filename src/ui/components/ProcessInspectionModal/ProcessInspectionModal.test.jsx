import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProcessInspectionModal from './ProcessInspectionModal';

function renderModal(dataOverrides = {}) {
    return render(
        <ProcessInspectionModal
            process={{
                source: 'ESCAVADOR2',
                cnj: '0001234-56.2024.8.26.0100',
                data: {
                    tribunalAcronym: 'TJSP',
                    area: 'CRIMINAL',
                    isCriminal: true,
                    ...dataOverrides,
                },
            }}
            djenTimeline={[]}
            onClose={() => {}}
        />,
    );
}

describe('ProcessInspectionModal', () => {
    it('mostra status processual real no badge', () => {
        renderModal({ status: 'ARQUIVADO' });
        expect(screen.getByText('ARQUIVADO')).toBeInTheDocument();
    });

    it('nao exibe status de pipeline (DONE/SKIPPED) persistido em casos antigos', () => {
        renderModal({ status: 'detalhes: DONE | movimentacoes: DONE | documentos: SKIPPED' });
        expect(screen.queryByText(/DONE/)).toBeNull();
        expect(screen.queryByText(/SKIPPED/)).toBeNull();
    });

    it('renderiza sem badge de status quando status ausente', () => {
        renderModal({ status: null });
        expect(screen.getByText('0001234-56.2024.8.26.0100')).toBeInTheDocument();
    });
});
