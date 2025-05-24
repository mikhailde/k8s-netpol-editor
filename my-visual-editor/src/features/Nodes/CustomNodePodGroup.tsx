import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useAppStore } from '../../store/store';
import { IValidationError } from '../../types';

const CustomNodePodGroup: React.FC<NodeProps> = ({ id, data, selected }) => {

  const validationErrors = useAppStore((state) => state.validationErrors);

  const nodeErrors = validationErrors.filter(
    (error: IValidationError) => error.elementId === id && error.severity === 'error'
  );
  const hasError = nodeErrors.length > 0;

  const nodeWarnings = validationErrors.filter(
    (error: IValidationError) => error.elementId === id && error.severity === 'warning'
  );
  const hasWarning = nodeWarnings.length > 0;


  let borderColor = '#777';
  if (selected) {
    borderColor = '#ff007f';
  }
  if (hasError) {
    borderColor = 'red';
  } else if (hasWarning && !selected) {
    borderColor = 'orange';
  }
  
  let boxShadow = selected ? '0 0 10px rgba(255, 0, 127, 0.5)' : 'none';
  if (hasError) {
      boxShadow = selected ? '0 0 8px rgba(255, 0, 0, 0.7)' : '0 0 8px rgba(255, 0, 0, 0.5)';
  } else if (hasWarning) {
      boxShadow = selected ? '0 0 8px rgba(255, 165, 0, 0.7)' : '0 0 8px rgba(255, 165, 0, 0.5)';
  }


  return (
    <div
      style={{
        padding: '10px',
        border: `2px solid ${borderColor}`,
        borderRadius: '5px',
        background: '#eee',
        minWidth: '100px',
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: boxShadow,
        transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
      }}
    >
      <Handle type="target" position={Position.Top} id="pg-target-a" isConnectable={true} />
      <div>{data?.label || 'Pod Group'}</div>
      {hasError && <div style={{ color: 'red', fontSize: '0.8em', marginTop: '3px' }}>Ошибка!</div>}
      {!hasError && hasWarning && <div style={{ color: 'orange', fontSize: '0.8em', marginTop: '3px' }}>Предупреждение</div>}
      <Handle type="source" position={Position.Bottom} id="pg-source-a" isConnectable={true} />
    </div>
  );
};

export default CustomNodePodGroup;