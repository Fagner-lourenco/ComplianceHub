import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicReportPage from './PublicReportPage';

const mocks = vi.hoisted(() => ({
    getPublicReportView: vi.fn(),
    generatePublicReportPdf: vi.fn(),
    triggerPdfDownload: vi.fn(),
}));

vi.mock('../core/firebase/firestoreService', () => ({
    getPublicReportView: (...args) => mocks.getPublicReportView(...args),
    generatePublicReportPdf: (...args) => mocks.generatePublicReportPdf(...args),
    triggerPdfDownload: (...args) => mocks.triggerPdfDownload(...args),
}));

vi.mock('../core/formatDate', () => ({
    formatDateTimeBR: (v) => (v ? String(v) : '—'),
}));

function makeError(message, code) {
    const err = new Error(message);
    if (code) err.code = code;
    return err;
}

function Wrapper({ initialRoute = '/r/test-token' }) {
    return (
        <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
                <Route path="/r/:token" element={<PublicReportPage />} />
                <Route path="/demo/r/:caseId" element={<PublicReportPage />} />
            </Routes>
        </MemoryRouter>
    );
}

const VALID_REPORT_VIEW = {
    html: '<html><body><h1>Relatório Teste</h1></body></html>',
    token: 'test-token-last12',
    candidateName: 'João Silva',
    caseId: 'case-123',
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2099-12-31T00:00:00.000Z',
    reportBuildVersion: 4,
    publicSnapshotHash: 'abc123def456',
};

describe('PublicReportPage', () => {
    beforeEach(() => {
        mocks.getPublicReportView.mockReset();
        mocks.generatePublicReportPdf.mockReset();
        mocks.triggerPdfDownload.mockReset();
    });

    it('renderiza relatório válido', async () => {
        mocks.getPublicReportView.mockResolvedValue(VALID_REPORT_VIEW);
        render(<Wrapper />);

        await waitFor(() => expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument());
        expect(screen.getByTitle(/Relatório Público/i)).toBeInTheDocument();
    });

    it('mostra tela de revogado quando active=false', async () => {
        mocks.getPublicReportView.mockRejectedValue(makeError('Relatorio revogado.'));
        render(<Wrapper />);

        await waitFor(() => expect(screen.getByRole('heading', { name: /Este link foi desativado/i })).toBeInTheDocument());
        expect(screen.getByText(/Solicite um novo link/)).toBeInTheDocument();
    });

    it('mostra tela de expirado quando expiresAt passado', async () => {
        mocks.getPublicReportView.mockRejectedValue(makeError('Link expirado.'));
        render(<Wrapper />);

        await waitFor(() => expect(screen.getByText(/Este link não está mais disponível/i)).toBeInTheDocument());
    });

    it('mostra tela de em revisão quando case.status !== DONE', async () => {
        mocks.getPublicReportView.mockRejectedValue(makeError('Relatorio em revisao.'));
        render(<Wrapper />);

        await waitFor(() => expect(screen.getByText(/Relatório em revisão/i)).toBeInTheDocument());
        expect(screen.getByText(/sendo revisado/)).toBeInTheDocument();
    });

    it('mostra tela de não encontrado quando relatório não existe', async () => {
        mocks.getPublicReportView.mockRejectedValue(makeError('not found', 'not-found'));
        render(<Wrapper />);

        await waitFor(() => expect(screen.getByText(/Relatório não encontrado/i)).toBeInTheDocument());
    });

    it('mostra tela de erro de rede em caso de falha', async () => {
        mocks.getPublicReportView.mockRejectedValue(new Error('network'));
        render(<Wrapper />);

        await waitFor(() => expect(screen.getByText(/Erro de conexão/i)).toBeInTheDocument());
    });

    it('renderiza demo route com caseId', async () => {
        render(<Wrapper initialRoute="/demo/r/CASE-001" />);

        await waitFor(() => expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument());
        expect(screen.getByTitle(/Relatório Público/i)).toBeInTheDocument();
    });

    it('mostra não encontrado para demo route inválida', async () => {
        render(<Wrapper initialRoute="/demo/r/INVALID" />);

        await waitFor(() => expect(screen.getByText(/Relatório não encontrado/i)).toBeInTheDocument());
    });
});
