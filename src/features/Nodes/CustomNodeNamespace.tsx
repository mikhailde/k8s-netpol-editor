import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps, HandleType } from 'reactflow';
import { useAppStore } from '../../store/store';
import { NamespaceNodeData, IValidationError } from '../../types';
import { 
    NS_HANDLE_TARGET_TOP_A, NS_HANDLE_TARGET_LEFT_B, 
    NS_HANDLE_SOURCE_BOTTOM_A, NS_HANDLE_SOURCE_RIGHT_B 
} from '../../constants';
import styles from './CustomNodeNamespace.module.css';

const NodeStatus: React.FC<{ issues: IValidationError[] }> = memo(({ issues }) => {
  const error = issues.find(issue => issue.severity === 'error');
  if (error) {
    return <div className={`${styles.statusContainer} ${styles.errorText}`}>{error.message.substring(0, 50)}</div>;
  }
  
  const warning = issues.find(issue => issue.severity === 'warning');
  if (warning) {
    return <div className={`${styles.statusContainer} ${styles.warningText}`}>{warning.message.substring(0, 50)}</div>;
  }
  
  return null;
});
NodeStatus.displayName = 'NodeStatus';

interface NodeHandleProps {
  type: HandleType;
  position: Position;
  id: string;
}

const nodeHandles: NodeHandleProps[] = [
  { type: 'target', position: Position.Top, id: NS_HANDLE_TARGET_TOP_A },
  { type: 'target', position: Position.Left, id: NS_HANDLE_TARGET_LEFT_B },
  { type: 'source', position: Position.Bottom, id: NS_HANDLE_SOURCE_BOTTOM_A },
  { type: 'source', position: Position.Right, id: NS_HANDLE_SOURCE_RIGHT_B },
];

const CustomNodeNamespace: React.FC<NodeProps<NamespaceNodeData>> = ({
  id,
  data,
  selected,
}) => {
  const validationErrors = useAppStore(state => state.validationErrors);

  const nodeSpecificIssues = useMemo(() => {
    return validationErrors.filter(error => error.elementId === id);
  }, [validationErrors, id]);

  const nodeClasses = useMemo(() => {
    const hasError = nodeSpecificIssues.some(issue => issue.severity === 'error');
    const hasWarning = !hasError && nodeSpecificIssues.some(issue => issue.severity === 'warning');
    
    return [
      styles.nodeBase,
      selected ? styles.selectedState : '',
      hasError ? styles.errorState : '',
      hasWarning ? styles.warningState : '',
    ].filter(Boolean).join(' ');
  }, [selected, nodeSpecificIssues]);

  const { label = `Неймспейс (${id.slice(-4)})`, hasChildren = false } = data;

  const showHintText = !hasChildren && nodeSpecificIssues.length === 0;

  return (
    <div className={nodeClasses} data-testid={`rf__node-${id}`}> 
      {nodeHandles.map(handle => (
        <Handle
          key={handle.id}
          type={handle.type}
          position={handle.position}
          id={handle.id}
        />
      ))}
      
      <div className={styles.nodeLabel}>{label}</div>
      
      <div className={styles.contentWrapper}> 
        {showHintText && (
          <div className={styles.hintText}>
            (Перетащите Группу Подов сюда)
          </div>
        )}
        {!showHintText && nodeSpecificIssues.length > 0 && (
          <NodeStatus issues={nodeSpecificIssues} />
        )}
      </div>
    </div>
  );
};

export default memo(CustomNodeNamespace);