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
    subscribeToModuleRunsForCase: vi.fn(() => () => {}),
    subscribeToEvidenceItemsForCase: vi.fn(() => () => {}),
    subscribeToRiskSignalsForCase: vi.fn(() => () => {}),
    subscribeToRelationshipsForCase: vi.fn(() => () => {}),
    subscribeToTimelineEventsForCase: vi.fn(() => () => {}),
    subscribeToProviderDivergencesForCase: vi.fn(() => () => {}),
    fetchSubjectDecisionHistory: vi.fn(() => Promise.resolve([])),
    callSaveCaseDraftByAnalyst: vi.fn(),
    callSetAiDecisionByAnalyst: vi.fn(),
    callReturnCaseToClient: vi.fn(),
    callConcludeCaseByAnalyst: vi.fn(),
    callResolveProviderDivergenceByAnalyst: vi.fn(),
    callCreateWatchlist: vi.fn(),
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
        subscribeToModuleRunsForCase: (...args) => casoPageMocks.subscribeToModuleRunsForCase(...args),
        subscribeToEvidenceItemsForCase: (...args) => casoPageMocks.subscribeToEvidenceItemsForCase(...args),
        subscribeToRiskSignalsForCase: (...args) => casoPageMocks.subscribeToRiskSignalsForCase(...args),
        subscribeToRelationshipsForCase: (...args) => casoPageMocks.subscribeToRelationshipsForCase(...args),
        subscribeToTimelineEventsForCase: (...args) => casoPageMocks.subscribeToTimelineEventsForCase(...args),
        subscribeToProviderDivergencesForCase: (...args) => casoPageMocks.subscribeToProviderDivergencesForCase(...args),
        fetchSubjectDecisionHistory: (...args) => casoPageMocks.fetchSubjectDecisionHistory(...args),
        callSaveCaseDraftByAnalyst: (...args) => casoPageMocks.callSaveCaseDraftByAnalyst(...args),
        callSetAiDecisionByAnalyst: (...args) => casoPageMocks.callSetAiDecisionByAnalyst(...args),
        callReturnCaseToClient: (...args) => casoPageMocks.callReturnCaseToClient(...args),
        callConcludeCaseByAnalyst: (...args) => casoPageMocks.callConcludeCaseByAnalyst(...args),
        callResolveProviderDivergenceByAnalyst: (...args) => casoPageMocks.callResolveProviderDivergenceByAnalyst(...args),
        callCreateWatchlist: (...args) => casoPageMocks.callCreateWatchlist(...args),
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
        casoPageMocks.subscribeToModuleRunsForCase.mockReset();
        casoPageMocks.subscribeToModuleRunsForCase.mockImplementation(() => () => {});
        casoPageMocks.subscribeToEvidenceItemsForCase.mockReset();
        casoPageMocks.subscribeToEvidenceItemsForCase.mockImplementation(() => () => {});
        casoPageMocks.subscribeToRiskSignalsForCase.mockReset();
        casoPageMocks.subscribeToRiskSignalsForCase.mockImplementation(() => () => {});
        casoPageMocks.subscribeToRelationshipsForCase.mockReset();
        casoPageMocks.subscribeToRelationshipsForCase.mockImplementation(() => () => {});
        casoPageMocks.subscribeToTimelineEventsForCase.mockReset();
        casoPageMocks.subscribeToTimelineEventsForCase.mockImplementation(() => () => {});
        casoPageMocks.subscribeToProviderDivergencesForCase.mockReset();
        casoPageMocks.subscribeToProviderDivergencesForCase.mockImplementation(() => () => {});
        casoPageMocks.fetchSubjectDecisionHistory.mockReset();
        casoPageMocks.fetchSubjectDecisionHistory.mockResolvedValue([]);
        casoPageMocks.callSaveCaseDraftByAnalyst.mockReset();
        casoPageMocks.callSetAiDecisionByAnalyst.mockReset();
        casoPageMocks.callReturnCaseToClient.mockReset();
        casoPageMocks.callConcludeCaseByAnalyst.mockReset();
        casoPageMocks.callResolveProviderDivergenceByAnalyst.mockReset();
        casoPageMocks.callResolveProviderDivergenceByAnalyst.mockResolvedValue({ success: true });
        casoPageMocks.callCreateWatchlist.mockReset();
        casoPageMocks.callCreateWatchlist.mockResolvedValue({ success: true, watchlistId: 'wl_subj_cpf_abc' });
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

    it('exibe PublicationGuardsPanel com label de produto e semantica solicitado->efetivo->executado', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Maria Silva',
                cpf: '12345678901',
                createdAt: '2026-04-21',
                enabledPhases: ['criminal', 'warrant'],
                productKey: 'kyc_individual',
                requestedModuleKeys: ['identity_pf', 'criminal', 'warrants', 'kyc', 'decision', 'report_secure'],
                effectiveModuleKeys: ['identity_pf', 'criminal', 'warrants', 'decision', 'report_secure'],
                executedModuleKeys: ['identity_pf', 'criminal'],
                moduleRunSummary: {
                    total: 6,
                    requestedCount: 6,
                    effectiveCount: 5,
                    executedCount: 2,
                    blockedCount: 0,
                    blockedModuleKeys: [],
                    blocksDecision: false,
                    blocksPublication: false,
                    evidenceCount: 3,
                    riskSignalCount: 1,
                    providerRecordCount: 8,
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('KYC Individual')).toBeInTheDocument();
        expect(screen.getByText('Gates operacionais V2')).toBeInTheDocument();
        expect(screen.getByText('6 solicitados')).toBeInTheDocument();
        expect(screen.getByText('5 efetivos')).toBeInTheDocument();
        expect(screen.getByText('2 executados')).toBeInTheDocument();
        expect(screen.getByText('3 evidencias')).toBeInTheDocument();
        expect(screen.queryByText('Bloqueia publicacao')).not.toBeInTheDocument();
    });

    it('exibe PublicationGuardsPanel com badge de bloqueio quando moduleRunSummary bloqueia publicacao', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Carlos Andrade',
                cpf: '98765432100',
                createdAt: '2026-04-21',
                enabledPhases: ['warrant'],
                productKey: 'kyb_business',
                requestedModuleKeys: ['identity_pj', 'warrants', 'decision', 'report_secure'],
                effectiveModuleKeys: ['identity_pj', 'warrants', 'decision', 'report_secure'],
                executedModuleKeys: [],
                moduleRunSummary: {
                    total: 4,
                    requestedCount: 4,
                    effectiveCount: 4,
                    executedCount: 0,
                    blockedCount: 2,
                    blockedModuleKeys: ['warrants', 'decision'],
                    blocksDecision: true,
                    blocksPublication: true,
                    evidenceCount: 0,
                    riskSignalCount: 0,
                    providerRecordCount: 0,
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('KYB Empresa')).toBeInTheDocument();
        expect(screen.getByText('Bloqueia decisao')).toBeInTheDocument();
        expect(screen.getByText('Bloqueia publicacao')).toBeInTheDocument();
        expect(screen.getByText('Mandados')).toBeInTheDocument();
        expect(screen.getByText('Decisao')).toBeInTheDocument();
    });

    it('exibe EvidenceSummaryPanel com evidencias agrupadas por modulo e severity badge', async () => {
        casoPageMocks.subscribeToEvidenceItemsForCase.mockImplementation((caseId, callback) => {
            setTimeout(() => callback([
                { id: 'ev1', caseId, moduleKey: 'criminal', kind: 'criminal_finding', summary: 'Processo criminal confirmado por CPF', severity: 'high' },
                { id: 'ev2', caseId, moduleKey: 'criminal', kind: 'criminal_finding', summary: 'Segunda ocorrencia criminal', severity: 'medium' },
                { id: 'ev3', caseId, moduleKey: 'warrants', kind: 'warrant_finding', summary: 'Mandado de prisao ativo', severity: 'critical' },
            ], null), 0);
            return () => {};
        });
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Joao Costa',
                cpf: '11122233344',
                createdAt: '2026-04-21',
                enabledPhases: ['criminal', 'warrant'],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Evidencias V2')).toBeInTheDocument();
        expect(screen.getByText('Processo criminal confirmado por CPF')).toBeInTheDocument();
        expect(screen.getByText('Mandado de prisao ativo')).toBeInTheDocument();
        expect(screen.getByText('Critico')).toBeInTheDocument();
        expect(screen.getByText('Alto')).toBeInTheDocument();
        expect(screen.getByText('3 evidencias')).toBeInTheDocument();
    });

    it('exibe RiskSignalsPanel com sinais ordenados por severity e scoreImpact', async () => {
        casoPageMocks.subscribeToRiskSignalsForCase.mockImplementation((caseId, callback) => {
            setTimeout(() => callback([
                { id: 'sig1', caseId, moduleKey: 'warrants', kind: 'warrant_risk', severity: 'critical', scoreImpact: 50, reason: 'Mandado de prisao ativo confirmado' },
                { id: 'sig2', caseId, moduleKey: 'criminal', kind: 'criminal_risk', severity: 'high', scoreImpact: 35, reason: 'Processo criminal com CPF exato' },
            ], null), 0);
            return () => {};
        });
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Paulo Mendes',
                cpf: '55566677788',
                createdAt: '2026-04-21',
                enabledPhases: ['criminal', 'warrant'],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Sinais de risco V2')).toBeInTheDocument();
        expect(screen.getByTestId('risk-signal-sig1')).toBeInTheDocument();
        expect(screen.getByTestId('risk-signal-sig2')).toBeInTheDocument();
        expect(screen.getAllByText('Mandado de prisao ativo confirmado').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Processo criminal com CPF exato').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('+50 pts').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('+35 pts').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('2 sinais')).toBeInTheDocument();
    });

    it('exibe RelationshipsPanel com mini-relacionamentos V2 do caso', async () => {
        casoPageMocks.subscribeToRelationshipsForCase.mockImplementation((caseId, callback) => {
            setTimeout(() => callback([
                {
                    id: 'rel_company_person_1',
                    caseId,
                    type: 'company_person',
                    confidence: 'medium',
                    fromDocument: { docType: 'cnpj', docValue: '12345678000195' },
                    toDocument: { docType: 'cpf', docValue: '98765432100' },
                    sourceItemIds: ['ev_1'],
                },
            ], null), 0);
            return () => {};
        });
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Grupo Exemplo',
                cnpj: '12345678000195',
                createdAt: '2026-04-21',
                enabledPhases: ['criminal'],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByTestId('relationships-panel')).toBeInTheDocument();
        expect(screen.getByText('Mini-relacionamentos')).toBeInTheDocument();
        expect(screen.getByText('Empresa -> pessoa')).toBeInTheDocument();
        expect(screen.getByText('1 vinculo(s)')).toBeInTheDocument();
        expect(screen.getByText('1 evid./registro(s) de suporte')).toBeInTheDocument();
    });

    it('permite resolver providerDivergence aberta com justificativa auditavel', async () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Divergencia revisada e fonte confirmada.');
        casoPageMocks.subscribeToProviderDivergencesForCase.mockImplementation((caseId, callback) => {
            setTimeout(() => callback([
                {
                    id: 'div-1',
                    caseId,
                    status: 'open',
                    reason: 'Divergencia entre Judit e BigDataCorp',
                    severity: 'critical',
                    blocksPublication: true,
                    moduleKey: 'criminal',
                },
            ], null), 0);
            return () => {};
        });
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Caso com Divergencia',
                cpf: '12345678901',
                createdAt: '2026-04-22',
                enabledPhases: ['criminal'],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByTestId('provider-divergences-panel')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Resolver divergencia'));

        expect(casoPageMocks.callResolveProviderDivergenceByAnalyst).toHaveBeenCalledWith({
            caseId: 'CASE-999',
            divergenceId: 'div-1',
            status: 'resolved',
            resolution: 'Divergencia revisada e fonte confirmada.',
        });
        promptSpy.mockRestore();
    });

    it('exibe comparativo historico por decisions/reportSnapshots do subject', async () => {
        casoPageMocks.fetchSubjectDecisionHistory.mockResolvedValue([
            {
                id: 'dec-2',
                caseId: 'CASE-OLD',
                productKey: 'dossier_pf_full',
                verdict: 'ATTENTION',
                riskScore: 72,
                scoreDeltaFromPrevious: 32,
                reportStatus: 'ready',
                approvedAt: '2026-04-20',
            },
        ]);
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                subjectId: 'subj_cpf_abc',
                candidateName: 'Historico Pessoa',
                cpf: '12345678901',
                createdAt: '2026-04-21',
                enabledPhases: ['criminal'],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByTestId('subject-decision-history-panel')).toBeInTheDocument();
        expect(screen.getByText('Comparativo historico')).toBeInTheDocument();
        expect(screen.getByText('Dossie PF Completo')).toBeInTheDocument();
        expect(screen.getByText('Score 72')).toBeInTheDocument();
        expect(screen.getByText('+32')).toBeInTheDocument();
    });

    it('permite criar watchlist a partir de caso concluido com entitlement de monitoramento', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'DONE',
                subjectId: 'subj_cpf_abc',
                tenantId: 'tenant-1',
                candidateName: 'Pessoa Monitorada',
                cpf: '12345678901',
                createdAt: '2026-04-22',
                publicReportToken: 'tok-1',
                effectiveModuleKeys: ['identity_pf', 'criminal', 'watchlist_screening', 'report_secure'],
                entitlementSummary: {
                    enabledCapabilities: { watchlist_monitoring: true },
                    enabledModules: { watchlist_screening: true },
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByTestId('watchlist-case-panel')).toBeInTheDocument();
        await act(async () => {
            fireEvent.click(screen.getByTestId('case-create-watchlist'));
        });

        expect(casoPageMocks.callCreateWatchlist).toHaveBeenCalledWith({
            subjectId: 'subj_cpf_abc',
            tenantId: 'tenant-1',
            modules: ['identity_pf', 'criminal', 'watchlist_screening'],
            intervalDays: 30,
        });
        expect(await screen.findByText(/Watchlist criada/i)).toBeInTheDocument();
    });

    it('nao exibe criacao de watchlist sem entitlement de monitoramento', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'DONE',
                subjectId: 'subj_cpf_no_watch',
                tenantId: 'tenant-1',
                candidateName: 'Pessoa Sem Monitoramento',
                cpf: '12345678901',
                createdAt: '2026-04-22',
                publicReportToken: 'tok-2',
                effectiveModuleKeys: ['identity_pf', 'criminal', 'report_secure'],
                entitlementSummary: {
                    enabledCapabilities: {},
                    enabledModules: {},
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);

        expect(await screen.findByText('Pessoa Sem Monitoramento')).toBeInTheDocument();
        expect(screen.queryByTestId('watchlist-case-panel')).toBeNull();
        expect(casoPageMocks.callCreateWatchlist).not.toHaveBeenCalled();
    });
});
