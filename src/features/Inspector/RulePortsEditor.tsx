import React, { useState, useEffect, useCallback, memo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isEqual } from 'lodash';
import { PortProtocolEntry, IValidationError } from '../../types';
import styles from '../Inspector/InspectorView.module.css';

// --- Константы Валидации (специфичные для этого компонента) ---
const MAX_PORT_NAME_LENGTH_UI = 63;
const DNS_1123_REGEX_FOR_NAMED_PORT_UI = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

// --- UI-валидация для поля порта (только для немедленного фидбека в UI) ---
const uiValidatePortEntry = (portValue: string): string | null => {
  if (!portValue.trim()) return 'Порт не может быть пустым.';
  if (portValue.toLowerCase() === 'any') return null;

  if (/^\d+$/.test(portValue)) {
    const num = parseInt(portValue, 10);
    return (num >= 1 && num <= 65535) ? null : 'Порт: 1-65535.';
  }
  
  if (portValue.length <= MAX_PORT_NAME_LENGTH_UI && DNS_1123_REGEX_FOR_NAMED_PORT_UI.test(portValue)) {
    return null;
  }

  return `Неверный формат (число, имя DNS-1123 до ${MAX_PORT_NAME_LENGTH_UI} симв., или "any").`;
};

interface RulePortsEditorProps {
  ports: PortProtocolEntry[];
  onChange: (data: { ports: PortProtocolEntry[]; allUiPortsValid: boolean }) => void;
  issues: IValidationError[];
}

const RulePortsEditor: React.FC<RulePortsEditorProps> = ({ ports = [], onChange, issues }) => {
  const [uiLocalErrors, setUiLocalErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const newUiErrors: Record<string, string | null> = {};
    ports.forEach(entry => {
      newUiErrors[entry.id] = uiValidatePortEntry(entry.port);
    });
    if (!isEqual(uiLocalErrors, newUiErrors)) {
      setUiLocalErrors(newUiErrors);
    }
  }, [ports, uiLocalErrors]);

  const handleChangeAndValidate = useCallback((updatedPorts: PortProtocolEntry[]) => {
    const currentUiErrors: Record<string, string | null> = {};
    updatedPorts.forEach(p => {
      currentUiErrors[p.id] = uiValidatePortEntry(p.port);
    });
    const allCurrentlyUiValid = updatedPorts.every(p => !currentUiErrors[p.id]);
    
    setUiLocalErrors(currentUiErrors); 
    onChange({ ports: updatedPorts, allUiPortsValid: allCurrentlyUiValid });
  }, [onChange]);


  const handleAddPort = useCallback(() => {
    const newEntry: PortProtocolEntry = { id: uuidv4(), port: '', protocol: 'TCP' };
    handleChangeAndValidate([...ports, newEntry]);
  }, [ports, handleChangeAndValidate]);

  const handleRemovePort = useCallback((idToRemove: string) => {
    handleChangeAndValidate(ports.filter(p => p.id !== idToRemove));
  }, [ports, handleChangeAndValidate]);

  const handlePortValueChange = useCallback((id: string, newPortValue: string) => {
    const updatedPorts = ports.map(p => p.id === id ? { ...p, port: newPortValue } : p);
    setUiLocalErrors(prev => ({...prev, [id]: uiValidatePortEntry(newPortValue)}));
    onChange({ 
        ports: updatedPorts, 
        allUiPortsValid: updatedPorts.every(p => !uiValidatePortEntry(p.port) || p.id !== id) && !uiValidatePortEntry(newPortValue)
    });
  }, [ports, onChange]);


  const handleProtocolValueChange = useCallback((id: string, newProtocol: PortProtocolEntry['protocol']) => {
    const updatedPorts = ports.map(p => p.id === id ? { ...p, protocol: newProtocol } : p);
    handleChangeAndValidate(updatedPorts);
  }, [ports, handleChangeAndValidate]);

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    // Комментарий: Останавливает "всплытие" события клавиатуры, чтобы предотвратить
    // срабатывание глобальных обработчиков React Flow (например, удаление узла/ребра),
    // когда пользователь редактирует поля формы.
    e.stopPropagation();
  }, []);
  
  return (
    <div className={styles.rulePortsEditorContainer}>
      {ports.length === 0 && (
        <p className={styles.placeholderText} style={{margin: 'var(--spacing-unit) 0'}}>Порты не определены. Будет разрешен весь трафик.</p>
      )}
      {ports.map((entry, index) => {
        const serviceIssue = issues.find(iss => iss.elementId === entry.id || iss.fieldKey === `ports[${entry.id}].port`);
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
              />
              {displayError && <span id={`port-error-${entry.id}`} className={styles.errorMessage}>{displayError}</span>}
            </div>
            <select
              value={entry.protocol}
              onChange={(e) => { stopPropagation(e); handleProtocolValueChange(entry.id, e.target.value as PortProtocolEntry['protocol'])}}
              onKeyDown={stopPropagation}
              className={`${styles.formInput} ${styles.protocolSelect}`}
              aria-label={`Протокол для порта ${index + 1}`}
            >
              <option value="TCP">TCP</option><option value="UDP">UDP</option>
              <option value="SCTP">SCTP</option><option value="ICMP">ICMP</option>
              <option value="ANY">ANY</option>
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
      })}
      <button
        type="button"
        onClick={handleAddPort}
        className={`${styles.buttonBase} ${styles.buttonSecondary} ${styles.buttonBlockWithMargin}`}
      >
        Добавить порт/протокол
      </button>
    </div>
  );
};

export default memo(RulePortsEditor);