import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

const casoPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    authState: {
        user: { uid: 'ops-1', email: 'fagner.alexandro.lourenco@gmail.com' },
        userProfile: { role: 'admin' },
    },
    subscribeToCaseDoc: vi.fn(),
    subscribeToCaseAuditLogs: vi.fn(() => () => {}),
    callSaveCaseDraftByAnalyst: vi.fn(),
    callSetAiDecisionByAnalyst: vi.fn(),
    callReturnCaseToClient: vi.fn(),
    callConcludeCaseByAnalyst: vi.fn(),
}));

vi.mock('../../core/auth/useAuth', () => ({
    useAuth: () => casoPageMocks.authState,
}));

vi.mock('../../core/firebase/firestoreService', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        subscribeToCaseDoc: (...args) => casoPageMocks.subscribeToCaseDoc(...args),
        subscribeToCaseAuditLogs: (...args) => casoPageMocks.subscribeToCaseAuditLogs(...args),
        callSaveCaseDraftByAnalyst: (...args) => casoPageMocks.callSaveCaseDraftByAnalyst(...args),
        callSetAiDecisionByAnalyst: (...args) => casoPageMocks.callSetAiDecisionByAnalyst(...args),
        callReturnCaseToClient: (...args) => casoPageMocks.callReturnCaseToClient(...args),
        callConcludeCaseByAnalyst: (...args) => casoPageMocks.callConcludeCaseByAnalyst(...args),
    };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => casoPageMocks.navigate,
        useParams: () => ({ caseId: 'CASE-999' }),
    };
});

const { default: CasoPage } = await import('./CasoPage');

describe('CasoPage', () => {
    beforeEach(() => {
        casoPageMocks.subscribeToCaseDoc.mockReset();
        casoPageMocks.subscribeToCaseAuditLogs.mockReset();
        casoPageMocks.subscribeToCaseAuditLogs.mockImplementation(() => () => {});
        casoPageMocks.callSaveCaseDraftByAnalyst.mockReset();
        casoPageMocks.callSetAiDecisionByAnalyst.mockReset();
        casoPageMocks.callReturnCaseToClient.mockReset();
        casoPageMocks.callConcludeCaseByAnalyst.mockReset();
    });

    it('nao exibe caso mock quando a rota real nao existe', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            // Simulate case not found
            setTimeout(() => callback(null, null), 0);
            return () => {}; // unsubscribe
        });

        render(<CasoPage />);

        expect(await screen.findByText('Caso indisponivel')).toBeInTheDocument();
        expect(screen.getByText('Caso nao encontrado no ambiente real.')).toBeInTheDocument();
        expect(screen.queryByText('Ana Paula Oliveira')).not.toBeInTheDocument();
        expect(screen.queryByText('TechCorp Inc.')).not.toBeInTheDocument();
    });

    it('exibe analise especializada de homonimos quando presente no caso', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Andre Luiz de Souza',
                cpf: '12345678901',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                aiHomonymTriggered: true,
                aiHomonymStructuredOk: true,
                aiHomonymStructured: {
                    decision: 'LIKELY_HOMONYM',
                    confidence: 'MEDIUM',
                    homonymRisk: 'HIGH',
                    justification: 'Geografia distante e ausencia de CPF exato reduzem a aderencia do vinculo.',
                    evidenceFor: ['Nome coincide com o candidato.'],
                    evidenceAgainst: ['Processo encontrado apenas por nome em UF distante.'],
                    unknowns: ['Nao ha data de nascimento nas partes do processo.'],
                    recommendedAction: 'MANUAL_REVIEW',
                    processAssessments: [
                        {
                            cnj: '0001234-55.2024.8.16.0001',
                            decision: 'LIKELY_HOMONYM',
                            reason: 'Processo em estado distante sem CPF ou mae coincidente.',
                        },
                    ],
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Analise de Homonimos por IA')).toBeInTheDocument();
        expect(screen.getByText('Geografia distante e ausencia de CPF exato reduzem a aderencia do vinculo.')).toBeInTheDocument();
        expect(screen.getByText('Leitura por processo')).toBeInTheDocument();
        expect(screen.getByText('Processo encontrado apenas por nome em UF distante.')).toBeInTheDocument();
    });

    it('exibe cobertura, evidencias ambiguas e safety net no card geral da IA', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Diego Emanuel Alves de Souza',
                cpf: '10794180329',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                coverageLevel: 'LOW_COVERAGE',
                criminalEvidenceQuality: 'NEGATIVE_WITH_PARTIAL_COVERAGE',
                coverageNotes: ['Nenhum provider retornou processo aproveitavel.'],
                ambiguityNotes: ['A cobertura geral das fontes ficou reduzida.'],
                negativePartialSafetyNetTriggered: true,
                negativePartialSafetyNetAction: 'RUN_ESCAVADOR',
                negativePartialSafetyNetReasons: ['LOW_COVERAGE', 'JUDIT_ZERO_PROCESS'],
                aiStructuredOk: true,
                aiStructured: {
                    resumo: 'Caso negativo com cobertura parcial; validar melhor antes da conclusao.',
                    evidencias: ['Judit nao encontrou processo confirmado por CPF.'],
                    evidenciasAmbiguas: ['Ha ruído residual por nome em fonte secundaria.'],
                    inconsistencias: [],
                    incertezas: ['Escavador ainda nao executado.'],
                    cobertura: 'PARTIAL_COVERAGE',
                    riscoHomonimo: 'MEDIUM',
                    confianca: 'LOW',
                    revisaoManualSugerida: true,
                    justificativa: 'A cobertura parcial nao sustenta fechamento automatico.',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Análise de IA', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('Evidencias ambiguas')).toBeInTheDocument();
        expect(screen.getByText('Ha ruído residual por nome em fonte secundaria.')).toBeInTheDocument();
        expect(screen.getByText('Revisao manual: Sim')).toBeInTheDocument();
        expect(screen.getByText('Safety net de cobertura parcial')).toBeInTheDocument();
        expect(screen.getByText(/Rodar Escavador/i)).toBeInTheDocument();
    });

    it('usa prefillNarratives para resumo executivo, apontamentos e justificativa final', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Francisco Taciano de Sousa',
                cpf: '05023290336',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'POSITIVE',
                criminalSeverity: 'HIGH',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'POSITIVE',
                prefillNarratives: {
                    executiveSummary: 'Resumo consolidado com mandado ativo, processos criminais relevantes e ressalva de divergencia entre providers.',
                    criminalNotes: 'Existe evidencia criminal confirmada, com processo penal e suporte de mais de um provider.',
                    laborNotes: 'Nao foram identificados processos trabalhistas relevantes nas fontes consultadas.',
                    warrantNotes: 'Mandado de prisao pendente de cumprimento localizado na Judit, com impacto operacional direto.',
                    keyFindings: ['Mandado ativo pendente de cumprimento.', 'Ha processo criminal confirmado com suporte cruzado.'],
                    finalJustification: 'O veredito final deve refletir o mandado ativo e a confirmacao criminal, mesmo com algum ruido por nome.',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Francisco Taciano de Sousa')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Proximo'));
        fireEvent.click(screen.getByText('Proximo'));
        fireEvent.click(screen.getByText('Proximo'));
        fireEvent.click(screen.getByText('Proximo'));

        expect(await screen.findByLabelText('Resumo executivo')).toHaveValue('Resumo consolidado com mandado ativo, processos criminais relevantes e ressalva de divergencia entre providers.');
        expect(screen.getByLabelText('Principais apontamentos')).toHaveValue('Mandado ativo pendente de cumprimento.\nHa processo criminal confirmado com suporte cruzado.');
        expect(screen.getByLabelText('Justificativa final do veredito')).toHaveValue('O veredito final deve refletir o mandado ativo e a confirmacao criminal, mesmo com algum ruido por nome.');
    });

    it('nao sobrescreve campo editado pelo analista quando o mesmo caso recebe update assincrono', async () => {
        let caseCallback = null;
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            caseCallback = callback;
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Francisco Taciano de Sousa',
                cpf: '05023290336',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'POSITIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                prefillNarratives: {
                    warrantNotes: 'Nenhum mandado confirmado ate o momento.',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Francisco Taciano de Sousa')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Proximo'));
        fireEvent.click(screen.getByText('Proximo'));
        fireEvent.click(screen.getByText('Proximo'));

        const warrantTextarea = screen.getByDisplayValue('Nenhum mandado confirmado ate o momento.');
        fireEvent.change(warrantTextarea, { target: { value: 'Analista revisando o mandado com cautela.' } });

        await act(async () => {
            caseCallback({
                id: 'CASE-999',
                status: 'IN_PROGRESS',
                candidateName: 'Francisco Taciano de Sousa',
                cpf: '05023290336',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'POSITIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'POSITIVE',
                juditActiveWarrantCount: 1,
                prefillNarratives: {
                    warrantNotes: 'Mandado ativo confirmado pela Judit.',
                },
            }, null);
        });

        expect(screen.getByDisplayValue('Analista revisando o mandado com cautela.')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Mandado ativo confirmado pela Judit.')).not.toBeInTheDocument();
    });
});
