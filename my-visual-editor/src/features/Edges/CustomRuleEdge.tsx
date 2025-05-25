import React, { CSSProperties } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { useAppStore } from '../../store/store';
import styles from './CustomRuleEdge.module.css';

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
  label: initialLabel,
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
  const edgeSpecificIssues = validationErrors.filter(error => error.elementId === id);
  const hasError = edgeSpecificIssues.some(issue => issue.severity === 'error');
  const hasWarning = !hasError && edgeSpecificIssues.some(issue => issue.severity === 'warning');

  let edgeStrokeColor = style?.stroke || '#b1b1b7';
  if (selected) {
    edgeStrokeColor = '#007AFF';
  }
  if (hasError) {
    edgeStrokeColor = '#d73a49';
  } else if (hasWarning && !selected) {
    edgeStrokeColor = '#DBAB09';
  }

  const pathStyle: CSSProperties = {
    ...style,
    stroke: edgeStrokeColor,
    strokeWidth: selected || hasError || hasWarning ? 2.5 : style?.strokeWidth || 1.8,
  };

  let displayLabelText: React.ReactNode = null;
  if (initialLabel) {
    displayLabelText = initialLabel;
  } else if (data?.ruleApplied) {
    const ruleText = typeof data.ruleApplied === 'string' ? data.ruleApplied : 'Rule';
    displayLabelText = ruleText.length > 25 ? `${ruleText.substring(0, 22)}...` : ruleText;
    if (data.isAggregated && typeof data.aggregatedCount === 'number' && data.aggregatedCount > 1) {
      displayLabelText = `(${data.aggregatedCount}) ${displayLabelText}`;
    }
  }
  
  if (!displayLabelText && (hasError || hasWarning)) {
    displayLabelText = hasError ? "Ошибка правила!" : "Предупреждение!";
  }

  const labelClasses = [
    styles.edgeLabelBase,
    selected ? styles.edgeLabelSelected : '',
    hasError ? styles.edgeLabelError : '',
    hasWarning ? styles.edgeLabelWarning : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={pathStyle} />
      {displayLabelText && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              zIndex: (typeof pathStyle.zIndex === 'number' ? pathStyle.zIndex : 0) + 1,
            }}
            className={`nodrag nopan ${labelClasses}`}
          >
            {displayLabelText}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomRuleEdge;
