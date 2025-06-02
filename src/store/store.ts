import { create } from 'zustand';
import {
  Node, Edge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, XYPosition,
} from 'reactflow';
import { isEqual } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import { 
    PortProtocolEntry, 
    IValidationError, 
    CustomNodeData, 
} from '../types'; 
import { ValidationService } from '../services/ValidationService'; 
import { 
    EDGE_TYPE_CUSTOM_RULE, 
    NODE_TYPE_NAMESPACE,
    NODE_TYPE_PODGROUP,
} from '../constants'; 

type ElementId = string | null;

const InvalidConnectionMessages = {
  SELF_CONNECTION: "Узел не может быть соединен сам с собой.",
  NS_TO_NS: "Неймспейс не может быть напрямую соединен с другим Неймспейсом этим способом.",
  GENERAL_INVALID: "Соединение между этими элементами не разрешено."
} as const;


export interface AppState {
  selectedElementId: ElementId;
  nodes: Node<CustomNodeData>[];
  edges: Edge[];
  validationErrors: IValidationError[];
  lastInvalidConnectionMessage: string | null;

  setSelectedElementId: (id: ElementId) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  isValidConnection: (connection: Connection) => boolean;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node<CustomNodeData>) => void;
  deleteElements: (elementsToRemove: { nodes?: Node<CustomNodeData>[]; edges?: Edge[] }) => void;
  updateNodeData: (nodeId: string, newDataOrUpdater: Partial<CustomNodeData> | ((currentData: CustomNodeData) => Partial<CustomNodeData>)) => void;
  updateEdgeData: (edgeId: string, newDataOrUpdater: Partial<Edge['data']> | ((currentData: Edge['data']) => Partial<Edge['data'] | undefined>)) => void;
  updateNodeSizeAndPosition: (nodeId: string, newSize: { width?: number; height?: number }, newPosition?: XYPosition) => void;
  runValidation: () => void;
  clearLastInvalidConnectionMessage: () => void;
}

const validationService = new ValidationService();

const initialState = {
  selectedElementId: null,
  nodes: [],
  edges: [],
  validationErrors: [],
  lastInvalidConnectionMessage: null,
};

export const useAppStore = create<AppState>((set, get) => {
  const triggerValidation = () => {
    const { nodes, edges, validationErrors: currentErrors } = get();
    const newErrors = validationService.validateAllElements(nodes, edges);
    if (!isEqual(currentErrors, newErrors)) {
      set({ validationErrors: newErrors });
    }
  };

  const checkConnectionValidity = (connection: Connection): { isValid: boolean; message?: string, ruleAppliedMessage?: string } => {
    const { nodes } = get();
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) return { isValid: false, message: "Исходный или целевой узел не найден." };
    if (connection.source === connection.target) return { isValid: false, message: InvalidConnectionMessages.SELF_CONNECTION };

    const sourceLabel = sourceNode.data && ('label' in sourceNode.data) ? sourceNode.data.label : sourceNode.id.slice(-4);
    const targetLabel = targetNode.data && ('label' in targetNode.data) ? targetNode.data.label : targetNode.id.slice(-4);

    if (sourceNode.type === NODE_TYPE_PODGROUP && targetNode.type === NODE_TYPE_PODGROUP) {
      return { isValid: true, ruleAppliedMessage: `Правило от ${sourceLabel} к ${targetLabel}` };
    }
    if (sourceNode.type === NODE_TYPE_PODGROUP && targetNode.type === NODE_TYPE_NAMESPACE) {
      return { isValid: true, ruleAppliedMessage: `Egress от ${sourceLabel} к Namespace ${targetLabel}` };
    }
    if (sourceNode.type === NODE_TYPE_NAMESPACE && targetNode.type === NODE_TYPE_PODGROUP) {
      return { isValid: true, ruleAppliedMessage: `Ingress к ${targetLabel} от Namespace ${sourceLabel}` };
    }
    if (sourceNode.type === NODE_TYPE_NAMESPACE && targetNode.type === NODE_TYPE_NAMESPACE) {
      return { isValid: false, message: InvalidConnectionMessages.NS_TO_NS };
    }
    
    return { isValid: false, message: InvalidConnectionMessages.GENERAL_INVALID };
  };


  return {
    ...initialState,

    setSelectedElementId: (id) => set({ selectedElementId: id }),
    clearLastInvalidConnectionMessage: () => set({ lastInvalidConnectionMessage: null }),

    onNodesChange: (changes) => {
      set(state => ({ nodes: applyNodeChanges(changes, state.nodes) }));
      triggerValidation(); 
    },

    onEdgesChange: (changes) => {
      set(state => ({ edges: applyEdgeChanges(changes, state.edges) }));
      triggerValidation();
    },

    isValidConnection: (connection) => {
        return checkConnectionValidity(connection).isValid;
    },

    onConnect: (connectionParams) => {
      const validityCheck = checkConnectionValidity(connectionParams);

      if (!validityCheck.isValid) {
        set({ lastInvalidConnectionMessage: validityCheck.message || InvalidConnectionMessages.GENERAL_INVALID });
        setTimeout(() => get().clearLastInvalidConnectionMessage(), 3000); 
        return;
      }

      const newEdge: Edge = {
        id: uuidv4(), 
        source: connectionParams.source!,
        target: connectionParams.target!,
        sourceHandle: connectionParams.sourceHandle, 
        targetHandle: connectionParams.targetHandle,
        type: EDGE_TYPE_CUSTOM_RULE, 
        animated: true, 
        data: { 
          ruleApplied: validityCheck.ruleAppliedMessage, 
          ports:[] as PortProtocolEntry[] 
        },
      };
      set(state => ({ edges: [...state.edges, newEdge], lastInvalidConnectionMessage: null }));
      triggerValidation();
    },

    addNode: (node) => { 
      set(state => ({ nodes: [...state.nodes, node] })); 
      triggerValidation(); 
    },

    deleteElements: ({ nodes: nodesToRemove = [], edges: edgesToRemove = [] }) => {
      set(state => {
        const nodeIdsToDelete = new Set(nodesToRemove.map(n => n.id));
        nodesToRemove.forEach(node => {
          if (node.type === NODE_TYPE_NAMESPACE) {
            state.nodes.forEach(childNode => { 
              if (childNode.parentNode === node.id) nodeIdsToDelete.add(childNode.id); 
            });
          }
        });

        const edgeIdsFromInput = new Set(edgesToRemove.map(e => e.id));
        const allEdgeIdsToDelete = new Set(edgeIdsFromInput);
        state.edges.forEach(edge => {
          if (nodeIdsToDelete.has(edge.source) || nodeIdsToDelete.has(edge.target)) {
            allEdgeIdsToDelete.add(edge.id);
          }
        });

        const newNodes = state.nodes.filter(n => !nodeIdsToDelete.has(n.id));
        const newEdges = state.edges.filter(e => !allEdgeIdsToDelete.has(e.id));
        let newSelectedId = state.selectedElementId;
        if (state.selectedElementId && (nodeIdsToDelete.has(state.selectedElementId) || allEdgeIdsToDelete.has(state.selectedElementId))) {
          newSelectedId = null;
        }
        return { nodes: newNodes, edges: newEdges, selectedElementId: newSelectedId, lastInvalidConnectionMessage: null };
      }); 
      triggerValidation();
    },

    updateNodeData: (nodeId, newDataOrUpdater) => {
      set(state => ({
        nodes: state.nodes.map(node => {
          if (node.id === nodeId) {
            const currentData = node.data as CustomNodeData; 
            const updatedDataPart = typeof newDataOrUpdater === 'function'
              ? newDataOrUpdater(currentData)
              : newDataOrUpdater;
            return { ...node, data: { ...currentData, ...updatedDataPart } };
          }
          return node;
        }),
      }));
      triggerValidation();
    },

    updateEdgeData: (edgeId, newDataOrUpdater) => {
      set(state => ({
        edges: state.edges.map(edge => {
          if (edge.id === edgeId) {
            const currentData = edge.data || {};
            const updatedDataPart = typeof newDataOrUpdater === 'function'
              ? newDataOrUpdater(currentData)
              : newDataOrUpdater;
            return { ...edge, data: { ...currentData, ...updatedDataPart } };
          }
          return edge;
        }),
      }));
      triggerValidation();
    },

    updateNodeSizeAndPosition: (nodeId, newSize, newPosition) => {
      set(state => ({
        nodes: state.nodes.map(node => {
          if (node.id === nodeId) {
            const updatedNode: Node<CustomNodeData> = { ...node };
            if (newSize.width !== undefined) updatedNode.width = newSize.width;
            if (newSize.height !== undefined) updatedNode.height = newSize.height;
            updatedNode.style = { ...node.style, width: newSize.width, height: newSize.height };
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