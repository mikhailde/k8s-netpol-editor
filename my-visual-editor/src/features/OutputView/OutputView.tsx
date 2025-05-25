import React, { useState, useMemo, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useAppStore, type AppState } from '../../store/store';
import { YamlGenerationService } from '../../services/YamlGenerationService';
import { CustomNodeData, IValidationError } from '../../types';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import styles from './OutputView.module.css';

const CopyIcon: React.FC<{className?: string}> = ({className}) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM6 11a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zM4.586 15.586a2 2 0 012.828 0L10 18.172l2.586-2.586a2 2 0 112.828 2.828L12.828 21a2 2 0 01-2.828 0L7.414 18.414a2 2 0 010-2.828z" />
    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm11 1H6v12h8V4z" clipRule="evenodd" />
  </svg>
);

SyntaxHighlighter.registerLanguage('yaml', yaml);

const OutputView: React.FC = () => {
  const [yamlOutput, setYamlOutput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes as Node<CustomNodeData>[]);
  const edges = useAppStore((state) => state.edges as Edge[]);
  const globalValidationErrors = useAppStore((state: AppState) => state.validationErrors);

  const yamlService = useMemo(() => new YamlGenerationService(), []);

  const relevantIssuesForGeneration = useMemo(() => {
    if (!selectedElementId) return { errors: [], warnings: [] };
    
    const errors: IValidationError[] = [];
    const warnings: IValidationError[] = [];

    globalValidationErrors.forEach(issue => {
        const isRelatedToSelectedNode = issue.elementId === selectedElementId;
        const isRelatedToEdgeOfSelectedNode = edges.some(e => e.id === issue.elementId && (e.source === selectedElementId || e.target === selectedElementId));

        if (isRelatedToSelectedNode || isRelatedToEdgeOfSelectedNode) {
            if (issue.severity === 'error') {
                errors.push(issue);
            } else if (issue.severity === 'warning') {
                warnings.push(issue);
            }
        }
    });
    return { errors, warnings };
  }, [selectedElementId, globalValidationErrors, edges]);

  const canGenerate = useMemo(() => {
    if (!selectedElementId) return false;
    const targetNode = nodes.find(n => n.id === selectedElementId);
    if (!targetNode || targetNode.type !== 'podGroup') return false;
    
    return relevantIssuesForGeneration.errors.length === 0;
  }, [selectedElementId, nodes, relevantIssuesForGeneration]);

  const handleGenerateYaml = useCallback((): void => {
    if (!selectedElementId) {
        setYamlOutput("# Пожалуйста, выберите PodGroup для генерации.");
        return;
    }
    if (!canGenerate) {
        setYamlOutput(`# Генерация YAML невозможна из-за критических ошибок.\n# Проверьте панель "Свойства элемента" для деталей.`);
        return;
    }

    setIsGenerating(true);
    setYamlOutput('');

    const policyObject = yamlService.createNetworkPolicyObject(selectedElementId, nodes, edges);
    let generatedYaml = yamlService.generateYamlString(policyObject);

    if (relevantIssuesForGeneration.warnings.length > 0) {
        const warningMessages = relevantIssuesForGeneration.warnings
            .map(w => `# ПРЕДУПРЕЖДЕНИЕ: ${w.message} (Элемент: ${w.elementId || 'N/A'})`)
            .join('\n');
        generatedYaml = `${warningMessages}\n# --- YAML СГЕНЕРИРОВАН С УЧЕТОМ ПРЕДУПРЕЖДЕНИЙ ВЫШЕ ---\n${generatedYaml}`;
    } else if (policyObject) {
        generatedYaml = `# YAML сгенерирован успешно для PodGroup: ${nodes.find(n=>n.id===selectedElementId)?.data?.label || selectedElementId}\n---\n${generatedYaml}`;
    }
    
    setYamlOutput(generatedYaml);
    setIsGenerating(false);
    setCopied(false);
  }, [selectedElementId, canGenerate, relevantIssuesForGeneration, yamlService, nodes, edges]);

  const handleCopyToClipboard = useCallback(() => {
    if (yamlOutput) {
      navigator.clipboard.writeText(yamlOutput)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Ошибка копирования YAML:', err));
    }
  }, [yamlOutput]);

  const placeholderText = 'Выберите PodGroup на холсте и нажмите "Сгенерировать YAML", чтобы увидеть результат здесь.';
  
  const displayableErrors = useMemo(() => {
    return globalValidationErrors.filter(e => e.severity === 'error');
  }, [globalValidationErrors]);

  const currentOutputContent = useMemo(() => {
    if (yamlOutput) {
      return yamlOutput;
    } else if (displayableErrors.length > 0) {
      return `# Генерация YAML невозможна из-за критических ошибок.\n# Проверьте панель "Свойства элемента" для деталей.`;
    } else {
      return placeholderText;
    }
  }, [yamlOutput, displayableErrors, placeholderText]);

  const isActualYaml = !currentOutputContent.startsWith("#") || currentOutputContent.startsWith("# YAML сгенерирован успешно");

  return (
    <div className={`output-view-root ${styles.outputViewBase}`}>
      <h3 className={styles.header}>Сгенерированный YAML</h3>
      
      <div className={styles.controls}>
        <button 
          onClick={handleGenerateYaml} 
          className={styles.generateButton}
          disabled={isGenerating || !selectedElementId || !nodes.find(n => n.id === selectedElementId && n.type === 'podGroup')}
        >
          {isGenerating ? 'Генерация...' : (canGenerate ? 'Сгенерировать YAML' : 'Проверьте ошибки')}
        </button>
      </div>

      <div className={`${styles.outputPreWrapper} ${!isActualYaml ? styles.placeholderActive : ''}`}>
        {isActualYaml && (
           <button onClick={handleCopyToClipboard} className={styles.copyButtonAbsolute} title="Скопировать YAML">
             <CopyIcon className={styles.copyIcon} /> {copied ? 'Скопировано!' : ''}
           </button>
        )}

        {isActualYaml ? (
          <SyntaxHighlighter
            language="yaml"
            style={atomDark}
            showLineNumbers={Boolean(currentOutputContent && !currentOutputContent.startsWith("#"))}
            wrapLines={true}
            lineNumberStyle={{ opacity: 0.5 }}
            customStyle={{ margin: 0, padding: 'calc(var(--spacing-unit) * 2)'}}
            codeTagProps={{ style: {
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
                fontSize: "0.85em",
                lineHeight: "1.5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all"
            }}}
          >
            {currentOutputContent}
          </SyntaxHighlighter>
        ) : (
          <div className={styles.placeholderTextContainer}>
            {currentOutputContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutputView;
