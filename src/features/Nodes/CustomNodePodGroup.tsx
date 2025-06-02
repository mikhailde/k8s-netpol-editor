import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../../store/store';
import { PodGroupNodeData } from '../../types';
import { PG_HANDLE_TARGET_TOP_A, PG_HANDLE_SOURCE_BOTTOM_A } from '../../constants';
import styles from './CustomNodePodGroup.module.css';

const NodeStatusText: React.FC<{ hasError: boolean; hasWarning: boolean }> = memo(({ hasError, hasWarning }) => {
  if (hasError) return <div className={styles.errorText}>Ошибка!</div>;
  if (hasWarning) return <div className={styles.warningText}>Предупреждение</div>;
  return null;
});
NodeStatusText.displayName = 'NodeStatusText';

const CustomNodePodGroup: React.FC<NodeProps<PodGroupNodeData>> = ({ id, data, selected }) => {
  const allValidationErrors = useAppStore(state => state.validationErrors);

  const { hasError, hasWarning } = useMemo(() => {
    const issuesForNode = allValidationErrors.filter(error => error.elementId === id);
    const err = issuesForNode.some(issue => issue.severity === 'error');
    const warn = !err && issuesForNode.some(issue => issue.severity === 'warning');
    return { hasError: err, hasWarning: warn };
  }, [allValidationErrors, id]);

  const nodeClasses = [
    styles.nodeBase,
    selected ? styles.selectedState : '',
    hasError ? styles.errorState : '',
    hasWarning ? styles.warningState : '',
  ].filter(Boolean).join(' ');

  const labelToShow = data?.label || data?.metadata?.name || `PodGroup (${id.slice(-4)})`;

  return (
    <div className={nodeClasses} data-testid={`rf__node-${id}`}>
      <Handle type="target" position={Position.Top} id={PG_HANDLE_TARGET_TOP_A} isConnectable={true} />
      <div className={styles.nodeLabel}>{labelToShow}</div>
      {(hasError || hasWarning) && <NodeStatusText hasError={hasError} hasWarning={hasWarning} />}
      <Handle type="source" position={Position.Bottom} id={PG_HANDLE_SOURCE_BOTTOM_A} isConnectable={true} />
    </div>
  );
};

export default memo(CustomNodePodGroup);