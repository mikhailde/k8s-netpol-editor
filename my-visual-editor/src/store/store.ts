import { create, StoreApi, UseBoundStore } from 'zustand';
import {
  Node,
  Edge,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import { PortProtocolEntry, IValidationError, CustomNodeData } from '../types';
import { ValidationService } from '../services/ValidationService';

type ElementId = string | null;

interface AppState {
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
  setValidationErrors: (errors: IValidationError[]) => void; 
  runValidation: () => void;
}

const validationServiceInstance = new ValidationService();
type AppStoreType = UseBoundStore<StoreApi<AppState>>;

export const useAppStore: AppStoreType = create<AppState>((set, get) => {
  const runFullValidation = () => {
    const { nodes, edges } = get();
    const errors = validationServiceInstance.validateAllElements(nodes, edges);
    set({ validationErrors: errors });
  };

  return {
    selectedElementId: null,
    nodes: [],
    edges: [],
    validationErrors: [],

    setSelectedElementId: (id: ElementId) => set({ selectedElementId: id }),

    onNodesChange: (changes: NodeChange[]) => {
      set((state) => ({
        nodes: applyNodeChanges(changes, state.nodes),
      }));
      runFullValidation();
    },

    onEdgesChange: (changes: EdgeChange[]) => {
      set((state) => ({
        edges: applyEdgeChanges(changes, state.edges),
      }));
      runFullValidation();
    },

    onConnect: (connection: Connection | Edge) => {
      if (!('source' in connection) || !('target' in connection)) return;

      const state = get();
      const sourceNode = state.nodes.find(node => node.id === connection.source);
      const targetNode = state.nodes.find(node => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        console.warn('Edge creation prevented: Source or target node not found.', connection);
        return;
      }

      let isValidConnection = false;
      let ruleAppliedMessage = 'connection_disallowed';

      if (
        sourceNode.type === 'podGroup' && connection.sourceHandle === 'pg-source-a' &&
        targetNode.type === 'podGroup' && connection.targetHandle === 'pg-target-a'
      ) { isValidConnection = true; ruleAppliedMessage = 'podgroup_to_podgroup'; }
      else if (
        sourceNode.type === 'podGroup' && connection.sourceHandle === 'pg-source-a' &&
        targetNode.type === 'namespace' && connection.targetHandle === 'ns-target-a'
      ) { isValidConnection = true; ruleAppliedMessage = 'podgroup_to_namespace'; }
      else if (
        sourceNode.type === 'namespace' && connection.sourceHandle === 'ns-source-a' &&
        targetNode.type === 'podGroup' && connection.targetHandle === 'pg-target-a'
      ) { isValidConnection = true; ruleAppliedMessage = 'namespace_to_podgroup'; }

      if (isValidConnection) {
        const newEdge: Edge = {
          id: `edge_${connection.source}${connection.sourceHandle || ''}-to-${connection.target}${connection.targetHandle || ''}_${Date.now()}`,
          source: connection.source!,
          target: connection.target!,
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
        set({ edges: [...state.edges, newEdge] });
        runFullValidation();
      } else {
        console.warn(`Connection disallowed by rules: ${sourceNode.type} (${connection.sourceHandle}) -> ${targetNode.type} (${connection.targetHandle})`);
      }
    },

    addNode: (node: Node<CustomNodeData>) => {
      set((state) => ({
        nodes: [...state.nodes, node],
      }));
      runFullValidation();
    },

    deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }: { nodes?: Node<CustomNodeData>[], edges?: Edge[] }) => {
      set((state) => {
        const nodeIdsToRemove = new Set(nodesToRemove.map(n => n.id));
        const edgeIdsToRemove = new Set(edgesToRemove.map(e => e.id));

        const newNodes = state.nodes.filter((node) => !nodeIdsToRemove.has(node.id));
        const newEdges = state.edges.filter((edge) =>
          !edgeIdsToRemove.has(edge.id) &&
          !nodeIdsToRemove.has(edge.source) &&
          !nodeIdsToRemove.has(edge.target)
        );
        
        let newSelectedElementId = state.selectedElementId;
        if (state.selectedElementId && (nodeIdsToRemove.has(state.selectedElementId) || edgeIdsToRemove.has(state.selectedElementId))) {
          newSelectedElementId = null;
        }

        return {
          nodes: newNodes,
          edges: newEdges,
          selectedElementId: newSelectedElementId,
        };
      });
      runFullValidation();
    },

    updateNodeData: (nodeId: string, newData: Partial<CustomNodeData>) => {
      set((state) => ({
        nodes: state.nodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
        ),
      }));
      runFullValidation();
    },

    updateEdgeData: (edgeId: string, newData: Partial<Edge['data']>) => { 
      set((state) => ({
        edges: state.edges.map((edge) =>
          edge.id === edgeId ? { ...edge, data: { ...edge.data, ...newData } } : edge
        ),
      }));
      runFullValidation();
    },
    setValidationErrors: (errors: IValidationError[]) => set({ validationErrors: errors }),
    runValidation: runFullValidation,
  };
});

export type { ElementId };