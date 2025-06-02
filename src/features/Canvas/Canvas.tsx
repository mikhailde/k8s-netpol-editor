import React, { useEffect, useCallback, useRef, useState, memo } from 'react';
import ReactFlow, {
  Controls, MiniMap, Background, BackgroundVariant, Edge, Node,
  useReactFlow, XYPosition, OnSelectionChangeParams,
  NodeDragHandler, NodeChange, ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { isEqual } from 'lodash';

import { useAppStore } from '../../store/store';
import { 
    PodGroupNodeData, NamespaceNodeData, CustomNodeData,
    isPodGroupNodeData, isNamespaceNodeData
} from '../../types';
import {
    NODE_TYPE_NAMESPACE, NODE_TYPE_PODGROUP, EDGE_TYPE_CUSTOM_RULE, DND_APP_TYPE_REACT_FLOW,
    NAMESPACE_INITIAL_PADDING, NAMESPACE_MIN_WIDTH, NAMESPACE_MIN_HEIGHT,
    PODGROUP_DEFAULT_WIDTH, PODGROUP_DEFAULT_HEIGHT
} from '../../constants';
import CustomNodeNamespace from '../Nodes/CustomNodeNamespace';
import CustomNodePodGroup from '../Nodes/CustomNodePodGroup';
import CustomRuleEdge from '../Edges/CustomRuleEdge';

const ToastNotification: React.FC<{ message: string | null; onClose: () => void }> = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', top: '20px', right: '20px', background: 'rgba(255,0,0,0.8)',
      color: 'white', padding: '10px 20px', borderRadius: '5px', zIndex: 10000,
      display: 'flex', alignItems: 'center', gap: '10px'
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '3px', cursor: 'pointer' }}>
        ×
      </button>
    </div>
  );
};
ToastNotification.displayName = 'ToastNotification';


const nodeTypes = { [NODE_TYPE_NAMESPACE]: CustomNodeNamespace, [NODE_TYPE_PODGROUP]: CustomNodePodGroup };
const edgeTypes = { [EDGE_TYPE_CUSTOM_RULE]: CustomRuleEdge };

let dndNodeIdCounter = 0; 
const generateDndNodeId = (prefix = 'dndnode') => `${prefix}_${dndNodeIdCounter++}`;

interface NodeRect { x: number; y: number; width: number; height: number; }

const getAggregatedEdges = (inputEdges: Edge[]): Edge[] => {
  const customRuleEdges: Edge[] = [];
  const otherEdges: Edge[] = [];
  inputEdges.forEach((edge) => (edge.type === EDGE_TYPE_CUSTOM_RULE ? customRuleEdges.push(edge) : otherEdges.push(edge)));

  const edgeGroups = new Map<string, Edge[]>();
  customRuleEdges.forEach((edge) => {
    const groupId = `${edge.source}-${edge.target}-${edge.sourceHandle || 'no_sh'}-${edge.targetHandle || 'no_th'}`;
    edgeGroups.set(groupId, (edgeGroups.get(groupId) || []).concat(edge));
  });

  const processedCustomRuleEdges: Edge[] = [];
  edgeGroups.forEach((group) => {
    if (group.length > 1) {
      const sortedGroup = [...group].sort((a, b) => a.id.localeCompare(b.id));
      processedCustomRuleEdges.push({
        ...sortedGroup[0],
        data: { ...(sortedGroup[0].data || {}), isAggregated: true, aggregatedCount: group.length, originalEdgeIds: sortedGroup.map(e => e.id) },
        label: `(${group.length}) Правил`
      });
      sortedGroup.slice(1).forEach(edgeInGroup => processedCustomRuleEdges.push({ ...edgeInGroup, hidden: true }));
    } else if (group.length === 1) {
      processedCustomRuleEdges.push({ ...group[0], data: { ...(group[0].data || {}), isAggregated: false, aggregatedCount: 1, originalEdgeIds: [group[0].id] } });
    }
  });
  return [...processedCustomRuleEdges, ...otherEdges];
};

const calculateChildrenBoundingBox = (children: Node<PodGroupNodeData>[]): NodeRect | null => {
  if (!children.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, hasValidChild = false;
  children.forEach(child => {
    if (child.width != null && child.height != null && child.position != null) {
      hasValidChild = true;
      minX = Math.min(minX, child.position.x); minY = Math.min(minY, child.position.y);
      maxX = Math.max(maxX, child.position.x + child.width); maxY = Math.max(maxY, child.position.y + child.height);
    }
  });
  if (!hasValidChild) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const CanvasComponent: React.FC = () => {
  const rfWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getNode, setNodes } = useReactFlow<CustomNodeData, Edge>();

  const storeNodes = useAppStore(s => s.nodes);
  const onNodesChange = useAppStore(s => s.onNodesChange);
  const rawEdgesFromStore = useAppStore(s => s.edges);
  const onEdgesChange = useAppStore(s => s.onEdgesChange);
  const onConnect = useAppStore(s => s.onConnect);
  const isValidConnection = useAppStore(s => s.isValidConnection);
  const addNode = useAppStore(s => s.addNode);
  const deleteElements = useAppStore(s => s.deleteElements);
  const setSelectedElementId = useAppStore(s => s.setSelectedElementId);
  const updateNodeData = useAppStore(s => s.updateNodeData);
  const updateNodeSizeAndPosition = useAppStore(s => s.updateNodeSizeAndPosition);
  const lastInvalidConnectionMessage = useAppStore(s => s.lastInvalidConnectionMessage);
  const clearLastInvalidConnectionMessage = useAppStore(s => s.clearLastInvalidConnectionMessage);

  const [processedEdges, setProcessedEdges] = useState<Edge[]>([]);
  useEffect(() => {
    const newProcessed = getAggregatedEdges(rawEdgesFromStore);
    if (!isEqual(processedEdges, newProcessed)) {
      setProcessedEdges(newProcessed);
    }
  }, [rawEdgesFromStore, processedEdges]);

  const autoResizeNamespace = useCallback((namespaceId: string | null | undefined) => {
    if (!namespaceId) return;
    const allNodes = getNodes();
    const nsNode = allNodes.find(n => n.id === namespaceId && n.type === NODE_TYPE_NAMESPACE);
    if (!nsNode || !isNamespaceNodeData(nsNode.data)) return;

    const children = allNodes.filter(n => n.parentNode === namespaceId && n.type === NODE_TYPE_PODGROUP) as Node<PodGroupNodeData>[];
    const newHasChildren = children.length > 0;
    if (nsNode.data.hasChildren !== newHasChildren) {
        updateNodeData(nsNode.id, { ...nsNode.data, hasChildren: newHasChildren });
    }

    const bbox = calculateChildrenBoundingBox(children);
    const targetW = bbox ? Math.max(NAMESPACE_MIN_WIDTH, bbox.width + NAMESPACE_INITIAL_PADDING * 2) : NAMESPACE_MIN_WIDTH;
    const targetH = bbox ? Math.max(NAMESPACE_MIN_HEIGHT, bbox.height + NAMESPACE_INITIAL_PADDING * 2) : NAMESPACE_MIN_HEIGHT;
    const sizeChanged = (nsNode.width !== targetW || nsNode.height !== targetH);

    if (sizeChanged) updateNodeSizeAndPosition(nsNode.id, { width: targetW, height: targetH });

    if (bbox && children.length > 0) {
      const dX = NAMESPACE_INITIAL_PADDING - bbox.x; const dY = NAMESPACE_INITIAL_PADDING - bbox.y;
      if (Math.abs(dX) > 0.1 || Math.abs(dY) > 0.1 || (sizeChanged && (bbox.x !== NAMESPACE_INITIAL_PADDING || bbox.y !== NAMESPACE_INITIAL_PADDING))) {
        const childChanges: NodeChange[] = children.map(c => ({
          id: c.id, type: 'position', position: { x: (c.position?.x || 0) + dX, y: (c.position?.y || 0) + dY }, dragging: false,
        }));
        if (childChanges.length > 0) onNodesChange(childChanges);
      }
    }
  }, [getNodes, updateNodeData, updateNodeSizeAndPosition, onNodesChange]);

  const onPaneClickHandler = useCallback(() => setSelectedElementId(null), [setSelectedElementId]);
  
  const onSelectionChangeHandler = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
    if (selNodes.length === 1 && !selEdges.length) setSelectedElementId(selNodes[0].id);
    else if (selEdges.length === 1 && !selNodes.length) setSelectedElementId(selEdges[0].id);
    else if (selNodes.length) setSelectedElementId(selNodes[0].id);
    else if (selEdges.length) setSelectedElementId(selEdges[0].id);
    else setSelectedElementId(null);
  }, [setSelectedElementId]);

  const onDragOverHandler = useCallback((event: React.DragEvent) => {
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDropHandler = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData(DND_APP_TYPE_REACT_FLOW);
    if (!type || !screenToFlowPosition) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    let parentNode: Node<NamespaceNodeData> | undefined, parentId: string | undefined;
    let relativePos = { ...position };
    const newNodeId = generateDndNodeId(type);
    const nameSuffix = newNodeId.substring(newNodeId.lastIndexOf('_') + 1);
    const defaultName = nameSuffix ? `${type.toLowerCase()}-${nameSuffix}` : `${type.toLowerCase()}-new`;
    let nodeToAdd: Node<CustomNodeData>;

    if (type === NODE_TYPE_PODGROUP) {
      parentNode = getNodes().slice().reverse().find((n): n is Node<NamespaceNodeData> => (
        n.type === NODE_TYPE_NAMESPACE && isNamespaceNodeData(n.data) && !!n.positionAbsolute && 
        n.width != null && n.height != null && position.x >= n.positionAbsolute.x && 
        position.x <= (n.positionAbsolute.x + n.width) && position.y >= n.positionAbsolute.y && 
        position.y <= (n.positionAbsolute.y + n.height)
      ));
      if (!parentNode) { alert("Ошибка: Группа Подов размещается только внутри Неймспейса."); return; }
      if (!parentNode.positionAbsolute) { alert("Критическая ошибка: Не удалось определить позицию Неймспейса."); return; }
      parentId = parentNode.id;
      const targetCenterX = position.x - parentNode.positionAbsolute.x;
      const targetCenterY = position.y - parentNode.positionAbsolute.y;
      relativePos = {
          x: targetCenterX - PODGROUP_DEFAULT_WIDTH / 2, y: targetCenterY - PODGROUP_DEFAULT_HEIGHT / 2,
      };
      relativePos.x = Math.max(relativePos.x, NAMESPACE_INITIAL_PADDING);
      relativePos.y = Math.max(relativePos.y, NAMESPACE_INITIAL_PADDING);
      if (parentNode.width && parentNode.height) {
          relativePos.x = Math.min(relativePos.x, parentNode.width - PODGROUP_DEFAULT_WIDTH - NAMESPACE_INITIAL_PADDING);
          relativePos.y = Math.min(relativePos.y, parentNode.height - PODGROUP_DEFAULT_HEIGHT - NAMESPACE_INITIAL_PADDING);
          relativePos.x = Math.max(relativePos.x, NAMESPACE_INITIAL_PADDING);
          relativePos.y = Math.max(relativePos.y, NAMESPACE_INITIAL_PADDING);
      }
      const pgData: PodGroupNodeData = { label: defaultName, labels: {}, metadata: { name: defaultName, namespace: parentNode.data?.label || '' }, policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false } };
      nodeToAdd = { id: newNodeId, type, position: relativePos, data: pgData, parentNode: parentId, width: PODGROUP_DEFAULT_WIDTH, height: PODGROUP_DEFAULT_HEIGHT, zIndex: 2000 };
    } else if (type === NODE_TYPE_NAMESPACE) {
      const nsData: NamespaceNodeData = { label: defaultName, hasChildren: false };
      nodeToAdd = { id: newNodeId, type, position: relativePos, data: nsData, width: NAMESPACE_MIN_WIDTH, height: NAMESPACE_MIN_HEIGHT, zIndex: 0 };
    } else { console.error(`[Canvas onDrop] Unknown drop type: ${type}`); return; }
    
    addNode(nodeToAdd);
    if (parentId && type === NODE_TYPE_PODGROUP) requestAnimationFrame(() => autoResizeNamespace(parentId));
  }, [screenToFlowPosition, getNodes, addNode, autoResizeNamespace]);

  const onNodeDragStopHandler: NodeDragHandler = useCallback((_event, draggedNode: Node) => {
    if (draggedNode.type !== NODE_TYPE_PODGROUP || !isPodGroupNodeData(draggedNode.data)) return;
    const podGroupNode = draggedNode as Node<PodGroupNodeData>;
    if (podGroupNode.width == null || podGroupNode.height == null || !podGroupNode.positionAbsolute) return;

    const oldParentId = podGroupNode.parentNode;
    const currentNodes = getNodes();
    const pgCenterX = podGroupNode.positionAbsolute.x + podGroupNode.width / 2;
    const pgCenterY = podGroupNode.positionAbsolute.y + podGroupNode.height / 2;
    let newParentNs: Node<NamespaceNodeData> | undefined;

    for (let i = currentNodes.length - 1; i >= 0; i--) {
      const n = currentNodes[i];
      if (n.type === NODE_TYPE_NAMESPACE && n.id !== podGroupNode.id && isNamespaceNodeData(n.data) && 
          n.positionAbsolute && n.width != null && n.height != null &&
          pgCenterX >= n.positionAbsolute.x && pgCenterX <= (n.positionAbsolute.x + n.width) &&
          pgCenterY >= n.positionAbsolute.y && pgCenterY <= (n.positionAbsolute.y + n.height)) {
        newParentNs = n as Node<NamespaceNodeData>; break;
      }
    }
    const newParentId = newParentNs?.id;
    const newNsName = (newParentNs && isNamespaceNodeData(newParentNs.data)) ? newParentNs.data.label || '' : '';
    let newPos: XYPosition;

    if (newParentNs?.positionAbsolute && podGroupNode.positionAbsolute) {
      newPos = { x: podGroupNode.positionAbsolute.x - newParentNs.positionAbsolute.x, y: podGroupNode.positionAbsolute.y - newParentNs.positionAbsolute.y };
    } else {
      newPos = podGroupNode.positionAbsolute ? { ...podGroupNode.positionAbsolute } : { ...podGroupNode.position };
    }
    
    setNodes(currentNodes.map(n => {
      if (n.id === draggedNode.id && isPodGroupNodeData(n.data)) {
        const currentPgData = n.data;
        return { ...n, parentNode: newParentId, position: newPos, zIndex: newParentId ? 2000 : 500,
          data: { ...currentPgData, metadata: { name: currentPgData.metadata?.name || currentPgData.label || n.id, namespace: newNsName } } 
        };
      }
      return (n.type === NODE_TYPE_NAMESPACE) ? { ...n, zIndex: 0 } : n;
    }) as Node<CustomNodeData>[]);
    
    if (oldParentId && oldParentId !== newParentId) requestAnimationFrame(() => autoResizeNamespace(oldParentId));
    if (newParentId) requestAnimationFrame(() => autoResizeNamespace(newParentId));
  }, [getNodes, setNodes, autoResizeNamespace]);

  useEffect(() => {
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      const selectedId = useAppStore.getState().selectedElementId;
      if (!selectedId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName.toUpperCase())) return;
      event.preventDefault();
      
      const nodeToDelete = getNode(selectedId);
      if (nodeToDelete) {
        deleteElements({ nodes: [nodeToDelete] });
        if (nodeToDelete.type === NODE_TYPE_PODGROUP && nodeToDelete.parentNode) {
          requestAnimationFrame(() => autoResizeNamespace(nodeToDelete.parentNode!));
        }
      } else {
        const edgeInStore = rawEdgesFromStore.find(edge => edge.id === selectedId);
        if (edgeInStore) {
          const reprAggEdge = processedEdges.find(pe => pe.id === edgeInStore.id && pe.data?.isAggregated && !pe.hidden && Array.isArray(pe.data.originalEdgeIds));
          if (reprAggEdge?.data?.originalEdgeIds) { 
            deleteElements({ edges: rawEdgesFromStore.filter(ed => (reprAggEdge.data!.originalEdgeIds as string[]).includes(ed.id)) });
          } else {
            deleteElements({ edges: [edgeInStore] });
          }
        }
      }
    };
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => document.removeEventListener('keydown', handleDocumentKeyDown);
  }, [getNode, deleteElements, autoResizeNamespace, rawEdgesFromStore, processedEdges]);

  return (
    <div className="reactflow-wrapper" ref={rfWrapper} style={{ width: '100%', height: '100%' }}>
      <ToastNotification message={lastInvalidConnectionMessage} onClose={clearLastInvalidConnectionMessage} />
      <ReactFlow
        nodes={storeNodes}
        edges={processedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={onPaneClickHandler}
        onSelectionChange={onSelectionChangeHandler}
        onNodeDragStop={onNodeDragStopHandler}
        onDragOver={onDragOverHandler}
        onDrop={onDropHandler}
        deleteKeyCode={null} 
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default memo(CanvasComponent);