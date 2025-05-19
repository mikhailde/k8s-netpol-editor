import React, { useState, useMemo } from 'react';
import './OutputView.css';
import { YamlGenerationService, NetworkPolicy } from '../../services/YamlGenerationService';

const OutputView: React.FC = () => {
  const [yamlOutput, setYamlOutput] = useState<string>('');

  const yamlService = useMemo(() => new YamlGenerationService(), []);

  const handleGenerateYaml = () => {
    const generatedYaml = yamlService.generateYamlString();
    setYamlOutput(generatedYaml);
    console.log("Сгенерированный YAML:\n", generatedYaml);
  };

  return (
    <div className="output-view-container">
      <h3>Сгенерированный YAML</h3>
      <div className="output-view-controls">
        <button onClick={handleGenerateYaml} className="generate-yaml-button">
          Сгенерировать YAML
        </button>
      </div>
      <pre className={`yaml-output-panel ${!yamlOutput ? 'placeholder' : ''}`}>
        {yamlOutput || 'Нажмите "Сгенерировать YAML", чтобы увидеть результат.'}
      </pre>
    </div>
  );
};

export default OutputView;