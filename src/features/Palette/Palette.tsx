import React, { useCallback, memo } from 'react';
import { useReactFlow, XYPosition, Node as ReactFlowNode } from 'reactflow';
import { useAppStore } from '../../store/store';
import { PodGroupNodeData, NamespaceNodeData, CustomNodeData } from '../../types';
import {
  NODE_TYPE_NAMESPACE,
  NODE_TYPE_PODGROUP,
  DND_APP_TYPE_REACT_FLOW,
  NAMESPACE_MIN_WIDTH,
  NAMESPACE_MIN_HEIGHT,
  PODGROUP_DEFAULT_WIDTH,
  PODGROUP_DEFAULT_HEIGHT,
} from '../../constants';
import styles from './Palette.module.css';

const NamespaceIcon: React.FC<{ className?: string }> = memo(({ className }) => (
  <svg className={className || styles.nodeIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.78 7.5L12.53 2.75A1 1 0 0011.47 2.75L3.22 7.5A1 1 0 002.5 8.4V15.6A1 1 0 003.22 16.5L11.47 21.25A1 1 0 0012.53 21.25L20.78 16.5A1 1 0 0021.5 15.6V8.4A1 1 0 0020.78 7.5ZM4.5 15.03V8.97L12 13.21L19.5 8.97V15.03L12 19.28L4.5 15.03ZM12 11.22L5.11 7.5L12 3.78L18.89 7.5L12 11.22Z"/></svg>
));
NamespaceIcon.displayName = 'NamespaceIcon';

const PodGroupIcon: React.FC<{ className?: string }> = memo(({ className }) => (
  <svg className={className || styles.nodeIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 18H4A2 2 0 012 16V14A2 2 0 014 12H20A2 2 0 0122 14V16A2 2 0 0120 18M20 10H4A2 2 0 012 8V6A2 2 0 014 4H20A2 2 0 0122 6V8A2 2 0 0120 10M7 7H5V9H7V7M7 15H5V17H7V15Z"/></svg>
));
PodGroupIcon.displayName = 'PodGroupIcon';

let paletteNodeIdCounter = 0;
const getPaletteNodeId = (typePrefix: string) => `${typePrefix.toLowerCase()}_${paletteNodeIdCounter++}`;

interface DraggableNodeProps {
  nodeType: typeof NODE_TYPE_NAMESPACE | typeof NODE_TYPE_PODGROUP;
  label: string;
  IconComponent: React.FC<{ className?: string }>;
  onDragStartInternal: (event: React.DragEvent, nodeType: string) => void;
  onKeyDownInternal: (event: React.KeyboardEvent<HTMLDivElement>, nodeType: string) => void;
}

const DraggableNode: React.FC<DraggableNodeProps> = memo(({ 
  nodeType, label, IconComponent, onDragStartInternal, onKeyDownInternal 
}) => (
  <div 
    className={`${styles.dndNode} ${nodeType === NODE_TYPE_NAMESPACE ? styles.dndNodeNamespace : styles.dndNodePodGroup}`}
    onDragStart={(e) => onDragStartInternal(e, nodeType)}
    onKeyDown={(e) => onKeyDownInternal(e, nodeType)}
    draggable
    tabIndex={0} 
    role="button"
    aria-label={`Добавить ${label} (Перетащить или Enter)`}
  >
    <IconComponent /> 
    <span>{label}</span>
  </div>
));
DraggableNode.displayName = 'DraggableNode';


const Palette: React.FC = () => {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useAppStore(state => state.addNode);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData(DND_APP_TYPE_REACT_FLOW, nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleAddNodeViaKeyboard = useCallback((nodeType: string) => {
    let position: XYPosition = { x: 250, y: 150 };
    const rfPane = document.querySelector('.react-flow__pane');
    if (rfPane && screenToFlowPosition) {
      const paneRect = rfPane.getBoundingClientRect();
      position = screenToFlowPosition({ 
        x: paneRect.left + paneRect.width / 2, 
        y: paneRect.top + paneRect.height / 2 
      });
    }

    const newNodeId = getPaletteNodeId(nodeType);
    const defaultLabel = `${nodeType.toLowerCase()}-${newNodeId.substring(newNodeId.lastIndexOf('_') + 1)}`;
    let nodeToAdd: ReactFlowNode<CustomNodeData>;

    if (nodeType === NODE_TYPE_PODGROUP) {
      const podGroupData: PodGroupNodeData = {
        label: defaultLabel, 
        labels: {}, 
        metadata: { name: defaultLabel, namespace: '' },
        policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
      };
      nodeToAdd = { 
        id: newNodeId, type: NODE_TYPE_PODGROUP, position, data: podGroupData,
        width: PODGROUP_DEFAULT_WIDTH, height: PODGROUP_DEFAULT_HEIGHT 
      };
    } else if (nodeType === NODE_TYPE_NAMESPACE) {
      const nsData: NamespaceNodeData = { label: defaultLabel, hasChildren: false };
      nodeToAdd = {
        id: newNodeId, type: NODE_TYPE_NAMESPACE, position, data: nsData,
        width: NAMESPACE_MIN_WIDTH, height: NAMESPACE_MIN_HEIGHT
      };
    } else { 
      console.error(`[Palette] Попытка добавить узел неизвестного типа: ${nodeType}`);
      return; 
    }
    addNode(nodeToAdd);
  }, [screenToFlowPosition, addNode]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, nodeType: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAddNodeViaKeyboard(nodeType);
    }
  }, [handleAddNodeViaKeyboard]);

  return (
    <aside className={styles.palettePanel} aria-label="Палитра элементов">   
      <div className={styles.description}>Перетащите или кликните для добавления:</div>
      <DraggableNode 
        nodeType={NODE_TYPE_NAMESPACE}
        label="Неймспейс"
        IconComponent={NamespaceIcon}
        onDragStartInternal={onDragStart}
        onKeyDownInternal={handleKeyDown}
      />
      <DraggableNode 
        nodeType={NODE_TYPE_PODGROUP}
        label="Группа Подов"
        IconComponent={PodGroupIcon}
        onDragStartInternal={onDragStart}
        onKeyDownInternal={handleKeyDown}
      />
    </aside>
  );
};

export default memo(Palette);