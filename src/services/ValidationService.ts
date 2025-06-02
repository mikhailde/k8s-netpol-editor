import { Node, Edge } from 'reactflow';
import {
    IValidationError,
    CustomNodeData,
    isPodGroupNodeData,
    PortProtocolEntry,
    NamespaceNodeData,
} from '../types';

// --- Константы для Валидации ---
const DNS_1123_LABEL_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const MAX_DNS_1123_LABEL_LENGTH = 63;

const K8S_LABEL_PART_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9_.-]{0,61}[a-zA-Z0-9])?$/;
const MAX_K8S_LABEL_PART_LENGTH = 63;


// --- Вспомогательные функции валидации ---
const createValidationError = (
    message: string, elementId: string, fieldKey: string, severity: 'error' | 'warning' = 'error'
): IValidationError => ({ message, elementId, fieldKey, severity });

const validateGenericDns1123 = (
    value: string | undefined, valueName: string, elementName: string, elementId: string, fieldKey: string
): IValidationError | null => {
    if (!value || !value.trim()) {
        return createValidationError(`${valueName} не указан для '${elementName}'.`, elementId, fieldKey);
    }
    if (value.length > MAX_DNS_1123_LABEL_LENGTH) {
        return createValidationError(`${valueName} '${value}' для '${elementName}' слишком длинный (макс. ${MAX_DNS_1123_LABEL_LENGTH} симв.).`, elementId, fieldKey);
    }
    if (!DNS_1123_LABEL_REGEX.test(value)) {
        return createValidationError(`Формат ${valueName.toLowerCase()} '${value}' для '${elementName}' некорректен (DNS-1123).`, elementId, fieldKey);
    }
    return null;
};

const validateK8sLabelPart = (
    value: string, partName: string, labelKeyContext: string, elementName: string, elementId: string, fieldKey: string
): IValidationError | null => {
    if (value.length > MAX_K8S_LABEL_PART_LENGTH) {
        return createValidationError(`${partName} '${value}' ${labelKeyContext} для '${elementName}' слишком длинный (макс. ${MAX_K8S_LABEL_PART_LENGTH} симв.).`, elementId, fieldKey);
    }
    if (!K8S_LABEL_PART_REGEX.test(value)) {
        return createValidationError(`Формат ${partName.toLowerCase()} '${value}' ${labelKeyContext} для '${elementName}' некорректен.`, elementId, fieldKey);
    }
    return null;
};

const validatePortFormat = (portValue: string, portEntryId?: string, edgeId?: string): IValidationError | null => {
    const fieldKey = portEntryId ? `ports[${portEntryId}].port` : 'ports.general';
    const elId = edgeId || 'unknown-edge';

    if (!portValue || !portValue.trim()) return createValidationError("Порт не может быть пустым.", elId, fieldKey);
    if (portValue.toLowerCase() === 'any') return null;

    if (/^\d+$/.test(portValue)) {
        const num = parseInt(portValue, 10);
        if (num >= 1 && num <= 65535) return null;
        return createValidationError(`Номер порта '${portValue}' должен быть 1-65535.`, elId, fieldKey);
    }
    // Kubernetes IANA Service Name (RFC 6335, section 5.1) - stricter than DNS label.
    // For simplicity and per review, using DNS-1123 for named ports up to 63 chars.
    if (portValue.length > MAX_DNS_1123_LABEL_LENGTH || !DNS_1123_LABEL_REGEX.test(portValue)) {
      return createValidationError(`Имя порта '${portValue}' должно быть DNS-1123 совместимым (макс. ${MAX_DNS_1123_LABEL_LENGTH} симв.).`, elId, fieldKey);
    }
    if (/^\d+-\d+$/.test(portValue)) {
      return createValidationError(`Диапазоны портов ('${portValue}') не поддерживаются стандартным NetworkPolicy.`, elId, fieldKey, 'warning');
    }
    return null;
};


export class ValidationService {
    public validateAllElements(nodes: Node<CustomNodeData>[], edges: Edge[]): IValidationError[] {
        const errors: IValidationError[] = [];
        const addError = (err: IValidationError | null) => err && errors.push(err);

        nodes.forEach(node => {
            const elId = node.id;
            if (node.type === 'podGroup' && isPodGroupNodeData(node.data)) {
                const pgData = node.data;
                const elName = `PodGroup '${pgData.metadata.name || elId}'`;

                addError(validateGenericDns1123(pgData.metadata.name, "Имя", elName, elId, "metadata.name"));
                addError(validateGenericDns1123(pgData.metadata.namespace, "Namespace", elName, elId, "metadata.namespace"));

                if (!pgData.labels || Object.keys(pgData.labels).length === 0) {
                    errors.push(createValidationError(`Отсутствуют Labels у ${elName}.`, elId, "labels", "warning"));
                } else {
                    for (const key in pgData.labels) {
                        const value = pgData.labels[key];
                        if (!key.trim()) {
                            errors.push(createValidationError(`Ключ метки не может быть пустым у ${elName}.`, elId, `labels."${key}".key`));
                        } else {
                            addError(validateK8sLabelPart(key, "Ключ метки", `для '${key}'`, elName, elId, `labels."${key}".key`));
                        }

                        if (value !== "") {
                            addError(validateK8sLabelPart(value, "Значение метки", `для '${key}'`, elName, elId, `labels."${key}".value`));
                        }
                    }
                }
            } else if (node.type === 'namespace' && node.data) {
                const nsData = node.data as NamespaceNodeData;
                const elName = `Namespace '${nsData.label || elId}'`;
                addError(validateGenericDns1123(nsData.label, "Label", elName, elId, "label"));
            }
        });

        edges.forEach(edge => {
            if (edge.type !== 'customRuleEdge') return;
            const elId = edge.id;
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            if (!sourceNode) errors.push(createValidationError(`Источник правила (ребро ${elId.slice(-6)}) не найден.`, elId, "source"));
            if (!targetNode) errors.push(createValidationError(`Назначение правила (ребро ${elId.slice(-6)}) не найден.`, elId, "target"));
            
            const ports = edge.data?.ports as PortProtocolEntry[] | undefined;
            if (ports && ports.length > 0) {
                ports.forEach(pEntry => {
                    addError(validatePortFormat(pEntry.port, pEntry.id, elId));
                    if ((pEntry.protocol === 'ICMP' || pEntry.protocol === 'ANY') && pEntry.port && pEntry.port.toLowerCase() !== 'any') {
                        errors.push(createValidationError(`Протокол ${pEntry.protocol} (ребро ${elId.slice(-6)}) не должен иметь порт '${pEntry.port}'.`, elId, `ports[${pEntry.id}].port`, 'warning'));
                    }
                });
            }
        });
        return errors;
    }
}