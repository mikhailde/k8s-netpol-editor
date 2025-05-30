import { create } from 'zustand';
import { Node } from 'reactflow';

interface AppState {
  count: number;
  increment: () => void;
  decrement: () => void;
  nodes: Node[];
  addNode: (newNode: Node) => void;
}

export const useAppStore = create<AppState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  
  nodes: [],
  addNode: (newNode: Node) => 
    set((state) => ({ 
      nodes: [...state.nodes, newNode] 
    })),
}));