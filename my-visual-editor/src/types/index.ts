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

    typeof d.labels === 'object' && d.labels !== null
  );
}

export interface NamespaceNodeData {
  label?: string;
}
