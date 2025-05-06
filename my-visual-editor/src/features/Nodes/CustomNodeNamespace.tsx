import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../../store/store';

interface CustomNodeNamespaceData {
  label?: string;
}

const CustomNodeNamespace: React.FC<NodeProps<CustomNodeNamespaceData>> = ({ id, data }) => {
  const setSelectedElementId = useAppStore((state) => state.setSelectedElementId);
  const selectedElementId = useAppStore((state) => state.selectedElementId);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedElementId(id);
  };

  const isSelected = selectedElementId === id;

  return (
    <div
      onClick={handleClick}
      style={{
        backgroundColor: '#e6f7ff',
        border: isSelected ? '2px solid #ff007f' : '1px solid #1890ff',
        borderRadius: '5px',
        padding: '25px',
        minWidth: '250px',
        minHeight: '150px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 0 10px rgba(255, 0, 127, 0.5)' : 'none',
        transition: 'border 0.1s ease-in-out, box-shadow 0.1s ease-in-out',
      }}
    >
      <Handle type="target" position={Position.Top} id="ns-target-a" isConnectable={true} />

      <div>{data?.label || 'Неймспейс Узел'}</div>
      <div style={{ marginTop: '15px', color: '#888', fontSize: '0.9em', fontStyle: 'italic' }}>
        (Перетащите Группу Подов сюда)
      </div>

      <Handle type="source" position={Position.Bottom} id="ns-source-a" isConnectable={true} />
    </div>
  );
};

export default CustomNodeNamespace;