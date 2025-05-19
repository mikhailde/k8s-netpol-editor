import { v4 as uuidv4 } from 'uuid';
import { dump } from 'js-yaml';

interface NetworkPolicyMetadata {
  name?: string;
  namespace?: string;
}

interface PodSelector {
  matchLabels?: { [key: string]: string };
}

interface NetworkPolicySpec {
  podSelector: PodSelector;
}

export interface NetworkPolicy {
  apiVersion: string;
  kind: string;
  metadata: NetworkPolicyMetadata;
  spec: NetworkPolicySpec;
}

export class YamlGenerationService {
  constructor() {}

  private generatePolicyName(): string {
    const SuffixLength = 8;
    const uniqueSuffix = uuidv4().substring(0, SuffixLength);
    return `netpol-${uniqueSuffix}`;
  }

  public generateNetworkPolicyObject(): NetworkPolicy {
    const policy: NetworkPolicy = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: this.generatePolicyName(),
      },
      spec: {
        podSelector: {
        }
      }
    };
    return policy;
  }

  public generateYamlString(policyObject?: NetworkPolicy): string {
    const objectToDump = policyObject || this.generateNetworkPolicyObject();
    try {
      return dump(objectToDump, { indent: 2, skipInvalid: true });
    } catch (e) {
      console.error("Error generating YAML:", e);
      return "Error generating YAML. Check console for details.";
    }
  }
}
