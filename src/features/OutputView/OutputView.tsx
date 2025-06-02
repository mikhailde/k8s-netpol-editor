import React, { useState, useMemo, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useAppStore, type AppState } from '../../store/store';
import { YamlGenerationService } from '../../services/YamlGenerationService';
import { CustomNodeData, IValidationError, isPodGroupNodeData } from '../../types';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import styles from './OutputView.module.css';

const CopyIcon: React.FC<{className?: string}> = React.memo(({className}) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM6 11a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zM4.586 15.586a2 2 0 012.828 0L10 18.172l2.586-2.586a2 2 0 112.828 2.828L12.828 21a2 2 0 01-2.828 0L7.414 18.414a2 2 0 010-2.828z" />
    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm11 1H6v12h8V4z" clipRule="evenodd" />
  </svg>
));
CopyIcon.displayName = 'CopyIcon';

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

  const { relevantErrors, relevantWarnings } = useMemo(() => {
    if (!selectedElementId) return { relevantErrors: [], relevantWarnings: [] };
    const errors: IValidationError[] = [];
    const warnings: IValidationError[] = [];
    globalValidationErrors.forEach(issue => {
        const isRelatedToSelectedNode = issue.elementId === selectedElementId;
        const selectedNode = nodes.find(n => n.id === selectedElementId);
        let isRelatedToEdgeOfSelectedNode = false;
        if (selectedNode) {
            isRelatedToEdgeOfSelectedNode = edges.some(e => 
                e.id === issue.elementId && (e.source === selectedElementId || e.target === selectedElementId)
            );
        }
        
        if (isRelatedToSelectedNode || isRelatedToEdgeOfSelectedNode) {
            if (issue.severity === 'error') errors.push(issue);
            else if (issue.severity === 'warning') warnings.push(issue);
        }
    });
    return { relevantErrors: errors, relevantWarnings: warnings };
  }, [selectedElementId, globalValidationErrors, nodes, edges]);


  const canGenerate = useMemo(() => {
    if (!selectedElementId) return false;
    const targetNode = nodes.find(n => n.id === selectedElementId);
    if (!targetNode || targetNode.type !== 'podGroup') return false;
    return relevantErrors.length === 0;
  }, [selectedElementId, nodes, relevantErrors]);

  const handleGenerateYaml = useCallback(async (): Promise<void> => {
    if (!selectedElementId) {
        setYamlOutput("# Пожалуйста, выберите PodGroup для генерации YAML.");
        return;
    }
    const targetNodeInfo = nodes.find(n => n.id === selectedElementId);
    if (!targetNodeInfo || targetNodeInfo.type !== 'podGroup') {
        setYamlOutput("# Выбранный элемент не является PodGroup. YAML генерируется только для PodGroup.");
        return;
    }
    if (!canGenerate) {
        const errorMessages = relevantErrors.map(e => `# - ${e.message} (Элемент: ${e.elementId || 'N/A'}${e.fieldKey ? `, Поле: ${e.fieldKey}` : ''})`).join('\n');
        setYamlOutput(`# Генерация YAML невозможна из-за критических ошибок:\n${errorMessages}`);
        return;
    }

    setIsGenerating(true);
    setYamlOutput('');

    const policyObject = yamlService.createNetworkPolicyObject(selectedElementId, nodes, edges);
    let generatedYaml = yamlService.generateYamlString(policyObject);

    if (relevantWarnings.length > 0) {
        const warningMessages = relevantWarnings
            .map(w => `# ПРЕДУПРЕЖДЕНИЕ: ${w.message} (Элемент: ${w.elementId || 'N/A'}${w.fieldKey ? `, Поле: ${w.fieldKey}` : ''})`)
            .join('\n');
        generatedYaml = `${warningMessages}\n# --- YAML СГЕНЕРИРОВАН С УЧЕТОМ ПРЕДУПРЕЖДЕНИЙ ВЫШЕ ---\n${generatedYaml}`;
    } else if (policyObject) {
        const selectedNode = nodes.find(n => n.id === selectedElementId);
        const nodeLabel = selectedNode?.data?.label || selectedNode?.id || 'выбранного элемента';
        generatedYaml = `# YAML сгенерирован успешно для: ${nodeLabel}\n---\n${generatedYaml}`;
    }
    
    setYamlOutput(generatedYaml);
    setIsGenerating(false);
    setCopied(false);
  }, [selectedElementId, canGenerate, relevantErrors, relevantWarnings, yamlService, nodes, edges]);


  const isDisplayingActualYaml = useMemo(() => {
  if (!yamlOutput || isGenerating) return false;

  const nonYamlPlaceholderMessages = [
    "# Пожалуйста, выберите PodGroup для генерации YAML.",
    "# Выбранный элемент не является PodGroup. YAML генерируется только для PodGroup.",
  ];

  const trimmedYamlOutput = yamlOutput.trim();

  if (nonYamlPlaceholderMessages.some(msg => trimmedYamlOutput === msg.trim())) {
    return false;
  }

  return true;
}, [yamlOutput, isGenerating]);

  const contentForSyntaxHighlighter = useMemo(() => {
    if (yamlOutput) return yamlOutput;
    return "";
  }, [yamlOutput]);
  
  const customPlaceholderMessage = useMemo(() => {
    if (yamlOutput) return null;

    if (!selectedElementId) return "Выберите PodGroup на холсте и нажмите \"Сгенерировать YAML\", чтобы увидеть результат здесь.";
    const targetNode = nodes.find(n => n.id === selectedElementId);
    if (!targetNode || targetNode.type !== 'podGroup') return "Выбранный элемент не является PodGroup. YAML генерируется только для PodGroup.";
    return "Нажмите \"Сгенерировать YAML\", чтобы просмотреть результат.";
  }, [yamlOutput, selectedElementId, nodes]);


  const handleCopyToClipboard = useCallback(() => {
    if (yamlOutput && isDisplayingActualYaml) {
      navigator.clipboard.writeText(yamlOutput)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => console.error('Ошибка копирования YAML:', err));
    }
  }, [yamlOutput, isDisplayingActualYaml]);

  const handleDownloadYaml = useCallback(() => {
    if (yamlOutput && isDisplayingActualYaml) {
      const blob = new Blob([yamlOutput], { type: 'application/x-yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const selectedNodeForFilename = nodes.find(n => n.id === selectedElementId);
      let filenamePrefix = 'network-policy';
      if (selectedNodeForFilename) {
          const nodeData = selectedNodeForFilename.data;
          if (nodeData?.label) {
              filenamePrefix = nodeData.label;
          } else if (isPodGroupNodeData(nodeData) && nodeData.metadata?.name) {
              filenamePrefix = nodeData.metadata.name;
          } else if (selectedNodeForFilename.id) {
              filenamePrefix = selectedNodeForFilename.id;
          }
      }
      const filename = `${filenamePrefix.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase()}.yaml`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [yamlOutput, isDisplayingActualYaml, selectedElementId, nodes]);


  const isGenerateButtonDisabled = isGenerating || !selectedElementId || !nodes.find(n => n.id === selectedElementId && n.type === 'podGroup');
  const generateButtonText = isGenerating ? 'Генерация...' : (canGenerate ? 'Сгенерировать YAML' : 'Проверьте ошибки');
  const isActionButtonsDisabled = !yamlOutput || !isDisplayingActualYaml || isGenerating;

  return (
    <div className={`output-view-root ${styles.outputViewBase}`}>
      <h3 className={styles.header}>Сгенерированный YAML</h3>
      
      <div className={styles.controls}>
        <button 
          onClick={handleGenerateYaml} 
          className={styles.generateButton}
          disabled={isGenerateButtonDisabled}
        >
          {generateButtonText}
        </button>
        <button
          onClick={handleDownloadYaml}
          className={styles.downloadButton}
          disabled={isActionButtonsDisabled}
          title="Скачать сгенерированный YAML файл"
        >
          Скачать .yaml
        </button>
      </div>

      <div 
        className={`${styles.outputPreWrapper} ${isDisplayingActualYaml || (yamlOutput && yamlOutput.startsWith("#")) ? styles.hasContent : ''}`}
        aria-live="polite"
        aria-atomic="true"
      >
        {isDisplayingActualYaml && yamlOutput && (
           <button 
             onClick={handleCopyToClipboard} 
             className={styles.copyButtonAbsolute} 
             title="Скопировать YAML в буфер обмена"
             aria-label={copied ? 'YAML скопирован в буфер обмена' : 'Скопировать YAML в буфер обмена'}
           >
             <CopyIcon className={styles.copyIcon} /> {copied ? 'Скопировано!' : 'Копировать'}
           </button>
        )}

        {customPlaceholderMessage && (
          <div className={styles.outputPlaceholderContent}>
            <p>{customPlaceholderMessage}</p>
          </div>
        )}
        
        {contentForSyntaxHighlighter && !customPlaceholderMessage && (
          <SyntaxHighlighter
            language="yaml"
            style={atomDark}
            showLineNumbers={isDisplayingActualYaml}
            wrapLines={true}
            lineNumberStyle={{ opacity: 0.5, userSelect: 'none' }}
            customStyle={{ 
                margin: 0, 
                padding: 'calc(var(--spacing-unit) * 1.5) calc(var(--spacing-unit) * 2)',
            }}
            codeTagProps={{ 
              style: {
                fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace",
                fontSize: "0.9em",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }
            }}
          >
            {contentForSyntaxHighlighter}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

export default OutputView;