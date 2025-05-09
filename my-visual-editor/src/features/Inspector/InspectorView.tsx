import React from 'react';
import { useAppStore } from '../../store/store';
import PodGroupPropertiesEditor, { PodGroupNodeData } from './PodGroupPropertiesEditor';
import NamespacePropertiesEditor from './NamespacePropertiesEditor';
import { Node } from 'reactflow';
import './InspectorView.css';

interface NamespaceNodeData {
  label?: string;
}

const InspectorView: React.FC = () => {
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes as Node<PodGroupNodeData | NamespaceNodeData>[]);

  const selectedNode = nodes.find((node) => node.id === selectedElementId);

  return (
    <div className="inspector-view">
      <h3>Inspector</h3>
      {selectedNode ? (
        selectedNode.type === 'podGroup' ? (
          <PodGroupPropertiesEditor node={selectedNode as Node<PodGroupNodeData>} />
        ) : selectedNode.type === 'namespace' ? (
          <NamespacePropertiesEditor node={selectedNode as Node<NamespaceNodeData>} />
        ) : (
          <p>Selected element: {selectedNode.id} (Type: {selectedNode.type}). No editor available for this type.</p>
        )
      ) : (
        <p>Select an element to see its properties.</p>
      )}
    </div>
  );
};

export default InspectorView;