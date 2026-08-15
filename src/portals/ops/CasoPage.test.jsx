import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';

const casoPageMocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    authState: {
        user: { uid: 'ops-1', email: 'fagner.alexandro.lourenco@gmail.com' },
        userProfile: { role: 'admin' },
    },
    subscribeToCaseDoc: vi.fn(),
    subscribeToCaseAuditLogs: vi.fn(() => () => {}),
    subscribeToCaseMessages: vi.fn(() => () => {}),
    callSendCaseMessage: vi.fn(),
    callMarkCaseCommunicationRead: vi.fn(),
    callSaveCaseDraftByAnalyst: vi.fn(),
    callSetAiDecisionByAnalyst: vi.fn(),
    callReturnCaseToClient: vi.fn(),
    callConcludeCaseByAnalyst: vi.fn(),
    getTenantSettings: vi.fn(),
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
        subscribeToCaseMessages: (...args) => casoPageMocks.subscribeToCaseMessages(...args),
        callSendCaseMessage: (...args) => casoPageMocks.callSendCaseMessage(...args),
        callMarkCaseCommunicationRead: (...args) => casoPageMocks.callMarkCaseCommunicationRead(...args),
        callSaveCaseDraftByAnalyst: (...args) => casoPageMocks.callSaveCaseDraftByAnalyst(...args),
        callSetAiDecisionByAnalyst: (...args) => casoPageMocks.callSetAiDecisionByAnalyst(...args),
        callReturnCaseToClient: (...args) => casoPageMocks.callReturnCaseToClient(...args),
        callConcludeCaseByAnalyst: (...args) => casoPageMocks.callConcludeCaseByAnalyst(...args),
        getTenantSettings: (...args) => casoPageMocks.getTenantSettings(...args),
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

/**
 * Os mocks de subscribeToCaseDoc entregam o doc do caso via setTimeout(0), e o
 * CasoPage so termina de se estabilizar tres commits depois dessa entrega:
 *
 *   commit A  setCaseData(nextCase) -> o nome do candidato aparece no DOM,
 *             mas enabledPhases ainda e o fallback LEGACY_PHASES do modulo;
 *   commit B  efeito [caseData, caseId, isDemoMode] -> setEnabledPhases(caseData.enabledPhases)
 *             + setActiveStep(0);
 *   commit C  efeito [steps.length] -> setActiveStep(Math.min(current, steps.length - 1)).
 *
 * `await screen.findByText(nomeDoCandidato)` resolve ja no commit A. Tudo que os
 * testes tocam logo em seguida de forma sincrona (allOk/checklist, o stepper,
 * canEditCase) so fica correto no commit B/C. O asyncWrapper do RTL concede
 * apenas um macrotask de folga depois do waitFor, e o scheduler do React precisa
 * de mais de um turno para essa cascata: com a suite inteira em paralelo o
 * commit B/C caia depois da interacao do teste, e o clique ia parar num botao
 * ainda desabilitado ou num stepper ainda nao montado.
 *
 * Drenar a entrega dentro de act() elimina a corrida: act repete o flush de
 * renders + efeitos passivos ate a fila esvaziar, entao o retorno so acontece
 * com o componente ja estabilizado.
 */
async function settleCaseSubscription() {
    await act(async () => {
        await new Promise((resolve) => { setTimeout(resolve, 0); });
    });
}

describe('CasoPage', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    beforeEach(() => {
        casoPageMocks.authState.userProfile = { role: 'admin' };
        casoPageMocks.navigate.mockReset();
        window.sessionStorage.clear();
        casoPageMocks.subscribeToCaseDoc.mockReset();
        casoPageMocks.subscribeToCaseAuditLogs.mockReset();
        casoPageMocks.subscribeToCaseAuditLogs.mockImplementation(() => () => {});
        casoPageMocks.subscribeToCaseMessages.mockReset();
        casoPageMocks.subscribeToCaseMessages.mockImplementation(() => () => {});
        casoPageMocks.callSendCaseMessage.mockReset();
        casoPageMocks.callSendCaseMessage.mockResolvedValue({});
        casoPageMocks.callMarkCaseCommunicationRead.mockReset();
        casoPageMocks.callMarkCaseCommunicationRead.mockResolvedValue({});
        casoPageMocks.callSaveCaseDraftByAnalyst.mockReset();
        casoPageMocks.callSaveCaseDraftByAnalyst.mockResolvedValue({});
        casoPageMocks.callSetAiDecisionByAnalyst.mockReset();
        casoPageMocks.callSetAiDecisionByAnalyst.mockResolvedValue({});
        casoPageMocks.callReturnCaseToClient.mockReset();
        casoPageMocks.callReturnCaseToClient.mockResolvedValue({});
        casoPageMocks.callConcludeCaseByAnalyst.mockReset();
        casoPageMocks.callConcludeCaseByAnalyst.mockResolvedValue({});
        casoPageMocks.getTenantSettings.mockReset();
        casoPageMocks.getTenantSettings.mockResolvedValue({ enrichmentConfig: { ai: { enabled: true } } });
    });

    it('nao exibe caso mock quando a rota real nao existe', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            // Simulate case not found
            setTimeout(() => callback(null, null), 0);
            return () => {}; // unsubscribe
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Caso indisponivel')).toBeInTheDocument();
        expect(screen.getByText('Caso nao encontrado no ambiente real.')).toBeInTheDocument();
        expect(screen.queryByText('Ana Paula Oliveira')).not.toBeInTheDocument();
        expect(screen.queryByText('TechCorp Inc.')).not.toBeInTheDocument();
    });

    it('exibe detalhes tecnicos de homonimos quando presentes no caso', async () => {
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
        await settleCaseSubscription();

        expect(await screen.findByText('Detalhes técnicos de homônimos')).toBeInTheDocument();
        expect(screen.getByText('Geografia distante e ausencia de CPF exato reduzem a aderencia do vinculo.')).toBeInTheDocument();
        expect(screen.getByText('Leitura por processo')).toBeInTheDocument();
        expect(screen.getByText('Processo encontrado apenas por nome em UF distante.')).toBeInTheDocument();
    });

    it('exibe analise assistida, cobertura, evidencias ambiguas e safety net', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Diego Emanuel Alves de Souza',
                cpf: '10794180329',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
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
        await settleCaseSubscription();

        expect(await screen.findByText('Análise assistida da autoclassificação')).toBeInTheDocument();
        expect(screen.getByText('Achados ambiguos')).toBeInTheDocument();
        expect(screen.getAllByText('A cobertura geral das fontes ficou reduzida.').length).toBeGreaterThan(0);
        expect(screen.getByText(/Sugestão consultiva: Revisar antes de concluir/i)).toBeInTheDocument();
        expect(screen.getByText('Safety net de cobertura parcial')).toBeInTheDocument();
        expect(screen.getByText(/Rodar Escavador/i)).toBeInTheDocument();
    });

    it('nao mostra conclusao assistida enquanto a autoclassificacao ainda esta pendente', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Fagner Lourenço',
                cpf: '08405241965',
                createdAt: '2026-05-18',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                bigdatacorpEnrichmentStatus: 'DONE',
                juditEnrichmentStatus: 'RUNNING',
                enrichmentStatus: 'PENDING',
                bigdatacorpProcessos: [{ cnj: '0001234-55.2025.8.26.0001', isDirectCpfMatch: true }],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Fagner Lourenço')).toBeInTheDocument();
        expect(screen.getByText(/Aguardando a autoclassificacao deterministica/i)).toBeInTheDocument();
        expect(screen.getByText(/Nao conclua o caso enquanto a consulta automatica/i)).toBeInTheDocument();
        expect(screen.queryByText(/nao indica achado criminal material/i)).not.toBeInTheDocument();
    });

    it('oculta JSON bruto e termos tecnicos da analise assistida contaminada', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Fagner Lourenço',
                cpf: '08405241965',
                createdAt: '2026-05-18',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                autoClassifiedAt: '2026-05-22T00:47:59.994Z',
                criminalFlag: 'NEGATIVE',
                juditCriminalFlag: 'POSITIVE',
                juditCriminalCount: 1,
                bigdatacorpCriminalFlag: 'NEGATIVE',
                bigdatacorpCriminalCount: 0,
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                coverageLevel: 'HIGH_COVERAGE',
                providerDivergence: 'MEDIUM',
                aiClassificationReviewOk: true,
                aiClassificationReview: {
                    summary: '{"summary":"Pessoa fisica com criminalFlag NEGATIVE"}',
                    identityAssessment: {
                        status: 'UNKNOWN',
                        rationale: 'hasExactCpfMatch=true no payload.',
                        homonymRisk: 'UNKNOWN',
                    },
                    classificationValidation: {
                        criminal: { autoFlag: null, assessment: 'INSUFFICIENT_DATA', evidenceStrength: 'INSUFFICIENT', rationale: 'isCriminal=true.', possibleErrors: [] },
                        labor: { autoFlag: null, assessment: 'INSUFFICIENT_DATA', evidenceStrength: 'INSUFFICIENT', rationale: '', possibleErrors: [] },
                        warrant: { autoFlag: null, assessment: 'INSUFFICIENT_DATA', evidenceStrength: 'INSUFFICIENT', rationale: '', possibleErrors: [] },
                    },
                    inconsistencies: ['providerDivergence=MEDIUM'],
                    manualReviewPoints: ['Confirmar leitura operacional antes de concluir.'],
                    consultativeSuggestion: {
                        action: 'REVIEW_BEFORE_CONCLUDING',
                        rationale: '{"summary":"payload bruto"}',
                    },
                    confidence: 'MEDIUM',
                },
                socialProfiles: {},
                otherSocialUrls: [],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Fagner Lourenço')).toBeInTheDocument();
        expect(screen.getAllByText('Cobertura alta').length).toBeGreaterThan(0);
        expect(screen.getByText('Divergência moderada')).toBeInTheDocument();
        expect(screen.queryByText(/\{"summary"/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/criminalFlag|hasExactCpfMatch|isCriminal|providerDivergence/i)).not.toBeInTheDocument();
        expect(screen.queryByText('Redes sociais fornecidas')).not.toBeInTheDocument();
    });

    it('abre modal com todas as comunicacoes DJEN do mesmo processo', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Fagner Lourenço',
                cpf: '08405241965',
                createdAt: '2026-05-18',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                djenComunicacaoTotal: 2,
                djenComunicacoes: [
                    {
                        id: 'djen-1',
                        dataDisponibilizacao: '2026-05-01',
                        tribunal: 'TJPR',
                        classe: 'Ação Penal',
                        area: 'criminal',
                        numeroProcesso: '00012345620258160001',
                        numeroProcessoMascara: '0001234-56.2025.8.16.0001',
                        tipoComunicacao: 'Intimação',
                        confirmationLevel: 'PROCESS_CONFIRMED',
                        textoCompleto: 'Primeira comunicação do processo.',
                    },
                    {
                        id: 'djen-2',
                        dataDisponibilizacao: '2026-05-02',
                        tribunal: 'TJPR',
                        classe: 'Ação Penal',
                        area: 'criminal',
                        numeroProcesso: '00012345620258160001',
                        numeroProcessoMascara: '0001234-56.2025.8.16.0001',
                        tipoComunicacao: 'Despacho',
                        confirmationLevel: 'PROCESS_CONFIRMED',
                        textoCompleto: 'Segunda comunicação do processo.',
                    },
                ],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Fagner Lourenço')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Criminal/i }));
        fireEvent.click(await screen.findByText(/Comunicações judiciais DJEN \(2\)/, {}, { timeout: 3000 }));
        fireEvent.click(screen.getAllByRole('button', { name: '0001234-56.2025.8.16.0001' })[0]);

        expect(screen.getAllByText('DJEN').length).toBeGreaterThan(0);
        expect(screen.getByText('Publicações no Diário (DJEN) · 2 ocorrência(s)')).toBeInTheDocument();
        expect(screen.getAllByText('Intimação').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Despacho').length).toBeGreaterThan(0);
    });

    it('mostra comunicacoes DJEN trabalhistas clicaveis na aba trabalhista', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'PENDING',
                candidateName: 'Maria Silva',
                cpf: '08405241965',
                createdAt: '2026-05-18',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                djenComunicacoes: [{
                    id: 'djen-labor-1',
                    dataDisponibilizacao: '2026-05-03',
                    tribunal: 'TRT9',
                    classe: 'Reclamação Trabalhista',
                    area: 'trabalhista',
                    numeroProcesso: '00099998820255090001',
                    numeroProcessoMascara: '0009999-88.2025.5.09.0001',
                    tipoComunicacao: 'Notificação',
                    confirmationLevel: 'NAME_EXACT',
                }],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
        fireEvent.click(screen.getAllByText('Trabalhista')[0]);
        expect(await screen.findByText(/Comunicações judiciais DJEN \(1\)/, {}, { timeout: 3000 })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '0009999-88.2025.5.09.0001' }));
        expect(screen.getByText('Publicações no Diário (DJEN) · 1 ocorrência(s)')).toBeInTheDocument();
        expect(screen.getAllByText('Notificação').length).toBeGreaterThan(0);
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
                    executiveSummary: 'Resumo consolidado com mandado ativo, processos criminais relevantes e ressalva de divergencia entre fontes de dados.',
                    criminalNotes: 'Existe evidencia criminal confirmada, com processo penal e suporte de mais de um provider.',
                    laborNotes: 'Nao foram identificados processos trabalhistas relevantes nas fontes consultadas.',
                    warrantNotes: 'Mandado de prisao pendente de cumprimento localizado na Judit, com impacto operacional direto.',
                    keyFindings: ['Mandado ativo pendente de cumprimento.', 'Ha processo criminal confirmado com suporte cruzado.'],
                    finalJustification: 'O resultado final deve refletir o mandado ativo e a confirmacao criminal, mesmo com algum ruido por nome.',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Francisco Taciano de Sousa')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Revisao/i }));

        expect(await screen.findByLabelText('Resumo executivo')).toHaveValue('Resumo consolidado com mandado ativo, processos criminais relevantes e ressalva de divergencia entre fontes de dados.');
        expect(screen.getByLabelText('Principais apontamentos')).toHaveValue('Mandado ativo pendente de cumprimento.\nHa processo criminal confirmado com suporte cruzado.');
        expect(screen.getByLabelText('Justificativa final do resultado')).toHaveValue('O resultado final deve refletir o mandado ativo e a confirmacao criminal, mesmo com algum ruido por nome.');
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
        await settleCaseSubscription();

        expect(await screen.findByText('Francisco Taciano de Sousa')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Mandado de Prisao/i }));

        const warrantTextarea = await screen.findByDisplayValue('Nenhum mandado confirmado ate o momento.', {}, { timeout: 3000 });
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

    it('bloqueia edicao e acoes criticas quando o caso esta concluido', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'DONE',
                candidateName: 'Marina Costa',
                cpf: '12345678901',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'warrant'],
                criminalFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Modo leitura')).toBeInTheDocument();
        expect(screen.getByText(/Caso concluido|Caso concluído/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Salvar rascunho/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Concluir$/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Devolver ao cliente/i })).not.toBeInTheDocument();
    });

    it('abre confirmacao propria ao sair com rascunho pendente e permite salvar antes de navegar', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Francisco Taciano de Sousa',
                cpf: '05023290336',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal'],
                criminalFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                prefillNarratives: {
                    criminalNotes: 'Nenhum processo criminal confirmado nas fontes consultadas.',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Francisco Taciano de Sousa')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Proximo' }));
        await waitFor(() => expect(screen.getByDisplayValue('Nenhum processo criminal confirmado nas fontes consultadas.')).toBeInTheDocument(), { timeout: 3000 });
        fireEvent.change(screen.getByDisplayValue('Nenhum processo criminal confirmado nas fontes consultadas.'), {
            target: { value: 'Analista revisou a cobertura criminal e manteve a classificacao negativa.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));

        expect(await screen.findByText('Sair do caso com rascunho aberto?')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Salvar e sair/i }));

        await waitFor(() => expect(casoPageMocks.callSaveCaseDraftByAnalyst).toHaveBeenCalledWith(expect.objectContaining({
            caseId: 'CASE-999',
            payload: expect.objectContaining({
                criminalNotes: 'Analista revisou a cobertura criminal e manteve a classificacao negativa.',
            }),
        })));
        await waitFor(() => expect(casoPageMocks.navigate).toHaveBeenCalledWith('/ops/fila'));
    });

    it('trata mandado ativo da Judit ou BigDataCorp como bloqueio de conclusao', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Rafael Nunes',
                cpf: '98765432100',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['warrant'],
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                bigdatacorpActiveWarrants: [{ processNumber: '0001234-55.2025.8.26.0001', isActive: true }],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Rafael Nunes')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Proximo' }));
        expect(await screen.findByRole('heading', { name: /Mandado de prisao/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Proximo' }));

        expect(await screen.findByText(/Bloqueio: flag de mandado negativa com 1 mandado/i, {}, { timeout: 3000 })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Concluir caso/i })).toBeDisabled();
    });

    it('permite conclusao quando resultado criminal e inconclusivo final', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Andressa de Souza Pereira',
                cpf: '12345678901',
                tenantId: 'tenant-1',
                createdAt: '2026-05-22',
                enabledPhases: ['criminal'],
                criminalFlag: 'INCONCLUSIVE',
                criminalNotes: 'Sem apontamento criminal.',
                finalVerdict: 'FIT',
                analystComment: 'Nao foram identificados apontamentos criminais nas fontes consultadas.',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Andressa de Souza Pereira')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^Concluir$/i })).not.toBeDisabled();
    });

    it('exibe revisao consultiva da autoclassificacao sem alterar o nivel de atencao calculado', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Helena Prado',
                cpf: '11122233344',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal'],
                criminalFlag: 'NEGATIVE',
                finalVerdict: '',
                aiClassificationReviewOk: true,
                aiClassificationReview: {
                    summary: 'Autoclassificacao negativa com cobertura parcial e revisao humana recomendada.',
                    identityAssessment: {
                        status: 'CONFIRMED',
                        rationale: 'Identidade confirmada nos dados disponiveis.',
                        homonymRisk: 'LOW',
                    },
                    classificationValidation: {
                        criminal: {
                            autoFlag: 'NEGATIVE',
                            assessment: 'AGREE_WITH_CAUTION',
                            evidenceStrength: 'WEAK',
                            rationale: 'Negativo coerente, mas com cobertura parcial.',
                            possibleErrors: ['Cobertura parcial pode esconder achados.'],
                        },
                        labor: {
                            autoFlag: 'NEGATIVE',
                            assessment: 'AGREE',
                            evidenceStrength: 'INSUFFICIENT',
                            rationale: 'Sem evidencia trabalhista material.',
                            possibleErrors: [],
                        },
                        warrant: {
                            autoFlag: 'NEGATIVE',
                            assessment: 'AGREE',
                            evidenceStrength: 'INSUFFICIENT',
                            rationale: 'Sem mandado ativo confirmado.',
                            possibleErrors: [],
                        },
                    },
                    inconsistencies: [],
                    manualReviewPoints: ['Validar cobertura antes da conclusao.'],
                    consultativeSuggestion: {
                        action: 'REVIEW_BEFORE_CONCLUDING',
                        rationale: 'Revisar antes de concluir.',
                    },
                    confidence: 'MEDIUM',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Helena Prado')).toBeInTheDocument();
        expect(screen.getByText('Concorda com ressalva')).toBeInTheDocument();
        expect(screen.getByText(/^Sugestão consultiva: Revisar antes de concluir$/i)).toBeInTheDocument();
        expect(casoPageMocks.callSetAiDecisionByAnalyst).not.toHaveBeenCalled();
    });

    it('exibe banner de IA desabilitada e subtitulo deterministico quando tenant desligou IA', async () => {
        casoPageMocks.getTenantSettings.mockResolvedValue({ enrichmentConfig: { ai: { enabled: false } } });
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Helena Prado',
                cpf: '11122233344',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                criminalFlag: 'NEGATIVE',
                autoClassifiedAt: '2026-05-22T00:47:59.994Z',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Helena Prado')).toBeInTheDocument();
        expect(await screen.findByText(/IA desabilitada/i)).toBeInTheDocument();
        expect(screen.getByText(/modo determinístico/i)).toBeInTheDocument();
    });

    it('nao propaga ressalva criminal para eixos trabalhista e mandado negativos bem cobertos', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Marcos Lima',
                cpf: '11122233344',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                coverageLevel: 'HIGH_COVERAGE',
                providerDivergence: 'MEDIUM',
                reviewRecommended: true,
                bigdatacorpEnrichmentStatus: 'DONE',
                bigdatacorpCriminalFlag: 'NEGATIVE',
                bigdatacorpCriminalCount: 0,
                bigdatacorpLaborCount: 0,
                bigdatacorpActiveWarrants: [],
                juditEnrichmentStatus: 'DONE',
                juditCriminalFlag: 'POSITIVE',
                juditCriminalCount: 1,
                juditActiveWarrantCount: 0,
                juditWarrants: [],
                djenEnrichmentStatus: 'DONE',
                djenLaborFlag: 'NEGATIVE',
                djenComunicacoes: [],
                finalVerdict: '',
                aiClassificationReviewOk: true,
                aiClassificationReview: {
                    summary: 'Negativo criminal com divergencia pontual; demais eixos sem achados materiais.',
                    identityAssessment: {
                        status: 'CONFIRMED',
                        rationale: 'Identidade confirmada nos dados disponiveis.',
                        homonymRisk: 'LOW',
                    },
                    classificationValidation: {
                        criminal: {
                            autoFlag: 'NEGATIVE',
                            assessment: 'AGREE_WITH_CAUTION',
                            evidenceStrength: 'MIXED',
                            rationale: 'Divergencia criminal exige confirmar papel processual.',
                            possibleErrors: ['Confirmar papel processual criminal.'],
                        },
                        labor: {
                            autoFlag: 'NEGATIVE',
                            assessment: 'AGREE',
                            evidenceStrength: 'STRONG',
                            rationale: 'Fontes consultadas nao retornaram achado trabalhista material.',
                            possibleErrors: [],
                        },
                        warrant: {
                            autoFlag: 'NEGATIVE',
                            assessment: 'AGREE',
                            evidenceStrength: 'STRONG',
                            rationale: 'Fontes consultadas nao retornaram mandado ativo.',
                            possibleErrors: [],
                        },
                    },
                    inconsistencies: ['Divergencia criminal entre fontes.'],
                    manualReviewPoints: ['Confirmar papel processual criminal.'],
                    consultativeSuggestion: {
                        action: 'REVIEW_BEFORE_CONCLUDING',
                        rationale: 'Revisar apenas a divergencia criminal antes de concluir.',
                    },
                    confidence: 'MEDIUM',
                },
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Marcos Lima')).toBeInTheDocument();
        expect(screen.getAllByText('Concorda com ressalva')).toHaveLength(1);
        expect(screen.getAllByText('Concorda').length).toBeGreaterThanOrEqual(2);
        expect(screen.queryByText('Cobertura parcial pode esconder achados.')).not.toBeInTheDocument();
    });

    it('exibe botao de bypass para supervisor quando caso esta em CORRECTION_NEEDED com gate bloqueado', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'CORRECTION_NEEDED',
                candidateName: 'Joao Silva',
                cpf: '12345678901',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                analystComment: 'Caso analisado e sem apontamentos relevantes',
                bigdatacorpGateResult: { passed: false, reason: 'CPF cancelado' },
                bigdatacorpEnrichmentStatus: 'BLOCKED',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Joao Silva')).toBeInTheDocument();
        expect(screen.getByText('Concluir com bypass de identidade')).toBeInTheDocument();
    });

    it('nao exibe botao de bypass para analista comum', async () => {
        casoPageMocks.authState.userProfile = { role: 'analyst' };
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'CORRECTION_NEEDED',
                candidateName: 'Joao Silva',
                cpf: '12345678901',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                analystComment: 'Caso analisado e sem apontamentos relevantes',
                bigdatacorpGateResult: { passed: false, reason: 'CPF cancelado' },
                bigdatacorpEnrichmentStatus: 'BLOCKED',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Joao Silva')).toBeInTheDocument();
        expect(screen.queryByText('Concluir com bypass de identidade')).not.toBeInTheDocument();

    });

    it('abre modal de bypass e envia payload correto ao concluir', async () => {
        casoPageMocks.authState.userProfile = { role: 'admin' };
        casoPageMocks.callConcludeCaseByAnalyst.mockResolvedValue({});
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'CORRECTION_NEEDED',
                candidateName: 'Joao Silva',
                cpf: '12345678901',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                criminalFlag: 'NEGATIVE',
                laborFlag: 'NEGATIVE',
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                analystComment: 'Caso analisado e sem apontamentos relevantes',
                bigdatacorpGateResult: { passed: false, reason: 'CPF cancelado' },
                bigdatacorpEnrichmentStatus: 'BLOCKED',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Joao Silva')).toBeInTheDocument();

        const bypassButton = screen.getByText('Concluir com bypass de identidade');
        fireEvent.click(bypassButton);

        expect(await screen.findByText('Bypass do gate de identidade')).toBeInTheDocument();

        const textarea = screen.getByPlaceholderText('Descreva por que a conclusao deve ser permitida mesmo com gate de identidade bloqueado...');
        fireEvent.change(textarea, { target: { value: 'Justificativa de teste com mais de 15 caracteres' } });

        const confirmButton = screen.getByText('Confirmar bypass e concluir');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(casoPageMocks.callConcludeCaseByAnalyst).toHaveBeenCalledWith(expect.objectContaining({
                caseId: 'CASE-999',
                payload: expect.objectContaining({
                    identityBypassed: true,
                    identityBypassJustification: 'Justificativa de teste com mais de 15 caracteres',
                }),
            }));
        });
    });

    it('renderiza processos Escavador2 na identificacao e nas abas criminal/trabalhista', async () => {
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Escavador2 Teste',
                cpf: '12345678901',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['criminal', 'labor', 'warrant'],
                escavador2EnrichmentStatus: 'DONE',
                escavador2ProcessTotal: 2,
                escavador2NewFindingCount: 1,
                escavador2DuplicateCount: 1,
                escavador2Processos: [
                    { numeroCnj: '0001234-56.2024.8.26.0100', area: 'CRIMINAL', tipoPrincipal: 'Reu', polo: 'PASSIVO', isMaterialRisk: true, isCriminal: true, isNewEscavador2Finding: true, tribunalSigla: 'TJSP', dataInicio: '2024-01-01' },
                    { numeroCnj: '0005678-90.2023.5.09.0001', area: 'LABOR', tipoPrincipal: 'Reclamante', polo: 'ATIVO', isMaterialRisk: false, isLabor: true, isNewEscavador2Finding: false, tribunalSigla: 'TRT9', dataInicio: '2023-03-10' },
                ],
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await settleCaseSubscription();

        expect(await screen.findByText('Escavador2 Teste')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Escavador2 via integração/ })).toBeInTheDocument();
        expect(screen.getByText('0001234-56.2024.8.26.0100')).toBeInTheDocument();
        expect(screen.getByText('0005678-90.2023.5.09.0001')).toBeInTheDocument();
        expect(screen.getAllByText('Novo').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Confirmatório').length).toBeGreaterThanOrEqual(1);

        fireEvent.click(screen.getByRole('button', { name: /Criminal/i }));
        const criminalSection = screen.getByRole('heading', { name: /Processos criminais Escavador2/ }).closest('.caso-identity-block');
        expect(within(criminalSection).getByText('0001234-56.2024.8.26.0100')).toBeInTheDocument();
        expect(within(criminalSection).getByText('Reu')).toBeInTheDocument();

        fireEvent.click(within(criminalSection).getByText('0001234-56.2024.8.26.0100'));
        expect(screen.getAllByText('ESCAVADOR2').length).toBeGreaterThan(0);
        expect(screen.getByText('Publicações no Diário (DJEN) · 0 ocorrência(s)')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Fechar'));

        fireEvent.click(screen.getAllByText('Trabalhista')[0]);
        const laborSection = screen.getByRole('heading', { name: /Processos trabalhistas Escavador2/ }).closest('.caso-identity-block');
        expect(within(laborSection).getByText('0005678-90.2023.5.09.0001')).toBeInTheDocument();
        expect(within(laborSection).getByText('Reclamante')).toBeInTheDocument();
    });

    it('apos conclusao, mostra contagem e redireciona para a fila em 5s', async () => {
        vi.useFakeTimers();
        window.sessionStorage.setItem(
            'compliancehub:case-checklist:CASE-999',
            JSON.stringify({ identification: true, warrant: true, review: true }),
        );
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Marcos Vinicius Lima',
                cpf: '12345678901',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['warrant'],
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                analystComment: 'Analise concluida sem apontamentos relevantes para o caso.',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByText('Marcos Vinicius Lima')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        expect(screen.getByText(/retornando para a fila em 5s/i)).toBeInTheDocument();

        await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

        expect(casoPageMocks.navigate).toHaveBeenCalledWith('/ops/fila');
    });

    it('botao "Ficar nesta pagina" cancela o retorno automatico', async () => {
        vi.useFakeTimers();
        window.sessionStorage.setItem(
            'compliancehub:case-checklist:CASE-999',
            JSON.stringify({ identification: true, warrant: true, review: true }),
        );
        casoPageMocks.subscribeToCaseDoc.mockImplementation((caseId, callback) => {
            setTimeout(() => callback({
                id: caseId,
                status: 'IN_PROGRESS',
                candidateName: 'Beatriz Andrade Melo',
                cpf: '10794180329',
                tenantId: 'tenant-1',
                createdAt: '2026-04-04',
                enabledPhases: ['warrant'],
                warrantFlag: 'NEGATIVE',
                finalVerdict: 'FIT',
                analystComment: 'Analise concluida sem apontamentos relevantes para o caso.',
            }, null), 0);
            return () => {};
        });

        render(<CasoPage />);
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });
        expect(screen.getByText('Beatriz Andrade Melo')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar conclusão' }));
        await act(async () => { await vi.advanceTimersByTimeAsync(0); });

        expect(screen.getByText(/retornando para a fila em 5s/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /ficar nesta p[aá]gina/i }));
        await act(async () => { await vi.advanceTimersByTimeAsync(6000); });

        expect(casoPageMocks.navigate).not.toHaveBeenCalledWith('/ops/fila');
    });
});
