import React from 'react';
import { useAppStore } from '../../store/store';
import './InspectorView.css';

const InspectorView: React.FC = () => {
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes);

  const selectedNode = React.useMemo(() => {
    if (!selectedElementId) return null;
    return nodes.find((node) => node.id === selectedElementId);
  }, [selectedElementId, nodes]);

  if (!selectedNode) {
    return (
      <div className="inspector-view inspector-empty">
        <p>Элемент не выбран</p>
      </div>
    );
  }

  return (
    <div className="inspector-view">
      <h3>Инспектор</h3>
      <div className="inspector-section">
        <label>ID:</label>
        <span>{selectedNode.id}</span>
      </div>
      <div className="inspector-section">
        <label>Тип:</label>
        <span>{selectedNode.type || 'N/A'}</span>
      </div>
      <div className="inspector-section">
        <label>Данные (data):</label>
        <pre>{JSON.stringify(selectedNode.data, null, 2)}</pre>
      </div>
       <div className="inspector-section">
        <label>Родитель (ID):</label>
        <span>{selectedNode.parentNode || 'Нет'}</span>
      </div>
       <div className="inspector-section">
        <label>Позиция:</label>
        <pre>{JSON.stringify(selectedNode.position, null, 2)}</pre>
      </div>
    </div>
  );
};

export default InspectorView;