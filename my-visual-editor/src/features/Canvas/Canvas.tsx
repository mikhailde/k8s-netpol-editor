import React, { useCallback, useRef, useEffect, useState } from 'react';
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
import { type PodGroupNodeData } from '../../types';

type CanvasNodeData = PodGroupNodeData | { label?: string };

const nodeTypes = { namespace: CustomNodeNamespace, podGroup: CustomNodePodGroup };
const edgeTypes = { customRuleEdge: CustomRuleEdge };

let idCounter = 0;
const getId = (prefix = 'dndnode') => `${prefix}_${idCounter++}`;

const getAggregatedEdges = (inputEdges: Edge[]): Edge[] => {
  console.log('[getAggregatedEdges] Input edges count:', inputEdges.length, 'Content:', JSON.parse(JSON.stringify(inputEdges)));
  
  const customRuleEdges: Edge[] = [];
  const otherEdges: Edge[] = [];

  // 1. Разделяем ребра на customRuleEdge и остальные
  inputEdges.forEach(edge => {
    if (edge.type === 'customRuleEdge') {
      customRuleEdges.push(edge);
    } else {
      otherEdges.push(edge);
    }
  });

  const edgeGroups = new Map<string, Edge[]>();

  // 2. Группируем ТОЛЬКО customRuleEdge ребра
  customRuleEdges.forEach(edge => {
    const groupId = `${edge.source}-${edge.target}-${edge.sourceHandle || 'null'}-${edge.targetHandle || 'null'}`;
    if (!edgeGroups.has(groupId)) {
      edgeGroups.set(groupId, []);
    }
    edgeGroups.get(groupId)!.push(edge);
  });

  const processedCustomRuleEdges: Edge[] = [];

  // 3. Обрабатываем сгруппированные customRuleEdge ребра
  edgeGroups.forEach(group => {
    if (group.length > 1) {
      const representativeEdge = { ...group[0] };
      const originalEdgeIds = group.map(e => e.id);
      representativeEdge.data = {
        ...representativeEdge.data,
        isAggregated: true,
        aggregatedCount: group.length,
        originalEdgeIds: originalEdgeIds,
      };
      representativeEdge.label = `(${group.length}) Rules`;

      processedCustomRuleEdges.push(representativeEdge);
      group.slice(1).forEach(edgeInGroup => {
        processedCustomRuleEdges.push({ ...edgeInGroup, hidden: true });
      });
    } else if (group.length === 1) {
      const singleEdge = { ...group[0] };
      singleEdge.data = {
        ...singleEdge.data,
        isAggregated: false,
        aggregatedCount: 1,
        originalEdgeIds: [singleEdge.id],
      };
      processedCustomRuleEdges.push(singleEdge);
    }
  });

  // 4. Объединяем обработанные customRuleEdges с остальными ребрами
  const finalEdges = [...processedCustomRuleEdges, ...otherEdges];
  
  console.log('[getAggregatedEdges] Final (processed) edges for React Flow count:', finalEdges.length, 'Content:', JSON.parse(JSON.stringify(finalEdges)));
  return finalEdges;
};


const CanvasComponent: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const [processedEdges, setProcessedEdges] = useState<Edge[]>([]);

  const nodes = useAppStore((state) => state.nodes as Node<CanvasNodeData>[]);
  const allEdgesDirectly = useAppStore.getState().edges;
  console.log('[CanvasComponent] allEdgesDirectly from getState():', JSON.parse(JSON.stringify(allEdgesDirectly)));

  const rawEdgesFromStore = useAppStore((state) => state.edges);
  
  useEffect(() => {
    console.log('!!! CanvasComponent RENDERED or rawEdgesFromStore CHANGED !!!');
    console.log('[useEffect for edges] rawEdgesFromStore count:', rawEdgesFromStore.length, 'Content:', JSON.parse(JSON.stringify(rawEdgesFromStore)));
    const newProcessedEdges = getAggregatedEdges(rawEdgesFromStore);
    console.log('[useEffect for edges] newProcessedEdges from getAggregatedEdges count:', newProcessedEdges.length, 'Content:', JSON.parse(JSON.stringify(newProcessedEdges)));
    setProcessedEdges(newProcessedEdges);
  }, [rawEdgesFromStore]);

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
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current) return;

      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let parentNodeId: string | undefined = undefined;
      let extent: 'parent' | undefined = undefined;
      let relativePosition = { ...position };
      let parentNSLabel: string | undefined = undefined;

      if (type === 'podGroup') {
        const potentialParent = reactFlowInstance.getNodes()
          .slice().reverse()
          .find(n =>
            n.type === 'namespace' && n.positionAbsolute && n.width && n.height &&
            position.x >= n.positionAbsolute.x && position.x <= n.positionAbsolute.x + n.width &&
            position.y >= n.positionAbsolute.y && position.y <= n.positionAbsolute.y + n.height
          );
        if (potentialParent) {
          parentNodeId = potentialParent.id;
          extent = 'parent';
          if (potentialParent.positionAbsolute) {
            relativePosition = {
              x: position.x - potentialParent.positionAbsolute.x,
              y: position.y - potentialParent.positionAbsolute.y,
            };
          }
          parentNSLabel = (potentialParent.data as { label?: string })?.label;
        }
      }

      const newNodeId = getId(type);
      const defaultName = `${type}-${newNodeId.substring(newNodeId.lastIndexOf('_') + 1)}`;
      const newNodeData: CanvasNodeData = type === 'podGroup'
        ? {
            label: defaultName,
            labels: {},
            metadata: { name: defaultName, namespace: parentNSLabel || '' },
            policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
          }
        : { label: defaultName };

      addNode({
        id: newNodeId, type, position: relativePosition, data: newNodeData,
        parentNode: parentNodeId, extent: extent,
      });
    },
    [reactFlowInstance, addNode]
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedElementId(node.id), [setSelectedElementId]);
  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => setSelectedElementId(edge.id), [setSelectedElementId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedElementId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;

      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return;
      }

      const nodeToRemove = reactFlowInstance.getNode(selectedElementId);
      if (nodeToRemove) {
        let nodesToDeleteIds: string[] = [nodeToRemove.id];
        if (nodeToRemove.type === 'namespace') {
          const childNodeIds = reactFlowInstance.getNodes()
            .filter(n => n.parentNode === selectedElementId)
            .map(n => n.id);
          nodesToDeleteIds = [...nodesToDeleteIds, ...childNodeIds];
        }
        const nodesToDeleteObjects = nodesToDeleteIds.map(id => reactFlowInstance.getNode(id)).filter(Boolean) as Node[];
        if (nodesToDeleteObjects.length > 0) {
            deleteElements({ nodes: nodesToDeleteObjects });
        }

      } else {
        const edgeToRemove = processedEdges.find(e => e.id === selectedElementId && !e.hidden);
        if (edgeToRemove) {
            const nodeAlsoSelected = reactFlowInstance.getNode(selectedElementId);
            if(nodeAlsoSelected) return;

            let edgesToDeleteFromStore: Edge[] = [];
            if (edgeToRemove.data?.isAggregated && edgeToRemove.data?.originalEdgeIds) {
                edgesToDeleteFromStore = (edgeToRemove.data.originalEdgeIds as string[])
                    .map(id => rawEdgesFromStore.find(e => e.id === id))
                    .filter(Boolean) as Edge[];
            } else if (!edgeToRemove.data?.isAggregated) {
                const originalEdge = rawEdgesFromStore.find(e => e.id === edgeToRemove.id);
                if (originalEdge) edgesToDeleteFromStore = [originalEdge];
            }

            if (edgesToDeleteFromStore.length > 0) {
                 console.log('[Delete] Deleting edges from store:', edgesToDeleteFromStore.map(e=>e.id));
                 deleteElements({ edges: edgesToDeleteFromStore });
            }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, deleteElements, reactFlowInstance, rawEdgesFromStore, processedEdges, nodes])

  return (
    <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={processedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        deleteKeyCode={null}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
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