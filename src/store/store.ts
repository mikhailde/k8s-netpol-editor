import { create, StoreApi, UseBoundStore } from 'zustand';

import {
  Node, Edge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange,
} from 'reactflow';
import { isEqual } from 'lodash';
import { PortProtocolEntry, IValidationError, CustomNodeData } from '../types';
import { ValidationService } from '../services/ValidationService';

type ElementId = string | null;

export interface AppState {
  selectedElementId: ElementId;
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  validationErrors: IValidationError[];

  setSelectedElementId: (id: ElementId) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection | Edge) => void;
  addNode: (node: Node<CustomNodeData>) => void;
  deleteElements: (elementsToRemove: { nodes?: Node<CustomNodeData>[]; edges?: Edge[] }) => void;
  updateNodeData: (nodeId: string, newData: Partial<CustomNodeData>) => void;
  updateEdgeData: (edgeId: string, newData: Partial<Edge['data']>) => void;
  runValidation: () => void;
}

export type AppStoreType = UseBoundStore<StoreApi<AppState>>;

const validationServiceInstance = new ValidationService();

export const useAppStore: AppStoreType = create<AppState>((set, get) => {

  const updateValidationErrorsIfNeeded = () => {
    const { nodes, edges, validationErrors: currentValidationErrors } = get();
    const newErrors = validationServiceInstance.validateAllElements(nodes, edges);

    if (!isEqual(currentValidationErrors, newErrors)) { 
      set({ validationErrors: newErrors });
    }
  };

  return {
    // --- Начальное состояние ---
    selectedElementId: null,
    nodes: [],
    edges: [],
    validationErrors: [],

    // --- Действия ---
    setSelectedElementId: (id: ElementId) => {
      set({ selectedElementId: id });
    },

    onNodesChange: (changes: NodeChange[]) => {
      set(state => ({ nodes: applyNodeChanges(changes, state.nodes) }));
      updateValidationErrorsIfNeeded();
    },

    onEdgesChange: (changes: EdgeChange[]) => {
      set(state => ({ edges: applyEdgeChanges(changes, state.edges) }));
      updateValidationErrorsIfNeeded();
    },

    onConnect: (connection: Connection | Edge) => {
      console.log('--- [STORE] onConnect CALLED ---');
      console.log('[STORE] Connection object:', JSON.stringify(connection, null, 2));
      const state = get(); 
      if (!('source' in connection) || !('target' in connection) || !connection.source || !connection.target) {
        console.warn('[Store] onConnect: Invalid connection object received.', connection);
        return;
      }
      
      const sourceNode = state.nodes.find(node => node.id === connection.source);
      const targetNode = state.nodes.find(node => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        console.warn('[Store] onConnect: Source or target node not found.', connection);
        return;
      }

      let isValidConnection = true;
      let ruleAppliedMessage: string;

      if (
        sourceNode.type === 'podGroup' && connection.sourceHandle === 'pg-source-a' &&
        targetNode.type === 'podGroup' && connection.targetHandle === 'pg-target-a'
      ) { 
        isValidConnection = true; 
        ruleAppliedMessage = 'podgroup_to_podgroup_connection'; 
      } else if (
        sourceNode.type === 'podGroup' && connection.sourceHandle === 'pg-source-a' &&
        targetNode.type === 'namespace' && connection.targetHandle === 'ns-target-a'
      ) { 
        isValidConnection = true; 
        ruleAppliedMessage = 'podgroup_to_namespace_connection'; 
      } else if (
        sourceNode.type === 'namespace' && connection.sourceHandle === 'ns-source-a' &&
        targetNode.type === 'podGroup' && connection.targetHandle === 'pg-target-a'
      ) { 
        isValidConnection = true; 
        ruleAppliedMessage = 'namespace_to_podgroup_connection'; 
      } else {
        isValidConnection = false;
        ruleAppliedMessage = 'connection_rule_violation'; 
      }

      if (isValidConnection) {
        const newEdge: Edge = {
          id: `edge_${connection.source}${connection.sourceHandle || ''}-to-${connection.target}${connection.targetHandle || ''}_${Date.now()}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          type: 'customRuleEdge', 
          animated: true,
          data: {
            ruleApplied: ruleAppliedMessage,
            timestamp: new Date().toISOString(),
            sourceNodeType: sourceNode.type,
            targetNodeType: targetNode.type,
            ports: [] as PortProtocolEntry[], 
          },
        };
        set(prevState => ({ edges: [...prevState.edges, newEdge] }));
        updateValidationErrorsIfNeeded();
      } else {
        console.warn(`[Store] onConnect: Connection disallowed. Type: ${sourceNode.type}(${connection.sourceHandle || 'default'}) -> ${targetNode.type}(${connection.targetHandle || 'default'}). Message: ${ruleAppliedMessage}`);
      }
    },

    addNode: (node: Node<CustomNodeData>) => {
      set(state => ({ nodes: [...state.nodes, node] }));
      updateValidationErrorsIfNeeded();
    },

    deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
      set(state => {
        const nodeIdsToRemove = new Set(nodesToRemove.map(n => n.id));
        const edgeIdsToRemove = new Set(edgesToRemove.map(e => e.id));

        const newNodes = state.nodes.filter(node => !nodeIdsToRemove.has(node.id));
        const newEdges = state.edges.filter(edge =>
          !edgeIdsToRemove.has(edge.id) &&
          !nodeIdsToRemove.has(edge.source) &&
          !nodeIdsToRemove.has(edge.target)
        );
        
        const newSelectedElementId = (state.selectedElementId && (nodeIdsToRemove.has(state.selectedElementId) || edgeIdsToRemove.has(state.selectedElementId)))
          ? null
          : state.selectedElementId;

        return { 
          nodes: newNodes, 
          edges: newEdges, 
          selectedElementId: newSelectedElementId 
        };
      });
      updateValidationErrorsIfNeeded();
    },

    updateNodeData: (nodeId: string, newData: Partial<CustomNodeData>) => {
      set(state => ({
        nodes: state.nodes.map(node =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
        ),
      }));
      updateValidationErrorsIfNeeded();
    },

    updateEdgeData: (edgeId: string, newData: Partial<Edge['data']>) => {
      set(state => ({
        edges: state.edges.map(edge =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, ...newData } } : edge
        ),
      }));
      updateValidationErrorsIfNeeded();
    },
    
    runValidation: updateValidationErrorsIfNeeded,
  };
});
