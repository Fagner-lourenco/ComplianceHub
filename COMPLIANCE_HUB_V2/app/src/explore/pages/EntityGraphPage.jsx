import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import DossierLayout from '../../dossie/layouts/DossierLayout';
import ComplianceGraph from '../components/ComplianceGraph';
import { useEntityGraph } from '../hooks/useEntityGraph';

export default function EntityGraphPage() {
  const { entityId } = useParams();
  const {
    nodes,
    edges,
    loading,
    error,
    layoutMode,
    layoutVersion,
    expandNode,
    hideNode,
    deleteNode,
    applyLayout,
    searchEntity,
    retry,
  } = useEntityGraph(entityId);

  return (
    <DossierLayout>
      <ReactFlowProvider>
        <ComplianceGraph
          nodes={nodes}
          edges={edges}
          loading={loading}
          error={error}
          layoutMode={layoutMode}
          layoutVersion={layoutVersion}
          onLayoutChange={applyLayout}
          onExpandNode={expandNode}
          onHideNode={hideNode}
          onDeleteNode={deleteNode}
          onSearch={searchEntity}
          onRetry={retry}
        />
      </ReactFlowProvider>
    </DossierLayout>
  );
}
