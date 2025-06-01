import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const { metadata, policyConfig, labels } = node.data;

  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [uiAddLabelError, setUiAddLabelError] = useState('');
  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  
  useEffect(() => {
    setNewLabelKey(''); setNewLabelValue(''); setUiAddLabelError('');
    setEditingLabelKey(null); setEditLabelValue('');
  }, [node.id]);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  const handleFieldChange = useCallback((field: keyof PodGroupNodeData['metadata'] | keyof PodGroupNodeData['policyConfig'], value: string | boolean) => {
    if (field === 'name' || field === 'namespace') {
      const newName = field === 'name' ? value as string : metadata.name;
      updateNodeData(node.id, { metadata: { ...metadata, [field]: value as string }, label: newName });
    } else {
      updateNodeData(node.id, { policyConfig: { ...policyConfig, [field as keyof PodGroupNodeData['policyConfig']]: value as boolean } });
    }
  }, [node.id, metadata, policyConfig, updateNodeData]);

  const handleAddLabel = useCallback(() => {
    const trimmedKey = newLabelKey.trim();
    if (!trimmedKey) { setUiAddLabelError('Ключ метки не может быть пустым.'); return; }
    setUiAddLabelError('');
    updateNodeData(node.id, { labels: { ...labels, [trimmedKey]: newLabelValue.trim() } });
    setNewLabelKey(''); setNewLabelValue('');
  }, [node.id, labels, newLabelKey, newLabelValue, updateNodeData]);

  const handleDeleteLabel = useCallback((keyToDelete: string) => {
    const { [keyToDelete]: _, ...remainingLabels } = labels;
    updateNodeData(node.id, { labels: remainingLabels });
    if (editingLabelKey === keyToDelete) setEditingLabelKey(null);
  }, [node.id, labels, editingLabelKey, updateNodeData]);

  const handleEditLabel = useCallback((key: string, value: string) => {
    setEditingLabelKey(key); setEditLabelValue(value); setUiAddLabelError('');
  }, []);

  const handleSaveEditedLabel = useCallback(() => {
    if (!editingLabelKey) return;
    updateNodeData(node.id, { labels: { ...labels, [editingLabelKey]: editLabelValue.trim() } });
    setEditingLabelKey(null);
  }, [node.id, labels, editingLabelKey, editLabelValue, updateNodeData]);
  
  const nameError = useMemo(() => getFieldError('metadata.name', nodeIssues), [nodeIssues]);
  const namespaceError = useMemo(() => getFieldError('metadata.namespace', nodeIssues), [nodeIssues]);
  const generalLabelsError = useMemo(() => getFieldError('labels', nodeIssues), [nodeIssues]);
  const firstSpecificLabelError = useMemo(() => getFirstLabelSpecificError(nodeIssues), [nodeIssues]);
  const displayLabelsError = generalLabelsError || (firstSpecificLabelError ? `${firstSpecificLabelError.message} (Поле: ${firstSpecificLabelError.fieldKey})` : '');

  return (
    <>
      <div className={styles.section}>
        <label htmlFor={`pg-name-${node.id}`} className={styles.formLabel}>Name (DNS-1123):</label>
        <input id={`pg-name-${node.id}`} type="text" value={metadata.name}
               onChange={(e) => handleFieldChange('name', e.target.value)} onKeyDown={stopPropagation}
               className={`${styles.formInput} ${nameError ? styles.formInputError : ''}`} placeholder="PodGroup Name" />
        {nameError && <span className={styles.errorMessage}>{nameError}</span>}
      </div>

      <div className={styles.section}>
        <label htmlFor={`pg-ns-${node.id}`} className={styles.formLabel}>Namespace (DNS-1123):</label>
        <input id={`pg-ns-${node.id}`} type="text" value={metadata.namespace}
               onChange={(e) => handleFieldChange('namespace', e.target.value)} onKeyDown={stopPropagation}
               className={`${styles.formInput} ${namespaceError ? styles.formInputError : ''}`} placeholder="Namespace" />
        {namespaceError && <span className={styles.errorMessage}>{namespaceError}</span>}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Policy Configuration</span>
        {(['defaultDenyIngress', 'defaultDenyEgress'] as const).map(key => (
          <div key={key} className={styles.formCheckboxWrapper} onClick={() => handleFieldChange(key, !policyConfig[key])}>
            <input type="checkbox" id={`${key}-${node.id}`} checked={policyConfig[key]} readOnly className={styles.formCheckbox} />
            <label htmlFor={`${key}-${node.id}`} className={styles.formCheckboxLabel}>{key.replace('defaultDeny', 'Default Deny ')}</label>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Labels (Selectors)</span>
        {displayLabelsError && <span className={`${styles.errorMessage} ${styles.section}`}>{displayLabelsError}</span>}
        
        {Object.keys(labels).length > 0 || editingLabelKey ? (
          <div className={styles.labelsListContainer}>
            {Object.entries(labels).map(([key, value]) => (
              <div key={key} className={styles.labelEntry}>
                {editingLabelKey === key ? (
                  <>
                    <span className={styles.labelKey}>{key}:</span>
                    <input type="text" value={editLabelValue} autoFocus
                           onChange={(e) => setEditLabelValue(e.target.value)}
                           onKeyDown={(e) => { stopPropagation(e); if(e.key==='Enter')handleSaveEditedLabel();if(e.key==='Escape')setEditingLabelKey(null);}}
                           className={styles.formInput} />
                    <button onClick={handleSaveEditedLabel} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonSuccess}`}>Save</button>
                    <button onClick={()=>setEditingLabelKey(null)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonSecondary}`}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span className={styles.labelKey}>{key}:</span>
                    <span className={styles.labelValue}>{value || '(empty)'}</span>
                    <button onClick={() => handleEditLabel(key, value)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonPrimary}`}>Edit</button>
                    <button onClick={() => handleDeleteLabel(key)} className={`${styles.buttonBase} ${styles.buttonSmall} ${styles.buttonDanger}`}>Delete</button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (<p className={styles.placeholderText}>No labels defined.</p>)}

        {!editingLabelKey && (
          <div className={styles.addLabelForm}>
            <span className={styles.sectionTitle} style={{fontSize:'1em', marginTop:'var(--spacing-unit)'}}>Add New Label:</span>
            {uiAddLabelError && <span className={styles.errorMessage}>{uiAddLabelError}</span>}
            <div>
              <input type="text" placeholder="Label Key" value={newLabelKey}
                     onChange={(e)=>{stopPropagation(e);setNewLabelKey(e.target.value);setUiAddLabelError('');}} onKeyDown={stopPropagation}
                     className={`${styles.formInput} ${uiAddLabelError ? styles.formInputError : ''}`} />
              <input type="text" placeholder="Label Value (can be empty)" value={newLabelValue}
                     onChange={(e)=>{stopPropagation(e);setNewLabelValue(e.target.value);}} onKeyDown={stopPropagation}
                     className={styles.formInput} />
            </div>
            <button onClick={handleAddLabel} className={`${styles.buttonBase} ${styles.buttonSuccess}`} style={{width:'100%'}}>Add Label</button>
          </div>
        )}
      </div>
    </>
  );
};

export default React.memo(PodGroupPropertiesEditor);