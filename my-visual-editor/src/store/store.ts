import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as reactFlowAddEdge,
} from 'reactflow';

type ElementId = string | null;

interface AppState {
  count: number;
  increment: () => void;
  decrement: () => void;

  selectedElementId: ElementId;
  setSelectedElementId: (id: ElementId) => void;

  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  deleteElements: (elementsToRemove: { nodes?: Node[]; edges?: Edge[] }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),

  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    const state = get();
    const sourceNode = state.nodes.find(node => node.id === connection.source);
    const targetNode = state.nodes.find(node => node.id === connection.target);


    if (sourceNode && targetNode) {
      let isValidConnection = false;
      let ruleAppliedMessage = 'connection_disallowed';

      if (
        sourceNode.type === 'podGroup' && connection.sourceHandle === 'pg-source-a' &&
        targetNode.type === 'namespace' && connection.targetHandle === 'ns-target-a'
      ) {
        isValidConnection = true;
        ruleAppliedMessage = 'podgroup_to_namespace';
      }
      else if (
        sourceNode.type === 'namespace' && connection.sourceHandle === 'ns-source-a' &&
        targetNode.type === 'podGroup' && connection.targetHandle === 'pg-target-a'
      ) {
        isValidConnection = true;
        ruleAppliedMessage = 'namespace_to_podgroup';
      }

      if (isValidConnection) {
        const sourceHandleId = connection.sourceHandle ? `_h-${connection.sourceHandle}` : '';
        const targetHandleId = connection.targetHandle ? `_h-${connection.targetHandle}` : '';
        const newEdgeId = `edge_${connection.source}${sourceHandleId}-to-${connection.target}${targetHandleId}_${Date.now()}`;

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
          },
        };

        set({
          edges: reactFlowAddEdge(newCustomEdge, state.edges),
        });
        console.log(`Custom edge created based on rule: ${ruleAppliedMessage}`, newCustomEdge);
      } else {
        console.warn(`Connection disallowed by rules: ${sourceNode.type} (${connection.sourceHandle}) -> ${targetNode.type} (${connection.targetHandle})`);
      }
    } else {
      console.warn('Edge creation prevented: Source or target node not found. Connection:', connection);
    }
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
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
  }
}));
