import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PortProtocolEntry, IValidationError } from '../../types';
import styles from '../Inspector/InspectorView.module.css';

interface RulePortsEditorProps {
  ports: PortProtocolEntry[];
  onChange: (updatedPorts: PortProtocolEntry[]) => void;
  issues: IValidationError[];
}

const uiValidatePort = (port: string): string | null => {
  if (!port.trim()) return 'Порт не может быть пустым.';
  if (port.toLowerCase() === 'any') return null;
  if (/^\d+$/.test(port)) {
    const num = parseInt(port, 10);
    if (num >= 1 && num <= 65535) return null;
    return 'Порт должен быть числом от 1 до 65535.';
  }
  if (/^\d+-\d+$/.test(port)) { 
    const [startStr, endStr] = port.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (!isNaN(start) && !isNaN(end) && start >= 1 && start <= 65535 && end >= 1 && end <= 65535 && start <= end) {
      return null; 
    }
    return 'Неверный диапазон (1-65535, start <= end).';
  }
  if (/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(port) && port.length <= 63) {
      return null;
  }
  return 'Неверный формат (число, диапазон, имя или "any").';
};


const RulePortsEditor: React.FC<RulePortsEditorProps> = ({ ports = [], onChange, issues }) => {
  const [uiInputErrors, setUiInputErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const initialInputErrors: Record<string, string | null> = {};
    ports.forEach(entry => {
      initialInputErrors[entry.id] = uiValidatePort(entry.port);
    });
    setUiInputErrors(initialInputErrors);
  }, [ports]);

  const handleAddPortProtocol = () => {
    const newEntry: PortProtocolEntry = {
      id: uuidv4(),
      port: '',
      protocol: 'TCP',
    };
    const updatedPorts = [...ports, newEntry];
    setUiInputErrors(prev => ({ ...prev, [newEntry.id]: uiValidatePort('') }));
    onChange(updatedPorts);
  };

  const handlePortChange = (id: string, newPortValue: string) => {
    const updatedPorts = ports.map((entry) =>
      entry.id === id ? { ...entry, port: newPortValue } : entry
    );
    console.log('[RulePortsEditor] handlePortChange, calling onChange with:', JSON.stringify(updatedPorts));
    onChange(updatedPorts);
  };

  const handleProtocolChange = (id: string, newProtocol: PortProtocolEntry['protocol']) => {
    const updatedPorts = ports.map((entry) =>
      entry.id === id ? { ...entry, protocol: newProtocol } : entry
    );
    onChange(updatedPorts);
  };

  const handleRemovePortProtocol = (id: string) => {
    const updatedPorts = ports.filter((entry) => entry.id !== id);
    setUiInputErrors(prevErrors => {
      const newErrors = { ...prevErrors };
      delete newErrors[id];
      return newErrors;
    });
    onChange(updatedPorts);
  };

  const stopPropagation = (e: React.KeyboardEvent | React.ChangeEvent<HTMLSelectElement>) => { 
    e.stopPropagation();
  };
  
  return (
    <div className={styles.rulePortsEditorContainer}>
      {ports.map((entry) => {
        const servicePortError = issues.find(iss => iss.fieldKey === `ports[${entry.id}].port`)?.message;
        const inputPortError = uiInputErrors[entry.id];
        const displayPortError = servicePortError || inputPortError;

        return (
          <div key={entry.id} className={styles.portProtocolEntry}>
            <div className={styles.portInputWrapper}>
              <input
                type="text"
                placeholder="Порт (80, any, named-port)"
                value={entry.port}
                onChange={(e) => handlePortChange(entry.id, e.target.value)}
                onKeyDown={stopPropagation}
                className={`${styles.formInput} ${displayPortError ? styles.formInputError : ''}`}
              />
              {displayPortError && <span className={styles.errorMessage}>{displayPortError}</span>}
            </div>
            <select
              value={entry.protocol}
              onChange={(e) => { stopPropagation(e); handleProtocolChange(entry.id, e.target.value as PortProtocolEntry['protocol'])}}
              className={`${styles.formInput} ${styles.protocolSelect}`}
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="SCTP">SCTP</option>
              <option value="ICMP">ICMP</option>
              <option value="ANY">ANY</option>
            </select>
            {}
            <button
              type="button"
              onClick={() => handleRemovePortProtocol(entry.id)}
              className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
              title="Удалить порт/протокол"
            >
              Удалить
            </button>
          </div>
        );
      })}
      <button 
        type="button"
        onClick={handleAddPortProtocol} 
        className={`${styles.buttonBase} ${styles.buttonSecondary}`}
        style={{ width: '100%', marginTop: 'var(--spacing-unit)' }}
      >
        Добавить порт/протокол
      </button>
    </div>
  );
};

export default RulePortsEditor;
