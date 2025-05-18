import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PortProtocolEntry } from '../../types';
import './RulePortsEditor.css';

interface RulePortsEditorProps {
  ports: PortProtocolEntry[];
  onChange: (updatedPorts: PortProtocolEntry[], isValid: boolean) => void;
}

const validatePort = (port: string): string | null => {
  if (!port.trim()) {
    return 'Порт не может быть пустым.';
  }
  if (port.toLowerCase() === 'any') {
    return null;
  }
  if (/^\d+$/.test(port)) {
    const num = parseInt(port, 10);
    if (num >= 1 && num <= 65535) {
      return null;
    }
    return 'Порт должен быть числом от 1 до 65535.';
  }
  if (/^\d+-\d+$/.test(port)) {
    const [startStr, endStr] = port.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (
      !isNaN(start) && !isNaN(end) &&
      start >= 1 && start <= 65535 &&
      end >= 1 && end <= 65535 &&
      start < end
    ) {
      return null;
    }
    return 'Неверный диапазон портов (1-65535, начало < конца).';
  }
  return 'Неверный формат порта (e.g., 80, 100-200, any).';
};

const RulePortsEditor: React.FC<RulePortsEditorProps> = ({ ports = [], onChange }) => {
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const checkAllPortsValid = (currentPorts: PortProtocolEntry[]): boolean => {
    let allValid = true;
    const newErrors: Record<string, string | null> = {};
    for (const entry of currentPorts) {
      const error = validatePort(entry.port);
      if (error) {
        allValid = false;
      }
      newErrors[entry.id] = error;
    }
    setErrors(newErrors);
    return allValid;
  };

  useEffect(() => {
    checkAllPortsValid(ports);
  }, [ports]);

  const handleAddPortProtocol = () => {
    const newEntry: PortProtocolEntry = {
      id: uuidv4(),
      port: '',
      protocol: 'TCP',
    };
    const updatedPorts = [...ports, newEntry];
    const isValid = checkAllPortsValid(updatedPorts);
    onChange(updatedPorts, isValid);
  };

  const handlePortChange = (id: string, newPortValue: string) => {
    const updatedPorts = ports.map((entry) =>
      entry.id === id ? { ...entry, port: newPortValue } : entry
    );
    const error = validatePort(newPortValue);
    setErrors(prevErrors => ({ ...prevErrors, [id]: error }));

    const allValid = Object.values({...errors, [id]: error }).every(e => e === null) &&
                     updatedPorts.every(p => validatePort(p.port) === null);

    onChange(updatedPorts, allValid);
  };

  const handleProtocolChange = (id: string, newProtocol: PortProtocolEntry['protocol']) => {
    const updatedPorts = ports.map((entry) =>
      entry.id === id ? { ...entry, protocol: newProtocol } : entry
    );
    const allValid = checkAllPortsValid(updatedPorts);
    onChange(updatedPorts, allValid);
  };

  const handleRemovePortProtocol = (id: string) => {
    const updatedPorts = ports.filter((entry) => entry.id !== id);
    const allValid = checkAllPortsValid(updatedPorts);
    onChange(updatedPorts, allValid);
  };

  const stopPropagation = (e: React.KeyboardEvent) => { 
    e.stopPropagation();
  };


  return (
    <div className="rule-ports-editor">
      <h4>Порты и Протоколы</h4>
      {ports.map((entry) => (
        <div key={entry.id} className="port-protocol-entry">
          <div>
            <input
              type="text"
              placeholder="Порт (e.g., 80, 100-200, any)"
              value={entry.port}
              onChange={(e) => handlePortChange(entry.id, e.target.value)}
              onKeyDown={stopPropagation}
              className={`port-input ${errors[entry.id] ? 'input-error' : ''}`}
            />
            {errors[entry.id] && <p className="error-text">{errors[entry.id]}</p>}
          </div>
          <select
            value={entry.protocol}
            onChange={(e) => handleProtocolChange(entry.id, e.target.value as PortProtocolEntry['protocol'])}
            className="protocol-select"
          >
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="SCTP">SCTP</option>
            <option value="ICMP">ICMP</option>
            <option value="ANY">ANY</option>
          </select>
          <button
            onClick={() => handleRemovePortProtocol(entry.id)}
            className="remove-button"
          >
            Удалить
          </button>
        </div>
      ))}
      <button onClick={handleAddPortProtocol} className="add-button">
        Добавить порт/протокол
      </button>
    </div>
  );
};

export default RulePortsEditor;