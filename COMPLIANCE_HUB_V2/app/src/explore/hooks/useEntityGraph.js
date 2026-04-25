import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
//  LinkMap — useEntityGraph
//  Hook de integração para buscar e expandir entidades no grafo.
//
//  MODO DE USO:
//    • Demo (atual):  `buildDemoData()` retorna dados mockados.
//    • Produção:      substituir `fetchEntityGraph(entityId)` por
//                      chamada à API (Firebase Functions ou REST).
//
//  API Surface esperada:
//    GET /api/graph/:entityId  → { nodes: Node[], edges: Edge[] }
//    POST /api/graph/expand    → { nodeId } → { nodes: Node[], edges: Edge[] }
// ═══════════════════════════════════════════════════════════════

const USE_DEMO_DATA = true; // ← toggle para integração real

// ── Demo data ───────────────────────────────────────────────
function buildDemoData() {
  const nodes = [
    {
      id: 'root',
      type: 'person',
      position: { x: 400, y: 60 },
      data: {
        type: 'person',
        name: 'Carlos Eduardo Silva',
        document: '123.456.789-00',
        age: 42,
        risk: 'alert',
        fields: {
          'Nome da mãe': 'Maria Aparecida Silva',
          Nacionalidade: 'Brasileira',
          'Estado civil': 'Casado',
          Profissão: 'Analista Financeiro',
        },
        relations: [
          { targetName: 'Silva Consultoria Ltda', type: 'Sócio majoritário' },
          { targetName: 'Omega Holdings S.A.', type: 'Sócio minoritário' },
          { targetName: 'Processo nº 0001234-12', type: 'Réu' },
        ],
      },
    },
    {
      id: 'comp-1',
      type: 'company',
      position: { x: 120, y: 260 },
      data: {
        type: 'company',
        name: 'Silva Consultoria Ltda',
        document: '12.345.678/0001-90',
        status: 'Ativa',
        risk: 'ok',
        fields: {
          'Natureza jurídica': 'Sociedade Empresária Limitada',
          'Capital social': 'R$ 150.000,00',
          Atividade: 'Consultoria em gestão',
          'Data de abertura': '15/03/2016',
          Matriz: 'sim',
        },
        relations: [
          { targetName: 'Carlos Eduardo Silva', type: 'Sócio majoritário' },
          { targetName: 'Ana Paula Mendes', type: 'Sócia minoritária' },
        ],
      },
    },
    {
      id: 'comp-2',
      type: 'company',
      position: { x: 680, y: 260 },
      data: {
        type: 'company',
        name: 'Omega Holdings S.A.',
        document: '98.765.432/0001-10',
        status: 'Ativa',
        risk: 'critical',
        fields: {
          'Natureza jurídica': 'Sociedade Anônima',
          'Capital social': 'R$ 5.000.000,00',
          Atividade: 'Holding',
          'Data de abertura': '10/08/2005',
          Matriz: 'sim',
        },
        relations: [
          { targetName: 'Carlos Eduardo Silva', type: 'Sócio minoritário' },
          { targetName: 'Ana Paula Mendes', type: 'Sócia majoritária' },
        ],
      },
    },
    {
      id: 'proc-1',
      type: 'process',
      position: { x: 400, y: 260 },
      data: {
        type: 'process',
        name: 'Reclamação Trabalhista',
        number: '0001234-12.2023.5.02.0001',
        court: 'TRT-2',
        status: 'Ativo',
        risk: 'alert',
        fields: {
          'Data de ajuizamento': '15/03/2023',
          'Valor causa': 'R$ 45.000,00',
          'Última movimentação': 'Aguardando sentença',
          Tribunal: '2ª Vara do Trabalho de São Paulo',
        },
      },
    },
    {
      id: 'addr-1',
      type: 'address',
      position: { x: 400, y: 460 },
      data: {
        type: 'address',
        label: 'Residencial',
        cep: '04538-132',
        street: 'Rua Funchal, 538 — Apto 1201',
        city: 'São Paulo',
        state: 'SP',
        fields: {
          CEP: '04538-132',
          Logradouro: 'Rua Funchal',
          Número: '538',
          Complemento: 'Apto 1201',
          Bairro: 'Vila Olímpia',
          Cidade: 'São Paulo',
          Estado: 'SP',
        },
      },
    },
    {
      id: 'person-2',
      type: 'person',
      position: { x: 900, y: 460 },
      data: {
        type: 'person',
        name: 'Ana Paula Mendes',
        document: '987.654.321-00',
        age: 38,
        risk: 'ok',
        fields: {
          'Nome da mãe': 'Joana Mendes',
          Nacionalidade: 'Brasileira',
          Profissão: 'Advogada',
        },
        relations: [
          { targetName: 'Silva Consultoria Ltda', type: 'Sócia minoritária' },
          { targetName: 'Omega Holdings S.A.', type: 'Sócia majoritária' },
        ],
      },
    },
  ];

  const edges = [
    { id: 'e1', source: 'root', target: 'comp-1', type: 'relationship', data: { label: 'Sócio - 40%', strength: 'strong' } },
    { id: 'e2', source: 'root', target: 'comp-2', type: 'relationship', data: { label: 'Sócio - 15%', strength: 'medium' } },
    { id: 'e3', source: 'root', target: 'proc-1', type: 'relationship', data: { label: 'Réu', strength: 'strong' } },
    { id: 'e4', source: 'root', target: 'addr-1', type: 'relationship', data: { label: 'Reside', strength: 'strong' } },
    { id: 'e5', source: 'comp-2', target: 'person-2', type: 'relationship', data: { label: 'Sócia - 51%', strength: 'strong' } },
    { id: 'e6', source: 'comp-1', target: 'addr-1', type: 'relationship', data: { label: 'Sede', strength: 'medium' } },
  ];

  return { nodes, edges };
}

// ── Layout engines ──────────────────────────────────────────
function buildHierarchy(edges) {
  const children = new Map();
  edges.forEach((e) => {
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source).push(e.target);
  });
  return children;
}

function computeLevels(nodes, edges) {
  const children = buildHierarchy(edges);
  const levels = new Map();
  const visited = new Set();

  function assignLevel(id, level) {
    if (visited.has(id)) return;
    visited.add(id);
    levels.set(id, level);
    (children.get(id) || []).forEach((childId) => assignLevel(childId, level + 1));
  }

  nodes.forEach((n) => {
    const isRoot = !edges.some((e) => e.target === n.id);
    if (isRoot) assignLevel(n.id, 0);
  });

  // orphan nodes (no edges at all) default to level 0
  nodes.forEach((n) => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });

  return levels;
}

function autoLayout(nodes, edges) {
  const levels = computeLevels(nodes, edges);
  const levelGroups = new Map();
  nodes.forEach((n) => {
    const lvl = levels.get(n.id);
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl).push(n);
  });

  const spacingX = 280;
  const spacingY = 180;
  return nodes.map((n) => {
    const lvl = levels.get(n.id);
    const group = levelGroups.get(lvl);
    const idx = group.indexOf(n);
    const count = group.length;
    const offsetX = (idx - (count - 1) / 2) * spacingX;
    return { ...n, position: { x: 420 + offsetX, y: 40 + lvl * spacingY } };
  });
}

function structuralLayout(nodes, edges) {
  const levels = computeLevels(nodes, edges);
  const levelGroups = new Map();
  nodes.forEach((n) => {
    const lvl = levels.get(n.id);
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, []);
    levelGroups.get(lvl).push(n);
  });

  const spacingX = 260;
  const spacingY = 220;
  return nodes.map((n) => {
    const lvl = levels.get(n.id);
    const group = levelGroups.get(lvl);
    const idx = group.indexOf(n);
    const count = group.length;
    const totalWidth = (count - 1) * spacingX;
    const x = 600 + idx * spacingX - totalWidth / 2;
    return { ...n, position: { x, y: 40 + lvl * spacingY } };
  });
}

function applyLayoutToState(nodes, edges, mode) {
  return mode === 'structural' ? structuralLayout(nodes, edges) : autoLayout(nodes, edges);
}

// ── Production fetch placeholder ────────────────────────────
/* eslint-disable no-unused-vars */
async function fetchEntityGraph(/* entityId */) {
  // TODO: substituir por chamada real à API
  // const res = await fetch(`/api/graph/${entityId}`);
  // if (!res.ok) throw new Error('Falha ao carregar grafo');
  // return res.json();
  throw new Error('Modo API não implementado — ative USE_DEMO_DATA');
}

async function fetchExpandNode(nodeId, nodeData) {
  // TODO: substituir por chamada real à API
  // const res = await fetch('/api/graph/expand', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ nodeId, type: nodeData.type }),
  // });
  // return res.json(); // { nodes: [], edges: [] }
  throw new Error('Modo API não implementado — ative USE_DEMO_DATA');
}
/* eslint-enable no-unused-vars */

// ── Hook ────────────────────────────────────────────────────
export function useEntityGraph(entityId) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [layoutMode, setLayoutMode] = useState('graph'); // 'graph' | 'structural'
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Keep latest edges in ref to avoid stale closures in functional updates
  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Initial load — only on entityId or refreshKey change.
  // layoutMode change reapplies layout locally without reloading (preserves expanded nodes).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        let rawNodes, rawEdges;
        if (USE_DEMO_DATA) {
          await new Promise((r) => setTimeout(r, 600));
          const demo = buildDemoData();
          rawNodes = demo.nodes;
          rawEdges = demo.edges;
        } else {
          const data = await fetchEntityGraph(entityId);
          rawNodes = data.nodes;
          rawEdges = data.edges;
        }
        if (cancelled) return;
        const arranged = applyLayoutToState(rawNodes, rawEdges, layoutMode);
        setNodes(arranged);
        setEdges(rawEdges);
        setLayoutVersion((v) => v + 1);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutMode handled separately by applyLayout
  }, [entityId, refreshKey]);

  const expandNode = useCallback(
    async (nodeId, nodeData) => {
      try {
        let newNodes, newEdges;
        if (USE_DEMO_DATA) {
          await new Promise((r) => setTimeout(r, 400));
          const childType = nodeData.type === 'person' ? 'company' : 'person';
          const newId = `${nodeId}-x-${Date.now()}`;
          newNodes = [
            {
              id: newId,
              type: childType,
              position: { x: 0, y: 0 },
              data: {
                type: childType,
                name: childType === 'company' ? 'Nova Empresa Ltda' : 'Novo Vínculo',
                document: childType === 'company' ? '00.000.000/0000-00' : '000.000.000-00',
                fields: { Origem: nodeData.name || '—' },
              },
            },
          ];
          newEdges = [
            {
              id: `e-${nodeId}-${newId}`,
              source: nodeId,
              target: newId,
              type: 'relationship',
              data: { label: 'Sócio', strength: 'medium' },
            },
          ];
        } else {
          const data = await fetchExpandNode(nodeId, nodeData);
          newNodes = data.nodes;
          newEdges = data.edges;
        }

        // Read current state via refs, compute combined snapshot, set both atomically
        const updatedNodes = [...nodes, ...newNodes];
        const updatedEdges = [...edgesRef.current, ...newEdges];
        const arranged = applyLayoutToState(updatedNodes, updatedEdges, layoutMode);
        setNodes(arranged);
        setEdges(updatedEdges);
        setLayoutVersion((v) => v + 1);
      } catch (err) {
        console.error('[LinkMap] expandNode failed:', err);
      }
    },
    [layoutMode, nodes]
  );

  // Hide: marks node as hidden (preserves data for restore). Edges to/from hidden nodes filtered at render.
  const hideNode = useCallback(
    (nodeId) => {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, hidden: true } : n)));
    },
    []
  );

  // Delete: removes node + connected edges permanently
  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    []
  );

  const applyLayout = useCallback(
    (mode) => {
      setLayoutMode(mode);
      setNodes((prev) => applyLayoutToState(prev, edgesRef.current, mode));
      setLayoutVersion((v) => v + 1);
    },
    []
  );

  const searchEntity = useCallback(
    (query) => {
      if (!query || typeof query !== 'string') return null;
      const lower = query.toLowerCase().trim();
      if (!lower) return null;
      return (
        nodes.find(
          (n) =>
            n.data?.name?.toLowerCase().includes(lower) ||
            n.data?.document?.toLowerCase().includes(lower) ||
            n.data?.number?.toLowerCase().includes(lower)
        ) || null
      );
    },
    [nodes]
  );

  const retry = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    nodes,
    edges,
    loading,
    error,
    layoutMode,
    layoutVersion,
    setLayoutMode,
    expandNode,
    hideNode,
    deleteNode,
    applyLayout,
    searchEntity,
    retry,
  };
}
