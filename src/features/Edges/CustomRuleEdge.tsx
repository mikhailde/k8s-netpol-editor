import React, { CSSProperties } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { useAppStore } from '../../store/store';
import styles from './CustomRuleEdge.module.css';

const CustomRuleEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style = {}, markerEnd, data, selected, label: propLabel
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const validationErrors = useAppStore((state) => state.validationErrors);
  const edgeIssues = validationErrors.filter(err => err.elementId === id);
  const hasError = edgeIssues.some(i => i.severity === 'error');
  const hasWarning = !hasError && edgeIssues.some(i => i.severity === 'warning');

  let strokeColor = style?.stroke || '#b1b1b7';
  if (selected) strokeColor = 'var(--color-accent, #007AFF)';
  if (hasError) strokeColor = 'var(--color-error, #d73a49)';
  else if (hasWarning && !selected) strokeColor = 'var(--color-warning, #DBAB09)';

  const pathStyle: CSSProperties = {
    ...style,
    stroke: strokeColor,
    strokeWidth: selected || hasError || hasWarning ? 2.2 : (style?.strokeWidth || 1.7),
  };

  let displayLabel: React.ReactNode = null;

  if (data?.isAggregated && typeof data.aggregatedCount === 'number' && data.aggregatedCount > 1) {
    displayLabel = `(${data.aggregatedCount}) Правил`;
  } else if (hasError) {
    displayLabel = edgeIssues.find(i => i.severity === 'error')?.message.substring(0, 30) || "Ошибка правила"; 
  } else if (hasWarning) {
    displayLabel = edgeIssues.find(i => i.severity === 'warning')?.message.substring(0, 30) || "Предупреждение";
  } else if (data?.ruleApplied && typeof data.ruleApplied === 'string' && data.ruleApplied.trim()) {
    const ruleText = data.ruleApplied;
    displayLabel = ruleText.length > 30 ? `${ruleText.substring(0, 27)}...` : ruleText;
  } else if (propLabel && typeof propLabel === 'string' && propLabel.trim()) {
    displayLabel = propLabel;
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
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              zIndex: (typeof pathStyle.zIndex === 'number' ? pathStyle.zIndex : 0) + 1, 
            }}
            className={`nodrag nopan ${labelClasses}`}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default React.memo(CustomRuleEdge);