import { Node, Edge } from 'reactflow';
import {
    IValidationError,
    PodGroupNodeData,
    CustomNodeData,
    isPodGroupNodeData,
    PortProtocolEntry,
} from '../types';

const validatePortFormat = (portValue: string, portEntryId?: string, edgeId?: string): IValidationError | null => {
    if (!portValue || portValue.trim() === '') {
        return {
            message: `Порт не может быть пустым.`,
            elementId: edgeId,
            fieldKey: portEntryId ? `ports[${portEntryId}].port` : 'ports.port',
            severity: 'error',
        };
    }
    if (portValue.toLowerCase() === 'any') {
        return null;
    }
    if (/^\d+$/.test(portValue)) {
        const num = parseInt(portValue, 10);
        if (num >= 1 && num <= 65535) {
            return null;
        }
        return {
            message: `Номер порта '${portValue}' должен быть числом от 1 до 65535.`,
            elementId: edgeId,
            fieldKey: portEntryId ? `ports[${portEntryId}].port` : 'ports.port',
            severity: 'error',
        };
    }
    if (/^\d+-\d+$/.test(portValue)) {
        return {
            message: `Диапазоны портов ('${portValue}') не поддерживаются стандартным NetworkPolicy.`,
            elementId: edgeId,
            fieldKey: portEntryId ? `ports[${portEntryId}].port` : 'ports.port',
            severity: 'warning',
        };
    }
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(portValue) || portValue.length > 15) {
         if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(portValue) || portValue.length > 63) {
            return {
                message: `Имя порта '${portValue}' некорректно. Должно быть DNS-совместимым именем (макс 63 символа, буквенно-цифровые символы или '-', начинаться и заканчиваться буквенно-цифровым).`,
                elementId: edgeId,
                fieldKey: portEntryId ? `ports[${portEntryId}].port` : 'ports.port',
                severity: 'error',
            };
         }
    }
    return null;
};

export class ValidationService {
    constructor() {}

    public validateForNetworkPolicyGeneration(
        targetPodGroupId: string,
        allNodes: Node<CustomNodeData>[],
        allEdges: Edge[]
    ): IValidationError[] {
        const errors: IValidationError[] = [];
        const targetNode = allNodes.find((node) => node.id === targetPodGroupId);

        if (!targetNode) {
            errors.push({ message: `Целевой PodGroup с ID '${targetPodGroupId}' не найден.`, severity: 'error' });
            return errors;
        }

        if (targetNode.type !== 'podGroup' || !isPodGroupNodeData(targetNode.data)) {
            errors.push({ message: `Элемент с ID '${targetNode.id}' не является PodGroup.`, elementId: targetNode.id, severity: 'error' });
            return errors;
        }

        const podGroupData = targetNode.data as PodGroupNodeData;

        // 1. Проверка Namespace для PodGroup
        if (!podGroupData.metadata.namespace || podGroupData.metadata.namespace.trim() === '') {
            errors.push({
                message: `Namespace не указан для PodGroup '${podGroupData.metadata.name || targetNode.id}'.`,
                elementId: targetNode.id,
                fieldKey: 'metadata.namespace',
                severity: 'error',
            });
        } else {
            if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(podGroupData.metadata.namespace) || podGroupData.metadata.namespace.length > 63) {
                 errors.push({
                    message: `Имя Namespace '${podGroupData.metadata.namespace}' некорректно для PodGroup '${podGroupData.metadata.name || targetNode.id}'.`,
                    elementId: targetNode.id,
                    fieldKey: 'metadata.namespace',
                    severity: 'error',
                });
            }
        }


        // 2. Проверка Labels (PodSelector) для PodGroup
        const k8sLabelKeyRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-_./]{0,61}[a-zA-Z0-9])?$/;
        const k8sLabelValueRegex = /^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$/;

        if (!podGroupData.labels || Object.keys(podGroupData.labels).length === 0) {
            errors.push({
                message: `Отсутствуют Labels у PodGroup '${podGroupData.metadata.name || targetNode.id}'. NetworkPolicy применится ко всем подам в namespace.`,
                elementId: targetNode.id,
                fieldKey: 'labels',
                severity: 'warning',
            });
        } else {
            for (const key in podGroupData.labels) {
                const value = podGroupData.labels[key];
                if (!key.trim()) {
                     errors.push({ message: `Ключ Label не может быть пустым у PodGroup '${podGroupData.metadata.name || targetNode.id}'.`, elementId: targetNode.id, fieldKey: `labels`, severity: 'error'});
                } else if (key.length > 63 || !k8sLabelKeyRegex.test(key)) {
                     errors.push({ message: `Некорректный ключ Label '${key}' у PodGroup '${podGroupData.metadata.name || targetNode.id}'.`, elementId: targetNode.id, fieldKey: `labels."${key}"`, severity: 'error'});
                }
                if (value.length > 63 || !k8sLabelValueRegex.test(value)) {
                     errors.push({ message: `Некорректное значение '${value}' для Label '${key}' у PodGroup '${podGroupData.metadata.name || targetNode.id}'.`, elementId: targetNode.id, fieldKey: `labels."${key}"`, severity: 'error'});
                }
            }
        }

        // 3. Валидация правил Ingress
        const incomingEdges = allEdges.filter(edge => edge.target === targetPodGroupId && edge.type === 'customRuleEdge');

        incomingEdges.forEach(edge => {
            const sourceNode = allNodes.find(node => node.id === edge.source);
            if (!sourceNode) {
                errors.push({ message: `Источник для правила Ingress (ребро ${edge.id.slice(-6)}) не найден.`, elementId: edge.id, severity: 'error' });
                return;
            }

            if (sourceNode.type === 'podGroup' && isPodGroupNodeData(sourceNode.data)) {
                if (!sourceNode.data.labels || Object.keys(sourceNode.data.labels).length === 0) {
                    errors.push({ message: `Источник PodGroup '${sourceNode.data.metadata.name || sourceNode.id}' (ребро ${edge.id.slice(-6)}) не имеет Labels.`, elementId: sourceNode.id, fieldKey: 'labels', severity: 'warning' });
                }
                if (!sourceNode.data.metadata.namespace || sourceNode.data.metadata.namespace.trim() === '') {
                     errors.push({ message: `Источник PodGroup '${sourceNode.data.metadata.name || sourceNode.id}' (ребро ${edge.id.slice(-6)}) не имеет Namespace.`, elementId: sourceNode.id, fieldKey: 'metadata.namespace', severity: 'error' });
                } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(sourceNode.data.metadata.namespace) || sourceNode.data.metadata.namespace.length > 63) {
                     errors.push({ message: `Некорректный Namespace '${sourceNode.data.metadata.namespace}' у источника PodGroup '${sourceNode.data.metadata.name || sourceNode.id}' (ребро ${edge.id.slice(-6)}).`, elementId: sourceNode.id, fieldKey: 'metadata.namespace', severity: 'error' });
                }

            } else if (sourceNode.type === 'namespace' && sourceNode.data) {
                const nsLabel = (sourceNode.data as {label?: string}).label;
                if (!nsLabel || nsLabel.trim() === '') {
                     errors.push({ message: `Источник Namespace (ребро ${edge.id.slice(-6)}) не имеет имени (label).`, elementId: sourceNode.id, fieldKey: 'label', severity: 'error' });
                } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(nsLabel) || nsLabel.length > 63) {
                     errors.push({ message: `Некорректное имя (label) '${nsLabel}' у источника Namespace (ребро ${edge.id.slice(-6)}).`, elementId: sourceNode.id, fieldKey: 'label', severity: 'error' });
                }
            } else {
                 errors.push({ message: `Неподдерживаемый тип источника '${sourceNode.type}' (ребро ${edge.id.slice(-6)}).`, elementId: sourceNode.id, severity: 'error' });
            }

            const ports = edge.data?.ports as PortProtocolEntry[] | undefined;
            if (ports && ports.length > 0) {
                ports.forEach(portEntry => {
                    const portError = validatePortFormat(portEntry.port, portEntry.id, edge.id);
                    if (portError) errors.push(portError);

                    if ((portEntry.protocol === 'ICMP' || portEntry.protocol === 'ANY') && portEntry.port && portEntry.port.toLowerCase() !== 'any') {
                        errors.push({ message: `Протокол ${portEntry.protocol} (ребро ${edge.id.slice(-6)}, порт ${portEntry.id.slice(-6)}) не должен иметь порт '${portEntry.port}'.`, elementId: edge.id, fieldKey: `ports[${portEntry.id}].port`, severity: 'warning' });
                    }
                });
            }
        });

        // 4. Валидация правил Egress
        const outgoingEdges = allEdges.filter(edge => edge.source === targetPodGroupId && edge.type === 'customRuleEdge');

        outgoingEdges.forEach(edge => {
            const destNode = allNodes.find(node => node.id === edge.target);
            if (!destNode) {
                errors.push({ message: `Назначение для правила Egress (ребро ${edge.id.slice(-6)}) не найдено.`, elementId: edge.id, severity: 'error' });
                return;
            }

            if (destNode.type === 'podGroup' && isPodGroupNodeData(destNode.data)) {
                if (!destNode.data.labels || Object.keys(destNode.data.labels).length === 0) {
                    errors.push({ message: `Назначение PodGroup '${destNode.data.metadata.name || destNode.id}' (ребро ${edge.id.slice(-6)}) не имеет Labels.`, elementId: destNode.id, fieldKey: 'labels', severity: 'warning' });
                }
                 if (!destNode.data.metadata.namespace || destNode.data.metadata.namespace.trim() === '') {
                     errors.push({ message: `Назначение PodGroup '${destNode.data.metadata.name || destNode.id}' (ребро ${edge.id.slice(-6)}) не имеет Namespace.`, elementId: destNode.id, fieldKey: 'metadata.namespace', severity: 'error' });
                } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(destNode.data.metadata.namespace) || destNode.data.metadata.namespace.length > 63) {
                     errors.push({ message: `Некорректный Namespace '${destNode.data.metadata.namespace}' у назначения PodGroup '${destNode.data.metadata.name || destNode.id}' (ребро ${edge.id.slice(-6)}).`, elementId: destNode.id, fieldKey: 'metadata.namespace', severity: 'error' });
                }
            } else if (destNode.type === 'namespace' && destNode.data) {
                const nsLabel = (destNode.data as {label?: string}).label;
                if (!nsLabel || nsLabel.trim() === '') {
                     errors.push({ message: `Назначение Namespace (ребро ${edge.id.slice(-6)}) не имеет имени (label).`, elementId: destNode.id, fieldKey: 'label', severity: 'error' });
                } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(nsLabel) || nsLabel.length > 63) {
                     errors.push({ message: `Некорректное имя (label) '${nsLabel}' у назначения Namespace (ребро ${edge.id.slice(-6)}).`, elementId: destNode.id, fieldKey: 'label', severity: 'error' });
                }
            } else {
                 errors.push({ message: `Неподдерживаемый тип назначения '${destNode.type}' (ребро ${edge.id.slice(-6)}).`, elementId: destNode.id, severity: 'error' });
            }

            const ports = edge.data?.ports as PortProtocolEntry[] | undefined;
            if (ports && ports.length > 0) {
                ports.forEach(portEntry => {
                    const portError = validatePortFormat(portEntry.port, portEntry.id, edge.id);
                    if (portError) errors.push(portError);
                    if ((portEntry.protocol === 'ICMP' || portEntry.protocol === 'ANY') && portEntry.port && portEntry.port.toLowerCase() !== 'any') {
                        errors.push({ message: `Протокол ${portEntry.protocol} (ребро ${edge.id.slice(-6)}, порт ${portEntry.id.slice(-6)}) не должен иметь порт '${portEntry.port}'.`, elementId: edge.id, fieldKey: `ports[${portEntry.id}].port`, severity: 'warning' });
                    }
                });
            }
        });

        return errors;
    }

    public validateAllElements(
        nodes: Node<CustomNodeData>[],
        edges: Edge[]
    ): IValidationError[] {
        const allErrors: IValidationError[] = [];

        nodes.forEach(node => {
            if (node.type === 'podGroup' && isPodGroupNodeData(node.data)) {
                const podGroupData = node.data;
                if (!podGroupData.metadata.namespace || podGroupData.metadata.namespace.trim() === '') {
                    allErrors.push({
                        message: `Namespace не указан для PodGroup '${podGroupData.metadata.name || node.id}'.`,
                        elementId: node.id,
                        fieldKey: 'metadata.namespace',
                        severity: 'error',
                    });
                } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(podGroupData.metadata.namespace) || podGroupData.metadata.namespace.length > 63) {
                    allErrors.push({
                        message: `Имя Namespace '${podGroupData.metadata.namespace}' некорректно для PodGroup '${podGroupData.metadata.name || node.id}'.`,
                        elementId: node.id,
                        fieldKey: 'metadata.namespace',
                        severity: 'error',
                    });
                }

                if (!podGroupData.labels || Object.keys(podGroupData.labels).length === 0) {
                    allErrors.push({
                        message: `Отсутствуют Labels у PodGroup '${podGroupData.metadata.name || node.id}'.`,
                        elementId: node.id,
                        fieldKey: 'labels',
                        severity: 'warning',
                    });
                } else {
                    const k8sLabelKeyRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-_./]{0,61}[a-zA-Z0-9])?$/;
                    const k8sLabelValueRegex = /^(([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9])?$/;
                    for (const key in podGroupData.labels) {
                        const value = podGroupData.labels[key];
                        if (!key.trim()) { allErrors.push({ message: `Ключ Label пуст у PodGroup '${podGroupData.metadata.name || node.id}'.`, elementId: node.id, fieldKey: `labels`, severity: 'error'}); }
                        else if (key.length > 63 || !k8sLabelKeyRegex.test(key)) { allErrors.push({ message: `Некорректный ключ Label '${key}' у PodGroup '${podGroupData.metadata.name || node.id}'.`, elementId: node.id, fieldKey: `labels."${key}"`, severity: 'error'});}
                        if (value.length > 63 || !k8sLabelValueRegex.test(value)) { allErrors.push({ message: `Некорректное значение '${value}' для Label '${key}' у PodGroup '${podGroupData.metadata.name || node.id}'.`, elementId: node.id, fieldKey: `labels."${key}"`, severity: 'error'});}
                    }
                }
            } else if (node.type === 'namespace' && node.data) {
                const nsLabel = (node.data as {label?: string}).label;
                 if (!nsLabel || nsLabel.trim() === '') {
                    allErrors.push({
                        message: `Имя (label) не указано для Namespace '${node.id}'.`,
                        elementId: node.id,
                        fieldKey: 'label',
                        severity: 'error',
                    });
                } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(nsLabel) || nsLabel.length > 63) {
                     allErrors.push({
                        message: `Некорректное имя (label) '${nsLabel}' для Namespace '${node.id}'.`,
                        elementId: node.id,
                        fieldKey: 'label',
                        severity: 'error',
                    });
                }
            }
        });

        edges.forEach(edge => {
            if (edge.type === 'customRuleEdge') {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                if (!sourceNode) {
                    allErrors.push({ message: `Источник правила (ребро ${edge.id.slice(-6)}) не найден.`, elementId: edge.id, severity: 'error' });
                }
                if (!targetNode) {
                    allErrors.push({ message: `Назначение правила (ребро ${edge.id.slice(-6)}) не найден.`, elementId: edge.id, severity: 'error' });
                }
                
                const ports = edge.data?.ports as PortProtocolEntry[] | undefined;
                if (ports && ports.length > 0) {
                    ports.forEach(portEntry => {
                        const portError = validatePortFormat(portEntry.port, portEntry.id, edge.id);
                        if (portError) {
                            allErrors.push(portError);
                        }
                        if ((portEntry.protocol === 'ICMP' || portEntry.protocol === 'ANY') && portEntry.port && portEntry.port.toLowerCase() !== 'any') {
                            allErrors.push({ message: `Протокол ${portEntry.protocol} (ребро ${edge.id.slice(-6)}, порт ${portEntry.id.slice(-6)}) не должен иметь порт '${portEntry.port}'.`, elementId: edge.id, fieldKey: `ports[${portEntry.id}].port`, severity: 'warning' });
                        }
                    });
                }
            }
        });
        return allErrors;
    }
}