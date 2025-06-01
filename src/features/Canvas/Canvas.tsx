import React, { useEffect, useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Controls, MiniMap, Background, BackgroundVariant, Edge, Node, Connection,
  useReactFlow, OnNodesChange, OnEdgesChange, XYPosition, OnSelectionChangeParams,
  NodeDragHandler, NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { isEqual } from 'lodash';

import { useAppStore, type AppState } from '../../store/store';
import { PodGroupNodeData, NamespaceNodeData, CustomNodeData } from '../../types';
import CustomNodeNamespace from '../Nodes/CustomNodeNamespace';
import CustomNodePodGroup from '../Nodes/CustomNodePodGroup';
import CustomRuleEdge from '../Edges/CustomRuleEdge';

// --- Константы ---
const NODE_TYPE_NAMESPACE = 'namespace'; const NODE_TYPE_PODGROUP = 'podGroup';
const EDGE_TYPE_CUSTOM_RULE = 'customRuleEdge'; const REACT_FLOW_APP_TYPE = 'application/reactflow';
const nodeTypes = { [NODE_TYPE_NAMESPACE]: CustomNodeNamespace, [NODE_TYPE_PODGROUP]: CustomNodePodGroup };
const edgeTypes = { [EDGE_TYPE_CUSTOM_RULE]: CustomRuleEdge };
const NAMESPACE_PADDING = 30; const MIN_NAMESPACE_WIDTH = 200; const MIN_NAMESPACE_HEIGHT = 120;
const DEFAULT_PODGROUP_WIDTH = 150; const DEFAULT_PODGROUP_HEIGHT = 40;

let dndNodeIdCounter = 0;
const generateDndNodeId = (prefix = 'dndnode') => `${prefix}_${dndNodeIdCounter++}`;
interface NodeRect { x: number; y: number; width: number; height: number; }

// --- Вспомогательные функции ---
const getAggregatedEdges = (iEs: AppState['edges']): AppState['edges'] => {
  const cREs: Edge[]=[]; const oEs: Edge[]=[]; iEs.forEach((e:Edge)=>(e.type===EDGE_TYPE_CUSTOM_RULE?cREs.push(e):oEs.push(e)));
  const eGrps=new Map<string,Edge[]>(); cREs.forEach((e:Edge)=>{const gId=`${e.source}-${e.target}-${e.sourceHandle||'n'}-${e.targetHandle||'n'}`;eGrps.set(gId,(eGrps.get(gId)||[]).concat(e));});
  const pCREs:Edge[]=[];eGrps.forEach((g:Edge[])=>{if(g.length>1){const sG=g.sort((a,b)=>a.id.localeCompare(b.id));const r={...sG[0],data:{...(sG[0].data||{}),isAggregated:true,aggregatedCount:g.length,originalEdgeIds:sG.map(e=>e.id)},label:`(${g.length}) Rules`};pCREs.push(r);sG.slice(1).forEach(eInG=>pCREs.push({...eInG,hidden:true}));}else if(g.length===1){pCREs.push({...g[0],data:{...(g[0].data||{}),isAggregated:false,aggregatedCount:1,originalEdgeIds:[g[0].id]}});}});
  return[...pCREs,...oEs];
};
const calculateChildrenBoundingBox = (children: Node<PodGroupNodeData>[]): NodeRect | null => {
  if(!children.length)return null;let mX=Infinity,mY=Infinity,mAX=-Infinity,mAY=-Infinity,vF=false;
  children.forEach(c=>{if(c.width!=null&&c.height!=null&&c.position!=null){vF=true;mX=Math.min(mX,c.position.x);mY=Math.min(mY,c.position.y);mAX=Math.max(mAX,c.position.x+c.width);mAY=Math.max(mAY,c.position.y+c.height);}});
  if(!vF)return null;const bbox={x:mX,y:mY,width:mAX-mX,height:mAY-mY};return bbox;
};

// --- Основной компонент канвы ---
const CanvasComponent: React.FC = () => {
  const rfWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getNode, setNodes } = useReactFlow<CustomNodeData, Edge>();

  const storeNodes = useAppStore(s=>s.nodes as Node<CustomNodeData>[]);
  const onNodesChange = useAppStore(s=>s.onNodesChange);
  const rawEdges = useAppStore(s=>s.edges);
  const onEdgesChange = useAppStore(s=>s.onEdgesChange);
  const onConnect = useAppStore(s=>s.onConnect);
  const addNode = useAppStore(s=>s.addNode);
  const deleteElements = useAppStore(s=>s.deleteElements);
  const setSelectedElId = useAppStore(s=>s.setSelectedElementId);
  const updateNodeData = useAppStore(s=>s.updateNodeData);
  const updateNodeSizePos = useAppStore(s=>s.updateNodeSizeAndPosition);

  const [procEdges, setProcEdges] = useState<AppState['edges']>([]);
  useEffect(()=>{const nP=getAggregatedEdges(rawEdges);if(!isEqual(procEdges,nP))setProcEdges(nP);},[rawEdges,procEdges]);

  const autoResizeNs = useCallback((namespaceId: string | null | undefined) => {
    if (!namespaceId) return;
    const allNodes = getNodes();
    const nsNode = allNodes.find(n => n.id === namespaceId && n.type === NODE_TYPE_NAMESPACE) as Node<NamespaceNodeData> | undefined;
    if (!nsNode) return;

    const children = allNodes.filter(n => n.parentNode === namespaceId && n.type === NODE_TYPE_PODGROUP) as Node<PodGroupNodeData>[];
    
    const newHasChildren = children.length > 0;
    if (nsNode.data && nsNode.data.hasChildren !== newHasChildren) {
        updateNodeData(namespaceId, { ...nsNode.data, hasChildren: newHasChildren });
    }

    const bbox = calculateChildrenBoundingBox(children);
    const targetW = bbox ? Math.max(MIN_NAMESPACE_WIDTH, bbox.width + NAMESPACE_PADDING * 2) : MIN_NAMESPACE_WIDTH;
    const targetH = bbox ? Math.max(MIN_NAMESPACE_HEIGHT, bbox.height + NAMESPACE_PADDING * 2) : MIN_NAMESPACE_HEIGHT;
    const nsSizeActuallyChanged = (nsNode.width !== targetW || nsNode.height !== targetH);

    if (nsSizeActuallyChanged) {
      updateNodeSizePos(namespaceId, { width: targetW, height: targetH });
    }

    if (bbox && children.length > 0) {
      const dX = NAMESPACE_PADDING - bbox.x;
      const dY = NAMESPACE_PADDING - bbox.y;
      if (Math.abs(dX) > 0.5 || Math.abs(dY) > 0.5 || (nsSizeActuallyChanged && (bbox.x !== NAMESPACE_PADDING || bbox.y !== NAMESPACE_PADDING))) {
        const cChanges: NodeChange[] = children.map(c => ({
          id: c.id, type: 'position',
          position: { x: (c.position?.x || 0) + dX, y: (c.position?.y || 0) + dY },
          dragging: false,
        }));
        if (cChanges.length > 0) onNodesChange(cChanges);
      }
    }
  }, [getNodes, updateNodeSizePos, onNodesChange, updateNodeData]);

  const onPaneClick=useCallback(()=>setSelectedElId(null),[setSelectedElId]);
  const onSelChange=useCallback(({nodes:sN,edges:sE}:OnSelectionChangeParams)=>{(sN.length===1&&sE.length===0)?setSelectedElId(sN[0].id):(sE.length===1&&sN.length===0)?setSelectedElId(sE[0].id):sN.length>0?setSelectedElId(sN[0].id):sE.length>0?setSelectedElId(sE[0].id):setSelectedElId(null);},[setSelectedElId]);
  const onDragOver=useCallback((e:React.DragEvent)=>{e.preventDefault();e.dataTransfer.dropEffect='move';},[]);

  const onDrop=useCallback((e:React.DragEvent)=>{
    e.preventDefault();const type=e.dataTransfer.getData(REACT_FLOW_APP_TYPE);if(!type||!screenToFlowPosition)return;
    const pos=screenToFlowPosition({x:e.clientX,y:e.clientY});let pNInst:Node<NamespaceNodeData>|undefined,pId:string|undefined,rPos={...pos};
    const newId=generateDndNodeId(type),name=`${type.toLowerCase()}-${newId.slice(newId.lastIndexOf('_')+1)}`;let nodeToAdd:Node<CustomNodeData>;
    if(type===NODE_TYPE_PODGROUP){
      pNInst=getNodes().slice().reverse().find((n):n is Node<NamespaceNodeData>=>(n.type===NODE_TYPE_NAMESPACE&&!!n.positionAbsolute&&n.width!=null&&n.height!=null&&pos.x>=n.positionAbsolute.x&&pos.x<=(n.positionAbsolute.x+n.width)&&pos.y>=n.positionAbsolute.y&&pos.y<=(n.positionAbsolute.y+n.height)));
      if(!pNInst){alert("Ошибка: Группа Подов размещается только внутри Неймспейса.");return;}pId=pNInst.id;rPos={x:pos.x-pNInst.positionAbsolute!.x,y:pos.y-pNInst.positionAbsolute!.y};
      const pgD:PodGroupNodeData={label:name,labels:{},metadata:{name,namespace:pNInst?.data?.label||''},policyConfig:{defaultDenyIngress:false,defaultDenyEgress:false}};
      nodeToAdd={id:newId,type,position:rPos,data:pgD,parentNode:pId,width:DEFAULT_PODGROUP_WIDTH,height:DEFAULT_PODGROUP_HEIGHT,zIndex:2000};
    }else if(type===NODE_TYPE_NAMESPACE){const nsD:NamespaceNodeData={label:name};nodeToAdd={id:newId,type,position:rPos,data:nsD,parentNode:pId,width:MIN_NAMESPACE_WIDTH,height:MIN_NAMESPACE_HEIGHT};
    }else{console.error(`[Canvas] Unknown drop type: ${type}`);return;}addNode(nodeToAdd);if(pId)requestAnimationFrame(()=>autoResizeNs(pId));
  },[screenToFlowPosition,getNodes,addNode,autoResizeNs]);

  const onNodeDragStop:NodeDragHandler=useCallback((_ev,draggedN:Node)=>{
    if(draggedN.type!==NODE_TYPE_PODGROUP)return;const pgN=draggedN as Node<PodGroupNodeData>;
    if(pgN.width==null||pgN.height==null||!pgN.positionAbsolute)return;
    const oldPId=pgN.parentNode,nodesNow=getNodes();
    const pgNCenterX=pgN.positionAbsolute.x+pgN.width/2,pgNCenterY=pgN.positionAbsolute.y+pgN.height/2;
    let newPNs:Node<NamespaceNodeData>|undefined;
    for(let i=nodesNow.length-1;i>=0;i--){const n=nodesNow[i];if(n.type===NODE_TYPE_NAMESPACE&&n.id!==pgN.id&&!!n.positionAbsolute&&n.width!=null&&n.height!=null&&(pgNCenterX>=n.positionAbsolute.x&&pgNCenterX<=(n.positionAbsolute.x+n.width)&&pgNCenterY>=n.positionAbsolute.y&&pgNCenterY<=(n.positionAbsolute.y+n.height))){newPNs=n as Node<NamespaceNodeData>;break;}}
    const newPId=newPNs?.id||undefined,newNsName=newPNs?.data?.label||'';let newPos:XYPosition;
    if(newPNs&&newPNs.positionAbsolute&&pgN.positionAbsolute){newPos={x:pgN.positionAbsolute.x-newPNs.positionAbsolute.x,y:pgN.positionAbsolute.y-newPNs.positionAbsolute.y};}
    else{newPos=pgN.positionAbsolute?{...pgN.positionAbsolute}:{...pgN.position};}
    
    const finalNodes = nodesNow.map(n=>(n.id===draggedN.id?{...n,parentNode:newPId,position:newPos,zIndex:newPId?2000:500,data:{...(n.data as PodGroupNodeData),metadata:{...((n.data as PodGroupNodeData).metadata||{name:(n.data as PodGroupNodeData).label||'',namespace:''}),namespace:newNsName}}}:n.type === NODE_TYPE_NAMESPACE ? { ...n, zIndex: 0 } : n));
    setNodes(finalNodes as Node<CustomNodeData>[]);
    
    if(oldPId&&oldPId!==newPId)requestAnimationFrame(()=>autoResizeNs(oldPId));
    if(newPId)requestAnimationFrame(() => {
        const nodesAfterSetNodes = getNodes();
        const finalPgNodeState = nodesAfterSetNodes.find(n => n.id === draggedN.id);
        console.log(`[DRAG_STOP_AFTER_SETNODES_RAF] PodGroup ${draggedN.id} state: parent=${finalPgNodeState?.parentNode}, pos=${JSON.stringify(finalPgNodeState?.position)}, absPos=${JSON.stringify(finalPgNodeState?.positionAbsolute)}`);
        
        if(oldPId&&oldPId!==newPId) autoResizeNs(oldPId);
        if(newPId) autoResizeNs(newPId);
    });
  },[getNodes,setNodes,updateNodeData,autoResizeNs]);

  useEffect(()=>{const onDocKeyDown=(e:KeyboardEvent)=>{const sId=useAppStore.getState().selectedElementId;if(!sId||(e.key!=='Delete'&&e.key!=='Backspace'))return;if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName.toUpperCase()))return;e.preventDefault();
    const nToDel=getNode(sId);if(nToDel){const pIdToR=nToDel.parentNode,typeDel=nToDel.type;deleteElements({nodes:[nToDel]});if(typeDel===NODE_TYPE_PODGROUP&&pIdToR)requestAnimationFrame(()=>autoResizeNs(pIdToR));}
    else{const eInS=rawEdges.find((ed:Edge)=>ed.id===sId);if(eInS){const rAE=procEdges.find((pe:Edge)=>pe.id===eInS.id&&pe.data?.isAggregated&&!pe.hidden&&Array.isArray(pe.data.originalEdgeIds));if(rAE)deleteElements({edges:rawEdges.filter((ed:Edge)=>(rAE.data!.originalEdgeIds as string[]).includes(ed.id))});else deleteElements({edges:[eInS]});}}};
    document.addEventListener('keydown',onDocKeyDown);return()=>document.removeEventListener('keydown',onDocKeyDown);
  },[deleteElements,getNodes,getNode,rawEdges,procEdges,autoResizeNs]);

  useEffect(() => {
    const problemPodGroupId = "podGroup_1";
    const pgNode = storeNodes.find(n => n.id === problemPodGroupId);
    if (pgNode) {
      console.log(`[PG_STATE_DEBUG] PodGroup ${problemPodGroupId}: parent=${pgNode.parentNode}, pos=${JSON.stringify(pgNode.position)}, hidden=${pgNode.hidden}, W=${pgNode.width}, H=${pgNode.height}, absPos=${JSON.stringify(pgNode.positionAbsolute)}`);
    }
    const domElement = document.querySelector(`[data-id="${problemPodGroupId}"]`);
      if (domElement) {
        const rect = domElement.getBoundingClientRect();
        console.log(`[PG_DOM_DEBUG] ID: ${problemPodGroupId}, DOM Rect: ${JSON.stringify(rect)}, offsetWidth: ${ (domElement as HTMLElement).offsetWidth}`);
        if (rect.width === 0 || rect.height === 0 || (domElement as HTMLElement).offsetWidth === 0) {
            console.error(`[PG_DOM_DEBUG] PodGroup ${problemPodGroupId} HAS ZERO DIMENSIONS IN DOM!`);
        }
        const computedStyle = window.getComputedStyle(domElement);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
            console.error(`[PG_DOM_DEBUG] PodGroup ${problemPodGroupId} IS HIDDEN BY STYLE! display=${computedStyle.display}, visibility=${computedStyle.visibility}, opacity=${computedStyle.opacity}`);
        }

      } else {
        console.warn(`[PG_DOM_DEBUG] PodGroup ${problemPodGroupId} DOM element NOT FOUND!`);
      }

}, [storeNodes]);

  return (<div className="reactflow-wrapper" ref={rfWrapper} style={{width:'100%',height:'100%'}}>
      <ReactFlow nodes={storeNodes} edges={procEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} onPaneClick={onPaneClick} onSelectionChange={onSelChange}
        onNodeDragStop={onNodeDragStop} onDragOver={onDragOver} onDrop={onDrop} deleteKeyCode={null} fitView
        proOptions={{hideAttribution:true}}>
        <Controls/><MiniMap nodeStrokeWidth={3} zoomable pannable/><Background variant={BackgroundVariant.Dots} gap={12} size={1}/>
      </ReactFlow>
    </div>);
};
export default CanvasComponent;