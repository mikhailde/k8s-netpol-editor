import React, { useCallback } from 'react';
import { useReactFlow, XYPosition, Node as ReactFlowNode } from 'reactflow';
import { useAppStore } from '../../store/store';
import { PodGroupNodeData, NamespaceNodeData, CustomNodeData } from '../../types';
import styles from './Palette.module.css';

const NODE_TYPE_NAMESPACE = 'namespace';
const NODE_TYPE_PODGROUP = 'podGroup';

const DEFAULT_PODGROUP_WIDTH_PALETTE = 150;
const DEFAULT_PODGROUP_HEIGHT_PALETTE = 40;
const DEFAULT_NAMESPACE_WIDTH_PALETTE = 200;
const DEFAULT_NAMESPACE_HEIGHT_PALETTE = 120;

const NamespaceIcon: React.FC = React.memo(() => (
  <svg className={styles.nodeIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20.78 7.5L12.53 2.75A1 1 0 0011.47 2.75L3.22 7.5A1 1 0 002.5 8.4V15.6A1 1 0 003.22 16.5L11.47 21.25A1 1 0 0012.53 21.25L20.78 16.5A1 1 0 0021.5 15.6V8.4A1 1 0 0020.78 7.5ZM4.5 15.03V8.97L12 13.21L19.5 8.97V15.03L12 19.28L4.5 15.03ZM12 11.22L5.11 7.5L12 3.78L18.89 7.5L12 11.22Z"/></svg>
));
NamespaceIcon.displayName = 'NamespaceIcon';
const PodGroupIcon: React.FC = React.memo(() => (
  <svg className={styles.nodeIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 18H4A2 2 0 012 16V14A2 2 0 014 12H20A2 2 0 0122 14V16A2 2 0 0120 18M20 10H4A2 2 0 012 8V6A2 2 0 014 4H20A2 2 0 0122 6V8A2 2 0 0120 10M7 7H5V9H7V7M7 15H5V17H7V15Z"/></svg>
));
PodGroupIcon.displayName = 'PodGroupIcon';

let paletteNodeIdCounter = 0;
const getPaletteNodeId = (prefix = 'pal_node') => `${prefix}_${paletteNodeIdCounter++}`;

const Palette: React.FC = () => {
  const { screenToFlowPosition } = useReactFlow();
  const addNode = useAppStore(state => state.addNode);

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>, nodeType: string) => {
    if (event.target !== event.currentTarget || event.key !== 'Enter') return;
    event.preventDefault();
    
    let position: XYPosition = { x: 150, y: 150 };
    const rfPane = document.querySelector('.reactflow-wrapper .react-flow__pane');
    if (rfPane && screenToFlowPosition) {
      const bounds = rfPane.getBoundingClientRect();
      position = screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    }

    const newNodeId = getPaletteNodeId(nodeType);
    const defaultName = `${nodeType.toLowerCase()}-${newNodeId.substring(newNodeId.lastIndexOf('_') + 1)}`;
    let nodeToAdd: ReactFlowNode<CustomNodeData>;

    if (nodeType === NODE_TYPE_PODGROUP) {
      const podGroupData: PodGroupNodeData = {
        label: defaultName, labels: {}, metadata: { name: defaultName, namespace: '' },
        policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
      };
      nodeToAdd = { 
        id: newNodeId, type: NODE_TYPE_PODGROUP, position, data: podGroupData,
        width: DEFAULT_PODGROUP_WIDTH_PALETTE, height: DEFAULT_PODGROUP_HEIGHT_PALETTE 
      };
    } else if (nodeType === NODE_TYPE_NAMESPACE) {
      const nsData: NamespaceNodeData = { label: defaultName };
      nodeToAdd = {
        id: newNodeId, type: NODE_TYPE_NAMESPACE, position, data: nsData,
        width: DEFAULT_NAMESPACE_WIDTH_PALETTE, height: DEFAULT_NAMESPACE_HEIGHT_PALETTE
      };
    } else { console.error(`[Palette] Unknown node type: ${nodeType}`); return; }
    addNode(nodeToAdd);
  }, [screenToFlowPosition, addNode]);

  return (
    <aside className={styles.palettePanel}>
      <div className={styles.description}>Перетащите узлы на холст:</div>
      <div className={`${styles.dndNode} ${styles.dndNodeNamespace}`}
        onDragStart={(e) => onDragStart(e, NODE_TYPE_NAMESPACE)} draggable tabIndex={0} role="button"
        aria-label="Добавить Неймспейс (Enter)" onKeyDown={(e) => handleKeyDown(e, NODE_TYPE_NAMESPACE)}>
        <NamespaceIcon /> <span>Неймспейс</span>
      </div>
      <div className={`${styles.dndNode} ${styles.dndNodePodGroup}`}
        onDragStart={(e) => onDragStart(e, NODE_TYPE_PODGROUP)} draggable tabIndex={0} role="button"
        aria-label="Добавить Группу Подов (Enter)" onKeyDown={(e) => handleKeyDown(e, NODE_TYPE_PODGROUP)}>
        <PodGroupIcon /> <span>Группа Подов</span>
      </div>
    </aside>
  );
};
export default React.memo(Palette);