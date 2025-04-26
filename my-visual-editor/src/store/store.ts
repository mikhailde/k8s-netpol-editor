import { create } from 'zustand';
import { Node, Edge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges, Connection, addEdge } from 'reactflow';

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
  deleteElements: (elementsToRemove: { nodes?: Node[], edges?: Edge[] }) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
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
  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },
  deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
    const nodeIdsToRemove = new Set(nodesToRemove.map(n => n.id));
    const edgeIdsToRemove = new Set(edgesToRemove.map(e => e.id));
    const currentSelectedId = get().selectedElementId;

    set({
      nodes: get().nodes.filter((node) => !nodeIdsToRemove.has(node.id)),
      edges: get().edges.filter((edge) =>
        !edgeIdsToRemove.has(edge.id) &&
        !nodeIdsToRemove.has(edge.source) &&
        !nodeIdsToRemove.has(edge.target)
      ),
    });

    if (currentSelectedId !== null) {
      if (nodeIdsToRemove.has(currentSelectedId)) {
         get().setSelectedElementId(null);
      } else if (edgeIdsToRemove.has(currentSelectedId)) {
         get().setSelectedElementId(null);
      }
    }
  }
}));

export type { ElementId };