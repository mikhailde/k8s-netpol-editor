import React, { useMemo } from 'react';
import { Node } from 'reactflow';
import { NamespaceNodeData, IValidationError } from '../../types';
import { useAppStore } from '../../store/store';
import styles from '../Inspector/InspectorView.module.css';

interface NamespacePropertiesEditorProps {
  node: Node<NamespaceNodeData>;
  nodeIssues: IValidationError[];
}

const getFieldError = (fieldKey: string, issues: IValidationError[]): string | undefined => {
  return issues.find(issue => issue.fieldKey === fieldKey)?.message;
};

const NamespacePropertiesEditor: React.FC<NamespacePropertiesEditorProps> = ({ node, nodeIssues }) => {
  const updateNodeData = useAppStore((state) => state.updateNodeData);

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(node.id, { label: event.target.value });
  };

  const stopPropagation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Комментарий: Останавливает "всплытие" события клавиатуры, чтобы предотвратить
    // срабатывание глобальных обработчиков React Flow (например, удаление узла/ребра
    // по Delete/Backspace, перемещение узлов стрелками), когда фокус находится внутри этого инпута.
    e.stopPropagation();
  };

  const labelError = useMemo(() => getFieldError('label', nodeIssues), [nodeIssues]);

  return (
    <> 
      {}
      {}
      
      <div> {}
        <label
          htmlFor={`ns-label-${node.id}`}
          className={styles.formLabel}
        >
          Label:
        </label>
        <input
          id={`ns-label-${node.id}`}
          type="text"
          value={node.data?.label || ''}
          onChange={handleLabelChange}
          onKeyDown={stopPropagation}
          className={`${styles.formInput} ${labelError ? styles.formInputError : ''}`}
          placeholder="Enter namespace label"
        />
        {labelError && <span className={styles.errorMessage}>{labelError}</span>}
      </div>
    </>
  );
};

export default NamespacePropertiesEditor;
