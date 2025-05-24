import React, { CSSProperties } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { useAppStore } from '../../store/store';
import { IValidationError } from '../../types';

const CustomRuleEdge: React.FC<EdgeProps> = ({
  id,
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
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const validationErrors = useAppStore((state) => state.validationErrors);
  const edgeErrors = validationErrors.filter(
    (error: IValidationError) => error.elementId === id && error.severity === 'error'
  );
  const hasError = edgeErrors.length > 0;

  const edgeWarnings = validationErrors.filter(
    (error: IValidationError) => error.elementId === id && error.severity === 'warning'
  );
  const hasWarning = edgeWarnings.length > 0;

  let edgeStrokeColor = style?.stroke || '#b1b1b7';
  if (selected) {
    edgeStrokeColor = '#ff007f';
  }
  if (hasError) {
    edgeStrokeColor = 'red';
  } else if (hasWarning && !selected) {
    edgeStrokeColor = 'orange';
  }

  const edgeStyle: CSSProperties = {
    ...style,
    stroke: edgeStrokeColor,
    strokeWidth: selected || hasError || hasWarning ? 2 : style?.strokeWidth || 1.5,
    zIndex: selected || hasError || hasWarning ? 10 : style?.zIndex || 1,
  };

  let displayLabel: React.ReactNode = null;
  let labelBackgroundColor = 'rgba(255, 255, 255, 0.8)';
  let labelColor = '#333';

  if (hasError) {
    labelBackgroundColor = 'rgba(255, 204, 204, 0.9)';
    labelColor = 'red';
  } else if (hasWarning) {
    labelBackgroundColor = 'rgba(255, 235, 204, 0.9)';
    labelColor = 'orange';
  }


  if (label) {
    displayLabel = label;
  } else if (data?.ruleApplied) {
    const ruleText = typeof data.ruleApplied === 'string' ? data.ruleApplied : 'Rule';
    displayLabel = ruleText.length > 20 ? `${ruleText.substring(0, 17)}...` : ruleText;
    if (data.isAggregated && data.aggregatedCount > 1) {
        displayLabel = `(${data.aggregatedCount}) ${displayLabel}`;
    }
  }
  
  if (!displayLabel && (hasError || hasWarning)) {
      displayLabel = hasError ? "Ошибка правила!" : "Предупреждение!";
  }


  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              zIndex: (edgeStyle.zIndex as number || 1) + 1,
              backgroundColor: labelBackgroundColor,
              color: labelColor,
              padding: '2px 5px',
              borderRadius: '4px',
              pointerEvents: 'all',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: hasError ? '1px solid red' : (hasWarning ? '1px solid orange' : 'none'),
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