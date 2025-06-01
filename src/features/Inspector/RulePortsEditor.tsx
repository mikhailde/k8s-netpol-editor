import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PortProtocolEntry, IValidationError } from '../../types';
import styles from '../Inspector/InspectorView.module.css';

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

interface RulePortsEditorProps {
  ports: PortProtocolEntry[];
  onChange: (data: { ports: PortProtocolEntry[]; allUiPortsValid: boolean }) => void;
  issues: IValidationError[];
}

const RulePortsEditor: React.FC<RulePortsEditorProps> = ({ ports = [], onChange, issues }) => {
  const [uiInputErrors, setUiInputErrors] = useState<Record<string, string | null>>({});

  const checkAllUiPortsValidity = useCallback((currentPorts: PortProtocolEntry[], currentUiErrors: Record<string, string | null>): boolean => {
    if (currentPorts.length === 0) return true;
    return currentPorts.every(p => !currentUiErrors[p.id]);
  }, []);
  
  useEffect(() => {
    const newUiErrors: Record<string, string | null> = {};
    let changed = false;
    ports.forEach(entry => {
      const currentError = uiInputErrors[entry.id];
      const newError = uiValidatePort(entry.port);
      if (currentError !== newError) changed = true;
      newUiErrors[entry.id] = newError;
    });
    if (changed || Object.keys(uiInputErrors).length !== Object.keys(newUiErrors).length) {
        setUiInputErrors(newUiErrors);
    }
  }, [ports]);


  const handleChangeWithValidation = useCallback((updatedPorts: PortProtocolEntry[]) => {
    console.log('[RulePortsEditor_DEBUG] handleChangeWithValidation called with ports:', updatedPorts);
    const tempUiErrors: Record<string, string | null> = {};
    updatedPorts.forEach(p => { tempUiErrors[p.id] = uiValidatePort(p.port); });
    const allValid = updatedPorts.every(p => !tempUiErrors[p.id]);
    
    setUiInputErrors(tempUiErrors); 
    
    onChange({ ports: updatedPorts, allUiPortsValid: allValid });
  }, [onChange]);


  const handleAddPortProtocol = useCallback(() => {
    console.log('[RulePortsEditor_DEBUG] handleAddPortProtocol called');
    const newEntry: PortProtocolEntry = { id: uuidv4(), port: '', protocol: 'TCP' };
    const updatedPorts = [...ports, newEntry];
    handleChangeWithValidation(updatedPorts);
  }, [ports, handleChangeWithValidation]);

  const handlePortChange = useCallback((id: string, newPortValue: string) => {
    const updatedPorts = ports.map(entry => entry.id === id ? { ...entry, port: newPortValue } : entry);
    handleChangeWithValidation(updatedPorts);
  }, [ports, handleChangeWithValidation]);

  const handleProtocolChange = useCallback((id: string, newProtocol: PortProtocolEntry['protocol']) => {
    const updatedPorts = ports.map(entry => entry.id === id ? { ...entry, protocol: newProtocol } : entry);
    handleChangeWithValidation(updatedPorts);
  }, [ports, handleChangeWithValidation]);

  const handleRemovePortProtocol = useCallback((id: string) => {
    const updatedPorts = ports.filter(entry => entry.id !== id);
    handleChangeWithValidation(updatedPorts);
  }, [ports, handleChangeWithValidation]);

  const stopPropagation = useCallback((e: React.KeyboardEvent | React.ChangeEvent<HTMLSelectElement>) => e.stopPropagation(), []);
  
  return (
    <div className={styles.rulePortsEditorContainer}>
      {ports.map((entry) => {
        const servicePortError = issues.find(iss => iss.elementId === entry.id || iss.fieldKey === `ports[${entry.id}].port`)?.message;
        const uiPortError = uiInputErrors[entry.id];
        const displayPortError = servicePortError || uiPortError;

        return (
          <div key={entry.id} className={styles.portProtocolEntry}>
            <div className={styles.portInputWrapper}>
              <input type="text" placeholder="Порт (80, any, named-port)" value={entry.port}
                     onChange={(e) => handlePortChange(entry.id, e.target.value)}
                     onKeyDown={stopPropagation}
                     className={`${styles.formInput} ${displayPortError ? styles.formInputError : ''}`} />
              {displayPortError && <span className={styles.errorMessage}>{displayPortError}</span>}
            </div>
            <select value={entry.protocol}
                    onChange={(e) => { stopPropagation(e); handleProtocolChange(entry.id, e.target.value as PortProtocolEntry['protocol'])}}
                    className={`${styles.formInput} ${styles.protocolSelect}`}>
              <option value="TCP">TCP</option> <option value="UDP">UDP</option> <option value="SCTP">SCTP</option>
              <option value="ICMP">ICMP</option> <option value="ANY">ANY</option>
            </select>
            <button type="button" onClick={() => handleRemovePortProtocol(entry.id)}
                    className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
                    title="Удалить порт/протокол">Удалить</button>
          </div>
        );
      })}
      <button type="button" onClick={handleAddPortProtocol} className={`${styles.buttonBase} ${styles.buttonSecondary}`}
              style={{ width: '100%', marginTop: 'var(--spacing-unit)' }}>Добавить порт/протокол</button>
    </div>
  );
};
export default React.memo(RulePortsEditor);