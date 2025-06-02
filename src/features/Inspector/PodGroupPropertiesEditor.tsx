import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Node } from 'reactflow';
import { useAppStore } from '../../store/store';
import { PodGroupNodeData, IValidationError } from '../../types';
import styles from './InspectorView.module.css';

const getFieldError = (fieldKey: string, issues: IValidationError[]): string | undefined =>
  issues.find(issue => issue.fieldKey === fieldKey)?.message;

const getFirstLabelSpecificError = (issues: IValidationError[]): IValidationError | undefined =>
  issues.find(issue => issue.fieldKey?.startsWith('labels.'));

interface PodGroupPropertiesEditorProps {
  node: Node<PodGroupNodeData>;
  nodeIssues: IValidationError[];
}

const PodGroupPropertiesEditor: React.FC<PodGroupPropertiesEditorProps> = ({ node, nodeIssues }) => {
  const updateNodeData = useAppStore(state => state.updateNodeData);

  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [uiAddLabelKeyError, setUiAddLabelKeyError] = useState<string | null>(null);

  useEffect(() => {
    setNewLabelKey('');
    setNewLabelValue('');
    setEditingLabelKey(null);
    setEditLabelValue('');
    setUiAddLabelKeyError(null);
  }, [node.id]);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const handleMetadataChange = useCallback((field: keyof PodGroupNodeData['metadata'], value: string) => {
    const newMetadata = { ...node.data.metadata, [field]: value };
    const newLabel = field === 'name' ? value : node.data.label;
    updateNodeData(node.id, { metadata: newMetadata, label: newLabel });
  }, [node, updateNodeData]);

  const handlePolicyConfigChange = useCallback((field: keyof PodGroupNodeData['policyConfig']) => {
    updateNodeData(node.id, { 
      policyConfig: { ...node.data.policyConfig, [field]: !node.data.policyConfig[field] } 
    });
  }, [node, updateNodeData]);

  const handleAddLabel = useCallback(() => {
    const trimmedKey = newLabelKey.trim();
    if (!trimmedKey) {
      setUiAddLabelKeyError('Ключ метки не может быть пустым.');
      return;
    }
    if (node.data.labels[trimmedKey] !== undefined) {
      setUiAddLabelKeyError(`Метка с ключом "${trimmedKey}" уже существует.`);
      return;
    }
    setUiAddLabelKeyError(null);
    updateNodeData(node.id, { labels: { ...node.data.labels, [trimmedKey]: newLabelValue.trim() } });
    setNewLabelKey('');
    setNewLabelValue('');
  }, [node, newLabelKey, newLabelValue, updateNodeData]);

  const handleDeleteLabel = useCallback((keyToDelete: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [keyToDelete]: _, ...remainingLabels } = node.data.labels;
    updateNodeData(node.id, { labels: remainingLabels });
    if (editingLabelKey === keyToDelete) { 
      setEditingLabelKey(null);
    }
  }, [node, editingLabelKey, updateNodeData]);

  const startEditLabel = useCallback((key: string, value: string) => {
    setEditingLabelKey(key);
    setEditLabelValue(value);
    setUiAddLabelKeyError(null);
  }, []);

  const handleSaveEditedLabel = useCallback(() => {
    if (!editingLabelKey) return;
    updateNodeData(node.id, { labels: { ...node.data.labels, [editingLabelKey]: editLabelValue.trim() } });
    setEditingLabelKey(null);
  }, [node, editingLabelKey, editLabelValue, updateNodeData]);

  const cancelEditLabel = useCallback(() => {
    setEditingLabelKey(null);
  }, []);

  const nameError = useMemo(() => getFieldError('metadata.name', nodeIssues), [nodeIssues]);
  const namespaceError = useMemo(() => getFieldError('metadata.namespace', nodeIssues), [nodeIssues]);
  const generalLabelsError = useMemo(() => getFieldError('labels', nodeIssues), [nodeIssues]);
  const firstSpecificLabelError = useMemo(() => getFirstLabelSpecificError(nodeIssues), [nodeIssues]);
  const displayLabelsError = generalLabelsError || (firstSpecificLabelError ? `${firstSpecificLabelError.message} (ключ: ${firstSpecificLabelError.fieldKey?.split('.')[1]})` : '');

  return (
    <>
      <div className={styles.section}>
        <label htmlFor={`pg-name-${node.id}`} className={styles.formLabel}>Name (DNS-1123):</label>
        <input
          id={`pg-name-${node.id}`}
          type="text"
          value={node.data.metadata.name || ''}
          onChange={(e) => handleMetadataChange('name', e.target.value)}
          onKeyDown={stopPropagation}
          className={`${styles.formInput} ${nameError ? styles.formInputError : ''}`}
          placeholder="Имя группы подов"
          aria-describedby={nameError ? `pg-name-error-${node.id}` : undefined}
        />
        {nameError && <span id={`pg-name-error-${node.id}`} className={styles.errorMessage}>{nameError}</span>}
      </div>

      <div className={styles.section}>
        <label htmlFor={`pg-ns-${node.id}`} className={styles.formLabel}>Namespace (DNS-1123):</label>
        <input
          id={`pg-ns-${node.id}`}
          type="text"
          value={node.data.metadata.namespace || ''}
          onChange={(e) => handleMetadataChange('namespace', e.target.value)}
          onKeyDown={stopPropagation}
          className={`${styles.formInput} ${namespaceError ? styles.formInputError : ''}`}
          placeholder="Неймспейс группы подов"
          aria-describedby={namespaceError ? `pg-ns-error-${node.id}` : undefined}
        />
        {namespaceError && <span id={`pg-ns-error-${node.id}`} className={styles.errorMessage}>{namespaceError}</span>}
      </div>

      <hr className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Конфигурация Политик</span>
        {(['defaultDenyIngress', 'defaultDenyEgress'] as const).map(key => (
          <label key={key} htmlFor={`${key}-${node.id}`} className={styles.formCheckboxWrapper}>
            <input
              type="checkbox"
              id={`${key}-${node.id}`}
              checked={node.data.policyConfig[key]}
              onChange={() => handlePolicyConfigChange(key)}
              onKeyDown={stopPropagation}
              className={styles.formCheckbox}
            />
            <span className={styles.formCheckboxLabel}>
              {key === 'defaultDenyIngress' ? 'Default Deny Ingress' : 'Default Deny Egress'}
            </span>
          </label>
        ))}
      </div>

      <hr className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Лейблы (Селекторы)</span>
        {displayLabelsError && <span className={`${styles.errorMessage} ${styles.section}`}>{displayLabelsError}</span>}
        
        {Object.keys(node.data.labels).length > 0 || editingLabelKey ? (
          <div className={styles.labelsListContainer}>
            {Object.entries(node.data.labels).map(([key, value]) => (
              <div key={key} className={styles.labelEntry}>
                {editingLabelKey === key ? (
                  <>
                    <span className={styles.labelKey}>{key}:</span>
                    <input
                      type="text"
                      value={editLabelValue}
                      onChange={(e) => setEditLabelValue(e.target.value)}
                      onKeyDown={(e) => { 
                        stopPropagation(e); 
                        if (e.key === 'Enter') handleSaveEditedLabel();
                        if (e.key === 'Escape') cancelEditLabel();
                      }}
                      className={styles.formInput}
                      autoFocus
                      aria-label={`Значение для метки ${key}`}
                    />
                    <button onClick={handleSaveEditedLabel} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonSuccess}`}>Сохранить</button>
                    <button onClick={cancelEditLabel} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonSecondary}`}>Отмена</button>
                  </>
                ) : (
                  <>
                    <span className={styles.labelKey}>{key}:</span>
                    <span className={styles.labelValue}>{value || '(пусто)'}</span>
                    <button onClick={() => startEditLabel(key, value)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonPrimary}`}>Изм.</button>
                    <button onClick={() => handleDeleteLabel(key)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonDanger}`}>Удал.</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (!editingLabelKey && <p className={styles.placeholderText}>Лейблы не определены.</p>)}

        {!editingLabelKey && (
          <div className={styles.addLabelForm}>
            <span className={`${styles.sectionTitle} ${styles.sectionTitleSmallerMargin}`}>Добавить новый лейбл:</span>
            <div className={styles.addLabelFormRow}>
              <div className={styles.inputWrapperWithError}>
                <input
                  type="text"
                  placeholder="Ключ метки"
                  value={newLabelKey}
                  onChange={(e) => { setNewLabelKey(e.target.value); setUiAddLabelKeyError(null); }}
                  onKeyDown={stopPropagation}
                  className={`${styles.formInput} ${uiAddLabelKeyError ? styles.formInputError : ''}`}
                  aria-label="Ключ новой метки"
                  aria-describedby={uiAddLabelKeyError ? `new-label-key-error-${node.id}` : undefined}
                />
                {uiAddLabelKeyError && <span id={`new-label-key-error-${node.id}`} className={styles.errorMessage}>{uiAddLabelKeyError}</span>}
              </div>
              <input
                type="text"
                placeholder="Значение метки"
                value={newLabelValue}
                onChange={(e) => setNewLabelValue(e.target.value)}
                onKeyDown={(e) => {
                    stopPropagation(e);
                    if(e.key === 'Enter' && !uiAddLabelKeyError) handleAddLabel();
                }}
                className={styles.formInput}
                aria-label="Значение новой метки"
              />
              <button onClick={handleAddLabel} className={`${styles.buttonBase} ${styles.buttonSuccess}`}>Добавить</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default memo(PodGroupPropertiesEditor);