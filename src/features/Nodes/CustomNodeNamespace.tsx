import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../../store/store';
import { NamespaceNodeData } from '../../types';
import styles from './CustomNodeNamespace.module.css';

const CustomNodeNamespace: React.FC<NodeProps<NamespaceNodeData>> = ({ id, data, selected }) => {
  const validationErrors = useAppStore((state) => state.validationErrors);
  const nodeSpecificIssues = validationErrors.filter(error => error.elementId === id);
  const hasError = nodeSpecificIssues.some(issue => issue.severity === 'error');
  const hasWarning = !hasError && nodeSpecificIssues.some(issue => issue.severity === 'warning');

  const nodeBaseClasses = [
    styles.nodeBase,
    selected ? styles.selectedState : '',
    hasError ? styles.errorState : '',
    hasWarning && !hasError ? styles.warningState : '',
  ].filter(Boolean).join(' ');

  const showHintText = !data.hasChildren && !hasError && !hasWarning; 

  return (
    <div className={nodeBaseClasses}> 
      <Handle type="target" position={Position.Top} id="ns-target-a" />
      <Handle type="target" position={Position.Left} id="ns-target-b" />
      
      <div className={styles.nodeLabel}>{data?.label || 'Неймспейс'}</div>
      
      {showHintText && 
        <div className={styles.hintText}>(Перетащите Группу Подов сюда)</div>
      }
      
      {(!showHintText && (hasError || hasWarning)) && (
        <div className={styles.statusContainer}>
          {hasError && <div className={styles.errorText}>Ошибка!</div>}
          {hasWarning && !hasError && <div className={styles.warningText}>Предупреждение</div>}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="ns-source-a" />
      <Handle type="source" position={Position.Right} id="ns-source-b" />
    </div>
  );
};
export default React.memo(CustomNodeNamespace);