import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../../store/store';
import { NamespaceNodeData } from '../../types';
import { 
    NS_HANDLE_TARGET_TOP_A, NS_HANDLE_TARGET_LEFT_B, 
    NS_HANDLE_SOURCE_BOTTOM_A, NS_HANDLE_SOURCE_RIGHT_B 
} from '../../constants';
import styles from './CustomNodeNamespace.module.css';

const NodeStatus: React.FC<{ hasError: boolean; hasWarning: boolean }> = memo(({ hasError, hasWarning }) => {
  if (hasError) return <div className={`${styles.statusContainer} ${styles.errorText}`}>Ошибка!</div>;
  if (hasWarning) return <div className={`${styles.statusContainer} ${styles.warningText}`}>Предупреждение</div>;
  return null;
});
NodeStatus.displayName = 'NodeStatus';

const CustomNodeNamespace: React.FC<NodeProps<NamespaceNodeData>> = ({ id, data, selected }) => {
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

  const showHintText = !data.hasChildren && !hasError && !hasWarning; 

  return (
    <div className={nodeClasses} data-testid={`rf__node-${id}`}> 
      <Handle type="target" position={Position.Top} id={NS_HANDLE_TARGET_TOP_A} />
      <Handle type="target" position={Position.Left} id={NS_HANDLE_TARGET_LEFT_B} />
      <div className={styles.nodeLabel}>{data?.label || `Неймспейс (${id.slice(-4)})`}</div>
      {showHintText && <div className={styles.hintText}>(Перетащите Группу Подов сюда)</div>}
      {!showHintText && (hasError || hasWarning) && <NodeStatus hasError={hasError} hasWarning={hasWarning} />}
      <Handle type="source" position={Position.Bottom} id={NS_HANDLE_SOURCE_BOTTOM_A} />
      <Handle type="source" position={Position.Right} id={NS_HANDLE_SOURCE_RIGHT_B} />
    </div>
  );
};

export default memo(CustomNodeNamespace);