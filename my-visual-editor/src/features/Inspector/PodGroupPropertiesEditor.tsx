// src/features/Inspector/PodGroupPropertiesEditor.tsx
import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { useAppStore } from '../../store/store';

export interface PodGroupNodeData {
  label?: string;
  labels: Record<string, string>;
  metadata: {
    name: string;
    namespace: string;
  };
  policyConfig: {
    defaultDenyIngress: boolean;
    defaultDenyEgress: boolean;
  };
}

interface PodGroupPropertiesEditorProps {
  node: Node<PodGroupNodeData>;
}

// --- Styles ---
const commonInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px',
  boxSizing: 'border-box',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '0.95em',
};

const commonButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.9em',
  textAlign: 'center',
};

const smallButtonStyle: React.CSSProperties = {
  ...commonButtonStyle,
  padding: '4px 8px',
  fontSize: '0.85em',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '18px',
  paddingBottom: '15px',
  borderBottom: '1px solid #eee',
};

const lastSectionStyle: React.CSSProperties = {
  marginBottom: '10px',
};

const formSectionStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0',
  padding: '12px',
  borderRadius: '4px',
  backgroundColor: '#f9f9f9',
  marginTop: '10px',
};

const errorTextStyle: React.CSSProperties = {
  color: 'red',
  fontSize: '0.85em',
  marginTop: '3px',
  marginBottom: '5px',
};

const inputErrorStyle: React.CSSProperties = {
  borderColor: 'red',
  boxShadow: '0 0 0 1px rgba(255,0,0,.25)', // Уменьшил размытие для компактности
};

// --- Component ---
const PodGroupPropertiesEditor: React.FC<PodGroupPropertiesEditorProps> = ({ node }) => {
  const updateNodeData = useAppStore((state) => state.updateNodeData);

  const [newLabelKey, setNewLabelKey] = useState('');
  const [newLabelValue, setNewLabelValue] = useState('');
  const [addLabelError, setAddLabelError] = useState('');

  const [editingLabelKey, setEditingLabelKey] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [editLabelError, setEditLabelError] = useState('');

  const [namespaceError, setNamespaceError] = useState('');

  const { metadata, policyConfig, labels } = node.data || {
    metadata: { name: '', namespace: '' },
    policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
    labels: {},
  };

  useEffect(() => {
    setEditingLabelKey(null);
    setEditLabelValue('');
    setNewLabelKey('');
    setNewLabelValue('');
    setAddLabelError('');
    setEditLabelError('');
    if (!metadata.namespace?.trim()) {
      setNamespaceError('Namespace is required.');
    } else {
      setNamespaceError('');
    }
  }, [node.id, metadata.namespace]);

  const stopPropagation = (e: React.KeyboardEvent) => e.stopPropagation();

  const handleFieldChange = (
    field: 'namespace' | keyof PodGroupNodeData['policyConfig'],
    value: string | boolean
  ) => {
    if (field === 'namespace' && typeof value === 'string') {
      if (!value.trim()) {
        setNamespaceError('Namespace is required.');
      } else {
        setNamespaceError('');
      }
      updateNodeData(node.id, { metadata: { ...metadata, namespace: value } });
    } else if (typeof value === 'boolean' && (field === 'defaultDenyIngress' || field === 'defaultDenyEgress')) {
      updateNodeData(node.id, { policyConfig: { ...policyConfig, [field]: value } });
    }
  };

  const handleAddLabel = () => {
    const trimmedKey = newLabelKey.trim();
    const trimmedValue = newLabelValue.trim();
    setEditLabelError('');

    if (!trimmedKey || !trimmedValue) {
      setAddLabelError('Label key and value cannot be empty.');
      return;
    }
    if (labels && Object.keys(labels).some(k => k.toLowerCase() === trimmedKey.toLowerCase())) {
      setAddLabelError(`Label key "${trimmedKey}" already exists (case-insensitive).`);
      return;
    }
    setAddLabelError('');
    updateNodeData(node.id, { labels: { ...labels, [trimmedKey]: trimmedValue } });
    setNewLabelKey('');
    setNewLabelValue('');
  };

  const handleDeleteLabel = (keyToDelete: string) => {
    const updatedLabels = { ...labels };
    delete updatedLabels[keyToDelete];
    updateNodeData(node.id, { labels: updatedLabels });
    if (addLabelError.toLowerCase().includes(keyToDelete.toLowerCase())) setAddLabelError('');
    if (editingLabelKey === keyToDelete) {
      setEditingLabelKey(null);
      setEditLabelValue('');
      setEditLabelError('');
    }
  };

  const handleEditLabelClick = (key: string, currentValue: string) => {
    setEditingLabelKey(key);
    setEditLabelValue(currentValue);
    setAddLabelError('');
    setEditLabelError('');
  };

  const handleSaveLabel = () => {
    if (!editingLabelKey) return;
    const trimmedEditValue = editLabelValue.trim();

    if (!trimmedEditValue) {
      setEditLabelError('Label value cannot be empty.');
      return;
    }
    setEditLabelError('');
    updateNodeData(node.id, { labels: { ...labels, [editingLabelKey]: trimmedEditValue } });
    setEditingLabelKey(null);
    setEditLabelValue('');
  };

  const handleCancelEdit = () => {
    setEditingLabelKey(null);
    setEditLabelValue('');
    setEditLabelError('');
  };

  return (
    <div style={{ padding: '10px', fontSize: '0.95em' }}>
      <h4 style={{ marginTop: 0, marginBottom: '15px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        PodGroup: {metadata.name || node.id}
      </h4>

      <div style={sectionStyle}>
        <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Metadata</h5>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor={`ns-${node.id}`} style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em' }}>Namespace (required):</label>
          <input id={`ns-${node.id}`} type="text" value={metadata.namespace}
            onChange={(e) => handleFieldChange('namespace', e.target.value)}
            onKeyDown={stopPropagation}
            style={{ ...commonInputStyle, ...(namespaceError ? inputErrorStyle : {}) }}
            placeholder="Enter namespace"
          />
          {namespaceError && <p style={errorTextStyle}>{namespaceError}</p>}
        </div>
        <div>
          <label htmlFor={`name-${node.id}`} style={{ display: 'block', marginBottom: '3px', fontSize: '0.9em' }}>Name (auto-generated):</label>
          <input id={`name-${node.id}`} type="text" value={metadata.name} readOnly
            onKeyDown={stopPropagation} style={{ ...commonInputStyle, backgroundColor: '#f0f0f0' }}
          />
        </div>
      </div>

      <div style={sectionStyle}>
        <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Policy Configuration</h5>
        {(['defaultDenyIngress', 'defaultDenyEgress'] as const).map(key => (
          <div key={key} style={{ marginBottom: '5px' }}>
            <input type="checkbox" id={`${key}-${node.id}`}
              checked={policyConfig[key]}
              onChange={(e) => handleFieldChange(key, e.target.checked)}
              style={{ marginRight: '8px', verticalAlign: 'middle' }}
            />
            <label htmlFor={`${key}-${node.id}`} style={{ verticalAlign: 'middle', fontSize: '0.95em' }}>
              {key.replace('defaultDeny', 'Default Deny ')}
            </label>
          </div>
        ))}
      </div>

      <div style={lastSectionStyle}>
        <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Labels</h5>
        {Object.keys(labels).length > 0 || editingLabelKey ? (
          <div style={{ marginBottom: '15px', maxHeight: '180px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', borderRadius: '4px' }}>
            {Object.entries(labels).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px dashed #f0f0f0', fontSize: '0.9em' }}>
                <div style={{ flexGrow: 1, marginRight: '10px', wordBreak: 'break-all' }}>
                  <strong>{key}:</strong>{' '}
                  {editingLabelKey === key ? (
                    <input type="text" value={editLabelValue}
                      onChange={(e) => setEditLabelValue(e.target.value)}
                      style={{ ...commonInputStyle, width: 'auto', flexGrow: 1, padding: '4px 6px', display: 'inline-block', marginLeft: '5px' }}
                      autoFocus
                      onKeyDown={(e) => { stopPropagation(e); if (e.key === 'Enter') handleSaveLabel(); if (e.key === 'Escape') handleCancelEdit(); }}
                    />
                  ) : ( value )}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', gap: '5px' }}>
                  {editingLabelKey === key ? (
                    <>
                      <button onClick={handleSaveLabel} style={{ ...smallButtonStyle, backgroundColor: '#28a745' }}>Save</button>
                      <button onClick={handleCancelEdit} style={{ ...smallButtonStyle, backgroundColor: '#6c757d' }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEditLabelClick(key, value)} style={{ ...smallButtonStyle, backgroundColor: '#007bff' }} title={`Edit label ${key}`}>Edit</button>
                      <button onClick={() => handleDeleteLabel(key)} style={{ ...smallButtonStyle, backgroundColor: '#dc3545' }} title={`Delete label ${key}`}>Delete</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {editLabelError && editingLabelKey && <p style={errorTextStyle}>{editLabelError}</p>}
          </div>
        ) : (
          <p style={{ fontStyle: 'italic', color: '#777', margin: '0 0 10px 0', fontSize: '0.9em' }}>No labels defined.</p>
        )}

        {!editingLabelKey && (
          <div style={formSectionStyle}>
            <p style={{ marginTop: 0, marginBottom: '8px', fontSize: '0.95em', fontWeight: 500 }}>Add New Label:</p>
            {addLabelError && <p style={errorTextStyle}>{addLabelError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input type="text" placeholder="Label Key" value={newLabelKey}
                onChange={(e) => { setNewLabelKey(e.target.value); if (addLabelError) setAddLabelError(''); }}
                onKeyDown={stopPropagation} style={{ ...commonInputStyle, flex: 1 }}
              />
              <input type="text" placeholder="Label Value" value={newLabelValue}
                onChange={(e) => { setNewLabelValue(e.target.value); if (addLabelError) setAddLabelError(''); }}
                onKeyDown={stopPropagation} style={{ ...commonInputStyle, flex: 1 }}
              />
            </div>
            <button onClick={handleAddLabel} style={{ ...commonButtonStyle, backgroundColor: '#28a745', width: '100%' }}>
              Add Label
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PodGroupPropertiesEditor;