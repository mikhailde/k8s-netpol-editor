import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';

import 'reactflow/dist/style.css';

import CustomNodeNamespace, { CustomNodeNamespaceData } from '../nodes/CustomNodeNamespace';
import { useAppStore } from '../../store/store';

const nodeTypes = {
  namespace: CustomNodeNamespace,
};

type AppNodeType = keyof typeof nodeTypes;

let idCounter = 0;
const getId = () => `dndnode_${idCounter++}`;

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const Canvas: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow(); 

  const addNodeToStore = useAppStore((state) => state.addNode);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const draggedType = event.dataTransfer.getData('application/reactflow');

      if (!draggedType) {
        console.warn('No type data found in drag event.');
        return;
      }

      const nodeType = draggedType as AppNodeType;

      if (!nodeTypes[nodeType]) {
        console.warn(`Dropped node type "${draggedType}" is not defined in nodeTypes.`);
        return;
      }
      
      if (!reactFlowWrapper.current) {
        console.error("ReactFlow wrapper ref is not available.");
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<CustomNodeNamespaceData> = {
        id: getId(),
        type: nodeType,
        position,
        data: { label: `${nodeType} node` },
      };

      setNodes((currentNodes) => currentNodes.concat(newNode));
      
      addNodeToStore(newNode);
    },
    [screenToFlowPosition, setNodes, addNodeToStore],
  );

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
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default Canvas;