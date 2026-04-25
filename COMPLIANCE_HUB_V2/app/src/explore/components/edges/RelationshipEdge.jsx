import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

function RelationshipEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const label = data?.label || 'Vínculo';
  const strength = data?.strength || 'medium';

  const strokeColor = selected ? '#8427cf' : strength === 'strong' ? '#475569' : '#94a3b8';
  const strokeWidth = strength === 'strong' ? 2 : 1.5;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          transition: 'stroke 200ms ease',
        }}
        markerEnd={selected ? 'url(#arrow-selected)' : 'url(#arrow)'}
      />
      <EdgeLabelRenderer>
        <div
          className="pointer-events-auto cursor-default rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur-sm"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(RelationshipEdge);
