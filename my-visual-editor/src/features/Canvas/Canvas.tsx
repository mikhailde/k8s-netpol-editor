import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAppStore } from '../../store/store';
import CustomNodeNamespace from '../Nodes/CustomNodeNamespace';
import CustomNodePodGroup from '../Nodes/CustomNodePodGroup';
import CustomRuleEdge from '../Edges/CustomRuleEdge';

const nodeTypes = {
  namespace: CustomNodeNamespace,
  podGroup: CustomNodePodGroup,
};

const edgeTypes = {
  customRuleEdge: CustomRuleEdge,
};

let idCounter = 0;
const getId = () => `dndnode_${idCounter++}`;

const Canvas: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNode } = useReactFlow();

  const nodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const onNodesChange = useAppStore((state) => state.onNodesChange);
  const onEdgesChange = useAppStore((state) => state.onEdgesChange);
  const onConnect = useAppStore((state) => state.onConnect);
  const addNode = useAppStore((state) => state.addNode);
  const deleteElements = useAppStore((state) => state.deleteElements);
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const setSelectedElementId = useAppStore((state) => state.setSelectedElementId);

  const handlePaneClick = useCallback(() => {
    setSelectedElementId(null);
  }, [setSelectedElementId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }
      const wrapper = reactFlowWrapper.current;
      if (!wrapper) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let parentNode: Node | undefined = undefined;
      let parentNodeId: string | undefined = undefined;
      let extent: 'parent' | undefined = undefined;
      let nodePosition = { ...position };

      const potentialParent = nodes
        .slice()
        .reverse()
        .find((n: Node) =>
          n.type === 'namespace' &&
          n.positionAbsolute &&
          n.width && n.height &&
          position.x >= n.positionAbsolute.x &&
          position.x <= n.positionAbsolute.x + n.width &&
          position.y >= n.positionAbsolute.y &&
          position.y <= n.positionAbsolute.y + n.height
        );

      if (potentialParent && type === 'podGroup') {
        parentNode = potentialParent;
        parentNodeId = parentNode.id;
        extent = 'parent';

        nodePosition = {
          x: position.x - parentNode.positionAbsolute!.x,
          y: position.y - parentNode.positionAbsolute!.y,
        };
      }

      const newNode: Node = {
        id: getId(),
        type,
        position: nodePosition,
        data: { label: `${type} node` },
        parentNode: parentNodeId,
        extent: extent,
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode, nodes]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedElementId) {
          const selectedNode = getNode(selectedElementId);
          if (!selectedNode) return;

          let nodesToRemove: Node[] = [];

          if (selectedNode.type === 'namespace') {
            const childNodes = nodes.filter((node: Node) => node.parentNode === selectedElementId);
            nodesToRemove = [selectedNode, ...childNodes];
          } else {
            nodesToRemove = [selectedNode];
          }

          if (nodesToRemove.length > 0) {
            deleteElements({ nodes: nodesToRemove });
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, deleteElements, getNode, nodes]);

  return (
    <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={handlePaneClick}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

const CanvasWrapper: React.FC = () => (
  <ReactFlowProvider>
    <Canvas />
  </ReactFlowProvider>
);

export default CanvasWrapper;