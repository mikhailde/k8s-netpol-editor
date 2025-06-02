import React, { memo, CSSProperties } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { useAppStore } from '../../store/store';
import styles from './CustomRuleEdge.module.css';
import { PortProtocolEntry } from '../../types';

const CustomRuleEdge: React.FC<EdgeProps> = ({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style = {}, markerEnd, data, selected
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

  let displayLabelContent: React.ReactNode | null = null;
  let showLabel = false;

  if (data?.isAggregated && typeof data.aggregatedCount === 'number' && data.aggregatedCount > 1) {
    displayLabelContent = `(${data.aggregatedCount}) Правил`;
    showLabel = true;
  } else if (hasError) {
    displayLabelContent = edgeIssues.find(i => i.severity === 'error')?.message.substring(0, 30) || "Ошибка правила"; 
    showLabel = true;
  } else if (hasWarning) {
    displayLabelContent = edgeIssues.find(i => i.severity === 'warning')?.message.substring(0, 30) || "Предупреждение";
    showLabel = true;
  } else if (data?.ports && Array.isArray(data.ports) && data.ports.length > 0) {
    const portDescriptions = (data.ports as PortProtocolEntry[]).map((p: PortProtocolEntry) => {
      const portText = p.port ? p.port.toString() : 'any';
      const protocolText = p.protocol ? p.protocol.toString() : 'any';
      return `${portText}/${protocolText}`;
    }).join(', ');
    displayLabelContent = portDescriptions.length > 30 ? `${portDescriptions.substring(0, 27)}...` : portDescriptions;
    showLabel = true;
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
      {showLabel && displayLabelContent && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              zIndex: (typeof pathStyle.zIndex === 'number' ? pathStyle.zIndex : 0) + 1, 
            }}
            className={`nodrag nopan ${labelClasses}`}
          >
            {displayLabelContent}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(CustomRuleEdge);