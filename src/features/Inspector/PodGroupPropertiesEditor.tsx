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
  const { id, data } = node;
  const { metadata, policyConfig, labels } = data;

  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [uiAddLabelError, setUiAddLabelError] = useState<string | null>(null);

  useEffect(() => {
    setNewLabelKey('');
    setNewLabelValue('');
    setEditingLabelKey(null);
    setEditLabelValue('');
    setUiAddLabelError(null);
  }, [id]);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    // Комментарий: Останавливает "всплытие" события (в основном клавиатурных),
    // чтобы предотвратить срабатывание глобальных обработчиков React Flow
    // (например, удаление, навигация), когда пользователь взаимодействует с полями формы.
    e.stopPropagation();
  }, []);

  const handleMetadataChange = useCallback((field: keyof PodGroupNodeData['metadata'], value: string) => {
    const newMetadata = { ...metadata, [field]: value };
    const newLabel = field === 'name' ? value : data.label;
    updateNodeData(id, { metadata: newMetadata, label: newLabel });
  }, [id, metadata, data.label, updateNodeData]);

  const handlePolicyConfigChange = useCallback((field: keyof PodGroupNodeData['policyConfig']) => {
    updateNodeData(id, { policyConfig: { ...policyConfig, [field]: !policyConfig[field] } });
  }, [id, policyConfig, updateNodeData]);

  const handleAddLabel = useCallback(() => {
    const trimmedKey = newLabelKey.trim();
    if (!trimmedKey) {
      setUiAddLabelError('Ключ метки не может быть пустым.');
      return;
    }
    if (labels[trimmedKey] !== undefined) {
      setUiAddLabelError(`Метка с ключом "${trimmedKey}" уже существует.`);
      return;
    }
    setUiAddLabelError(null);
    updateNodeData(id, { labels: { ...labels, [trimmedKey]: newLabelValue.trim() } });
    setNewLabelKey('');
    setNewLabelValue('');
  }, [id, labels, newLabelKey, newLabelValue, updateNodeData]);

  const handleDeleteLabel = useCallback((keyToDelete: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [keyToDelete]: _, ...remainingLabels } = labels;
    updateNodeData(id, { labels: remainingLabels });
    if (editingLabelKey === keyToDelete) { 
      setEditingLabelKey(null);
    }
  }, [id, labels, editingLabelKey, updateNodeData]);

  const startEditLabel = useCallback((key: string, value: string) => {
    setEditingLabelKey(key);
    setEditLabelValue(value);
    setUiAddLabelError(null);
  }, []);

  const handleSaveEditedLabel = useCallback(() => {
    if (!editingLabelKey) return;
    updateNodeData(id, { labels: { ...labels, [editingLabelKey]: editLabelValue.trim() } });
    setEditingLabelKey(null);
  }, [id, labels, editingLabelKey, editLabelValue, updateNodeData]);

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
        <label htmlFor={`pg-name-${id}`} className={styles.formLabel}>Name (DNS-1123):</label>
        <input
          id={`pg-name-${id}`}
          type="text"
          value={metadata.name || ''}
          onChange={(e) => handleMetadataChange('name', e.target.value)}
          onKeyDown={stopPropagation}
          className={`${styles.formInput} ${nameError ? styles.formInputError : ''}`}
          placeholder="Имя группы подов"
          aria-describedby={nameError ? `pg-name-error-${id}` : undefined}
        />
        {nameError && <span id={`pg-name-error-${id}`} className={styles.errorMessage}>{nameError}</span>}
      </div>

      <div className={styles.section}>
        <label htmlFor={`pg-ns-${id}`} className={styles.formLabel}>Namespace (DNS-1123):</label>
        <input
          id={`pg-ns-${id}`}
          type="text"
          value={metadata.namespace || ''}
          onChange={(e) => handleMetadataChange('namespace', e.target.value)}
          onKeyDown={stopPropagation}
          className={`${styles.formInput} ${namespaceError ? styles.formInputError : ''}`}
          placeholder="Неймспейс группы подов"
          aria-describedby={namespaceError ? `pg-ns-error-${id}` : undefined}
        />
        {namespaceError && <span id={`pg-ns-error-${id}`} className={styles.errorMessage}>{namespaceError}</span>}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Конфигурация Политик</span>
        {(['defaultDenyIngress', 'defaultDenyEgress'] as const).map(key => (
          <label key={key} htmlFor={`${key}-${id}`} className={styles.formCheckboxWrapper}>
            <input
              type="checkbox"
              id={`${key}-${id}`}
              checked={policyConfig[key]}
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

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Лейблы (Селекторы)</span>
        {displayLabelsError && <span className={`${styles.errorMessage} ${styles.section}`}>{displayLabelsError}</span>}
        
        {Object.keys(labels).length > 0 || editingLabelKey ? (
          <div className={styles.labelsListContainer}>
            {Object.entries(labels).map(([key, value]) => (
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
            {uiAddLabelError && <span className={styles.errorMessage}>{uiAddLabelError}</span>}
            <div>
              <input
                type="text"
                placeholder="Ключ метки"
                value={newLabelKey}
                onChange={(e) => { setNewLabelKey(e.target.value); setUiAddLabelError(null); }}
                onKeyDown={stopPropagation}
                className={`${styles.formInput} ${uiAddLabelError ? styles.formInputError : ''}`}
                aria-label="Ключ новой метки"
              />
              <input
                type="text"
                placeholder="Значение метки (опционально)"
                value={newLabelValue}
                onChange={(e) => setNewLabelValue(e.target.value)}
                onKeyDown={(e) => {
                    stopPropagation(e);
                    if(e.key === 'Enter') handleAddLabel();
                }}
                className={styles.formInput}
                aria-label="Значение новой метки"
              />
            </div>
            <button onClick={handleAddLabel} className={`${styles.buttonBase} ${styles.buttonSuccess} ${styles.buttonBlock}`}>Добавить лейбл</button>
          </div>
        )}
      </div>
    </>
  );
};

export default memo(PodGroupPropertiesEditor);