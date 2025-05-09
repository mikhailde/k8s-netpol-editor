import React from 'react';
import { Node } from 'reactflow';
import { useAppStore } from '../../store/store';

interface NamespaceNodeData {
  label?: string;
}

interface NamespacePropertiesEditorProps {
  node: Node<NamespaceNodeData>;
}

const NamespacePropertiesEditor: React.FC<NamespacePropertiesEditorProps> = ({ node }) => {
  const updateNodeData = useAppStore((state) => state.updateNodeData);

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(node.id, { label: event.target.value });
  };

  const stopPropagation = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div style={{ padding: '10px' }}>
      <h4>Namespace Properties (ID: {node.id})</h4>
      <div style={{ marginBottom: '10px' }}>
        <label
          htmlFor={`ns-label-${node.id}`}
          style={{ display: 'block', marginBottom: '5px' }}
        >
          Label:
        </label>
        <input
          id={`ns-label-${node.id}`}
          type="text"
          value={node.data?.label || ''}
          onChange={handleLabelChange}
          onKeyDown={stopPropagation}
          style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          placeholder="Enter namespace label"
        />
      </div>
    </div>
  );
};

export default NamespacePropertiesEditor;