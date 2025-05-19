import React, { useState, useMemo } from 'react';
import './OutputView.css';
import { YamlGenerationService } from '../../services/YamlGenerationService';
import { useAppStore } from '../../store/store';
import { Node, Edge } from 'reactflow';
import { PodGroupNodeData, NamespaceNodeData, isPodGroupNodeData } from '../../types';

const OutputView: React.FC = () => {
  const [yamlOutput, setYamlOutput] = useState<string>('');

  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes as Node<PodGroupNodeData | NamespaceNodeData>[]);
  const edges = useAppStore((state) => state.edges as Edge[]);

  const yamlService = useMemo(() => new YamlGenerationService(), []);

  const handleGenerateYaml = (): void => {
    if (!selectedElementId) {
      setYamlOutput("# Пожалуйста, выберите PodGroup на холсте для генерации NetworkPolicy.");
      return;
    }
    const targetNode = nodes.find(node => node.id === selectedElementId);
    if (!targetNode || targetNode.type !== 'podGroup' || !isPodGroupNodeData(targetNode.data)) {
      setYamlOutput("# Выбранный элемент не является PodGroup или его данные некорректны.\n# NetworkPolicy может быть сгенерирована только для PodGroup.");
      return;
    }
    if (!targetNode.data.metadata.namespace) {
        setYamlOutput(`# Ошибка: У выбранного PodGroup '${targetNode.data.metadata.name || targetNode.id}' не указан неймспейс.\n# Пожалуйста, укажите неймспейс в свойствах PodGroup (Инспектор).`);
        return;
    }
    const policyObject = yamlService.createNetworkPolicyObject(selectedElementId, nodes, edges);
    const generatedYaml = yamlService.generateYamlString(policyObject);
    
    setYamlOutput(generatedYaml);
  };

  return (
    <div className="output-view-container">
      <h3>Сгенерированный YAML</h3>
      <div className="output-view-controls">
        <button onClick={handleGenerateYaml} className="generate-yaml-button">
          Сгенерировать YAML (для выбранного PodGroup)
        </button>
      </div>
      <pre className={`yaml-output-panel ${!yamlOutput ? 'placeholder' : ''}`}>
        {yamlOutput || 'Выберите PodGroup и нажмите "Сгенерировать YAML", чтобы увидеть результат.'}
      </pre>
    </div>
  );
};

export default OutputView;