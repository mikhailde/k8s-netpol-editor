import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isEqual } from 'lodash';
import { PortProtocolEntry, IValidationError } from '../../types';
import styles from '../Inspector/InspectorView.module.css';

// --- Константы Валидации (специфичные для этого компонента UI) ---
const MAX_PORT_NAME_LENGTH_UI = 63;
const DNS_1123_REGEX_FOR_NAMED_PORT_UI = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

// --- UI-валидация для поля порта (только для немедленного фидбека в UI) ---
const uiValidatePortValue = (portValue: string): string | null => {
  const trimmedPort = portValue.trim();
  if (!trimmedPort) return 'Порт не может быть пустым.';
  if (trimmedPort.toLowerCase() === 'any') return null;

  if (/^\d+$/.test(trimmedPort)) {
    const num = parseInt(trimmedPort, 10);
    return (num >= 1 && num <= 65535) ? null : 'Порт должен быть числом от 1 до 65535.';
  }
  
  if (trimmedPort.length <= MAX_PORT_NAME_LENGTH_UI && DNS_1123_REGEX_FOR_NAMED_PORT_UI.test(trimmedPort)) {
    return null;
  }

  if (/^\d+-\d+$/.test(trimmedPort)) { 
    return null; 
  }

  return `Неверный формат: число (1-65535), имя (DNS-1123, до ${MAX_PORT_NAME_LENGTH_UI} симв.) или "any".`;
};

interface RulePortsEditorProps {
  ports: PortProtocolEntry[];
  onChange: (data: { ports: PortProtocolEntry[]; allUiPortsValid: boolean }) => void;
  issues: IValidationError[];
}

const RulePortsEditor: React.FC<RulePortsEditorProps> = ({ ports, onChange, issues }) => {
  const [uiLocalErrors, setUiLocalErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const newUiErrors: Record<string, string | null> = {};
    ports.forEach(entry => {
      const serviceIssueForPort = issues.find(
        iss => iss.elementId === entry.id || iss.fieldKey === `ports[${entry.id}].port`
      );
      if (!serviceIssueForPort) {
        newUiErrors[entry.id] = uiValidatePortValue(entry.port);
      } else {
        newUiErrors[entry.id] = null;
      }
    });
    if (!isEqual(uiLocalErrors, newUiErrors)) {
      setUiLocalErrors(newUiErrors);
    }
  }, [ports, issues, uiLocalErrors]);

  const handleChangeAndTriggerParent = useCallback((updatedPorts: PortProtocolEntry[]) => {
    const currentLocalUiErrors: Record<string, string | null> = {};
    let allCurrentlyUiValid = true;

    updatedPorts.forEach(p => {
      const portError = uiValidatePortValue(p.port);
      currentLocalUiErrors[p.id] = portError;
      if (portError) {
        allCurrentlyUiValid = false;
      }
    });
    
    setUiLocalErrors(currentLocalUiErrors); 
    onChange({ ports: updatedPorts, allUiPortsValid: allCurrentlyUiValid });
  }, [onChange]);


  const handleAddPort = useCallback(() => {
    const newEntry: PortProtocolEntry = { id: uuidv4(), port: '', protocol: 'TCP' };
    handleChangeAndTriggerParent([...ports, newEntry]);
  }, [ports, handleChangeAndTriggerParent]);

  const handleRemovePort = useCallback((idToRemove: string) => {
    handleChangeAndTriggerParent(ports.filter(p => p.id !== idToRemove));
  }, [ports, handleChangeAndTriggerParent]);

  const handlePortValueChange = useCallback((id: string, newPortValue: string) => {
    const updatedPorts = ports.map(p => p.id === id ? { ...p, port: newPortValue } : p);
    
    const newPortError = uiValidatePortValue(newPortValue);
    setUiLocalErrors(prev => ({...prev, [id]: newPortError}));
    
    let allUiCurrentlyValid = !newPortError;
    if (allUiCurrentlyValid) {
      allUiCurrentlyValid = updatedPorts.every(p => p.id === id || !uiValidatePortValue(p.port));
    }
    
    onChange({ 
        ports: updatedPorts, 
        allUiPortsValid: allUiCurrentlyValid
    });
  }, [ports, onChange]);

  const handleProtocolValueChange = useCallback((id: string, newProtocol: PortProtocolEntry['protocol']) => {
    const updatedPorts = ports.map(p => p.id === id ? { ...p, protocol: newProtocol } : p);
    handleChangeAndTriggerParent(updatedPorts);
  }, [ports, handleChangeAndTriggerParent]);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);
  
  const portEntriesToRender = useMemo(() => ports.map((entry, index) => {
    const serviceIssue = issues.find(
      iss => iss.elementId === entry.id || iss.fieldKey === `ports[${entry.id}].port`
    );
    const displayError = serviceIssue?.message || uiLocalErrors[entry.id];

    return (
      <div key={entry.id} className={styles.portProtocolEntry}>
        <div className={styles.portInputWrapper}>
          <input
            type="text"
            placeholder="Порт (80, any, имя)"
            value={entry.port}
            onChange={(e) => handlePortValueChange(entry.id, e.target.value)}
            onKeyDown={stopPropagation}
            className={`${styles.formInput} ${displayError ? styles.formInputError : ''}`}
            aria-label={`Порт ${index + 1}`}
            aria-describedby={displayError ? `port-error-${entry.id}` : undefined}
            aria-invalid={!!displayError}
          />
          {displayError && (
            <span id={`port-error-${entry.id}`} className={styles.errorMessage}>
              {displayError}
            </span>
          )}
        </div>
        <select
          value={entry.protocol}
          onChange={(e) => { 
            stopPropagation(e);
            handleProtocolValueChange(entry.id, e.target.value as PortProtocolEntry['protocol']);
          }}
          onKeyDown={stopPropagation}
          className={`${styles.formInput} ${styles.protocolSelect}`}
          aria-label={`Протокол для порта ${index + 1}`}
        >
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="SCTP">SCTP</option>
          <option value="ICMP">ICMP (порт игнорируется)</option>
          <option value="ANY">ANY (порт и протокол)</option>
        </select>
        <button
          type="button"
          onClick={() => handleRemovePort(entry.id)}
          className={`${styles.buttonBase} ${styles.buttonDanger} ${styles.buttonSmall}`}
          title="Удалить порт/протокол"
          aria-label={`Удалить порт ${index + 1}`}
        >
          Удалить
        </button>
      </div>
    );
  }), [ports, issues, uiLocalErrors, handlePortValueChange, handleProtocolValueChange, handleRemovePort, stopPropagation]);


  return (
    <div className={styles.rulePortsEditorContainer}>
      {ports.length === 0 && (
        <div className={styles.infoMessage}>
          Порты не определены. Правило разрешит весь трафик (все порты, все протоколы) для указанного peer.
        </div>
      )}

      {portEntriesToRender}
      
      <button
        type="button"
        onClick={handleAddPort}
        className={`${styles.buttonBase} ${styles.buttonSecondary} ${styles.buttonSmall} ${styles.buttonBlockWithMargin}`}
      >
        Добавить порт/протокол
      </button>
    </div>
  );
};

export default memo(RulePortsEditor);