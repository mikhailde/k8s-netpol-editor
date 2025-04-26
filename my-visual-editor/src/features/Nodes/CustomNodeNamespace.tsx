import React from 'react';
import { Handle, Position } from 'reactflow';

interface CustomNodeNamespaceData {
  label?: string;
}

const CustomNodeNamespace: React.FC<{ data: CustomNodeNamespaceData }> = ({ data }) => {
  return (
    <div style={{
      backgroundColor: '#e6f7ff',
      border: '1px solid #1890ff',
      borderRadius: '5px',
      padding: '25px',
      minWidth: '250px',
      minHeight: '150px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Handle type="target" position={Position.Top} isConnectable={true} />

      <div>{data.label || 'Неймспейс Узел'}</div>
      <div style={{ marginTop: '15px', color: '#888', fontSize: '0.9em', fontStyle: 'italic' }}>
        (Перетащите Группу Подов сюда)
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={true} />
    </div>
  );
};

export default CustomNodeNamespace;