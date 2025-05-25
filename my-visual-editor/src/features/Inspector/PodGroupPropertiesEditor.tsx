import React, { useState, useEffect, useMemo } from 'react';
import { Node } from 'reactflow';
import { useAppStore } from '../../store/store';
import { PodGroupNodeData, IValidationError } from '../../types';
import styles from '../Inspector/InspectorView.module.css';

interface PodGroupPropertiesEditorProps {
  node: Node<PodGroupNodeData>;
  nodeIssues: IValidationError[];
}

const getFieldError = (fieldKey: string, issues: IValidationError[]): string | undefined => {
  return issues.find(issue => issue.fieldKey === fieldKey)?.message;
};

const PodGroupPropertiesEditor: React.FC<PodGroupPropertiesEditorProps> = ({ node, nodeIssues }) => {
  const updateNodeData = useAppStore((state) => state.updateNodeData);

  const { metadata, policyConfig, labels } = node.data || {
    metadata: { name: '', namespace: '' },
    policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
    labels: {},
  };

  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  
  const [uiAddLabelError, setUiAddLabelError] = useState('');
  const [uiEditLabelError, setUiEditLabelError] = useState('');


  useEffect(() => {
    setEditingLabelKey(null);
    setEditLabelValue('');
    setNewLabelKey('');
    setNewLabelValue('');
    setUiAddLabelError('');
    setUiEditLabelError('');
  }, [node.id]);

  const stopPropagation = (e: React.KeyboardEvent | React.ChangeEvent<HTMLInputElement>) => e.stopPropagation();

  const handleFieldChange = (
    field: 'metadata.namespace' | `policyConfig.${keyof PodGroupNodeData['policyConfig']}`,
    value: string | boolean
  ) => {
    if (field === 'metadata.namespace' && typeof value === 'string') {
      updateNodeData(node.id, { metadata: { ...metadata, namespace: value } });
    } else if (field.startsWith('policyConfig.') && typeof value === 'boolean') {
      const configKey = field.split('.')[1] as keyof PodGroupNodeData['policyConfig'];
      updateNodeData(node.id, { policyConfig: { ...policyConfig, [configKey]: value } });
    }
  };

  const namespaceError = useMemo(() => getFieldError('metadata.namespace', nodeIssues), [nodeIssues]);

  const handleAddLabel = () => {
    const trimmedKey = newLabelKey.trim();
    const trimmedValue = newLabelValue.trim();
    setUiEditLabelError('');

    if (!trimmedKey) {
      setUiAddLabelError('Ключ метки не может быть пустым.'); return;
    }
    if (!trimmedValue) {
      setUiAddLabelError('Значение метки не может быть пустым.'); return;
    }
    if (labels && Object.keys(labels).some(k => k.toLowerCase() === trimmedKey.toLowerCase())) {
      setUiAddLabelError(`Метка с ключом "${trimmedKey}" уже существует.`); return;
    }

    setUiAddLabelError('');
    updateNodeData(node.id, { labels: { ...labels, [trimmedKey]: trimmedValue } });
    setNewLabelKey('');
    setNewLabelValue('');
  };

  const handleDeleteLabel = (keyToDelete: string) => {
    const updatedLabels = { ...labels };
    delete updatedLabels[keyToDelete];
    updateNodeData(node.id, { labels: updatedLabels });
    if (uiAddLabelError.toLowerCase().includes(keyToDelete.toLowerCase())) setUiAddLabelError('');
    if (editingLabelKey === keyToDelete) {
      setEditingLabelKey(null);
      setEditLabelValue('');
      setUiEditLabelError('');
    }
  };

  const handleEditLabelClick = (key: string, currentValue: string) => {
    setEditingLabelKey(key);
    setEditLabelValue(currentValue);
    setUiAddLabelError('');
    setUiEditLabelError('');
  };

  const handleSaveLabel = () => {
    if (!editingLabelKey) return;
    const trimmedEditValue = editLabelValue.trim();

    if (!trimmedEditValue) {
      setUiEditLabelError('Значение метки не может быть пустым.'); return;
    }
    setUiEditLabelError('');
    updateNodeData(node.id, { labels: { ...labels, [editingLabelKey]: trimmedEditValue } });
    setEditingLabelKey(null);
    setEditLabelValue('');
  };
  
  const handleCancelEdit = () => {
    setEditingLabelKey(null);
    setEditLabelValue('');
    setUiEditLabelError('');
  };

  const labelsSectionError = useMemo(() => getFieldError('labels', nodeIssues), [nodeIssues]);

  return (
    <>
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Metadata</span>
        <div>
          <label htmlFor={`ns-${node.id}`} className={styles.formLabel}>Namespace (required):</label>
          <input 
            id={`ns-${node.id}`} type="text" value={metadata.namespace}
            onChange={(e) => { stopPropagation(e); handleFieldChange('metadata.namespace', e.target.value); }}
            onKeyDown={stopPropagation}
            className={`${styles.formInput} ${namespaceError ? styles.formInputError : ''}`}
            placeholder="Enter namespace"
          />
          {namespaceError && <span className={styles.errorMessage}>{namespaceError}</span>}
        </div>
        <div style={{ marginTop: 'var(--spacing-unit)' }}> 
          <label htmlFor={`name-${node.id}`} className={styles.formLabel}>Name (auto-generated):</label>
          <input 
            onKeyDown={stopPropagation} 
            className={styles.formInput} 
            style={{ backgroundColor: '#f0f0f0' }}
          />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Policy Configuration</span>
        {(['defaultDenyIngress', 'defaultDenyEgress'] as const).map(key => (
          <div key={key} className={styles.formCheckboxWrapper} onClick={() => handleFieldChange(`policyConfig.${key}`, !policyConfig[key])}>
            <input 
              type="checkbox" 
              id={`${key}-${node.id}`}
              checked={policyConfig[key]}
              onChange={(e) => {stopPropagation(e); handleFieldChange(`policyConfig.${key}`, e.target.checked)}}
              className={styles.formCheckbox}
            />
            <label htmlFor={`${key}-${node.id}`} className={styles.formCheckboxLabel}>
              {key.replace('defaultDeny', 'Default Deny ')}
            </label>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Labels</span>
        {labelsSectionError && <span className={styles.errorMessage} style={{marginBottom: 'var(--spacing-unit)'}}>{labelsSectionError}</span>}
        
        {Object.keys(labels).length > 0 || editingLabelKey ? (
          <div className={styles.labelsListContainer}>
            {Object.entries(labels).map(([key, value]) => (
              <div key={key} className={styles.labelEntry}>
                {editingLabelKey === key ? (
                  <>
                    <span className={styles.labelKey}>{key}:</span>
                    <input 
                      type="text" value={editLabelValue}
                      onChange={(e) => setEditLabelValue(e.target.value)}
                      className={`${styles.formInput} ${styles.labelValueInput} ${uiEditLabelError ? styles.formInputError : ''}`}
                      autoFocus
                      onKeyDown={(e) => { stopPropagation(e); if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') handleCancelEdit(); }}
                    />
                    <button onClick={handleSaveLabel} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonSuccess}`}>Save</button>
                    <button onClick={handleCancelEdit} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonSecondary}`}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className={styles.labelKey}>{key}:</span>
                    <span className={styles.labelValue}>{value}</span>
                    <button onClick={() => handleEditLabelClick(key, value)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonPrimary}`} title={`Edit label ${key}`}>Edit</button>
                    <button onClick={() => handleDeleteLabel(key)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonDanger}`} title={`Delete label ${key}`}>Delete</button>
                  </>
                )}
              </div>
            ))}
             {uiEditLabelError && editingLabelKey && <span className={`${styles.errorMessage} ${styles.labelEditError}`}>{uiEditLabelError}</span>}
          </div>
        ) : (
          <p className={styles.placeholderText}>No labels defined.</p>
        )}

        {!editingLabelKey && (
          <div className={styles.addLabelForm}>
            <span className={styles.sectionTitle} style={{fontSize: '1em', marginTop: 'var(--spacing-unit)'}}>Add New Label:</span>
            {uiAddLabelError && <span className={styles.errorMessage}>{uiAddLabelError}</span>}
            <div style={{ display: 'flex', gap: 'var(--spacing-unit)', marginBottom: 'var(--spacing-unit)' }}>
              <input 
                type="text" placeholder="Label Key" value={newLabelKey}
                onChange={(e) => { stopPropagation(e); setNewLabelKey(e.target.value); if (uiAddLabelError) setUiAddLabelError(''); }}
                onKeyDown={stopPropagation} 
                className={`${styles.formInput} ${uiAddLabelError && !newLabelValue ? styles.formInputError : ''}`}
              />
              <input 
                type="text" placeholder="Label Value" value={newLabelValue}
                onChange={(e) => { stopPropagation(e); setNewLabelValue(e.target.value); if (uiAddLabelError) setUiAddLabelError(''); }}
                onKeyDown={stopPropagation} 
                className={`${styles.formInput} ${uiAddLabelError && !newLabelKey ? styles.formInputError : ''}`}
              />
            </div>
            <button onClick={handleAddLabel} className={`${styles.buttonBase} ${styles.buttonSuccess}`} style={{ width: '100%' }}>
              Add Label
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default PodGroupPropertiesEditor;
