import React, { CSSProperties } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';


const CustomRuleEdge: React.FC<EdgeProps> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  label,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  let displayLabel: React.ReactNode = null;
  if (label) {
    displayLabel = label;
  } else if (data?.ruleApplied) {
    const ruleText = typeof data.ruleApplied === 'string' ? data.ruleApplied : 'Rule';
    displayLabel = ruleText.length > 20 ? `${ruleText.substring(0, 17)}...` : ruleText;
    if (data.isAggregated && data.aggregatedCount > 1) {
        displayLabel = `(${data.aggregatedCount}) ${displayLabel}`;
    }
  }

  const edgeStyle: CSSProperties = {
    ...style,
    zIndex: 1,
  };


  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              zIndex: (style?.zIndex as number || 1) + 1,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '2px 5px',
              borderRadius: '4px',
              pointerEvents: 'all',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
            className="nodrag nopan"
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomRuleEdge;