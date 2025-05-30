import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../../store/store';

const CustomNodePodGroup: React.FC<NodeProps> = ({ id, data }) => {
  const setSelectedElementId = useAppStore((state) => state.setSelectedElementId);
  const selectedElementId = useAppStore((state) => state.selectedElementId);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    console.log('PodGroup Node clicked:', id);
    setSelectedElementId(id);
  };

  const isSelected = selectedElementId === id;

  return (
    <div
      onClick={handleClick}
      style={{
        padding: '10px',
        border: isSelected ? '2px solid #ff007f' : '1px solid #777',
        borderRadius: '5px',
        background: '#eee',
        minWidth: '100px',
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 0 10px rgba(255, 0, 127, 0.5)' : 'none',
        transition: 'border 0.1s ease-in-out, box-shadow 0.1s ease-in-out',
      }}
    >
      <Handle type="target" position={Position.Top} isConnectable={true} />
      <div>{data?.label || 'Pod Group'}</div>
      <Handle type="source" position={Position.Bottom} isConnectable={true} />
    </div>
  );
};

export default CustomNodePodGroup;