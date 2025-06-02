import { dump } from 'js-yaml';
import { Node, Edge } from 'reactflow';
import {
  NetworkPolicy,
  isPodGroupNodeData,
  isNamespaceNodeData,
  PolicyType,
  NetworkPolicyIngressRule,
  NetworkPolicyEgressRule,
  NetworkPolicyPeer,
  PortProtocolEntry,
  NetworkPolicyPort,
  CustomNodeData,
} from '../types';

export class YamlGenerationService {

  private transformUiPortToK8sPort(uiPortEntry: PortProtocolEntry): NetworkPolicyPort | null {
    const k8sPort: NetworkPolicyPort = {};

    if (uiPortEntry.protocol === 'ICMP' && uiPortEntry.port && uiPortEntry.port.toLowerCase() !== 'any') {
      return null;
    }
    
    if (uiPortEntry.protocol && uiPortEntry.protocol !== 'ANY') {
      if (['TCP', 'UDP', 'SCTP'].includes(uiPortEntry.protocol)) {
        k8sPort.protocol = uiPortEntry.protocol as 'TCP' | 'UDP' | 'SCTP';
      } else {
        console.warn(`[YamlGenSvc] Неподдерживаемый протокол '${uiPortEntry.protocol}' для NetworkPolicyPort, будет пропущен.`);
      }
    }

    if (uiPortEntry.port && uiPortEntry.port.toLowerCase() !== 'any') {
      if (/^\d+-\d+$/.test(uiPortEntry.port)) {
        return null;
      }
      
      const numericPort = parseInt(uiPortEntry.port, 10);
      if (!isNaN(numericPort)) {
        if (numericPort >= 1 && numericPort <= 65535) {
          k8sPort.port = numericPort;
        } else {
          return null;
        }
      } else {
        if (/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(uiPortEntry.port) && uiPortEntry.port.length <= 63) {
          k8sPort.port = uiPortEntry.port;
        } else {
          return null;
        }
      }
    }

    return (Object.keys(k8sPort).length > 0 || (uiPortEntry.port.toLowerCase() === 'any' && uiPortEntry.protocol === 'ANY')) ? k8sPort : null;
  }

  private createPeer(
    node: Node<CustomNodeData>,
    policyNamespace: string
  ): NetworkPolicyPeer | null {
    if (isPodGroupNodeData(node.data) && node.type === 'podGroup') {
      const peerPodData = node.data;
      const peer: NetworkPolicyPeer = {
        podSelector: { matchLabels: { ...(peerPodData.labels || {}) } },
      };
      if (peerPodData.metadata.namespace && peerPodData.metadata.namespace !== policyNamespace) {
        peer.namespaceSelector = {
          matchLabels: { 'kubernetes.io/metadata.name': peerPodData.metadata.namespace },
        };
      }
      return peer;
    } else if (isNamespaceNodeData(node.data) && node.type === 'namespace' && node.data.label) {
      return {
        namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': node.data.label } },
      };
    }
    return null;
  }

  private processPortsForEdge(edgeData: Edge['data']): NetworkPolicyPort[] | undefined {
    const uiPorts = edgeData?.ports as PortProtocolEntry[] | undefined;
    if (!uiPorts || uiPorts.length === 0) return undefined;

    const k8sPorts: NetworkPolicyPort[] = [];
    for (const uiPort of uiPorts) {
      const k8sPort = this.transformUiPortToK8sPort(uiPort);
      if (k8sPort) {
        k8sPorts.push(k8sPort);
      }
    }
    return k8sPorts.length > 0 ? k8sPorts : undefined; 
  }

  public createNetworkPolicyObject(
    targetPodGroupId: string,
    allNodes: Node<CustomNodeData>[],
    allEdges: Edge[]
  ): NetworkPolicy | null {
    const targetNode = allNodes.find((node) => node.id === targetPodGroupId);

    if (!targetNode || targetNode.type !== 'podGroup' || !isPodGroupNodeData(targetNode.data)) {
      return null;
    }

    const podGroupData = targetNode.data;

    if (!podGroupData.metadata.namespace) {
      return null;
    }
    

    const policyName = `netpol-${podGroupData.metadata.name || targetPodGroupId.slice(-6)}`;

    const policy: NetworkPolicy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: policyName,
        namespace: podGroupData.metadata.namespace,
      },
      spec: {
        podSelector: {
          matchLabels: { ...(podGroupData.labels || {}) },
        },
      },
    };

    const policyTypesSet = new Set<PolicyType>();
    
    // Ingress
    const ingressRules: NetworkPolicyIngressRule[] = [];
    allEdges
      .filter(edge => edge.target === targetPodGroupId && edge.type === 'customRuleEdge')
      .forEach(edge => {
        const sourceNode = allNodes.find(node => node.id === edge.source);
        if (sourceNode) {
          const peer = this.createPeer(sourceNode, podGroupData.metadata.namespace);
          if (peer) {
            const rule: NetworkPolicyIngressRule = { from: [peer] };
            const k8sPorts = this.processPortsForEdge(edge.data);
            if (k8sPorts) rule.ports = k8sPorts;
            ingressRules.push(rule);
          }
        }
      });

    if (ingressRules.length > 0) {
      policy.spec.ingress = ingressRules;
      policyTypesSet.add('Ingress');
    } else if (podGroupData.policyConfig.defaultDenyIngress) {
      policy.spec.ingress = [];
      policyTypesSet.add('Ingress');
    }

    // Egress
    const egressRules: NetworkPolicyEgressRule[] = [];
    allEdges
      .filter(edge => edge.source === targetPodGroupId && edge.type === 'customRuleEdge')
      .forEach(edge => {
        const destNode = allNodes.find(node => node.id === edge.target);
        if (destNode) {
          const peer = this.createPeer(destNode, podGroupData.metadata.namespace);
          if (peer) {
            const rule: NetworkPolicyEgressRule = { to: [peer] };
            const k8sPorts = this.processPortsForEdge(edge.data);
            if (k8sPorts) rule.ports = k8sPorts;
            egressRules.push(rule);
          }
        }
      });

    if (egressRules.length > 0) {
      policy.spec.egress = egressRules;
      policyTypesSet.add('Egress');
    } else if (podGroupData.policyConfig.defaultDenyEgress) {
      policy.spec.egress = [];
      policyTypesSet.add('Egress');
    }

    if (policyTypesSet.size > 0) {
      policy.spec.policyTypes = Array.from(policyTypesSet).sort();
    }
    
    return policy;
  }

  public generateYamlString(policyObject: NetworkPolicy | null): string {
    if (!policyObject) {
      return "# Ошибка: Объект NetworkPolicy не был создан или не предоставлен.";
    }
    try {
      return dump(policyObject, { 
        indent: 2, 
        skipInvalid: true,
        sortKeys: false,
        noRefs: true,
        flowLevel: -1,
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Неизвестная ошибка сериализации";
      return `# Ошибка генерации YAML: ${errorMessage}\n# Проверьте консоль приложения для деталей.`;
    }
  }
}