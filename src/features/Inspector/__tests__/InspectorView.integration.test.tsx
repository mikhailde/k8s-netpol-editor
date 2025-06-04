import { render, screen, act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InspectorView from '../InspectorView';
import { useAppStore, AppState } from '../../../store/store';
import { Node } from 'reactflow';
import { NamespaceNodeData, PodGroupNodeData, CustomNodeData, PortProtocolEntry } from '../../../types';
import styles from '../InspectorView.module.css';
import { IValidationError } from '../../../types';

type AppStoreType = typeof useAppStore;
interface TestableAppStore extends AppStoreType {
  setState: (
    partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>),
    replace?: boolean | undefined
  ) => void;
  getState: () => AppState;
}
const testableAppStore = useAppStore as TestableAppStore;

const initialFullStoreState = testableAppStore.getState();

const setupStore = (overrides: Partial<AppState> = {}) => {
  act(() => {
    testableAppStore.setState(
      {
        ...initialFullStoreState,
        nodes: [],
        edges: [],
        selectedElementId: null,
        validationErrors: [],
        ...overrides,
      },
      true
    );
  });
};

describe('InspectorView Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  const namespaceNodeId = 'ns-test-1';
  const namespaceNode: Node<NamespaceNodeData> = {
    id: namespaceNodeId,
    type: 'namespace',
    position: { x: 0, y: 0 },
    data: { label: 'initial-namespace-label' },
  };

  const podGroupNodeId = 'pg-test-1';
  const podGroupNode: Node<PodGroupNodeData> = {
    id: podGroupNodeId,
    type: 'podGroup',
    position: { x: 0, y: 0 },
    data: {
      label: 'my-test-pg',
      metadata: { name: 'my-test-pg', namespace: 'initial-pg-ns' },
      labels: { app: 'my-app', env: 'test' },
      policyConfig: { defaultDenyIngress: false, defaultDenyEgress: false },
    },
  };

  beforeEach(() => {
    user = userEvent.setup();
    setupStore();
  });

  it('should display placeholder if no element is selected', () => {
    render(<InspectorView />);
    expect(screen.getByText(/Выберите элемент на холсте/i)).toBeInTheDocument();
  });

  describe('NamespacePropertiesEditor', () => {
    beforeEach(() => {
      setupStore({
        nodes: [namespaceNode] as Node<CustomNodeData>[],
        selectedElementId: namespaceNodeId,
      });
      render(<InspectorView />);
    });

    it('should display editor with current label', () => {
      expect(screen.getByRole('heading', { name: /Свойства Узла/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Label:/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue(namespaceNode.data.label!)).toBeInTheDocument();
    });

    it('should update namespace label in store when edited', async () => {
      const newLabel = 'updated-namespace-label';
      const labelInput = screen.getByDisplayValue(namespaceNode.data.label!) as HTMLInputElement;

      await user.clear(labelInput);
      await user.type(labelInput, newLabel);

      expect(labelInput.value).toBe(newLabel);
      await waitFor(() => {
        const updatedNode = testableAppStore.getState().nodes.find(n => n.id === namespaceNodeId);
        expect(updatedNode?.data.label).toBe(newLabel);
      });
    });
  });

  describe('PodGroupPropertiesEditor', () => {
    beforeEach(() => {
      setupStore({
        nodes: [podGroupNode] as Node<CustomNodeData>[],
        selectedElementId: podGroupNodeId,
      });
      render(<InspectorView />);
    });

    it('should display editor with current podGroup data', () => {
      expect(screen.getByDisplayValue(podGroupNode.data.metadata.namespace)).toBeInTheDocument();
      expect(screen.getByText(`${podGroupNode.data.labels.app}`)).toBeInTheDocument();
      expect(screen.getByLabelText(/Default Deny Ingress/i)).not.toBeChecked();
    });

    it('should update podGroup namespace in store', async () => {
      const newNamespace = 'updated-pg-ns';
      const namespaceInput = screen.getByDisplayValue(podGroupNode.data.metadata.namespace) as HTMLInputElement;

      await user.clear(namespaceInput);
      await user.type(namespaceInput, newNamespace);

      expect(namespaceInput.value).toBe(newNamespace);
      await waitFor(() => {
        const pgData = testableAppStore.getState().nodes.find(n => n.id === podGroupNodeId)?.data as PodGroupNodeData;
        expect(pgData?.metadata.namespace).toBe(newNamespace);
      });
    });

    it('should add a new label to podGroup in store', async () => {
      const keyInput = screen.getByPlaceholderText('Label Key');
      const valueInput = screen.getByPlaceholderText('Label Value');
      const addButton = screen.getByRole('button', { name: /Add Label/i });

      await user.type(keyInput, 'role');
      await user.type(valueInput, 'backend');
      await user.click(addButton);

      await waitFor(() => {
        const pgData = testableAppStore.getState().nodes.find(n => n.id === podGroupNodeId)?.data as PodGroupNodeData;
        expect(pgData?.labels).toEqual(expect.objectContaining({ ...podGroupNode.data.labels, 'role': 'backend' }));
      });
      expect(keyInput).toHaveValue('');
      expect(valueInput).toHaveValue('');
    });

    it('should delete a label from podGroup in store', async () => {
      const appLabelValueElement = screen.getByText(podGroupNode.data.labels.app);
      const labelEntryElement = appLabelValueElement.closest(`.${styles.labelEntry}`);
      
      if (!(labelEntryElement instanceof HTMLElement)) {
        throw new Error(`Label entry div not found for '${podGroupNode.data.labels.app}' or it's not an HTMLElement`);
      }
      const labelEntryDiv = labelEntryElement; 
      
      const deleteButton = within(labelEntryDiv).getByRole('button', { name: /delete/i }); 
      
      if (!deleteButton) throw new Error("Delete button for 'app' label not found");
      
      await user.click(deleteButton);

      await waitFor(() => {
        const pgData = testableAppStore.getState().nodes.find(n => n.id === podGroupNodeId)?.data as PodGroupNodeData;
        expect(pgData?.labels).not.toHaveProperty('app');
        expect(pgData?.labels).toHaveProperty('env', podGroupNode.data.labels.env);
      });
    });

    it('should toggle policyConfig defaultDenyIngress in store', async () => {
      const ingressCheckbox = screen.getByLabelText(/Default Deny Ingress/i) as HTMLInputElement;
      const initialCheckedState = podGroupNode.data.policyConfig.defaultDenyIngress;
      expect(ingressCheckbox.checked).toBe(initialCheckedState);

      await user.click(ingressCheckbox);

      await waitFor(() => {
        const pgData = testableAppStore.getState().nodes.find(n => n.id === podGroupNodeId)?.data as PodGroupNodeData;
        expect(pgData?.policyConfig.defaultDenyIngress).toBe(!initialCheckedState);
      });
      expect(ingressCheckbox.checked).toBe(!initialCheckedState);
    });
  });

  describe('RulePortsEditor', () => {
    const sourceNodeForEdge: Node<PodGroupNodeData> = { id: 'source-pg-edge', type: 'podGroup', position: {x:0,y:0}, data: { label: 's', metadata: {name: 's', namespace: 's'}, labels: {}, policyConfig: {defaultDenyEgress: false, defaultDenyIngress: false} }};
    const targetNodeForEdge: Node<PodGroupNodeData> = { id: 'target-pg-edge', type: 'podGroup', position: {x:0,y:0}, data: { label: 't', metadata: {name: 't', namespace: 't'}, labels: {}, policyConfig: {defaultDenyEgress: false, defaultDenyIngress: false} }};

    const edgeWithPorts: AppState['edges'][0] = {
      id: 'edge-ports-1',
      source: sourceNodeForEdge.id,
      target: targetNodeForEdge.id,
      type: 'customRuleEdge',
      data: {
        ports: [
          { id: 'uuid1', port: '80', protocol: 'TCP' },
          { id: 'uuid2', port: '443', protocol: 'TCP' },
        ] as PortProtocolEntry[],
      },
    };

    beforeEach(() => {
        setupStore({
            nodes: [sourceNodeForEdge, targetNodeForEdge] as Node<CustomNodeData>[],
            edges: [edgeWithPorts],
            selectedElementId: edgeWithPorts.id,
        });
        render(<InspectorView />);
    });

    it('should display existing ports for a selected edge', () => {
        expect(screen.getByRole('heading', { name: /Свойства Правила \(Ребра\)/i})).toBeInTheDocument();
        expect(screen.getByDisplayValue('80')).toBeInTheDocument();
        expect(screen.getByDisplayValue('443')).toBeInTheDocument();
        const tcpSelects = screen.getAllByDisplayValue('TCP');
        expect(tcpSelects.length).toBeGreaterThanOrEqual(2);
    });

    it('should add a new port entry and update store', async () => {
        const addButton = screen.getByRole('button', { name: /Добавить порт\/протокол/i });
        await user.click(addButton);

        const portInputs = screen.getAllByPlaceholderText(/Порт \(80, any, named-port\)/i);
        const newPortInput = portInputs[portInputs.length - 1];
        
        const protocolSelects = screen.getAllByRole('combobox');
        const newProtocolSelect = protocolSelects[protocolSelects.length - 1];

        await user.type(newPortInput, '3000');
        await user.selectOptions(newProtocolSelect, 'UDP');
        
        await waitFor(() => {
            const edgeInStore = testableAppStore.getState().edges.find(e => e.id === edgeWithPorts.id);
            const portsInStore = edgeInStore?.data?.ports as PortProtocolEntry[] | undefined;
            expect(portsInStore).toHaveLength(3);
            expect(portsInStore).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ port: '80', protocol: 'TCP' }),
                    expect.objectContaining({ port: '443', protocol: 'TCP' }),
                    expect.objectContaining({ port: '3000', protocol: 'UDP' }),
                ])
            );
        });
    });

    it('should modify an existing port entry and update store', async () => {
        const port80Input = screen.getByDisplayValue('80') as HTMLInputElement;
        await user.clear(port80Input);
        await user.type(port80Input, '8080');

        const protocolSelects = screen.getAllByRole('combobox');
        const firstProtocolSelect = protocolSelects[0];
        await user.selectOptions(firstProtocolSelect, 'UDP');

        await waitFor(() => {
            const edgeInStore = testableAppStore.getState().edges.find(e => e.id === edgeWithPorts.id);
            const portsInStore = edgeInStore?.data?.ports as PortProtocolEntry[] | undefined;
            const modifiedPort = portsInStore?.find(p => p.id === 'uuid1');
            expect(modifiedPort?.port).toBe('8080');
            expect(modifiedPort?.protocol).toBe('UDP');
        });
    });

    it('should delete a port entry and update store', async () => {

      const port80Input = screen.getByDisplayValue('80');
      const portEntryElement = port80Input.closest(`.${styles.portProtocolEntry}`);
      
      if (!(portEntryElement instanceof HTMLElement)) {
        throw new Error("Port entry div for port 80 not found or it's not an HTMLElement");
      }
      const portEntryDiv = portEntryElement;

      const deleteButton = within(portEntryDiv).getByRole('button', { name: /Удалить/i });
      
      await user.click(deleteButton);

      await waitFor(() => {
        const edgeInStore = testableAppStore.getState().edges.find(e => e.id === edgeWithPorts.id);
        const portsInStore = edgeInStore?.data?.ports as PortProtocolEntry[] | undefined;
        expect(portsInStore).toHaveLength(1);
        expect(portsInStore?.[0]).toEqual(expect.objectContaining({ port: '443', protocol: 'TCP' }));
      });
    });
  });
});

describe('IssuesPanel display', () => {
    it('should display validation errors for a selected node from the store', () => {
      const nodeIdWithError = 'node-with-error';
      const nodeData: Node<NamespaceNodeData> = {
        id: nodeIdWithError, type: 'namespace', position: {x:0, y:0}, data: { label: 'Test NS' }
      };
      const validationErrors: IValidationError[] = [
        {
          elementId: nodeIdWithError,
          message: 'Это тестовая ошибка для узла',
          severity: 'error',
          fieldKey: 'label',
        },
        {
          elementId: nodeIdWithError,
          message: 'Это тестовое предупреждение для узла',
          severity: 'warning',
        }
      ];

      setupStore({
        nodes: [nodeData] as Node<CustomNodeData>[],
        selectedElementId: nodeIdWithError,
        validationErrors: validationErrors,
      });

      render(<InspectorView />);

      const issuesPanelTitle = screen.getByText(/Общие проблемы с узлом:|Проблемы с элементом:/i);
      expect(issuesPanelTitle).toBeInTheDocument();
      
      const issuesPanelElement = issuesPanelTitle.parentElement?.querySelector(`.${styles.issuesList}`)?.closest(`.${styles.nodeIssuesPanel}`);

      if (!(issuesPanelElement instanceof HTMLElement)) {
          throw new Error("IssuesPanel (or its specific part) not found or not an HTMLElement");
      }
      const issuesPanel = issuesPanelElement;

      const errorMessageInPanel = within(issuesPanel).getByText('Это тестовая ошибка для узла');
      expect(errorMessageInPanel).toBeInTheDocument();
      expect(errorMessageInPanel.closest('li')).toHaveClass(styles.error);
      expect(within(issuesPanel).getByText(/\(Поле: label\)/i)).toBeInTheDocument();

      const warningMessageInPanel = within(issuesPanel).getByText('Это тестовое предупреждение для узла');
      expect(warningMessageInPanel).toBeInTheDocument();
      expect(warningMessageInPanel.closest('li')).toHaveClass(styles.warning);
    });

    it('should display validation errors for a selected edge from the store', () => {
        const edgeIdWithError = 'edge-with-error';
        const sourceNodeId = 'source-for-edge-error';
        const targetNodeId = 'target-for-edge-error';
        const nodesForEdge: Node<CustomNodeData>[] = [
            { id: sourceNodeId, type: 'podGroup', position: {x:0,y:0}, data: {label:'s', metadata: {name:'s', namespace:'s'}, labels:{}, policyConfig:{defaultDenyEgress:false, defaultDenyIngress: false}} },
            { id: targetNodeId, type: 'podGroup', position: {x:0,y:0}, data: {label:'t', metadata: {name:'t', namespace:'t'}, labels:{}, policyConfig:{defaultDenyEgress:false, defaultDenyIngress: false}} },
        ];
        const edgeWithError: AppState['edges'][0] = {
            id: edgeIdWithError, source: sourceNodeId, target: targetNodeId, type: 'customRuleEdge',
            data: { ports: [{ id: 'p1', port: '', protocol: 'TCP'}]}
        };

        const validationErrors: IValidationError[] = [
            {
                elementId: edgeIdWithError,
                message: 'Порт не может быть пустым для этого правила.',
                severity: 'error',
                fieldKey: 'ports[p1].port',
            },
        ];

        setupStore({
            nodes: nodesForEdge,
            edges: [edgeWithError],
            selectedElementId: edgeIdWithError,
            validationErrors: validationErrors,
        });

        render(<InspectorView />);
        
        const generalEdgeIssuesPanelTitle = screen.queryByText("Общие проблемы с правилом:");
        if (generalEdgeIssuesPanelTitle) {
            const generalIssuesPanelElement = generalEdgeIssuesPanelTitle.parentElement?.querySelector(`.${styles.issuesList}`);
            if (generalIssuesPanelElement instanceof HTMLElement) {
                 const generalIssuesPanel = generalIssuesPanelElement;
                 expect(within(generalIssuesPanel).queryByText('Порт не может быть пустым для этого правила.')).not.toBeInTheDocument();
            } else if (generalIssuesPanelElement !== null) {
                 console.warn(".issuesList found but not an HTMLElement for general edge issues");
            }
        }

        const portErrorMessage = screen.getByText('Порт не может быть пустым для этого правила.');
        expect(portErrorMessage).toBeInTheDocument();
        expect(portErrorMessage).toHaveClass(styles.errorMessage); 
    });

    it('should not display IssuesPanel if no relevant errors for selected element', () => {
      const nodeIdWithoutError = 'node-no-error';
      const nodeData: Node<NamespaceNodeData> = {
        id: nodeIdWithoutError, type: 'namespace', position: {x:0, y:0}, data: { label: 'Test NS No Error' }
      };
      const 다른ЭлементаError: IValidationError[] = [
        { elementId: 'other-node', message: 'Some other error', severity: 'error' }
      ];

      setupStore({
        nodes: [nodeData] as Node<CustomNodeData>[],
        selectedElementId: nodeIdWithoutError,
        validationErrors: 다른ЭлементаError,
      });

      render(<InspectorView />);
      
      expect(screen.queryByText(/Общие проблемы с узлом:|Проблемы с элементом:|Общие проблемы с правилом:/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Это тестовая ошибка для узла')).not.toBeInTheDocument();
    });
  });