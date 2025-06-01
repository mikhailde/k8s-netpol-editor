import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { isEqual } from 'lodash';
import { useAppStore, type AppState } from '../../store/store';
import PodGroupPropertiesEditor from './PodGroupPropertiesEditor';
import NamespacePropertiesEditor from './NamespacePropertiesEditor';
import RulePortsEditor from './RulePortsEditor';
import {
  PortProtocolEntry, PodGroupNodeData, isPodGroupNodeData,
  NamespaceNodeData, CustomNodeData, IValidationError,
} from '../../types';
import { Node, Edge } from 'reactflow';
import styles from './InspectorView.module.css';

// --- Вспомогательные компоненты (предполагаем React.memo) ---
const PlaceholderIcon: React.FC<{ className?: string }> = React.memo(({ className }) => (
  <svg className={className || styles.placeholderIcon} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
));
PlaceholderIcon.displayName = 'PlaceholderIcon';

interface InfoBlockProps { label: string; value: React.ReactNode; }
const InfoBlock: React.FC<InfoBlockProps> = React.memo(({ label, value }) => (
  <div className={styles.section}><span className={styles.sectionTitle}>{label}</span><span className={styles.infoBlock}>{value}</span></div>
));
InfoBlock.displayName = 'InfoBlock';

interface IssuesPanelProps { issues: IValidationError[]; title?: string; }
const IssuesPanel: React.FC<IssuesPanelProps> = React.memo(({ issues, title = "Проблемы:" }) => {
  if (!issues?.length) return null;
  return (
    <div className={`${styles.section} ${styles.nodeIssuesPanel}`}>
      <span className={styles.sectionTitle}>{title}</span>
      <ul className={styles.issuesList}>
        {issues.map((iss, i) => (
          <li key={`${iss.elementId||'g'}-${iss.fieldKey||'f'}-${i}`} className={`${styles.issueItem} ${styles[iss.severity||'error']||styles.error}`}>
            {iss.message} {iss.fieldKey && <span className={styles.issueFieldInfo}>({iss.fieldKey})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
});
IssuesPanel.displayName = 'IssuesPanel';

const getEdgeGroupId = (e: Edge): string => `${e.source}-${e.target}-${e.sourceHandle||'n'}-${e.targetHandle||'n'}`;

// --- Основной компонент InspectorView ---
const InspectorView: React.FC = () => {
  const selId = useAppStore(s => s.selectedElementId);
  const nodes = useAppStore(s => s.nodes as Node<CustomNodeData>[]);
  const allEdges = useAppStore(s => s.edges);
  const errors = useAppStore(s => s.validationErrors);
  const updateEdgeData = useAppStore(s => s.updateEdgeData);

  const [editingOriginalEdgeId, setEditingOriginalEdgeId] = useState<string|null>(null);
  const [currentPorts, setCurrentPorts] = useState<PortProtocolEntry[]|undefined>(undefined);

  useEffect(() => { setEditingOriginalEdgeId(null); setCurrentPorts(undefined); }, [selId]);

  const selNode = useMemo(() => nodes.find(n => n.id === selId), [selId, nodes]);

  const selEdgeInfo = useMemo(() => {
    if (!selId) return null;
    const dirSelEdge = allEdges.find(e => e.id === selId);
    if (!dirSelEdge || dirSelEdge.type !== 'customRuleEdge') 
      return dirSelEdge ? { e: dirSelEdge, isAgg: false, ids: [dirSelEdge.id], cnt: 1 } : null;
    const grpId = getEdgeGroupId(dirSelEdge);
    const grp = allEdges.filter(e => e.type === 'customRuleEdge' && getEdgeGroupId(e) === grpId);
    if (grp.length > 1) {
      const sGrp = [...grp].sort((a,b) => a.id.localeCompare(b.id));
      return (dirSelEdge.id === sGrp[0].id) 
        ? { e: dirSelEdge, isAgg: true, cnt: grp.length, ids: sGrp.map(e => e.id) }
        : { e: dirSelEdge, isAgg: false, ids: [dirSelEdge.id], cnt: 1 };
    }
    return { e: dirSelEdge, isAgg: false, ids: [dirSelEdge.id], cnt: 1 };
  }, [selId, allEdges]);
  
  const elIssues = useMemo(() => errors.filter(i => i.elementId === selId), [selId, errors]);

  const edgeToEdit = useMemo(() => {
    if (editingOriginalEdgeId) return allEdges.find(e => e.id === editingOriginalEdgeId);
    return (selEdgeInfo?.e && !selEdgeInfo.isAgg) ? selEdgeInfo.e : null;
  }, [editingOriginalEdgeId, selEdgeInfo, allEdges]);

  useEffect(() => {
    setCurrentPorts(edgeToEdit?.data?.ports as PortProtocolEntry[] | undefined);
  }, [edgeToEdit]);

  const handlePortsChange = useCallback((data: { ports: PortProtocolEntry[]; allUiPortsValid: boolean }) => {
    const { ports: uiPorts, allUiPortsValid } = data;
    setCurrentPorts(uiPorts);
    if (edgeToEdit?.id && allUiPortsValid) {
      const storePorts = (edgeToEdit.data?.ports as PortProtocolEntry[] | undefined) || [];
      if (!isEqual(storePorts, uiPorts)) {
        updateEdgeData(edgeToEdit.id, { ports: uiPorts });
      }
    }
  }, [edgeToEdit, updateEdgeData]);

  if (!selId) return <div className={`${styles.inspectorViewBase} ${styles.placeholder}`}><PlaceholderIcon />Выберите элемент.</div>;

  const renderNodeInsp = () => {
    if (!selNode) return null;
    const genIss = elIssues.filter(i => !i.fieldKey || !i.fieldKey.startsWith("ports"));
    const fldIss = elIssues.filter(i => !!i.fieldKey && !i.fieldKey.startsWith("ports"));
    return (<> <h3 className={styles.inspectorHeader}>Свойства Узла</h3> <IssuesPanel issues={genIss} title="Проблемы:" />
        <InfoBlock label="ID" value={selNode.id} /> <InfoBlock label="Тип" value={selNode.type || 'N/A'} />
        {selNode.type === 'namespace' && selNode.data && <NamespacePropertiesEditor node={selNode as Node<NamespaceNodeData>} nodeIssues={fldIss} />}
        {selNode.type === 'podGroup' && isPodGroupNodeData(selNode.data) && <PodGroupPropertiesEditor node={selNode as Node<PodGroupNodeData>} nodeIssues={fldIss} />}
    </>);
  };

  const renderEdgeInsp = () => {
    if (!selEdgeInfo?.e) return null;
    const { e, isAgg, cnt, ids } = selEdgeInfo;
    const genIss = elIssues.filter(i => !i.fieldKey || !i.fieldKey.startsWith("ports"));
    const portIss = elIssues.filter(i => i.fieldKey?.startsWith("ports") && edgeToEdit && i.elementId === edgeToEdit.id);
    return (<> <h3 className={styles.inspectorHeader}>Свойства Правила</h3> <IssuesPanel issues={genIss} title="Проблемы:" />
        <InfoBlock label="ID" value={e.id.slice(-10)} /> <InfoBlock label="Источник" value={e.source.slice(-10)} /> <InfoBlock label="Цель" value={e.target.slice(-10)} />
        {isAgg && cnt && ids && (<div className={`${styles.section} ${styles.aggregatedRuleDetails}`}>
            <span className={styles.sectionTitle}>Агрегированное ({cnt})</span> <p>Выберите для редактирования портов:</p>
            <ul className={styles.aggregatedRuleList}>{ids.map(id => (<li key={id}><button type="button"
                onClick={()=>setEditingOriginalEdgeId(id)} className={`${styles.aggregatedRuleButton} ${editingOriginalEdgeId===id?styles.active:''}`}>
                ID: ...{id.slice(-6)}</button></li>))}</ul>
            {editingOriginalEdgeId && <hr className={styles.divider}/>}</div>)}
        {edgeToEdit && (<> {(editingOriginalEdgeId || (!isAgg && edgeToEdit)) && (<div className={styles.section}>
            <span className={styles.sectionTitle}>{editingOriginalEdgeId ? `Порты ID: ...${editingOriginalEdgeId.slice(-6)}` : "Порты"}</span></div>)}
            <RulePortsEditor ports={currentPorts || []} onChange={handlePortsChange} issues={portIss} /> </>)}
        {isAgg && !editingOriginalEdgeId && !edgeToEdit && <p className={styles.infoBlock}>Выберите соединение.</p>}
    </>);
  };
  
  return (
     <div className={`inspector-view-root ${styles.inspectorViewBase}`}>
        {selNode ? renderNodeInsp() : (selEdgeInfo?.e ? renderEdgeInsp() : 
            <InfoBlock label="Ошибка" value={`Элемент ID ${selId} не найден.`} />)}
        {(selNode || selEdgeInfo?.e) && <hr className={styles.divider} />}
     </div>
  );
};
export default React.memo(InspectorView);