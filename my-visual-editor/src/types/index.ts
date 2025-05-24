// --- Типы для Валидации ---
export interface IValidationError {
  message: string;
  elementId?: string;
  fieldKey?: string;
  severity?: 'error' | 'warning';
}

// --- Типы для Элементов Холста (UI-специфичные) ---

export interface PortProtocolEntry {
  id: string;
  port: string;
  protocol: 'TCP' | 'UDP' | 'SCTP' | 'ICMP' | 'ANY';
}

export interface PodGroupNodeData {
  label?: string;
  labels: Record<string, string>;
  metadata: {
    name: string;
    namespace: string;
  };
  policyConfig: {
    defaultDenyIngress: boolean;
    defaultDenyEgress: boolean;
  };
}

export interface NamespaceNodeData {
  label?: string;
}

export type CustomNodeData = PodGroupNodeData | NamespaceNodeData;

export function isPodGroupNodeData(data: unknown): data is PodGroupNodeData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const d = data as Partial<PodGroupNodeData>;
  return (
    typeof d.metadata === 'object' && d.metadata !== null &&
    typeof d.metadata.name === 'string' &&
    typeof d.metadata.namespace === 'string' &&
    typeof d.policyConfig === 'object' && d.policyConfig !== null &&
    typeof d.policyConfig.defaultDenyIngress === 'boolean' &&
    typeof d.policyConfig.defaultDenyEgress === 'boolean' &&
    (typeof d.labels === 'object' && d.labels !== null)
  );
}


// --- Типы для Kubernetes NetworkPolicy (соответствуют спецификации K8s) ---

export interface K8sLabelSelector {
  matchLabels?: { [key: string]: string };
}

export interface IPBlock {
  cidr: string;
  except?: string[];
}

export interface NetworkPolicyPeer {
  podSelector?: K8sLabelSelector;
  namespaceSelector?: K8sLabelSelector;
  ipBlock?: IPBlock;
}

export interface NetworkPolicyPort {
  protocol?: 'TCP' | 'UDP' | 'SCTP';
  port?: number | string;
}

export interface NetworkPolicyIngressRule {
  from?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface NetworkPolicyEgressRule {
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export type PolicyType = 'Ingress' | 'Egress';

export interface NetworkPolicySpec {
  podSelector: K8sLabelSelector;
  policyTypes?: PolicyType[];
  ingress?: NetworkPolicyIngressRule[];
  egress?: NetworkPolicyEgressRule[];
}

export interface NetworkPolicyMetadata {
  name: string;
  namespace?: string;
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
}

export interface NetworkPolicy {
  apiVersion: 'networking.k8s.io/v1';
  kind: 'NetworkPolicy';
  metadata: NetworkPolicyMetadata;
  spec: NetworkPolicySpec;
}