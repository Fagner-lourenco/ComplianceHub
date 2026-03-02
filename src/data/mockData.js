/* Mock data for development / demonstration */

export const MOCK_CASES = [
    {
        id: 'CASE-001', tenantId: 'TEN-001', tenantName: 'TechCorp Inc.', candidateId: 'CAND-001', candidateName: 'Ana Paula Oliveira',
        candidatePosition: 'Analista Financeiro', cpfMasked: '***.***.***-45',
        createdAt: '2026-02-28', status: 'DONE', assigneeId: 'analyst1', priority: 'NORMAL',
        criminalFlag: 'NEGATIVE', osintLevel: 'LOW', socialStatus: 'APPROVED', digitalFlag: 'CLEAN',
        conflictInterest: 'NO', finalVerdict: 'FIT', riskLevel: 'GREEN', riskScore: 5,
        hasNotes: false, hasEvidence: false,
        socialProfiles: { instagram: '@anapaulaoliv', linkedin: 'https://linkedin.com/in/anapaula', facebook: '', tiktok: '', twitter: '', youtube: '' },
    },
    {
        id: 'CASE-002', tenantId: 'TEN-001', tenantName: 'TechCorp Inc.', candidateId: 'CAND-002', candidateName: 'Carlos Eduardo Santos',
        candidatePosition: 'Gerente de Operações', cpfMasked: '***.***.***-12',
        createdAt: '2026-02-27', status: 'DONE', assigneeId: 'analyst1', priority: 'HIGH',
        criminalFlag: 'POSITIVE', criminalSeverity: 'HIGH', osintLevel: 'MEDIUM', socialStatus: 'CONCERN', digitalFlag: 'ALERT',
        conflictInterest: 'NO', finalVerdict: 'NOT_RECOMMENDED', riskLevel: 'RED', riskScore: 88,
        hasNotes: true, hasEvidence: true,
        socialProfiles: { instagram: '@carlosedu', linkedin: 'https://linkedin.com/in/carloseduardo', facebook: 'https://facebook.com/carlosedu', tiktok: '', twitter: '@carlosedu_', youtube: '' },
    },
    {
        id: 'CASE-003', tenantId: 'TEN-001', tenantName: 'TechCorp Inc.', candidateId: 'CAND-003', candidateName: 'Maria Fernanda Costa',
        candidatePosition: 'Engenheira de Software', cpfMasked: '***.***.***-78',
        createdAt: '2026-02-26', status: 'IN_PROGRESS', assigneeId: 'analyst1', priority: 'NORMAL',
        criminalFlag: 'NEGATIVE', osintLevel: 'LOW', socialStatus: 'NEUTRAL', digitalFlag: 'NOT_CHECKED',
        conflictInterest: 'UNKNOWN', finalVerdict: 'PENDING', riskLevel: 'GREEN', riskScore: 12,
        hasNotes: false, hasEvidence: false,
        socialProfiles: { instagram: '@mariafcosta', linkedin: 'https://linkedin.com/in/mariafernanda', facebook: '', tiktok: '@mariafcosta', twitter: '', youtube: '' },
    },
    {
        id: 'CASE-004', tenantId: 'TEN-001', tenantName: 'TechCorp Inc.', candidateId: 'CAND-004', candidateName: 'João Pedro Almeida',
        candidatePosition: 'Coord. de RH', cpfMasked: '***.***.***-33',
        createdAt: '2026-02-25', status: 'DONE', assigneeId: 'analyst1', priority: 'NORMAL',
        criminalFlag: 'INCONCLUSIVE', osintLevel: 'MEDIUM', socialStatus: 'CONCERN', digitalFlag: 'ALERT',
        conflictInterest: 'NO', finalVerdict: 'ATTENTION', riskLevel: 'YELLOW', riskScore: 52,
        hasNotes: true, hasEvidence: true,
        socialProfiles: { instagram: '', linkedin: 'https://linkedin.com/in/joaopedro', facebook: 'https://facebook.com/joaopalmeida', tiktok: '', twitter: '', youtube: '' },
    },
    {
        id: 'CASE-005', tenantId: 'TEN-001', tenantName: 'TechCorp Inc.', candidateId: 'CAND-005', candidateName: 'Beatriz Rodrigues Lima',
        candidatePosition: 'Diretora Comercial', cpfMasked: '***.***.***-56',
        createdAt: '2026-02-24', status: 'PENDING', assigneeId: null, priority: 'HIGH',
        criminalFlag: null, osintLevel: null, socialStatus: null, digitalFlag: null,
        conflictInterest: null, finalVerdict: 'PENDING', riskLevel: null, riskScore: 0,
        hasNotes: false, hasEvidence: false,
        socialProfiles: { instagram: '@bialima', linkedin: 'https://linkedin.com/in/beatrizrlima', facebook: '', tiktok: '@bialima_oficial', twitter: '@bialima', youtube: 'https://youtube.com/@bialima' },
    },
    {
        id: 'CASE-006', tenantId: 'TEN-002', tenantName: 'Banco Atlântico', candidateId: 'CAND-006', candidateName: 'Rafael Mendes Silva',
        candidatePosition: 'Contador', cpfMasked: '***.***.***-90',
        createdAt: '2026-02-23', status: 'DONE', assigneeId: 'analyst1', priority: 'NORMAL',
        criminalFlag: 'NEGATIVE', osintLevel: 'LOW', socialStatus: 'APPROVED', digitalFlag: 'CLEAN',
        conflictInterest: 'NO', finalVerdict: 'FIT', riskLevel: 'GREEN', riskScore: 0,
        hasNotes: false, hasEvidence: false,
        socialProfiles: { instagram: '', linkedin: 'https://linkedin.com/in/rafaelmendes', facebook: '', tiktok: '', twitter: '', youtube: '' },
    },
    {
        id: 'CASE-007', tenantId: 'TEN-002', tenantName: 'Banco Atlântico', candidateId: 'CAND-007', candidateName: 'Larissa Sousa Barbosa',
        candidatePosition: 'Analista de Compliance', cpfMasked: '***.***.***-21',
        createdAt: '2026-02-22', status: 'WAITING_INFO', assigneeId: 'analyst1', priority: 'NORMAL',
        criminalFlag: 'NEGATIVE', osintLevel: 'UNKNOWN', socialStatus: 'NEUTRAL', digitalFlag: 'NOT_CHECKED',
        conflictInterest: 'UNKNOWN', finalVerdict: 'PENDING', riskLevel: 'GREEN', riskScore: 18,
        hasNotes: true, hasEvidence: false,
        socialProfiles: { instagram: '@larissasb', linkedin: '', facebook: 'https://facebook.com/larissasousab', tiktok: '', twitter: '', youtube: '' },
    },
    {
        id: 'CASE-008', tenantId: 'TEN-002', tenantName: 'Banco Atlântico', candidateId: 'CAND-008', candidateName: 'Fernando Henrique Oliveira',
        candidatePosition: 'Gerente de TI', cpfMasked: '***.***.***-67',
        createdAt: '2026-02-21', status: 'DONE', assigneeId: 'analyst1', priority: 'HIGH',
        criminalFlag: 'NEGATIVE', osintLevel: 'HIGH', socialStatus: 'CONTRAINDICATED', digitalFlag: 'CRITICAL',
        conflictInterest: 'YES', finalVerdict: 'NOT_RECOMMENDED', riskLevel: 'RED', riskScore: 95,
        hasNotes: true, hasEvidence: true,
        socialProfiles: { instagram: '@fh_oliveira', linkedin: 'https://linkedin.com/in/fholiveira', facebook: 'https://facebook.com/fholiveira', tiktok: '@fholiveira', twitter: '@fh_oliveira', youtube: '' },
    },
    {
        id: 'CASE-009', tenantId: 'TEN-002', tenantName: 'Banco Atlântico', candidateId: 'CAND-009', candidateName: 'Camila Martins Pereira',
        candidatePosition: 'Assistente Administrativo', cpfMasked: '***.***.***-89',
        createdAt: '2026-02-20', status: 'DONE', assigneeId: 'analyst1', priority: 'NORMAL',
        criminalFlag: 'NEGATIVE', osintLevel: 'LOW', socialStatus: 'APPROVED', digitalFlag: 'CLEAN',
        conflictInterest: 'NO', finalVerdict: 'FIT', riskLevel: 'GREEN', riskScore: 3,
        hasNotes: false, hasEvidence: false,
        socialProfiles: { instagram: '@camilamp', linkedin: 'https://linkedin.com/in/camilamartins', facebook: '', tiktok: '', twitter: '', youtube: '' },
    },
    {
        id: 'CASE-010', tenantId: 'TEN-002', tenantName: 'Banco Atlântico', candidateId: 'CAND-010', candidateName: 'Thiago Nascimento Rocha',
        candidatePosition: 'Motorista', cpfMasked: '***.***.***-01',
        createdAt: '2026-02-19', status: 'PENDING', assigneeId: null, priority: 'NORMAL',
        criminalFlag: null, osintLevel: null, socialStatus: null, digitalFlag: null,
        conflictInterest: null, finalVerdict: 'PENDING', riskLevel: null, riskScore: 0,
        hasNotes: false, hasEvidence: false,
        socialProfiles: { instagram: '', linkedin: '', facebook: 'https://facebook.com/thiagonasc', tiktok: '', twitter: '', youtube: '' },
    },
];

export const MOCK_CASE_DETAILS = {
    'CASE-002': {
        executiveSummary: 'Candidato apresenta registros criminais ativos (processo por fraude financeira) e comportamento questionável em redes sociais. Perfil de risco ALTO. Não recomendado para posição de confiança.',
        criminalNotes: 'Processo ativo por fraude financeira na 2ª Vara Criminal de São Paulo. Registro encontrado no TJSP.',
        criminalFindings: 'Processo nº 0012345-67.2025.8.26.0100 — Fraude financeira (Art. 171, CP)',
        criminalSource: 'TJSP — Tribunal de Justiça de São Paulo',
        criminalImpact: 'ALTO — Posição de gerência com acesso a dados financeiros',
        osintNotes: 'Exposição pública média. Nome aparece em matérias sobre investigações financeiras.',
        osintVectors: ['public_exposure', 'mentions_sensitive'],
        socialNotes: 'Publicações com teor agressivo e posturas incompatíveis com ambiente corporativo.',
        socialReasons: ['incompatible_posture', 'aggressive_speech'],
        digitalNotes: 'Perfil de Instagram com conteúdo questionável. Inconsistência entre LinkedIn e Facebook (cargos divergentes).',
        digitalVectors: ['identity_mismatch', 'inappropriate_content'],
        conflictNotes: '',
        analystComment: 'Candidato não recomendado para posição de confiança dado histórico criminal ativo e comportamento em redes sociais.',
    },
    'CASE-004': {
        executiveSummary: 'Candidato com resultado inconclusivo na verificação criminal (sistema indisponível). OSINT médio e comportamento social com pontos de atenção. Recomendação: Atenção — verificar novamente após disponibilidade do sistema.',
        criminalNotes: 'Verificação inconclusiva — sistema TJMG fora do ar na data da consulta.',
        osintNotes: 'Perfil digital com exposição acima do esperado para o cargo.',
        socialNotes: 'Algumas publicações com posicionamento político agressivo.',
        socialReasons: ['incompatible_posture'],
        digitalNotes: 'Perfil de Facebook com postagens de opinião forte sobre temas controversos.',
        digitalVectors: ['inappropriate_content'],
        analystComment: 'Recomendar nova consulta criminal quando sistema estiver disponível.',
    },
};

export function getCaseStats(cases) {
    const total = cases.length;
    const done = cases.filter(c => c.status === 'DONE').length;
    const pending = cases.filter(c => c.status === 'PENDING').length;
    const red = cases.filter(c => c.riskLevel === 'RED').length;
    return { total, done, pending, red };
}
