import React from 'react';
import { Handle, Position } from 'reactflow';

interface CustomNodeNamespaceData {
  label?: string;
}

const CustomNodeNamespace: React.FC<{ data: CustomNodeNamespaceData }> = ({ data }) => {
  return (
    <div style={{
      padding: '10px',
      border: '1px solid #1a192b',
      borderRadius: '5px',
      backgroundColor: '#fff',
      minWidth: '100px',
      textAlign: 'center',
    }}>
      <div>{data.label || 'Неймспейс Узел'}</div>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomNodeNamespace;