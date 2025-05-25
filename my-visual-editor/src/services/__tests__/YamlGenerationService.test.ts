import { YamlGenerationService } from '../YamlGenerationService';
import { Node, Edge } from 'reactflow';
import { PodGroupNodeData, NamespaceNodeData, NetworkPolicy, PortProtocolEntry } from '../../types';

describe('YamlGenerationService', () => {
  let yamlService: YamlGenerationService;
  let basePodGroupNode: Node<PodGroupNodeData>;
  let anotherPodGroupNode: Node<PodGroupNodeData>;
  let namespaceNode: Node<NamespaceNodeData>;

  beforeEach(() => {
    yamlService = new YamlGenerationService();

    basePodGroupNode = {
      id: 'pg1',
      type: 'podGroup',
      position: { x: 0, y: 0 },
      data: {
        label: 'frontend',
        metadata: { name: 'frontend', namespace: 'app-ns' },
        labels: { app: 'frontend', tier: 'web' },
        policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
      },
    };

    anotherPodGroupNode = {
      id: 'pg2',
      type: 'podGroup',
      position: { x: 100, y: 0 },
      data: {
        label: 'backend',
        metadata: { name: 'backend', namespace: 'app-ns' },
        labels: { app: 'backend', tier: 'api' },
        policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
      },
    };
    
    namespaceNode = {
      id: 'ns-other',
      type: 'namespace',
      position: {x: 0, y: 100},
      data: { label: 'other-ns' }
    }
  });

  describe('createNetworkPolicyObject', () => {
    it('should return null if targetPodGroupId is not found', () => {
      const policy = yamlService.createNetworkPolicyObject('non-existent-pg', [basePodGroupNode], []);
      expect(policy).toBeNull();
    });

    it('should return null if target node is not a PodGroup', () => {
      const notAPodGroup: Node<NamespaceNodeData> = { id: 'not-pg', type: 'namespace', position: {x:0, y:0}, data: { label: 'some-ns' } };
      const policy = yamlService.createNetworkPolicyObject('not-pg', [notAPodGroup], []);
      expect(policy).toBeNull();
    });
    
    it('should return null if target PodGroup has no namespace', () => {
      const pgNoNs: Node<PodGroupNodeData> = {
        ...basePodGroupNode,
        id: 'pg-no-ns',
        data: { ...basePodGroupNode.data, metadata: { ...basePodGroupNode.data.metadata, namespace: '' } },
      };
      const policy = yamlService.createNetworkPolicyObject('pg-no-ns', [pgNoNs], []);
      expect(policy).toBeNull();
    });

    it('should generate a basic policy for a PodGroup with no rules and no default deny', () => {
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode], []);
      expect(policy).toEqual({
        apiVersion: 'networking.k8s.io/v1',
        kind: 'NetworkPolicy',
        metadata: { name: 'netpol-frontend', namespace: 'app-ns' },
        spec: {
          podSelector: { matchLabels: { app: 'frontend', tier: 'web' } },
        },
      });
    });
    
    it('should include policyTypes Ingress if defaultDenyIngress is true', () => {
      basePodGroupNode.data.policyConfig.defaultDenyIngress = true;
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode], []);
      expect(policy?.spec.policyTypes).toEqual(['Ingress']);
    });

    it('should include policyTypes Egress if defaultDenyEgress is true', () => {
      basePodGroupNode.data.policyConfig.defaultDenyEgress = true;
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode], []);
      expect(policy?.spec.policyTypes).toEqual(['Egress']);
    });
    
    it('should include sorted policyTypes if both defaultDeny flags are true', () => {
      basePodGroupNode.data.policyConfig.defaultDenyIngress = true;
      basePodGroupNode.data.policyConfig.defaultDenyEgress = true;
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode], []);
      expect(policy?.spec.policyTypes).toEqual(['Egress', 'Ingress']);
    });

    it('should generate an ingress rule from another PodGroup in the same namespace', () => {
      const edge: Edge = {
        id: 'e1', source: 'pg2', target: 'pg1', type: 'customRuleEdge',
        data: { ports: [{ id: 'p1', port: '80', protocol: 'TCP' }] }
      };
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode, anotherPodGroupNode], [edge]);
      expect(policy?.spec.ingress).toEqual([
        {
          from: [{ podSelector: { matchLabels: { app: 'backend', tier: 'api' } } }],
          ports: [{ port: 80, protocol: 'TCP' }],
        },
      ]);
      expect(policy?.spec.policyTypes).toContain('Ingress');
    });

    it('should generate an egress rule to another PodGroup in a different namespace', () => {
      anotherPodGroupNode.data.metadata.namespace = 'other-ns';
      const edge: Edge = {
        id: 'e2', source: 'pg1', target: 'pg2', type: 'customRuleEdge',
        data: { ports: [{ id: 'p1', port: '5432', protocol: 'TCP' }] }
      };
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode, anotherPodGroupNode], [edge]);
      expect(policy?.spec.egress).toEqual([
        {
          to: [{
            podSelector: { matchLabels: { app: 'backend', tier: 'api' } },
            namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'other-ns' } }
          }],
          ports: [{ port: 5432, protocol: 'TCP' }],
        },
      ]);
      expect(policy?.spec.policyTypes).toContain('Egress');
    });

    it('should generate an ingress rule from a NamespaceSelector', () => {
      const edge: Edge = {
        id: 'e3', source: 'ns-other', target: 'pg1', type: 'customRuleEdge',
        data: { ports: [{id: 'p1', port: '443', protocol: 'TCP'}]}
      };
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode, namespaceNode], [edge]);
      expect(policy?.spec.ingress).toEqual([
        {
          from: [{ namespaceSelector: { matchLabels: { 'kubernetes.io/metadata.name': 'other-ns' } } }],
          ports: [{ port: 443, protocol: 'TCP'}]
        }
      ]);
    });
    
    it('should handle ports correctly: named port, no protocol, UDP protocol, SCTP protocol, no port', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const edge: Edge = {
        id: 'e-ports', source: 'pg2', target: 'pg1', type: 'customRuleEdge',
        data: {
          ports: [
            { id: 'p1', port: 'http', protocol: 'TCP' },
            { id: 'p2', port: '9090', protocol: 'ANY' },
            { id: 'p3', port: '53', protocol: 'UDP' },
            { id: 'p4', port: 'any', protocol: 'TCP' },
            { id: 'p5', port: 'any', protocol: 'ANY' },
            { id: 'p6', port: '3000', protocol: 'SCTP' },
            { id: 'p7', port: '12345', protocol: 'ICMP' },
            { id: 'p8', port: '_INVALID_NAME', protocol: 'TCP' },
            { id: 'p9', port: '70000', protocol: 'TCP' },
          ] as PortProtocolEntry[]
        }
      };
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode, anotherPodGroupNode], [edge]);
      
      expect(policy?.spec.ingress?.[0].ports).toEqual([
        { port: 'http', protocol: 'TCP' },
        { port: 9090 }, 
        { port: 53, protocol: 'UDP' },
        { protocol: 'TCP' }, 
        { port: 3000, protocol: 'SCTP' },
      ]);

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[YamlGenSvc] Для протокола ICMP указан порт '12345'"));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[YamlGenSvc] Имя порта '_INVALID_NAME' некорректно"));
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[YamlGenSvc] Номер порта '70000' вне допустимого диапазона"));
      consoleWarnSpy.mockRestore();
    });
    
    it('should use empty podSelector if target PodGroup has no labels (with warning in console)', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      basePodGroupNode.data.labels = {};
      const policy = yamlService.createNetworkPolicyObject('pg1', [basePodGroupNode], []);
      
      expect(policy?.spec.podSelector).toEqual({ matchLabels: {} });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[YamlGenSvc] У PodGroup 'frontend' нет лейблов. 'spec.podSelector' будет пустым")
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('generateYamlString', () => {
    it('should generate a YAML string from a policy object', () => {
      const policyObj: NetworkPolicy = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'NetworkPolicy',
        metadata: { name: 'test-pol', namespace: 'test-ns' },
        spec: {
          podSelector: { matchLabels: { app: 'test' } },
          ingress: [{ from: [{ podSelector: { matchLabels: { 'role': 'client' } } }] }],
        },
      };
      const yamlString = yamlService.generateYamlString(policyObj);
      expect(yamlString).toContain('kind: NetworkPolicy');
      expect(yamlString).toContain('name: test-pol');
      expect(yamlString).toContain('namespace: test-ns');
      expect(yamlString).toContain('podSelector:');
      expect(yamlString).toContain('matchLabels:');
      expect(yamlString).toContain('app: test');
      expect(yamlString).toContain('ingress:');
      expect(yamlString).toContain('- from:');
      expect(yamlString).toContain('- podSelector:');
      expect(yamlString).toContain('role: client');
      expect(yamlString).toMatch(/^\s{2}podSelector:/m); 
    });

    it('should return an error message if policy object is null', () => {
      const yamlString = yamlService.generateYamlString(null);
      expect(yamlString).toEqual('# Ошибка: Объект NetworkPolicy не предоставлен для генерации YAML.');
    });

    it('should handle js-yaml dump errors gracefully', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const invalidPolicyObj = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'NetworkPolicy',
            metadata: { name: 'bad-pol', namespace: 'ns-bad' },
            spec: {
                get podSelector() { throw new Error("Force dump error"); },
            }
        };
        const yamlString = yamlService.generateYamlString(invalidPolicyObj as unknown as NetworkPolicy);
        expect(yamlString).toContain('# Ошибка генерации YAML: Force dump error');
        expect(consoleErrorSpy).toHaveBeenCalledWith("[YamlGenSvc] Ошибка при генерации YAML:", expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
  });
});