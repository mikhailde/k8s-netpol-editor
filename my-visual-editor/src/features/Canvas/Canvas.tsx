import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  OnNodesChange,
  OnEdgesChange,
  Connection,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAppStore } from '../../store/store';
import CustomNodeNamespace from '../Nodes/CustomNodeNamespace';
import CustomNodePodGroup from '../Nodes/CustomNodePodGroup';
import CustomRuleEdge from '../Edges/CustomRuleEdge';
import { type PodGroupNodeData } from '../Inspector/PodGroupPropertiesEditor';

type CanvasNodeData = PodGroupNodeData | { label?: string };

const nodeTypes = { namespace: CustomNodeNamespace, podGroup: CustomNodePodGroup };
const edgeTypes = { customRuleEdge: CustomRuleEdge };

let idCounter = 0;
const getId = (prefix = 'dndnode') => `${prefix}_${idCounter++}`;

const CanvasComponent: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const nodes = useAppStore((state) => state.nodes as Node<CanvasNodeData>[]);
  const edges = useAppStore((state) => state.edges);
  const onNodesChange = useAppStore((state) => state.onNodesChange as OnNodesChange);
  const onEdgesChange = useAppStore((state) => state.onEdgesChange as OnEdgesChange);
  const onConnect = useAppStore((state) => state.onConnect as (params: Connection | Edge) => void);
  const addNode = useAppStore((state) => state.addNode);
  const deleteElements = useAppStore((state) => state.deleteElements);
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const setSelectedElementId = useAppStore((state) => state.setSelectedElementId);

  const handlePaneClick = useCallback(() => setSelectedElementId(null), [setSelectedElementId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      console.log('onDrop triggered');

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current) {
        console.log('onDrop: No type or wrapper, exiting.');
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      console.log('onDrop: Drop position (flow coordinates):', position);

      let parentNodeId: string | undefined = undefined;
      let extent: 'parent' | undefined = undefined;
      let relativePosition = { ...position };
      let parentNSLabel: string | undefined = undefined;

      if (type === 'podGroup') {
        const currentFlowNodes = reactFlowInstance.getNodes();
        const potentialParent = currentFlowNodes
          .slice().reverse()
          .find(n =>
            n.type === 'namespace' &&
            n.positionAbsolute && n.width && n.height &&
            position.x >= n.positionAbsolute.x && position.x <= n.positionAbsolute.x + n.width &&
            position.y >= n.positionAbsolute.y && position.y <= n.positionAbsolute.y + n.height
          );

        if (potentialParent) {
          console.log('onDrop: Found potential parent namespace:', JSON.parse(JSON.stringify(potentialParent)));
          parentNodeId = potentialParent.id;
          extent = 'parent';
          if (potentialParent.positionAbsolute) {
            relativePosition = {
              x: position.x - potentialParent.positionAbsolute.x,
              y: position.y - potentialParent.positionAbsolute.y,
            };
          } else {
            console.error('onDrop: Parent node has no positionAbsolute!', potentialParent.id);
          }
          parentNSLabel = (potentialParent.data as { label?: string })?.label;
          console.log('onDrop: Calculated relativePosition:', relativePosition, 'Parent NS Label:', parentNSLabel);
        } else {
          console.log('onDrop: No parent namespace found for podGroup.');
        }
      }

      const newNodeId = getId(type);
      const idSuffix = newNodeId.substring(newNodeId.lastIndexOf('_') + 1);

      const defaultName = type === 'podGroup' ? `pod-group-${idSuffix}` : `${type}-${idSuffix}`;

      const newNodeData: CanvasNodeData =
        type === 'podGroup'
          ? {
              label: defaultName,
              labels: {},
              metadata: { name: defaultName, namespace: parentNSLabel || '' },
              policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
            }
          : { label: defaultName };

      const newNode: Node<CanvasNodeData> = {
        id: newNodeId,
        type,
        position: relativePosition,
        data: newNodeData,
        parentNode: parentNodeId,
        extent: extent,
      };
      console.log('onDrop: Creating new node:', JSON.parse(JSON.stringify(newNode)));

      addNode(newNode);
      console.log('onDrop: Node addition requested to store.');
    },
    [reactFlowInstance, addNode]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedElementId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;

      const nodeToRemove = reactFlowInstance.getNode(selectedElementId);
      if (nodeToRemove) {
        let nodesToDelete: Node<CanvasNodeData>[] = [nodeToRemove as Node<CanvasNodeData>];
        if (nodeToRemove.type === 'namespace') {
          const childNodes = reactFlowInstance.getNodes()
            .filter(n => n.parentNode === selectedElementId)
            .map(n => n as Node<CanvasNodeData>);
          nodesToDelete = [...nodesToDelete, ...childNodes];
        }
        deleteElements({ nodes: nodesToDelete });
      } else {
        const edgeToRemove = reactFlowInstance.getEdge(selectedElementId);
        if (edgeToRemove) {
             deleteElements({ edges: [edgeToRemove] });
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, deleteElements, reactFlowInstance]);


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
        deleteKeyCode={null}
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
    <CanvasComponent />
  </ReactFlowProvider>
);

export default CanvasWrapper;