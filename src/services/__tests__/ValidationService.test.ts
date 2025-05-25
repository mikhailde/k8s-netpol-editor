import { ValidationService } from '../ValidationService';
import { NamespaceNodeData, PodGroupNodeData } from '../../types';
import { Node, Edge } from 'reactflow';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateAllElements - NamespaceNode specific validation', () => {
    it('should return no errors for a valid NamespaceNodeData label', () => {
      const namespaceNode: Node<NamespaceNodeData> = {
        id: 'ns1',
        type: 'namespace',
        position: { x: 0, y: 0 },
        data: {
          label: 'my-namespace',
        },
      };
      const errors = validationService.validateAllElements([namespaceNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'ns1');
      expect(nodeErrors).toEqual([]);
    });

    it('should return an error if NamespaceNodeData label is empty', () => {
      const namespaceNode: Node<NamespaceNodeData> = {
        id: 'ns2',
        type: 'namespace',
        position: { x: 0, y: 0 },
        data: {
          label: '',
        },
      };
      const errors = validationService.validateAllElements([namespaceNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'ns2');

      expect(nodeErrors.length).toBe(1);
      expect(nodeErrors[0]).toMatchObject({
        elementId: 'ns2',
        message: expect.stringContaining("Имя (label) не указано для Namespace 'ns2'"),
        severity: 'error',
        fieldKey: 'label',
      });
    });

    it('should return an error if NamespaceNodeData label is invalid (too long)', () => {
      const namespaceNode: Node<NamespaceNodeData> = {
        id: 'ns3',
        type: 'namespace',
        position: { x: 0, y: 0 },
        data: {
          label: 'a'.repeat(64),
        },
      };
      const errors = validationService.validateAllElements([namespaceNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'ns3');
      expect(nodeErrors.length).toBe(1);
      expect(nodeErrors[0]).toMatchObject({
        elementId: 'ns3',
        message: expect.stringContaining("Некорректное имя (label) 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' для Namespace 'ns3'"),
        severity: 'error',
        fieldKey: 'label',
      });
    });

     it('should return an error if NamespaceNodeData label is invalid (invalid characters)', () => {
      const namespaceNode: Node<NamespaceNodeData> = {
        id: 'ns4',
        type: 'namespace',
        position: { x: 0, y: 0 },
        data: {
          label: 'invalid_label!',
        },
      };
      const errors = validationService.validateAllElements([namespaceNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'ns4');
      expect(nodeErrors.length).toBe(1);
      expect(nodeErrors[0]).toMatchObject({
        elementId: 'ns4',
        message: expect.stringContaining("Некорректное имя (label) 'invalid_label!' для Namespace 'ns4'"),
        severity: 'error',
        fieldKey: 'label',
      });
    });
  });

  describe('validateAllElements - PodGroupNode specific validation', () => {
    const basePodGroupData: PodGroupNodeData = {
        label: 'pg',
        metadata: { name: 'pg', namespace: 'default' },
        labels: { app: 'test' },
        policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
    };

    it('should return no errors for a valid PodGroupNodeData', () => {
      const podGroupNode: Node<PodGroupNodeData> = {
        id: 'pg1',
        type: 'podGroup',
        position: { x: 0, y: 0 },
        data: { ...basePodGroupData },
      };
      const errors = validationService.validateAllElements([podGroupNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'pg1');
      expect(nodeErrors).toEqual([]);
    });

    it('should return an error if PodGroupNodeData metadata.namespace is empty', () => {
      const podGroupNode: Node<PodGroupNodeData> = {
        id: 'pg2',
        type: 'podGroup',
        position: { x: 0, y: 0 },
        data: {
          ...basePodGroupData,
          metadata: { ...basePodGroupData.metadata, namespace: '' },
        },
      };
      const errors = validationService.validateAllElements([podGroupNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'pg2');
      expect(nodeErrors.length).toBe(1);
      expect(nodeErrors[0]).toMatchObject({
        elementId: 'pg2',
        message: expect.stringContaining("Namespace не указан для PodGroup"),
        severity: 'error',
        fieldKey: 'metadata.namespace',
      });
    });

    it('should return an error for invalid PodGroupNodeData metadata.namespace (too long)', () => {
      const podGroupNode: Node<PodGroupNodeData> = {
        id: 'pg3',
        type: 'podGroup',
        position: { x: 0, y: 0 },
        data: {
          ...basePodGroupData,
          metadata: { ...basePodGroupData.metadata, namespace: 'a'.repeat(64) },
        },
      };
      const errors = validationService.validateAllElements([podGroupNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'pg3');
      expect(nodeErrors.length).toBe(1);
      expect(nodeErrors[0]).toMatchObject({
        elementId: 'pg3',
        message: expect.stringContaining("Имя Namespace 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' некорректно"),
        severity: 'error',
        fieldKey: 'metadata.namespace',
      });
    });
    
    it('should return a warning if PodGroupNodeData labels are empty', () => {
      const podGroupNode: Node<PodGroupNodeData> = {
        id: 'pg4',
        type: 'podGroup',
        position: { x: 0, y: 0 },
        data: {
          ...basePodGroupData,
          labels: {},
        },
      };
      const errors = validationService.validateAllElements([podGroupNode], []);
      const nodeErrors = errors.filter(err => err.elementId === 'pg4');
      expect(nodeErrors.length).toBe(1);
      expect(nodeErrors[0]).toMatchObject({
        elementId: 'pg4',
        message: expect.stringContaining("Отсутствуют Labels у PodGroup"),
        severity: 'warning',
        fieldKey: 'labels',
      });
    });

    it('should return an error for invalid PodGroupNodeData label key (empty)', () => {
        const podGroupNode: Node<PodGroupNodeData> = {
          id: 'pg5', type: 'podGroup', position: { x:0, y:0},
          data: { ...basePodGroupData, labels: {'': 'value'} },
        };
        const errors = validationService.validateAllElements([podGroupNode], []);
        const nodeErrors = errors.filter(err => err.elementId === 'pg5' && err.fieldKey === 'labels');
        expect(nodeErrors.length).toBe(1);
        expect(nodeErrors[0].message).toContain("Ключ Label пуст");
    });

    it('should return an error for invalid PodGroupNodeData label value (too long)', () => {
        const podGroupNode: Node<PodGroupNodeData> = {
          id: 'pg6', type: 'podGroup', position: { x:0, y:0},
          data: { ...basePodGroupData, labels: {'app': 'v'.repeat(64)} },
        };
        const errors = validationService.validateAllElements([podGroupNode], []);
        const nodeErrors = errors.filter(err => err.elementId === 'pg6' && err.fieldKey === 'labels."app"');
        expect(nodeErrors.length).toBe(1);
        expect(nodeErrors[0].message).toContain("Некорректное значение");
        expect(nodeErrors[0].message).toContain("'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv'");
    });

  });

  describe('validateAllElements - Edge specific validation (ports)', () => {
  const baseSourceNode: Node<PodGroupNodeData> = {
      id: 'source-pg', type: 'podGroup', position: { x: 0, y: 0 },
      data: {
      label: 'source-pg', metadata: { name: 'source-pg', namespace: 'ns1' },
      labels: { app: 'source' }, policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false }
      }
  };
  const baseTargetNode: Node<PodGroupNodeData> = {
      id: 'target-pg', type: 'podGroup', position: { x: 100, y: 0 },
      data: {
      label: 'target-pg', metadata: { name: 'target-pg', namespace: 'ns1' },
      labels: { app: 'target' }, policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false }
      }
  };
  const nodesForEdgeTest = [baseSourceNode, baseTargetNode];

    it('should return no errors for a valid edge with valid ports', () => {
        const edge: Edge = {
        id: 'edge1', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: {
            ports: [{ id: 'p1', port: '80', protocol: 'TCP' }]
        }
        };
        const errors = validationService.validateAllElements(nodesForEdgeTest, [edge]);
        const edgeErrors = errors.filter(err => err.elementId === 'edge1');
        expect(edgeErrors).toEqual([]);
    });

    it('should return an error if port is empty', () => {
        const edge: Edge = {
        id: 'edge2', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: {
            ports: [{ id: 'p2-1', port: '', protocol: 'TCP' }]
        }
        };
        const errors = validationService.validateAllElements(nodesForEdgeTest, [edge]);
        const edgeError = errors.find(err => err.elementId === 'edge2' && err.fieldKey === 'ports[p2-1].port');
        expect(edgeError).toBeDefined();
        expect(edgeError?.message).toContain('Порт не может быть пустым');
        expect(edgeError?.severity).toBe('error');
    });

    it('should return an error for invalid numeric port (out of range)', () => {
        const edge: Edge = {
        id: 'edge3', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: {
            ports: [{ id: 'p3-1', port: '70000', protocol: 'TCP' }]
        }
        };
        const errors = validationService.validateAllElements(nodesForEdgeTest, [edge]);
        const edgeError = errors.find(err => err.elementId === 'edge3' && err.fieldKey === 'ports[p3-1].port');
        expect(edgeError).toBeDefined();
        expect(edgeError?.message).toContain("Номер порта '70000' должен быть числом от 1 до 65535");
        expect(edgeError?.severity).toBe('error');
    });

    it('should return a warning for port range', () => {
        const edge: Edge = {
        id: 'edge4', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: {
            ports: [{ id: 'p4-1', port: '8000-9000', protocol: 'TCP' }]
        }
        };
        const errors = validationService.validateAllElements(nodesForEdgeTest, [edge]);
        const edgeError = errors.find(err => err.elementId === 'edge4' && err.fieldKey === 'ports[p4-1].port');
        expect(edgeError).toBeDefined();
        expect(edgeError?.message).toContain("Диапазоны портов ('8000-9000') не поддерживаются стандартным NetworkPolicy");
        expect(edgeError?.severity).toBe('warning');
    });

    it('should return an error for invalid named port', () => {
        const edge: Edge = {
        id: 'edge5', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: {
            ports: [{ id: 'p5-1', port: 'INVALID-PORT-NAME-THAT-IS-WAY-TOO-LONG-AND-HAS-UPPERCASE-CHARS', protocol: 'TCP' }]
        }
        };
        const errors = validationService.validateAllElements(nodesForEdgeTest, [edge]);
        const edgeError = errors.find(err => err.elementId === 'edge5' && err.fieldKey === 'ports[p5-1].port');
        expect(edgeError).toBeDefined();
        expect(edgeError?.message).toContain("Имя порта 'INVALID-PORT-NAME-THAT-IS-WAY-TOO-LONG-AND-HAS-UPPERCASE-CHARS' некорректно.");
        expect(edgeError?.severity).toBe('error');
    }); 

    it('should return a warning if ICMP/ANY protocol has a specific port number', () => {
        const edge: Edge = {
        id: 'edge6', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: {
            ports: [{ id: 'p6-1', port: '123', protocol: 'ICMP' }]
        }
        };
        const errors = validationService.validateAllElements(nodesForEdgeTest, [edge]);
        const edgeError = errors.find(err => err.elementId === 'edge6' && err.fieldKey === 'ports[p6-1].port' && err.severity === 'warning');
        expect(edgeError).toBeDefined();
        expect(edgeError?.message).toContain("Протокол ICMP");
        expect(edgeError?.message).toContain("не должен иметь порт '123'");
    });

    it('should allow ICMP/ANY protocol with port "any" or empty/null', () => {
        const edge1: Edge = {
        id: 'edge7-1', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: { ports: [{ id: 'p7-1', port: 'any', protocol: 'ICMP' }] }
        };
        const edge2: Edge = {
        id: 'edge7-2', source: 'source-pg', target: 'target-pg', type: 'customRuleEdge',
        data: { ports: [{ id: 'p7-2', port: '', protocol: 'ICMP' }] }
        };

        const errors1 = validationService.validateAllElements(nodesForEdgeTest, [edge1]);
        const icmpWarning1 = errors1.find(err => err.elementId === 'edge7-1' && err.fieldKey === 'ports[p7-1].port' && err.message.includes("не должен иметь порт"));
        expect(icmpWarning1).toBeUndefined();

        const errors2 = validationService.validateAllElements(nodesForEdgeTest, [edge2]);
        const icmpWarning2 = errors2.find(err => err.elementId === 'edge7-2' && err.fieldKey === 'ports[p7-2].port' && err.message.includes("не должен иметь порт"));
        expect(icmpWarning2).toBeUndefined();
        const emptyPortError = errors2.find(err => err.elementId === 'edge7-2' && err.fieldKey === 'ports[p7-2].port' && err.message.includes("Порт не может быть пустым"));
        expect(emptyPortError).toBeDefined();
    });
  });
});