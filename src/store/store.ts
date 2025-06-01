import { create, StoreApi, UseBoundStore } from 'zustand';
import {
  Node, Edge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, XYPosition,
} from 'reactflow';
import { isEqual } from 'lodash';
import { PortProtocolEntry, IValidationError, CustomNodeData, NamespaceNodeData, PodGroupNodeData } from '../types';
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
  updateNodeSizeAndPosition: (nodeId: string, newSize: { width: number; height: number }, newPosition?: XYPosition) => void;
  runValidation: () => void;
}

const validationService = new ValidationService();

export const useAppStore = create<AppState>((set, get) => {
  const triggerValidation = () => {
    const { nodes, edges, validationErrors: currentErrors } = get();
    const newErrors = validationService.validateAllElements(nodes, edges);
    if (!isEqual(currentErrors, newErrors)) set({ validationErrors: newErrors });
  };

  return {
    // --- Состояние ---
    selectedElementId: null,
    nodes: [],
    edges: [],
    validationErrors: [],

    // --- Действия ---
    setSelectedElementId: (id) => set({ selectedElementId: id }),

    onNodesChange: (changes) => {
      set(state => ({ nodes: applyNodeChanges(changes, state.nodes) }));
      triggerValidation();
    },

    onEdgesChange: (changes) => {
      set(state => ({ edges: applyEdgeChanges(changes, state.edges) }));
      triggerValidation();
    },

    onConnect: (connection) => {
      const state = get();
      if(!('source' in connection && 'target' in connection && connection.source && connection.target)) return;
      const sourceNode = state.nodes.find(n=>n.id===connection.source); 
      const targetNode = state.nodes.find(n=>n.id===connection.target);
      if(!sourceNode || !targetNode) return;

      let isValidConnection = true; // TODO: Внедрить реальную логику валидации соединений
      let ruleAppliedMessage: string | undefined = undefined;

      if(isValidConnection){
        const newEdge: Edge = {
          id: `edge_${connection.source.slice(-4)}${connection.sourceHandle||''}-${connection.target.slice(-4)}${connection.targetHandle||''}_${Date.now()}`,
          source:connection.source, target:connection.target, 
          sourceHandle:connection.sourceHandle, targetHandle:connection.targetHandle,
          type: 'customRuleEdge', animated: true, 
          data: { ruleApplied: ruleAppliedMessage, ports:[] as PortProtocolEntry[] },
        };
        set(s=>({edges:[...s.edges, newEdge]})); 
        triggerValidation();
      } else console.warn(`[Store] Connection disallowed.`);
    },

    addNode: (node) => { 
      set(state => ({ nodes: [...state.nodes, node] })); 
      triggerValidation(); 
    },

    deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
      set(state => {
        const nodeIdsToDelete = new Set(nodesToRemove.map(n => n.id));
        nodesToRemove.forEach(node => {
          if (node.type === 'namespace') {
            state.nodes.forEach(childNode => { 
              if (childNode.parentNode === node.id) nodeIdsToDelete.add(childNode.id); 
            });
          }
        });

        const edgeIdsToDeleteFromInput = new Set(edgesToRemove.map(e => e.id));
        const allEdgeIdsToDelete = new Set(edgeIdsToDeleteFromInput);
        state.edges.forEach(edge => {
          if (nodeIdsToDelete.has(edge.source) || nodeIdsToDelete.has(edge.target)) {
            allEdgeIdsToDelete.add(edge.id);
          }
        });

        const newNodes = state.nodes.filter(n => !nodeIdsToDelete.has(n.id));
        const newEdges = state.edges.filter(e => !allEdgeIdsToDelete.has(e.id));
        const newSelectedId = (state.selectedElementId && (nodeIdsToDelete.has(state.selectedElementId) || allEdgeIdsToDelete.has(state.selectedElementId)))
          ? null : state.selectedElementId;
        return { nodes: newNodes, edges: newEdges, selectedElementId: newSelectedId };
      }); 
      triggerValidation();
    },

    updateNodeData: (nodeId, newData) => {
      set(state => ({ nodes: state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...newData } } : n) }));
      triggerValidation();
    },

    updateEdgeData: (edgeId, newData) => {
      set(state => ({ edges: state.edges.map(e => e.id === edgeId ? { ...e, data: { ...e.data, ...newData } } : e) }));
      triggerValidation();
    },

    updateNodeSizeAndPosition: (nodeId, newSize, newPosition) => {
      set(state => ({
        nodes: state.nodes.map(node => {
          if (node.id === nodeId) {
            const updatedNode: Node<CustomNodeData> = { ...node, width: newSize.width, height: newSize.height, style: { ...node.style, width: newSize.width, height: newSize.height }};
            if (newPosition) updatedNode.position = newPosition;
            return updatedNode;
          }
          return node;
        }),
      }));
      triggerValidation();
    },
    
    runValidation: triggerValidation,
  };
});

export type { AppState as ApplicationState };