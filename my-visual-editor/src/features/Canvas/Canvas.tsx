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
  NodeProps,
  XYPosition
} from 'reactflow';

import 'reactflow/dist/style.css';

import CustomNodeNamespace from '../Nodes/CustomNodeNamespace';
import CustomNodePodGroup from '../Nodes/CustomNodePodGroup';

const nodeTypes = {
  namespace: CustomNodeNamespace,
  podGroup: CustomNodePodGroup,
};

let id = 0;
const getId = () => `dndnode_${id++}`;

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const Canvas: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, getIntersectingNodes } = useReactFlow();

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

      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const reactFlowWrapperCurrent = reactFlowWrapper.current;
      if (!reactFlowWrapperCurrent) {
          return;
      }

      const reactFlowBounds = reactFlowWrapperCurrent.getBoundingClientRect();
      // 1. Рассчитываем АБСОЛЮТНУЮ позицию на холсте
      const absolutePosition = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      let parentNode: Node | undefined = undefined;
      let position = { ...absolutePosition };
      let parentNodeId: string | undefined = undefined;
      let extent: 'parent' | undefined = undefined;

      // 2. Ищем пересекающий неймспейс в точке броска
      const intersectingNodes = getIntersectingNodes({
        x: absolutePosition.x,
        y: absolutePosition.y,
        width: 1,
        height: 1,
      }).filter((n) => n.type === 'namespace');

      // 3. Если нашли неймспейс и бросаем Pod Group
      if (intersectingNodes.length > 0 && type === 'podGroup') {
        parentNode = intersectingNodes[0];
        parentNodeId = parentNode.id;

        // 4. ВЫЧИСЛЯЕМ ОТНОСИТЕЛЬНУЮ ПОЗИЦИЮ
        if (parentNode.positionAbsolute) {
          position = {
            x: absolutePosition.x - parentNode.positionAbsolute.x,
            y: absolutePosition.y - parentNode.positionAbsolute.y,
          };
        } else {
          console.warn("Parent node's absolute position is not available for relative calculation.");
        }

        // 5. Устанавливаем ограничение перемещения границами родителя
        extent = 'parent';
      }

      // 6. Создаем новый узел с правильной позицией и родителем
      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
        parentNode: parentNodeId,
        extent: extent,
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [project, setNodes, getIntersectingNodes],
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
        nodesDraggable={true}
        nodesConnectable={true}>
        <Controls />
        <MiniMap nodeStrokeWidth={3} />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default Canvas;