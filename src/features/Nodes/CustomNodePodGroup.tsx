import React from 'react';
import { Handle, Position, NodeProps, internalsSymbol } from 'reactflow';
import { useAppStore } from '../../store/store';
import { PodGroupNodeData } from '../../types';
import styles from './CustomNodePodGroup.module.css';

const CustomNodePodGroup: React.FC<NodeProps<PodGroupNodeData>> = ({
  id,
  data,
  selected,
}) => {
  const validationErrors = useAppStore((state) => state.validationErrors);
  const nodeSpecificIssues = validationErrors.filter(error => error.elementId === id);
  const hasError = nodeSpecificIssues.some(issue => issue.severity === 'error');
  const hasWarning = !hasError && nodeSpecificIssues.some(issue => issue.severity === 'warning');

  const nodeClasses = [
    styles.nodeBase,
    selected ? styles.selectedState : '',
    hasError ? styles.errorState : '',
    hasWarning && !hasError ? styles.warningState : '',
  ].filter(Boolean).join(' ');

  const labelToShow = data?.label || data?.metadata?.name || 'Pod Group';

  return (
    <div className={nodeClasses}>
      <Handle type="target" position={Position.Top} id="pg-target-a" isConnectable={true} />
      
      <div className={styles.nodeLabel}>{labelToShow}</div>

      {hasError && <div className={styles.errorText}>Ошибка!</div>}
      {hasWarning && !hasError && <div className={styles.warningText}>Предупреждение</div>}

      <Handle type="source" position={Position.Bottom} id="pg-source-a" isConnectable={true} />
    </div>
  );
};

export default React.memo(CustomNodePodGroup);