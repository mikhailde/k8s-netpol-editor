import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/store';
import PodGroupPropertiesEditor from './PodGroupPropertiesEditor';
import NamespacePropertiesEditor from './NamespacePropertiesEditor';
import RulePortsEditor from './RulePortsEditor';
import { PortProtocolEntry, PodGroupNodeData, isPodGroupNodeData, NamespaceNodeData } from '../../types';
import { Node, Edge } from 'reactflow';
import './InspectorView.css';


const getEdgeGroupId = (edge: Edge): string => {
  return `${edge.source}-${edge.target}-${edge.sourceHandle || 'null'}-${edge.targetHandle || 'null'}`;
};

const InspectorView: React.FC = () => {
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes as Node<PodGroupNodeData | NamespaceNodeData>[]);
  const allEdges = useAppStore((state) => state.edges);
  const updateEdgeData = useAppStore((state) => state.updateEdgeData);

  const [editingOriginalEdgeId, setEditingOriginalEdgeId] = useState<string | null>(null);

  useEffect(() => {
    setEditingOriginalEdgeId(null);
  }, [selectedElementId]);

  const selectedNode = useMemo(() => {
    if (!selectedElementId) return null;
    return nodes.find((node) => node.id === selectedElementId);
  }, [selectedElementId, nodes]);

  const selectedEdgeInfo = useMemo(() => {
    if (!selectedElementId) return null;
    const directlySelectedEdge = allEdges.find(edge => edge.id === selectedElementId);
    if (!directlySelectedEdge || directlySelectedEdge.type !== 'customRuleEdge') return { edge: directlySelectedEdge, isAggregated: false, originalEdgeIds: directlySelectedEdge ? [directlySelectedEdge.id] : [], aggregatedCount: 1 };
    const groupId = getEdgeGroupId(directlySelectedEdge);
    const group: Edge[] = [];
    allEdges.forEach(e => {
      if (e.type === 'customRuleEdge' && getEdgeGroupId(e) === groupId) {
        group.push(e);
      }
    });
    if (group.length > 1) {
      const representativeInGroup = group.sort((a,b) => a.id.localeCompare(b.id))[0];
      if (directlySelectedEdge.id === representativeInGroup.id) {
        return {
          edge: directlySelectedEdge,
          isAggregated: true,
          aggregatedCount: group.length,
          originalEdgeIds: group.map(e => e.id).sort((a,b) => a.localeCompare(b)),
        };
      } else {
         return { edge: directlySelectedEdge, isAggregated: false, originalEdgeIds: [directlySelectedEdge.id], aggregatedCount: 1 };
      }
    }
    return { edge: directlySelectedEdge, isAggregated: false, originalEdgeIds: [directlySelectedEdge.id], aggregatedCount: 1 };
  }, [selectedElementId, allEdges]);

  console.log('[InspectorView] Selected Element ID:', selectedElementId);
  console.log('[InspectorView] Calculated selectedEdgeInfo:', selectedEdgeInfo ? JSON.parse(JSON.stringify(selectedEdgeInfo)) : null);
  if (selectedEdgeInfo?.edge) {
      console.log('[InspectorView] selectedEdgeInfo.edge.data:', JSON.parse(JSON.stringify(selectedEdgeInfo.edge.data)));
      console.log('[InspectorView] selectedEdgeInfo.isAggregated:', selectedEdgeInfo.isAggregated);
  }


  const edgeToEditDetails = editingOriginalEdgeId
    ? allEdges.find(edge => edge.id === editingOriginalEdgeId)
    : (selectedEdgeInfo?.isAggregated ? null : selectedEdgeInfo?.edge);

  const handlePortsChange = (updatedPorts: PortProtocolEntry[], isValid: boolean) => {
    const edgeIdToUpdate = editingOriginalEdgeId || (selectedEdgeInfo?.edge && !selectedEdgeInfo.isAggregated ? selectedEdgeInfo.edge.id : null);
    if (edgeIdToUpdate) {
      console.log(`Ports update for edge ${edgeIdToUpdate}. Valid:`, isValid);
      updateEdgeData(edgeIdToUpdate, { ports: updatedPorts });
    }
  };

  return (
    <div className="inspector-view">
      <h3>Свойства элемента</h3>
      
      {selectedNode && (
        <>
          <p>ID: {selectedNode.id}</p>
          <p>Тип: {selectedNode.type}</p>
          {selectedNode.type === 'namespace' && (
            <NamespacePropertiesEditor
              node={selectedNode as Node<NamespaceNodeData>}
            />
          )}
          {selectedNode.type === 'podGroup' && isPodGroupNodeData(selectedNode.data) && (
             <PodGroupPropertiesEditor
              node={selectedNode as Node<PodGroupNodeData>}
            />
          )}
           {selectedNode.type !== 'namespace' && selectedNode.type !== 'podGroup' && (
             <p>Выбран элемент: {selectedNode.id} (Тип: {selectedNode.type}). Редактор для этого типа отсутствует.</p>
           )}
           <hr />
        </>
      )}


      {selectedEdgeInfo?.edge && !selectedNode && (
        <>
          <p>ID: {selectedEdgeInfo.edge.id} (Тип: Ребро)</p>
          <p>Источник: {selectedEdgeInfo.edge.source}</p>
          <p>Назначение: {selectedEdgeInfo.edge.target}</p>

          {selectedEdgeInfo.isAggregated ? (
            <div className="aggregated-rule-details">
              <h4>Агрегированное правило</h4>
              <p>Это правило представляет {selectedEdgeInfo.aggregatedCount} индивидуальных правил.</p>
              <p>Выберите правило для редактирования портов:</p>
              <ul>
                {(selectedEdgeInfo.originalEdgeIds as string[]).map((originalId) => (
                  <li key={originalId}>
                    <button
                      onClick={() => setEditingOriginalEdgeId(originalId)}
                      className={editingOriginalEdgeId === originalId ? 'active' : ''}
                    >
                      Редактировать ID: {originalId.slice(-6)}
                    </button>
                  </li>
                ))}
              </ul>
              {editingOriginalEdgeId && <hr />}
            </div>
          ) : (
            !editingOriginalEdgeId && <p>Простое правило:</p>
          )}

          {edgeToEditDetails && (
             <>
                {editingOriginalEdgeId && <p>Редактирование правила ID: {editingOriginalEdgeId.slice(-6)}</p>}
                <RulePortsEditor
                    ports={(edgeToEditDetails.data?.ports as PortProtocolEntry[] | undefined) || []}
                    onChange={handlePortsChange}
                />
             </>
          )}
        </>
      )}

      {!selectedNode && !selectedEdgeInfo?.edge && selectedElementId && (
          <p>Выбранный элемент с ID {selectedElementId} не найден или является скрытым ребром.</p>
      )}
       {!selectedElementId && (
          <p>Выберите элемент для просмотра свойств.</p>
      )}
    </div>
  );
};

export default InspectorView;