import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    callCreateClientSolicitation: vi.fn(),
    subscribeToCaseDoc: vi.fn(() => () => {}),
    subscribeToModuleRunsForCase: vi.fn(() => () => {}),
    subscribeToRiskSignalsForCase: vi.fn(() => () => {}),
    subscribeToTimelineEventsForCase: vi.fn(() => () => {}),
    navigate: vi.fn(),
    authState: {
        user: { uid: 'client-1', email: 'client@acme.com' },
        userProfile: { tenantId: 'tenant-1', role: 'client_operator' },
    },
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => mocks.authState,
}));

vi.mock('react-router-dom', async (orig) => {
    const actual = await orig();
    return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('../../core/firebase/firestoreService', async (orig) => {
    const actual = await orig();
    return {
        ...actual,
        callCreateClientSolicitation: (...args) => mocks.callCreateClientSolicitation(...args),
        subscribeToCaseDoc: (...args) => mocks.subscribeToCaseDoc(...args),
        subscribeToModuleRunsForCase: (...args) => mocks.subscribeToModuleRunsForCase(...args),
        subscribeToRiskSignalsForCase: (...args) => mocks.subscribeToRiskSignalsForCase(...args),
        subscribeToTimelineEventsForCase: (...args) => mocks.subscribeToTimelineEventsForCase(...args),
    };
});

import AnaliseRapidaPage from './AnaliseRapidaPage';
import { MemoryRouter } from 'react-router-dom';

function renderPage() {
    return render(
        <MemoryRouter initialEntries={['/client/analise']}>
            <AnaliseRapidaPage />
        </MemoryRouter>,
    );
}

describe('AnaliseRapidaPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders hero with CPF/CNPJ entry', () => {
        renderPage();
        expect(screen.getByTestId('analise-doc-input')).toBeInTheDocument();
        expect(screen.getByTestId('analise-submit')).toBeInTheDocument();
        expect(screen.getByTestId('analise-doc-tag').textContent.trim()).toBe('—');
    });

    it('tags as PF when 11-digit CPF typed', () => {
        renderPage();
        const input = screen.getByTestId('analise-doc-input');
        fireEvent.change(input, { target: { value: '390.533.447-05' } });
        expect(screen.getByTestId('analise-doc-tag').textContent.trim()).toBe('PF');
    });

    it('tags as PJ when CNPJ typed', () => {
        renderPage();
        const input = screen.getByTestId('analise-doc-input');
        fireEvent.change(input, { target: { value: '11.222.333/0001-81' } });
        expect(screen.getByTestId('analise-doc-tag').textContent.trim()).toBe('PJ');
    });

    it('blocks submit when CPF invalid', async () => {
        renderPage();
        fireEvent.change(screen.getByTestId('analise-name-input'), { target: { value: 'John Doe' } });
        fireEvent.change(screen.getByTestId('analise-doc-input'), { target: { value: '111.111.111-11' } });
        await act(async () => {
            fireEvent.click(screen.getByTestId('analise-submit'));
        });
        expect(mocks.callCreateClientSolicitation).not.toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toMatch(/invalido/i);
    });

    it('submits valid CPF payload', async () => {
        mocks.callCreateClientSolicitation.mockResolvedValue({ caseId: 'case-123' });
        renderPage();
        fireEvent.change(screen.getByTestId('analise-name-input'), { target: { value: 'Fulano de Tal' } });
        fireEvent.change(screen.getByTestId('analise-doc-input'), { target: { value: '390.533.447-05' } });
        await act(async () => {
            fireEvent.click(screen.getByTestId('analise-submit'));
        });
        expect(mocks.callCreateClientSolicitation).toHaveBeenCalledWith(expect.objectContaining({
            productKey: 'dossier_pf_basic',
            fullName: 'Fulano de Tal',
            cpf: '390.533.447-05',
        }));
        expect(mocks.subscribeToCaseDoc).toHaveBeenCalledWith('case-123', expect.any(Function));
        expect(mocks.subscribeToModuleRunsForCase).toHaveBeenCalled();
        expect(mocks.subscribeToRiskSignalsForCase).toHaveBeenCalled();
    });

    it('routes CNPJ payload through dossier_pj product', async () => {
        mocks.callCreateClientSolicitation.mockResolvedValue({ caseId: 'case-pj' });
        renderPage();
        fireEvent.change(screen.getByTestId('analise-name-input'), { target: { value: 'ACME Industria Ltda' } });
        fireEvent.change(screen.getByTestId('analise-doc-input'), { target: { value: '11.222.333/0001-81' } });
        await act(async () => {
            fireEvent.click(screen.getByTestId('analise-submit'));
        });
        expect(mocks.callCreateClientSolicitation).toHaveBeenCalledWith(expect.objectContaining({
            productKey: 'dossier_pj',
            cnpj: expect.stringMatching(/11\.222\.333\/0001-81/),
        }));
    });

    it('shows running phase with progress subscriptions feeding state', async () => {
        mocks.callCreateClientSolicitation.mockResolvedValue({ caseId: 'case-xyz' });
        let caseCb; let modulesCb; let signalsCb;
        mocks.subscribeToCaseDoc.mockImplementation((_id, cb) => { caseCb = cb; return () => {}; });
        mocks.subscribeToModuleRunsForCase.mockImplementation((_id, cb) => { modulesCb = cb; return () => {}; });
        mocks.subscribeToRiskSignalsForCase.mockImplementation((_id, cb) => { signalsCb = cb; return () => {}; });

        renderPage();
        fireEvent.change(screen.getByTestId('analise-name-input'), { target: { value: 'Fulano de Tal' } });
        fireEvent.change(screen.getByTestId('analise-doc-input'), { target: { value: '390.533.447-05' } });
        await act(async () => {
            fireEvent.click(screen.getByTestId('analise-submit'));
        });

        await act(async () => {
            caseCb({ id: 'case-xyz', status: 'IN_PROGRESS', tenantId: 'tenant-1' });
            modulesCb([
                { moduleKey: 'identity_pf', status: 'completed_no_findings' },
                { moduleKey: 'criminal', status: 'running' },
            ]);
            signalsCb([{ id: 's1', moduleKey: 'criminal', severity: 'medium', reason: 'Sinal' }]);
        });

        expect(screen.getByTestId('analise-progress-label').textContent).toMatch(/%$/);
        expect(screen.getByTestId('analise-risk-bucket').textContent.toLowerCase()).toContain('atencao');
        expect(screen.getByTestId('analise-card-identity_pf')).toBeInTheDocument();
        expect(screen.getByTestId('analise-card-criminal')).toBeInTheDocument();
    });

    it('shows final CTA when case reaches DONE', async () => {
        mocks.callCreateClientSolicitation.mockResolvedValue({ caseId: 'case-done' });
        let caseCb; let modulesCb;
        mocks.subscribeToCaseDoc.mockImplementation((_id, cb) => { caseCb = cb; return () => {}; });
        mocks.subscribeToModuleRunsForCase.mockImplementation((_id, cb) => { modulesCb = cb; return () => {}; });

        renderPage();
        fireEvent.change(screen.getByTestId('analise-name-input'), { target: { value: 'Fulano de Tal' } });
        fireEvent.change(screen.getByTestId('analise-doc-input'), { target: { value: '390.533.447-05' } });
        await act(async () => {
            fireEvent.click(screen.getByTestId('analise-submit'));
        });

        await act(async () => {
            modulesCb([{ moduleKey: 'identity_pf', status: 'completed_no_findings' }]);
            caseCb({ id: 'case-done', status: 'DONE', tenantId: 'tenant-1', publicReportToken: null });
        });

        expect(screen.getByTestId('analise-final')).toBeInTheDocument();
        expect(screen.getByTestId('analise-open-report')).toBeInTheDocument();
        expect(screen.getByTestId('analise-progress-label').textContent).toBe('100%');
    });
});
