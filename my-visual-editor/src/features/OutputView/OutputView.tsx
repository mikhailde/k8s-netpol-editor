import React, { useState, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { useAppStore } from '../../store/store';
import { YamlGenerationService } from '../../services/YamlGenerationService';
import {
  CustomNodeData,
} from '../../types';
import './OutputView.css';

const OutputView: React.FC = () => {
  const [yamlOutput, setYamlOutput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes as Node<CustomNodeData>[]);
  const edges = useAppStore((state) => state.edges as Edge[]);
  const globalValidationErrors = useAppStore((state) => state.validationErrors);

  const yamlService = useMemo(() => new YamlGenerationService(), []);

  const canGenerate = useMemo(() => {
    if (!selectedElementId) return false;
    const targetNode = nodes.find(n => n.id === selectedElementId);
    if (!targetNode || targetNode.type !== 'podGroup') return false;

    const targetNodeErrors = globalValidationErrors.filter(
        err => err.elementId === selectedElementId && err.severity === 'error'
    );
    if (targetNodeErrors.length > 0) return false;

    const relatedEdgeErrors = globalValidationErrors.filter(err => {
        if (err.severity !== 'error') return false;
        const edge = edges.find(e => e.id === err.elementId);
        return edge && (edge.source === selectedElementId || edge.target === selectedElementId);
    });
    if (relatedEdgeErrors.length > 0) return false;
    
    return true;
  }, [selectedElementId, nodes, edges, globalValidationErrors]);

  const handleGenerateYaml = (): void => {
    if (!selectedElementId) {
        setYamlOutput("# Пожалуйста, выберите PodGroup для генерации.");
        return;
    }
    if (!canGenerate) {
        const relevantErrors = globalValidationErrors
            .filter(err => err.elementId === selectedElementId || edges.some(e => e.id === err.elementId && (e.source === selectedElementId || e.target === selectedElementId)))
            .map(e => `# ${e.severity?.toUpperCase() || 'ERROR'}: ${e.message}`)
            .join('\n');
        setYamlOutput(`# Генерация YAML невозможна. Исправьте следующие проблемы:\n${relevantErrors || '# Неизвестные критические ошибки.'}`);
        return;
    }

    setIsGenerating(true);
    setYamlOutput('');

    const policyObject = yamlService.createNetworkPolicyObject(selectedElementId, nodes, edges);
    let generatedYaml = yamlService.generateYamlString(policyObject);

    const relevantWarnings = globalValidationErrors.filter(issue => {
        if (issue.severity !== 'warning') return false;
        if (issue.elementId === selectedElementId) return true;
        const edge = edges.find(e => e.id === issue.elementId);
        return edge && (edge.source === selectedElementId || edge.target === selectedElementId);
    });

    if (relevantWarnings.length > 0) {
    const warningMessages = relevantWarnings
        .map(w => `# ПРЕДУПРЕЖДЕНИЕ: ${w.message} (Элемент: ${w.elementId || 'N/A'})`)
        .join('\n');
    generatedYaml = `${warningMessages}\n# --- YAML СГЕНЕРИРОВАН С УЧЕТОМ ПРЕДУПРЕЖДЕНИЙ ВЫШЕ ---\n${generatedYaml}`;
    } else if (policyObject) {
        generatedYaml = `# YAML сгенерирован успешно.\n---\n${generatedYaml}`;
    }
    
    setYamlOutput(generatedYaml);
    setIsGenerating(false);
  };

  const placeholderText = 'Выберите PodGroup и нажмите "Сгенерировать YAML", чтобы увидеть результат.';

  return (
    <div className="output-view-container">
      <h3>Сгенерированный YAML</h3>
      <div className="output-view-controls">
        <button 
          onClick={handleGenerateYaml} 
          className="generate-yaml-button"
          disabled={isGenerating || !canGenerate || !selectedElementId}
        >
          {isGenerating ? 'Генерация...' : 'Сгенерировать YAML (для выбранного PodGroup)'}
        </button>
      </div>

      {globalValidationErrors.length > 0 && (
        <div className="validation-errors-panel">
          <h4>Проблемы валидации на холсте:</h4>
          <ul>
            {globalValidationErrors.map((error, index) => (
              <li key={index} style={{ color: error.severity === 'error' ? '#d8000c' : '#D2691E' }}>
                {error.message}
                {error.elementId && ` (Элемент: ${error.elementId.substring(0,15)}${error.elementId.length > 15 ? '...' : ''})`}
                {error.fieldKey && ` (Поле: ${error.fieldKey})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <pre className={`yaml-output-panel ${!yamlOutput && globalValidationErrors.length === 0 ? 'placeholder' : ''}`}>
        {yamlOutput || (globalValidationErrors.length === 0 && placeholderText)}
      </pre>
    </div>
  );
};

export default OutputView;