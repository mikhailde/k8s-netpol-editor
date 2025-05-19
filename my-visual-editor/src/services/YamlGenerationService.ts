import { dump } from 'js-yaml';
import { Node, Edge } from 'reactflow';
import {
  NetworkPolicy,
  PodGroupNodeData,
  NamespaceNodeData,
  isPodGroupNodeData,
  PolicyType,
  NetworkPolicyIngressRule,
  NetworkPolicyEgressRule,
  NetworkPolicyPeer,
  PortProtocolEntry,
  NetworkPolicyPort,
} from '../types';

export class YamlGenerationService {
  constructor() {}

  private transformUiPortToK8sPort(uiPortEntry: PortProtocolEntry): NetworkPolicyPort | null {
    const k8sPort: NetworkPolicyPort = {};

    if (uiPortEntry.protocol && uiPortEntry.protocol !== 'ANY' && uiPortEntry.protocol !== 'ICMP') {
      if (['TCP', 'UDP', 'SCTP'].includes(uiPortEntry.protocol)) {
        k8sPort.protocol = uiPortEntry.protocol as 'TCP' | 'UDP' | 'SCTP';
      } else {
        console.warn(`[YamlGenSvc] Неподдерживаемый протокол '${uiPortEntry.protocol}' для NetworkPolicyPort, будет пропущен.`);
      }
    }

    if (uiPortEntry.port && uiPortEntry.port.toLowerCase() !== 'any') {
      if (/^\d+-\d+$/.test(uiPortEntry.port)) {
        console.warn(`[YamlGenSvc] Диапазоны портов ('${uiPortEntry.port}') не поддерживаются стандартным NetworkPolicyPort. Это правило порта будет пропущено.`);
        return null;
      } else {
        const numericPort = parseInt(uiPortEntry.port, 10);
        if (!isNaN(numericPort)) {
          if (numericPort >= 1 && numericPort <= 65535) {
            k8sPort.port = numericPort;
          } else {
            console.warn(`[YamlGenSvc] Номер порта '${numericPort}' вне допустимого диапазона (1-65535), будет пропущен.`);
             return null;
          }
        } else {
          k8sPort.port = uiPortEntry.port;
        }
      }
    }

    if (Object.keys(k8sPort).length === 0) {
      return null;
    }

    return k8sPort;
  }

  public createNetworkPolicyObject(
    targetPodGroupId: string,
    allNodes: Node<PodGroupNodeData | NamespaceNodeData>[],
    allEdges: Edge[]
  ): NetworkPolicy | null {
    const targetNode = allNodes.find((node) => node.id === targetPodGroupId);

    if (!targetNode) {
      console.error(`[YamlGenSvc] Узел с ID '${targetPodGroupId}' не найден.`);
      return null;
    }

    if (targetNode.type !== 'podGroup' || !isPodGroupNodeData(targetNode.data)) {
      console.error(
        `[YamlGenSvc] Узел '${targetPodGroupId}' не является PodGroup или его данные некорректны.`
      );
      return null;
    }

    const podGroupData: PodGroupNodeData = targetNode.data;

    if (!podGroupData.metadata.namespace) {
      console.error(
        `[YamlGenSvc] У PodGroup '${podGroupData.metadata.name}' отсутствует неймспейс. Политика не может быть создана.`
      );
      return null;
    }
    
    if (Object.keys(podGroupData.labels || {}).length === 0) {
        console.warn(
          `[YamlGenSvc] У PodGroup '${podGroupData.metadata.name}' нет лейблов. 'spec.podSelector' будет пустым (выберет все поды в неймспейсе).`
        );
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
    if (podGroupData.policyConfig.defaultDenyIngress) policyTypesSet.add('Ingress');
    if (podGroupData.policyConfig.defaultDenyEgress) policyTypesSet.add('Egress');

    const createPeer = (
      node: Node<PodGroupNodeData | NamespaceNodeData>,
      targetNamespace: string
    ): NetworkPolicyPeer | null => {
      if (node.type === 'podGroup' && isPodGroupNodeData(node.data)) {
        const peerPodData = node.data;
        const peer: NetworkPolicyPeer = {
          podSelector: { matchLabels: { ...(peerPodData.labels || {}) } },
        };
        if (
          peerPodData.metadata.namespace &&
          peerPodData.metadata.namespace !== targetNamespace
        ) {
          peer.namespaceSelector = {
            matchLabels: { 'kubernetes.io/metadata.name': peerPodData.metadata.namespace },
          };
        }
        return peer;
      } else if (node.type === 'namespace' && node.data?.label) {
        return {
          namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': node.data.label } },
        };
      }
      return null;
    };

    const processPortsForEdge = (edgeData: Edge['data']): NetworkPolicyPort[] | undefined => {
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
    };

    // --- Ingress ---
    const ingressRules: NetworkPolicyIngressRule[] = [];
    const incomingEdges = allEdges.filter(
      (edge) => edge.target === targetPodGroupId && edge.type === 'customRuleEdge'
    );
    for (const edge of incomingEdges) {
      const sourceNode = allNodes.find((node) => node.id === edge.source);
      if (!sourceNode) continue;
      const peer = createPeer(sourceNode, podGroupData.metadata.namespace);
      if (peer) {
        const rule: NetworkPolicyIngressRule = { from: [peer] };
        const k8sPorts = processPortsForEdge(edge.data);
        if (k8sPorts) rule.ports = k8sPorts;
        ingressRules.push(rule);
      }
    }
    if (ingressRules.length > 0) {
      policy.spec.ingress = ingressRules;
      policyTypesSet.add('Ingress');
    }

    // --- Egress ---
    const egressRules: NetworkPolicyEgressRule[] = [];
    const outgoingEdges = allEdges.filter(
      (edge) => edge.source === targetPodGroupId && edge.type === 'customRuleEdge'
    );
    for (const edge of outgoingEdges) {
      const destNode = allNodes.find((node) => node.id === edge.target);
      if (!destNode) continue;
      const peer = createPeer(destNode, podGroupData.metadata.namespace);
      if (peer) {
        const rule: NetworkPolicyEgressRule = { to: [peer] };
        const k8sPorts = processPortsForEdge(edge.data);
        if (k8sPorts) rule.ports = k8sPorts;
        egressRules.push(rule);
      }
    }
    if (egressRules.length > 0) {
      policy.spec.egress = egressRules;
      policyTypesSet.add('Egress');
    }

    if (policyTypesSet.size > 0) {
      policy.spec.policyTypes = Array.from(policyTypesSet).sort();
    }

    return policy;
  }

  public generateYamlString(policyObject: NetworkPolicy | null): string {
    if (!policyObject) {
      return "# Ошибка: Объект NetworkPolicy не предоставлен для генерации YAML.";
    }
    try {
      return dump(policyObject, { indent: 2, skipInvalid: true, sortKeys: false });
    } catch (e) {
      console.error("[YamlGenSvc] Ошибка при генерации YAML:", e);
      const errorMessage = e instanceof Error ? e.message : "Неизвестная ошибка";
      return `# Ошибка генерации YAML: ${errorMessage}\n# Проверьте консоль для деталей.`;
    }
  }
}