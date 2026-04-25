// Development mock data — returned when backend is unavailable on localhost
const IS_DEV = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const isMockEnabled = () => IS_DEV && !import.meta.env.VITE_API_BASE_URL;

const now = () => new Date().toISOString().split('T')[0];

const mockDossiers = [
  {
    id: 'DOS-2026-0001',
    createdAt: '2026-04-20',
    tag: 'PF-Alta',
    criterion: 'João da Silva',
    subjectName: 'João da Silva',
    progress: 100,
    status: 'completed',
    monitoringEnabled: true,
    workflow: 'Automático',
    riskLevel: 'Baixo',
    score: '12',
    analysis: { conclusion: 'Aprovado', conclusive: 'Aprovado para contratação.' },
    moduleRuns: [
      { id: 'criminal', moduleKey: 'criminal', status: 'completed', progress: 100 },
      { id: 'labor', moduleKey: 'labor', status: 'completed', progress: 100 },
      { id: 'warrant', moduleKey: 'warrant', status: 'completed', progress: 100 },
    ],
    sourceSections: [
      {
        title: 'Fontes Criminais',
        rows: [
          { source: 'criminal', status: 'ok', result: 'Nenhuma ocorrência encontrada.' },
          { source: 'warrant', status: 'ok', result: 'Sem mandados ativos.' },
        ],
      },
      {
        title: 'Fontes Trabalhistas',
        rows: [
          { source: 'labor', status: 'ok', result: '3 processos encontrados, todos arquivados.' },
        ],
      },
    ],
    comments: [
      { id: 'c1', text: 'Análise concluída sem ressalvas.', author: 'Analista 1', createdAt: '2026-04-21T10:00:00Z', highlighted: true },
    ],
  },
  {
    id: 'DOS-2026-0002',
    createdAt: '2026-04-21',
    tag: 'PJ-Critico',
    criterion: 'Acme Tecnologia Ltda',
    subjectName: 'Acme Tecnologia Ltda',
    progress: 65,
    status: 'processing',
    monitoringEnabled: false,
    workflow: 'Automático',
    riskLevel: 'Médio',
    score: '45',
    analysis: { conclusion: null, conclusive: null },
    moduleRuns: [
      { id: 'criminal', moduleKey: 'criminal', status: 'completed', progress: 100 },
      { id: 'labor', moduleKey: 'labor', status: 'pending', progress: 0 },
      { id: 'osint', moduleKey: 'osint', status: 'processing', progress: 50 },
    ],
    sourceSections: [
      {
        title: 'Fontes Criminais',
        rows: [
          { source: 'criminal', status: 'ok', result: 'Nenhuma ocorrência.' },
        ],
      },
      {
        title: 'OSINT',
        rows: [
          { source: 'osint', status: 'pending', result: 'Aguardando...' },
        ],
      },
    ],
    comments: [],
  },
  {
    id: 'DOS-2026-0003',
    createdAt: '2026-04-22',
    tag: 'PF-Media',
    criterion: 'Maria Oliveira',
    subjectName: 'Maria Oliveira',
    progress: 30,
    status: 'pending',
    monitoringEnabled: true,
    workflow: 'Manual',
    riskLevel: 'Alto',
    score: '78',
    analysis: { conclusion: null, conclusive: null },
    moduleRuns: [
      { id: 'criminal', moduleKey: 'criminal', status: 'error', progress: 50, errorMessage: 'Timeout na fonte' },
      { id: 'labor', moduleKey: 'labor', status: 'pending', progress: 0 },
    ],
    sourceSections: [
      {
        title: 'Fontes Criminais',
        rows: [
          { source: 'criminal', status: 'error', error: 'Timeout na fonte', result: null },
        ],
      },
    ],
    comments: [
      { id: 'c2', text: 'Fonte criminal apresentou timeout. Solicitar reprocessamento.', author: 'Supervisor', createdAt: '2026-04-22T14:30:00Z', highlighted: true },
    ],
  },
  {
    id: 'DOS-2026-0004',
    createdAt: '2026-04-22',
    tag: 'PF-Baixa',
    criterion: 'Pedro Santos',
    subjectName: 'Pedro Santos',
    progress: 100,
    status: 'completed',
    monitoringEnabled: false,
    workflow: 'Automático',
    riskLevel: 'Baixo',
    score: '8',
    analysis: { conclusion: 'Aprovado', conclusive: 'Sem ressalvas.' },
    moduleRuns: [
      { id: 'criminal', moduleKey: 'criminal', status: 'completed', progress: 100 },
      { id: 'labor', moduleKey: 'labor', status: 'completed', progress: 100 },
      { id: 'warrant', moduleKey: 'warrant', status: 'completed', progress: 100 },
      { id: 'osint', moduleKey: 'osint', status: 'completed', progress: 100 },
    ],
    sourceSections: [],
    comments: [],
  },
  {
    id: 'DOS-2026-0005',
    createdAt: '2026-04-23',
    tag: 'PJ-Alta',
    criterion: 'Global Consulting S.A.',
    subjectName: 'Global Consulting S.A.',
    progress: 10,
    status: 'pending',
    monitoringEnabled: true,
    workflow: 'Automático',
    riskLevel: 'Crítico',
    score: '92',
    analysis: { conclusion: null, conclusive: null },
    moduleRuns: [
      { id: 'criminal', moduleKey: 'criminal', status: 'pending', progress: 0 },
    ],
    sourceSections: [],
    comments: [],
  },
];

function matchPath(pattern, path) {
  const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
  return path.match(regex);
}

export function getMockResponse(path, method = 'GET', body = null) {
  if (!isMockEnabled()) return null;

  // List dossiers
  if (path === '/api/v1/dossiers' && method === 'GET') {
    return { items: mockDossiers, total: mockDossiers.length };
  }

  // Get single dossier
  const getMatch = matchPath('/api/v1/dossiers/([^/]+)', path);
  if (getMatch && method === 'GET') {
    const id = getMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    return dossier || { id, error: 'Not found' };
  }

  // Create dossier
  if (path === '/api/v1/dossiers' && method === 'POST') {
    const newId = `DOS-2026-${String(mockDossiers.length + 1).padStart(4, '0')}`;
    const newDossier = {
      id: newId,
      createdAt: now(),
      tag: body?.tag || 'PF',
      criterion: body?.subjectName || 'Novo Dossiê',
      subjectName: body?.subjectName || 'Novo Dossiê',
      progress: 0,
      status: 'pending',
      monitoringEnabled: false,
      workflow: 'Automático',
      riskLevel: '—',
      score: '—',
      analysis: { conclusion: null, conclusive: null },
      moduleRuns: [],
      sourceSections: [],
      comments: [],
    };
    mockDossiers.unshift(newDossier);
    return newDossier;
  }

  // Patch dossier
  if (getMatch && method === 'PATCH') {
    const id = getMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    if (dossier) {
      Object.assign(dossier, body);
      return dossier;
    }
    return { error: 'Not found' };
  }

  // Process dossier
  const processMatch = matchPath('/api/v1/dossiers/([^/]+)/process', path);
  if (processMatch && method === 'POST') {
    const id = processMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    if (dossier) {
      dossier.status = 'processing';
      dossier.progress = 10;
      return dossier;
    }
    return { error: 'Not found' };
  }

  // Comments
  const commentsMatch = matchPath('/api/v1/dossiers/([^/]+)/comments', path);
  if (commentsMatch && method === 'POST') {
    const id = commentsMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    if (dossier) {
      const comment = {
        id: `c${Date.now()}`,
        text: body?.text || '',
        author: 'Você',
        createdAt: new Date().toISOString(),
        highlighted: body?.highlighted || false,
      };
      dossier.comments.push(comment);
      return comment;
    }
    return { error: 'Not found' };
  }

  if (commentsMatch && method === 'GET') {
    const id = commentsMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    return { items: dossier?.comments || [] };
  }

  // Approve / Reject
  const approveMatch = matchPath('/api/v1/dossiers/([^/]+)/approve', path);
  if (approveMatch && method === 'POST') {
    const id = approveMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    if (dossier) {
      dossier.status = 'approved';
      dossier.analysis.conclusion = 'Aprovado';
      return dossier;
    }
    return { error: 'Not found' };
  }

  const rejectMatch = matchPath('/api/v1/dossiers/([^/]+)/reject', path);
  if (rejectMatch && method === 'POST') {
    const id = rejectMatch[1];
    const dossier = mockDossiers.find((d) => d.id === id);
    if (dossier) {
      dossier.status = 'rejected';
      dossier.analysis.conclusion = 'Reprovado';
      return dossier;
    }
    return { error: 'Not found' };
  }

  return null;
}
