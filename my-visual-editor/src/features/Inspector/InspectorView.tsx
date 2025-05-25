import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { isEqual } from 'lodash';
import { useAppStore, type AppState } from '../../store/store';
import PodGroupPropertiesEditor from './PodGroupPropertiesEditor';
import NamespacePropertiesEditor from './NamespacePropertiesEditor';
import RulePortsEditor from './RulePortsEditor';
import {
  PortProtocolEntry,
  PodGroupNodeData,
  isPodGroupNodeData,
  NamespaceNodeData,
  CustomNodeData,
  IValidationError,
} from '../../types';
import { Node, Edge } from 'reactflow';
import styles from './InspectorView.module.css';

// --- Вспомогательные компоненты (обернуты в React.memo для оптимизации) ---
const PlaceholderIcon: React.FC<{ className?: string }> = React.memo(({ className }) => (
  <svg className={className || styles.placeholderIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
));
PlaceholderIcon.displayName = 'PlaceholderIcon';


interface InfoBlockProps { label: string; value: React.ReactNode; isPreformatted?: boolean; className?: string; }
const InfoBlock: React.FC<InfoBlockProps> = React.memo(({ label, value, isPreformatted, className = '' }) => (
  <div className={`${styles.section} ${className}`}>
    <span className={styles.sectionTitle}>{label}</span>
    <span className={isPreformatted ? styles.preformattedText : styles.infoBlock}>{value}</span>
  </div>
));
InfoBlock.displayName = 'InfoBlock';

interface IssuesPanelProps { issues: IValidationError[]; title?: string; }
const IssuesPanel: React.FC<IssuesPanelProps> = React.memo(({ issues, title = "Проблемы с элементом:" }) => {
  if (!issues || issues.length === 0) return null;
  return (
    <div className={`${styles.section} ${styles.nodeIssuesPanel}`}>
      <span className={styles.sectionTitle}>{title}</span>
      <ul className={styles.issuesList}>
        {issues.map((issue, index) => (
          <li key={`${issue.elementId || 'global'}-${issue.fieldKey || 'general'}-${index}`}
              className={`${styles.issueItem} ${styles[issue.severity || 'error']}`}>
            {issue.message}
            {issue.fieldKey && (<span className={styles.issueFieldInfo}> (Поле: {issue.fieldKey})</span>)}
          </li>
        ))}
      </ul>
    </div>
  );
});
IssuesPanel.displayName = 'IssuesPanel';


// --- Основной компонент InspectorView ---
const getEdgeGroupId = (edge: Edge): string => `${edge.source}-${edge.target}-${edge.sourceHandle || 'null'}-${edge.targetHandle || 'null'}`;

const InspectorView: React.FC = () => {

  const selectedElementId = useAppStore((state: AppState) => state.selectedElementId);
  const nodes = useAppStore((state: AppState) => state.nodes as Node<CustomNodeData>[], isEqual);
  const allEdges = useAppStore((state: AppState) => state.edges, isEqual);
  const globalValidationErrors = useAppStore((state: AppState) => state.validationErrors, isEqual);
  const updateEdgeData = useAppStore((state: AppState) => state.updateEdgeData);

  const [editingOriginalEdgeId, setEditingOriginalEdgeId] = useState<string | null>(null);

  useEffect(() => {
    setEditingOriginalEdgeId(null);
  }, [selectedElementId]);

  const selectedNode = useMemo(() => {
    if (!selectedElementId) return null;
    const node = nodes.find((n) => n.id === selectedElementId);
    return node;
  }, [selectedElementId, nodes]);

  const selectedEdgeInfo = useMemo(() => {
    if (!selectedElementId || !allEdges.length) return null;
    const directlySelectedEdge = allEdges.find(edge => edge.id === selectedElementId);

    if (!directlySelectedEdge || directlySelectedEdge.type !== 'customRuleEdge') {
      return directlySelectedEdge ? { edge: directlySelectedEdge, isAggregated: false, originalEdgeIds: [directlySelectedEdge.id], aggregatedCount: 1 } : null;
    }
    const groupId = getEdgeGroupId(directlySelectedEdge);
    const group: Edge[] = allEdges.filter(e => e.type === 'customRuleEdge' && getEdgeGroupId(e) === groupId);

    if (group.length > 1) {
      const sortedGroup = [...group].sort((a, b) => a.id.localeCompare(b.id));
      const representativeInGroup = sortedGroup[0];
      if (directlySelectedEdge.id === representativeInGroup.id) {
        return { edge: directlySelectedEdge, isAggregated: true, aggregatedCount: group.length, originalEdgeIds: sortedGroup.map(e => e.id) };
      } else {
        return { edge: directlySelectedEdge, isAggregated: false, originalEdgeIds: [directlySelectedEdge.id], aggregatedCount: 1 };
      }
    }
    return { edge: directlySelectedEdge, isAggregated: false, originalEdgeIds: [directlySelectedEdge.id], aggregatedCount: 1 };
  }, [selectedElementId, allEdges]);
  
  const elementIssues = useMemo(() => {
    if (!selectedElementId || !globalValidationErrors.length) return [];
    const issues = globalValidationErrors.filter(issue => issue.elementId === selectedElementId);
    return issues;
  }, [selectedElementId, globalValidationErrors]);

  const edgeToEditDetails = useMemo(() => {
    if (editingOriginalEdgeId) {
      const edge = allEdges.find(e => e.id === editingOriginalEdgeId);
      return edge;
    }
    if (selectedEdgeInfo?.edge && !selectedEdgeInfo.isAggregated) {
      return selectedEdgeInfo.edge;
    }
    return null;
  }, [editingOriginalEdgeId, selectedEdgeInfo, allEdges]);

  const handlePortsChange = useCallback((updatedPorts: PortProtocolEntry[]) => {
    if (edgeToEditDetails?.id) {
      updateEdgeData(edgeToEditDetails.id, { ports: updatedPorts });
    }
  }, [edgeToEditDetails, updateEdgeData]);

  if (!selectedElementId) {
    return (
      <div className={`inspector-view-root ${styles.inspectorViewBase} ${styles.placeholder}`}>
        <PlaceholderIcon />
        Выберите элемент на холсте для просмотра и редактирования его свойств.
      </div>
    );
  }

  const renderNodeInspector = () => {
    if (!selectedNode) return null;
    const nodeGeneralIssues = elementIssues.filter(iss => !iss.fieldKey || !iss.fieldKey.startsWith("ports"));
    const fieldSpecificIssues = elementIssues.filter(iss => !!iss.fieldKey && !iss.fieldKey.startsWith("ports"));
    return (
      <>
        <h3 className={styles.inspectorHeader}>Свойства Узла</h3>
        <IssuesPanel issues={nodeGeneralIssues} title="Общие проблемы с узлом:" />
        <InfoBlock label="ID" value={selectedNode.id} />
        <InfoBlock label="Тип" value={selectedNode.type || 'N/A'} />
        
        {selectedNode.type === 'namespace' && selectedNode.data && (
          <NamespacePropertiesEditor node={selectedNode as Node<NamespaceNodeData>} nodeIssues={fieldSpecificIssues} />
        )}
        {selectedNode.type === 'podGroup' && isPodGroupNodeData(selectedNode.data) && (
           <PodGroupPropertiesEditor node={selectedNode as Node<PodGroupNodeData>} nodeIssues={fieldSpecificIssues} />
        )}
        {selectedNode.type !== 'namespace' && selectedNode.type !== 'podGroup' && (
           <InfoBlock label="Информация" value={`Редактор для типа "${selectedNode.type}" отсутствует.`} />
        )}
      </>
    );
  };

  const renderEdgeInspector = () => {
    if (!selectedEdgeInfo?.edge) return null;
    const { edge, isAggregated, aggregatedCount, originalEdgeIds } = selectedEdgeInfo;
    const edgeGeneralIssues = elementIssues.filter(iss => !iss.fieldKey || !iss.fieldKey.startsWith("ports"));
    const portSpecificIssuesForCurrentEditor = elementIssues.filter(iss => 
        iss.fieldKey?.startsWith("ports") && edgeToEditDetails && iss.elementId === edgeToEditDetails.id
    );
    return (
      <>
        <h3 className={styles.inspectorHeader}>Свойства Правила (Ребра)</h3>
        <IssuesPanel issues={edgeGeneralIssues} title="Общие проблемы с правилом:" />
        <InfoBlock label="ID Ребра" value={edge.id} />
        <InfoBlock label="Источник (ID)" value={edge.source} />
        <InfoBlock label="Назначение (ID)" value={edge.target} />

        {isAggregated && aggregatedCount && originalEdgeIds && (
          <div className={`${styles.section} ${styles.aggregatedRuleDetails}`}>
            <span className={styles.sectionTitle}>Агрегированное правило ({aggregatedCount})</span>
            <p>Это правило представляет {aggregatedCount} индивидуальных соединений.</p>
            <p>Выберите соединение для редактирования портов:</p>
            <ul className={styles.aggregatedRuleList}>
              {originalEdgeIds.map((originalId) => (
                <li key={originalId}>
                  <button type="button"
                          onClick={() => {
                            setEditingOriginalEdgeId(originalId);
                          }}
                          className={`${styles.aggregatedRuleButton} ${editingOriginalEdgeId === originalId ? styles.active : ''}`}>
                    Редактировать ID: ...{originalId.slice(-6)}
                  </button>
                </li>
              ))}
            </ul>
            {editingOriginalEdgeId && <hr className={styles.divider} />}
          </div>
        )}

        {edgeToEditDetails && (
           <>
              {(editingOriginalEdgeId || (!isAggregated && edgeToEditDetails)) && (
                <div className={styles.section}>
                  <span className={styles.sectionTitle}>
                    {editingOriginalEdgeId 
                      ? `Редактирование портов для ID: ...${editingOriginalEdgeId.slice(-6)}`
                      : "Порты и Протоколы"}
                  </span>
                </div>
              )}
              <RulePortsEditor
                  ports={(edgeToEditDetails.data?.ports as PortProtocolEntry[] | undefined) || []}
                  onChange={handlePortsChange}
                  issues={portSpecificIssuesForCurrentEditor}
              />
           </>
        )}
        {isAggregated && !editingOriginalEdgeId && !edgeToEditDetails && (
            <p className={styles.infoBlock}>Выберите конкретное соединение выше, чтобы редактировать его порты.</p>
        )}
      </>
    );
  };
  
  return (
     <div className={`inspector-view-root ${styles.inspectorViewBase}`}>
        {selectedNode 
          ? renderNodeInspector() 
          : selectedEdgeInfo?.edge 
            ? renderEdgeInspector() 
            : selectedElementId 
              ? (<>
                  <h3 className={styles.inspectorHeader}>Ошибка</h3>
                  <InfoBlock label="Информация об элементе" 
                             value={`Выбранный элемент с ID ${selectedElementId} не найден или его свойства не могут быть отображены.`} />
                </>)
              : null
        }
        {(selectedNode || selectedEdgeInfo?.edge) && <hr className={styles.divider} />}
     </div>
  );
};

export default InspectorView;
