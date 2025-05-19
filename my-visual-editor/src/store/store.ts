import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import { PortProtocolEntry } from '../types';

type ElementId = string | null;

interface AppState {

  selectedElementId: ElementId;
  setSelectedElementId: (id: ElementId) => void;

  nodes: Node[];
  edges: Edge[];

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  deleteElements: (elementsToRemove: { nodes?: Node[]; edges?: Edge[] }) => void;
  updateNodeData: (nodeId: string, newData: Partial<Node['data']>) => void;
  updateEdgeData: (edgeId: string, newData: Partial<Edge['data']>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({

  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  nodes: [],
  edges: [],

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection: Connection) => {
    const state = get();
    const sourceNode = state.nodes.find(node => node.id === connection.source);
    const targetNode = state.nodes.find(node => node.id === connection.target);

    if (!sourceNode || !targetNode) {
      console.warn('Edge creation prevented: Source or target node not found. Connection:', connection);
      return;
    }

    let isValidConnection = false;
    let ruleAppliedMessage = 'connection_disallowed';

    if (
      sourceNode.type === 'podGroup' && connection.sourceHandle === 'pg-source-a' &&
      targetNode.type === 'namespace' && connection.targetHandle === 'ns-target-a'
    ) {
      isValidConnection = true;
      ruleAppliedMessage = 'podgroup_to_namespace';
    } else if (
      sourceNode.type === 'namespace' && connection.sourceHandle === 'ns-source-a' &&
      targetNode.type === 'podGroup' && connection.targetHandle === 'pg-target-a'
    ) {
      isValidConnection = true;
      ruleAppliedMessage = 'namespace_to_podgroup';
    }

    if (isValidConnection) {
      const sourceHandleSuffix = connection.sourceHandle ? `_h-${connection.sourceHandle}` : '';
      const targetHandleSuffix = connection.targetHandle ? `_h-${connection.targetHandle}` : '';
      const newEdgeId = `edge_${connection.source}${sourceHandleSuffix}-to-${connection.target}${targetHandleSuffix}_${Date.now()}`;

      const newCustomEdge: Edge = {
        id: newEdgeId,
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

      set({ edges: [...state.edges, newCustomEdge] });
      console.log(`CustomRuleEdge created: ${ruleAppliedMessage} (ID: ${newCustomEdge.id})`);
    } else {
      console.warn(`Connection disallowed by rules: ${sourceNode.type} (${connection.sourceHandle}) -> ${targetNode.type} (${connection.targetHandle})`);
    }
  },

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
    set((state) => {
      const nodeIdsToRemove = new Set(nodesToRemove.map(n => n.id));
      const edgeIdsToRemove = new Set(edgesToRemove.map(e => e.id));

      const newNodes = state.nodes.filter((node) => !nodeIdsToRemove.has(node.id));
      const currentEdges = state.edges;
      const newEdges = currentEdges.filter((edge) =>
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
  },

  updateNodeData: (nodeId, newData) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      ),
    }));
  },

  updateEdgeData: (edgeId, newData) => {
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === edgeId ? { ...edge, data: { ...edge.data, ...newData } } : edge
      ),
    }));
  },
}));

export type { ElementId };