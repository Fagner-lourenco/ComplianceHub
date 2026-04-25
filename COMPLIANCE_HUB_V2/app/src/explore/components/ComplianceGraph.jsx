import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  useReactFlow,
  useStore,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PersonNode from './nodes/PersonNode';
import CompanyNode from './nodes/CompanyNode';
import ProcessNode from './nodes/ProcessNode';
import AddressNode from './nodes/AddressNode';
import RelationshipEdge from './edges/RelationshipEdge';
import GraphSidebar from './controls/GraphSidebar';
import NodeContextMenu from './controls/NodeContextMenu';
import EntityDetailsPanel from './panels/EntityDetailsPanel';
import LoadingState from '../../shared/components/LoadingState';
import ErrorState from '../../shared/components/ErrorState';
import { useToast } from '../../shared/hooks/useToast';

const nodeTypes = {
  person: PersonNode,
  company: CompanyNode,
  process: ProcessNode,
  address: AddressNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

function ZoomDisplay() {
  const zoom = useStore((s) => s.transform[2]);
  const pct = Math.round(zoom * 100);
  return <span className="text-[10px] font-semibold text-slate-400">{pct}%</span>;
}

export default function ComplianceGraph({
  nodes: propNodes,
  edges: propEdges,
  loading,
  error,
  layoutMode,
  layoutVersion,
  onLayoutChange,
  onExpandNode,
  onHideNode,
  onDeleteNode,
  onSearch,
  onRetry,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(propNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(propEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLegend, setShowLegend] = useState(false);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { toast } = useToast();

  // Sync props -> local state whenever layoutVersion changes (avoid infinite loop on every render)
  useEffect(() => {
    setNodes(propNodes);
    setEdges(propEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutVersion is the sync trigger
  }, [layoutVersion]);

  // Filter hidden nodes + their edges (hide is non-destructive)
  const visibleNodes = useMemo(() => nodes.filter((n) => !n.hidden), [nodes]);
  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [edges, visibleNodes]);
  const hasHiddenNodes = nodes.some((n) => n.hidden);

  const handleRestoreHidden = useCallback(() => {
    setNodes((prev) => prev.map((n) => (n.hidden ? { ...n, hidden: false } : n)));
    toast.success('Nós ocultos restaurados.');
  }, [setNodes, toast]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({ nodeId: node.id, data: node.data, x: event.clientX, y: event.clientY });
  }, []);

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      const match = onSearch?.(q);
      if (match) {
        setSelectedNode(match);
        fitView({ nodes: [{ id: match.id }], padding: 0.3, duration: 400 });
      } else {
        toast.warning(`Nenhum nó encontrado para "${q}".`);
      }
    },
    [searchQuery, onSearch, fitView, toast]
  );

  const handleSidebarAction = useCallback(
    (id) => {
      if (id === 'find') {
        document.getElementById('graph-search-input')?.focus();
        return;
      }
      if (id === 'legend') {
        setShowLegend((s) => !s);
        return;
      }
      if (id === 'restore') {
        if (hasHiddenNodes) {
          handleRestoreHidden();
        } else {
          onLayoutChange?.(layoutMode);
          toast.info('Layout reaplicado.');
        }
        return;
      }
      // Placeholders for future integration
      const labels = {
        new: 'Novo mapa', add: 'Adicionar nó', highlight: 'Destaque',
        save: 'Salvar', maps: 'Mapas salvos', download: 'Download', faq: 'FAQ',
      };
      toast.info(`${labels[id] || id}: em breve.`);
    },
    [onLayoutChange, layoutMode, hasHiddenNodes, handleRestoreHidden, toast]
  );

  const handleHide = useCallback(
    (nodeId) => {
      onHideNode?.(nodeId);
      setContextMenu(null);
      if (selectedNode?.id === nodeId) setSelectedNode(null);
      toast.info('Nó ocultado. Use "Restaurar" para reverter.');
    },
    [onHideNode, selectedNode, toast]
  );

  const handleDelete = useCallback(
    (nodeId) => {
      const ok = window.confirm('Remover este nó e suas conexões? Esta ação não pode ser desfeita.');
      if (!ok) return;
      onDeleteNode?.(nodeId);
      setContextMenu(null);
      if (selectedNode?.id === nodeId) setSelectedNode(null);
    },
    [onDeleteNode, selectedNode]
  );

  // Placeholder handlers for context-menu actions not yet wired to API
  const handleConsultApp = useCallback(() => {
    toast.info('Consultar em outro App: em breve.');
    setContextMenu(null);
  }, [toast]);

  const handleFlag = useCallback(() => {
    toast.info('FlagHub: em breve.');
    setContextMenu(null);
  }, [toast]);

  const handleComment = useCallback(() => {
    toast.info('Adicionar comentário: em breve.');
    setContextMenu(null);
  }, [toast]);

  const handleShowDoc = useCallback(() => {
    toast.info('Exibir documento: em breve.');
    setContextMenu(null);
  }, [toast]);

  const handleGenerateDossie = useCallback(() => {
    toast.info('Gerar Dossiê: em breve.');
    setContextMenu(null);
  }, [toast]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f5f5f5]">
        <LoadingState rows={3} columns={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f5f5f5] px-4">
        <ErrorState title="Erro ao carregar mapa" message={error.message} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#f5f5f5]">
      {/* SVG arrow markers */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
          </marker>
          <marker id="arrow-selected" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#8427cf" />
          </marker>
        </defs>
      </svg>

      {/* Left sidebar */}
      <div className="absolute left-0 top-20 z-20">
        <GraphSidebar onAction={handleSidebarAction} />
      </div>

      {/* Search bar — UPlink style top-center */}
      <form
        onSubmit={handleSearch}
        className="absolute left-1/2 top-4 z-10 flex w-[min(480px,calc(100vw-200px))] -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm"
      >
        <input
          id="graph-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, CPF ou CNPJ..."
          className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-500 hover:bg-brand-600 active:scale-[0.97] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:opacity-90"
        >
          Buscar
        </button>
      </form>

      {/* Layout toggle */}
      <div className="absolute right-6 top-4 z-10 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onLayoutChange?.('graph')}
          className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
            layoutMode === 'graph' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Grafo
        </button>
        <button
          type="button"
          onClick={() => onLayoutChange?.('structural')}
          className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${
            layoutMode === 'structural' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Estrutural
        </button>
      </div>

      {/* Graph canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          fitView
          minZoom={0.2}
          maxZoom={1.5}
          defaultEdgeOptions={{ type: 'relationship', animated: false }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d1d5db" gap={24} size={1} variant="lines" />
        </ReactFlow>
      </div>

      {/* Hidden nodes badge */}
      {hasHiddenNodes && (
        <button
          type="button"
          onClick={handleRestoreHidden}
          className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[12px] font-bold text-amber-700 shadow-sm transition hover:bg-amber-100"
        >
          {nodes.filter((n) => n.hidden).length} nós ocultos · Restaurar
        </button>
      )}

      {/* Bottom-right zoom toolbar */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
        <button type="button" onClick={() => zoomIn()} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" title="Zoom in">
          <span className="text-lg font-bold leading-none">+</span>
        </button>
        <ZoomDisplay />
        <button type="button" onClick={() => zoomOut()} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" title="Zoom out">
          <span className="text-lg font-bold leading-none">−</span>
        </button>
      </div>

      {/* Right detail panel */}
      {selectedNode && (
        <div className="absolute right-0 top-0 z-30 h-full w-full sm:w-[360px] lg:w-[400px]">
          <EntityDetailsPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
          onExpand={(nodeId, data) => {
            onExpandNode?.(nodeId, data);
            setContextMenu(null);
          }}
          onViewDetails={(nodeId) => {
            const node = nodes.find((n) => n.id === nodeId);
            if (node) setSelectedNode(node);
            setContextMenu(null);
          }}
          onHide={handleHide}
          onDelete={handleDelete}
          onConsultApp={handleConsultApp}
          onFlag={handleFlag}
          onComment={handleComment}
          onShowDoc={handleShowDoc}
          onGenerateDossie={handleGenerateDossie}
        />
      )}

      {/* Legend modal */}
      {showLegend && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onClick={() => setShowLegend(false)}>
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-[14px] font-bold text-slate-900">Legenda</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-2 w-8 rounded bg-gradient-to-r from-purple-600 to-purple-400" />
                <span className="text-[12px] text-slate-600">Pessoa Física</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-8 rounded bg-gradient-to-r from-orange-500 to-amber-400" />
                <span className="text-[12px] text-slate-600">Pessoa Jurídica</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-8 rounded bg-gradient-to-r from-red-500 to-rose-400" />
                <span className="text-[12px] text-slate-600">Processo Judicial</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-8 rounded bg-gradient-to-r from-amber-500 to-yellow-400" />
                <span className="text-[12px] text-slate-600">Endereço</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="mt-4 w-full rounded-lg bg-slate-100 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
