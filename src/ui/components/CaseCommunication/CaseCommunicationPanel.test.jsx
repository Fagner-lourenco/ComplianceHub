import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CaseCommunicationPanel from './CaseCommunicationPanel';

const mocks = vi.hoisted(() => ({
    subscribeToCaseMessages: vi.fn(),
    callMarkCaseCommunicationRead: vi.fn(),
    callSendCaseMessage: vi.fn(),
}));

vi.mock('../../../core/auth/useAuth', () => ({
    useAuth: () => ({ user: { uid: 'ops-1' } }),
}));

vi.mock('../../../core/firebase/firestoreService', () => ({
    subscribeToCaseMessages: (...args) => mocks.subscribeToCaseMessages(...args),
    callMarkCaseCommunicationRead: (...args) => mocks.callMarkCaseCommunicationRead(...args),
    callSendCaseMessage: (...args) => mocks.callSendCaseMessage(...args),
}));

describe('CaseCommunicationPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.callMarkCaseCommunicationRead.mockResolvedValue({});
        mocks.callSendCaseMessage.mockResolvedValue({});
    });

    it('renderiza mensagens legadas que usam content em vez de body', async () => {
        mocks.subscribeToCaseMessages.mockImplementation((_caseId, _tenantId, callback) => {
            callback([
                {
                    id: 'msg-1',
                    senderUid: 'client-1',
                    senderName: 'Cliente Teste',
                    content: 'Mensagem legada visivel',
                    createdAt: '2026-06-01T10:00:00.000Z',
                },
            ], null);
            return () => {};
        });

        render(<CaseCommunicationPanel caseId="case-1" caseData={{ tenantId: 'tenant-1' }} />);

        expect(await screen.findByText('Mensagem legada visivel')).toBeInTheDocument();
    });
});
