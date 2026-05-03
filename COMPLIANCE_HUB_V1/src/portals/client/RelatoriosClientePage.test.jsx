import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RelatoriosClientePage from './RelatoriosClientePage';
import * as firestoreService from '../../core/firebase/firestoreService';

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => ({
        user: { uid: 'u1' },
        userProfile: { tenantId: 'TEN-001', role: 'client_manager' },
    }),
}));

vi.mock('../../data/mockData', () => ({
    getMockPublicReports: () => [
        {
            id: 'r1',
            token: 'r1',
            caseId: 'CASE-001',
            tenantId: 'TEN-001',
            candidateName: 'João Silva',
            active: true,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: 'r2',
            token: 'r2',
            caseId: 'CASE-002',
            tenantId: 'TEN-001',
            candidateName: 'Maria Souza',
            active: false,
            status: 'REVOKED',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ],
}));

describe('RelatoriosClientePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renderiza lista de relatórios e resumo', async () => {
        vi.spyOn(firestoreService, 'fetchClientPublicReports').mockResolvedValue({
            reports: [
                {
                    id: 'r1',
                    token: 'r1',
                    caseId: 'CASE-001',
                    tenantId: 'TEN-001',
                    candidateName: 'João Silva',
                    active: true,
                    status: 'ACTIVE',
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                },
            ],
            hasMore: false,
            nextCursor: null,
        });

        render(<RelatoriosClientePage />);
        await waitFor(() => expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1));
        expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Ativos').length).toBeGreaterThanOrEqual(1);
    });

    it('filtra por status', async () => {
        vi.spyOn(firestoreService, 'fetchClientPublicReports').mockResolvedValue({
            reports: [
                {
                    id: 'r1', token: 'r1', caseId: 'CASE-001', candidateName: 'João Silva',
                    active: true, status: 'ACTIVE', createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                },
                {
                    id: 'r2', token: 'r2', caseId: 'CASE-002', candidateName: 'Maria Souza',
                    active: false, status: 'REVOKED', createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                },
            ],
            hasMore: false,
            nextCursor: null,
        });

        render(<RelatoriosClientePage />);
        await waitFor(() => expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1));

        const select = screen.getByLabelText('Filtrar por status');
        fireEvent.change(select, { target: { value: 'REVOGADO' } });

        await waitFor(() => {
            expect(screen.queryAllByText('João Silva')).toHaveLength(0);
            expect(screen.getAllByText('Maria Souza').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('abre modal de confirmação ao revogar', async () => {
        vi.spyOn(firestoreService, 'fetchClientPublicReports').mockResolvedValue({
            reports: [
                {
                    id: 'r1', token: 'r1', caseId: 'CASE-001', candidateName: 'João Silva',
                    active: true, status: 'ACTIVE', createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                },
            ],
            hasMore: false,
            nextCursor: null,
        });
        vi.spyOn(firestoreService, 'revokeClientPublicReport').mockResolvedValue({ success: true });

        render(<RelatoriosClientePage />);
        await waitFor(() => expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1));

        const revokeBtns = screen.getAllByRole('button', { name: /Revogar/i });
        fireEvent.click(revokeBtns[0]);

        await waitFor(() => expect(screen.getByText(/Revogar relatório público/i)).toBeInTheDocument());
        expect(screen.getByText(/Candidato:/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Revogar relatório/i })).toBeInTheDocument();
    });

    it('não usa window.confirm', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
        vi.spyOn(firestoreService, 'fetchClientPublicReports').mockResolvedValue({
            reports: [
                {
                    id: 'r1', token: 'r1', caseId: 'CASE-001', candidateName: 'João Silva',
                    active: true, status: 'ACTIVE', createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                },
            ],
            hasMore: false,
            nextCursor: null,
        });

        render(<RelatoriosClientePage />);
        await waitFor(() => expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1));

        const revokeBtns = screen.getAllByRole('button', { name: /Revogar/i });
        fireEvent.click(revokeBtns[0]);

        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('exibe recorte quando há mais páginas', async () => {
        vi.spyOn(firestoreService, 'fetchClientPublicReports').mockResolvedValue({
            reports: [
                {
                    id: 'r1', token: 'r1', caseId: 'CASE-001', candidateName: 'João Silva',
                    active: true, status: 'ACTIVE', createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                },
            ],
            hasMore: true,
            nextCursor: new Date().toISOString(),
        });

        render(<RelatoriosClientePage />);
        await waitFor(() => expect(screen.getByText(/Mostrando 1 relatórios mais recentes/i)).toBeInTheDocument());
        expect(screen.getByRole('button', { name: /Carregar mais relatórios/i })).toBeInTheDocument();
    });
});
