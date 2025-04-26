import React from 'react';
import { Handle, Position } from 'reactflow';

interface CustomNodePodGroupProps {
}

const CustomNodePodGroup: React.FC<CustomNodePodGroupProps> = () => {
  return (
    <div style={{
      padding: '10px',
      border: '1px solid #777',
      borderRadius: '5px',
      background: '#eee',
      minWidth: '100px',
      textAlign: 'center'
    }}>
      <Handle type="target" position={Position.Top} isConnectable={true} />
      <div>Pod Group</div>
      <Handle type="source" position={Position.Bottom} isConnectable={true} />
    </div>
  );
};

export default CustomNodePodGroup;