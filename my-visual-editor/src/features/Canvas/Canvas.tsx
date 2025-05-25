import React, { useEffect, useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Controls, MiniMap, Background, BackgroundVariant,
  ReactFlowProvider, Edge, Node, Connection,
  useReactFlow, OnNodesChange, OnEdgesChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { isEqual } from 'lodash';

import { useAppStore, type AppState } from '../../store/store';
import { PodGroupNodeData } from '../../types';
import CustomNodeNamespace from '../Nodes/CustomNodeNamespace';
import CustomNodePodGroup from '../Nodes/CustomNodePodGroup';
import CustomRuleEdge from '../Edges/CustomRuleEdge';

// --- Типы и константы ---
type CanvasNodeData = PodGroupNodeData | { label?: string };

const nodeTypes = { namespace: CustomNodeNamespace, podGroup: CustomNodePodGroup };
const edgeTypes = { customRuleEdge: CustomRuleEdge };

let idCounter = 0;
const getId = (prefix = 'dndnode') => `${prefix}_${idCounter++}`;

// --- Функция агрегации ребер ---
const getAggregatedEdges = (inputEdges: AppState['edges']): AppState['edges'] => {
  const customRuleEdges: AppState['edges'] = [];
  const otherEdges: AppState['edges'] = [];
  inputEdges.forEach(edge => {
    if (edge.type === 'customRuleEdge') customRuleEdges.push(edge);
    else otherEdges.push(edge);
  });

  const edgeGroups = new Map<string, AppState['edges']>();
  customRuleEdges.forEach(edge => {
    const groupId = `${edge.source}-${edge.target}-${edge.sourceHandle || 'null'}-${edge.targetHandle || 'null'}`;
    const group = edgeGroups.get(groupId) || [];
    group.push(edge);
    edgeGroups.set(groupId, group);
  });

  const processedCustomRuleEdges: AppState['edges'] = [];
  edgeGroups.forEach(group => {
    if (group.length > 1) {
      const representativeEdge = { ...group.sort((a,b) => a.id.localeCompare(b.id))[0] };
      const originalEdgeIds = group.map(e => e.id).sort((a,b) => a.localeCompare(b));
      representativeEdge.data = {
        ...(representativeEdge.data || {}),
        isAggregated: true,
        aggregatedCount: group.length,
        originalEdgeIds: originalEdgeIds,
      };
      representativeEdge.label = `(${group.length}) Rules`;
      processedCustomRuleEdges.push(representativeEdge);
      group.forEach(edgeInGroup => {
        if (edgeInGroup.id !== representativeEdge.id) {
          processedCustomRuleEdges.push({ ...edgeInGroup, hidden: true });
        }
      });
    } else if (group.length === 1) {
      const singleEdge = { ...group[0] };
      singleEdge.data = {
        ...(singleEdge.data || {}),
        isAggregated: false,
        aggregatedCount: 1,
        originalEdgeIds: [singleEdge.id],
      };
      processedCustomRuleEdges.push(singleEdge);
    }
  });
  return [...processedCustomRuleEdges, ...otherEdges];
};

// --- Основной компонент канвы ---
const CanvasComponent: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getNode } = useReactFlow<CanvasNodeData, Edge>();

  const nodes = useAppStore(state => state.nodes as Node<CanvasNodeData>[]);
  const onNodesChange = useAppStore(state => state.onNodesChange as OnNodesChange);
  const rawEdgesFromStore = useAppStore(
    state => state.edges,
    (newEdges, oldEdges) => isEqual(newEdges, oldEdges)
  );
  const onEdgesChange = useAppStore(state => state.onEdgesChange as OnEdgesChange);
  const onConnect = useAppStore(state => state.onConnect as (params: Connection | Edge) => void);
  const addNode = useAppStore(state => state.addNode);
  const deleteElements = useAppStore(state => state.deleteElements);
  const selectedElementId = useAppStore(state => state.selectedElementId);
  const setSelectedElementId = useAppStore(state => state.setSelectedElementId);

  const [processedEdges, setProcessedEdges] = useState<AppState['edges']>([]);

  useEffect(() => {
    const newProcessed = getAggregatedEdges(rawEdgesFromStore);
    setProcessedEdges(currentProcessed => 
      isEqual(currentProcessed, newProcessed) ? currentProcessed : newProcessed
    );
  }, [rawEdgesFromStore]);

  const handlePaneClick = useCallback(() => setSelectedElementId(null), [setSelectedElementId]);
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedElementId(node.id), [setSelectedElementId]);
  const handleEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => setSelectedElementId(edge.id), [setSelectedElementId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current || !screenToFlowPosition) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      let parentNodeId: string | undefined;
      let extent: 'parent' | undefined;
      let relativePosition = { ...position };
      let parentNSLabel: string | undefined;

      if (type === 'podGroup') {
        const currentNodes = getNodes();
        const potentialParent = currentNodes
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
            relativePosition = { x: position.x - potentialParent.positionAbsolute.x, y: position.y - potentialParent.positionAbsolute.y };
          }
          parentNSLabel = (potentialParent.data as { label?: string })?.label;
        }
      }
      const newNodeId = getId(type);
      const defaultName = `${type}-${newNodeId.substring(newNodeId.lastIndexOf('_') + 1)}`;
      const newNodeData: CanvasNodeData = type === 'podGroup'
        ? { label: defaultName, labels: {}, metadata: { name: defaultName, namespace: parentNSLabel || '' }, policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false } }
        : { label: defaultName };
      addNode({ id: newNodeId, type, position: relativePosition, data: newNodeData, parentNode: parentNodeId, extent });
    },
    [screenToFlowPosition, getNodes, addNode]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedElementId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;

      const nodeToRemove = getNode(selectedElementId);
      if (nodeToRemove) {
        const baseId = nodeToRemove.id;
        const childNodeIds = nodeToRemove.type === 'namespace'
          ? getNodes().filter(n => n.parentNode === baseId).map(n => n.id)
          : [];
        const finalDeletableNodeIds: string[] = [baseId, ...childNodeIds];
        
        const nodesToDeleteObjects = finalDeletableNodeIds
          .map(id => getNode(id))
          .filter((n): n is Node<CanvasNodeData> => Boolean(n));

        if (nodesToDeleteObjects.length > 0) deleteElements({ nodes: nodesToDeleteObjects });

        const edgeViewToRemove = processedEdges.find(e => e.id === selectedElementId && !e.hidden);
        if (edgeViewToRemove) {
          let edgesFromStoreToDelete: Edge[];
          if (edgeViewToRemove.data?.isAggregated && Array.isArray(edgeViewToRemove.data.originalEdgeIds)) {
            const originalIds = edgeViewToRemove.data.originalEdgeIds as string[];
            edgesFromStoreToDelete = rawEdgesFromStore.filter((e: Edge) => originalIds.includes(e.id));
          } else {
            edgesFromStoreToDelete = rawEdgesFromStore.filter((e: Edge) => e.id === edgeViewToRemove.id);
          }
          if (edgesFromStoreToDelete.length > 0) deleteElements({ edges: edgesFromStoreToDelete });
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, deleteElements, getNodes, getNode, rawEdgesFromStore, processedEdges]);

  return (
    <div className="reactflow-wrapper" ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={processedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        deleteKeyCode={null}
        fitView
        nodesDraggable={true}
        nodesConnectable={true}
        nodesFocusable={false}
        proOptions={{ hideAttribution: true }}
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
