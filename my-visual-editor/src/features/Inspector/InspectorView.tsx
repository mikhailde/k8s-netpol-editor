import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/store';
import './InspectorView.css';

const DNS_1123_LABEL_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const MAX_DNS_1123_LABEL_LENGTH = 63;

function isValidDns1123Label(name: string): { valid: boolean; message?: string } {
  if (!name) {
    return { valid: false, message: 'Имя не может быть пустым.' };
  }
  if (name.length > MAX_DNS_1123_LABEL_LENGTH) {
    return { valid: false, message: `Имя не должно превышать ${MAX_DNS_1123_LABEL_LENGTH} символов.` };
  }
  if (!DNS_1123_LABEL_REGEX.test(name)) {
    return {
      valid: false,
      message:
        'Имя должно состоять из строчных буквенно-цифровых символов или "-", начинаться и заканчиваться буквенно-цифровым символом.',
    };
  }
  return { valid: true };
}

const InspectorView: React.FC = () => {
  const selectedElementId = useAppStore((state) => state.selectedElementId);
  const nodes = useAppStore((state) => state.nodes);
  const updateNodeData = useAppStore((state) => state.updateNodeData); // Для следующего шага

  const selectedNode = React.useMemo(() => {
    if (!selectedElementId) return null;
    return nodes.find((node) => node.id === selectedElementId);
  }, [selectedElementId, nodes]);

  const [namespaceName, setNamespaceName] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedNode && selectedNode.type === 'namespace') {
      setNamespaceName(selectedNode.data?.label || '');
      setValidationError(null);
    } else {
      setNamespaceName('');
      setValidationError(null);
    }
  }, [selectedNode]);

  const handleNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNamespaceName(event.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
  };

  const handleSaveChanges = useCallback(() => {
    if (!selectedNode || selectedNode.type !== 'namespace') return;

    const validationResult = isValidDns1123Label(namespaceName);
    if (!validationResult.valid) {
      setValidationError(validationResult.message || 'Некорректное имя.');
      return;
    }

    setValidationError(null);

    updateNodeData(selectedNode.id, { label: namespaceName });
  }, [selectedNode, namespaceName, updateNodeData]);

  if (!selectedNode) {
    return (
      <div className="inspector-view inspector-empty">
        <p>Элемент не выбран</p>
      </div>
    );
  }

  return (
    <div className="inspector-view">
      <h3>Инспектор</h3>

      <div className="inspector-section">
        <label>ID:</label>
        <span>{selectedNode.id}</span>
      </div>
      <div className="inspector-section">
        <label>Тип:</label>
        <span>{selectedNode.type || 'N/A'}</span>
      </div>

      {selectedNode.type === 'namespace' && (
        <div className="inspector-section namespace-edit-section">
          <label htmlFor={`namespace-name-input-${selectedNode.id}`}>Имя Namespace:</label>
          <input
            id={`namespace-name-input-${selectedNode.id}`}
            type="text"
            value={namespaceName}
            onChange={handleNameInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Введите имя неймспейса"
            className={`inspector-input ${validationError ? 'input-error' : ''}`}
            aria-invalid={!!validationError}
            aria-describedby={validationError ? `namespace-name-error-${selectedNode.id}` : undefined}
          />
          {validationError && (
            <p id={`namespace-name-error-${selectedNode.id}`} className="inspector-error">
              {validationError}
            </p>
          )}
          <button onClick={handleSaveChanges} className="inspector-button" disabled={!!validationError && namespaceName !== (selectedNode.data?.label || '')}>
            Сохранить имя
          </button>
        </div>
      )}

      <div className="inspector-section">
        <label>Данные (data):</label>
        <pre>{JSON.stringify(selectedNode.data, null, 2)}</pre>
      </div>
      <div className="inspector-section">
        <label>Родитель (ID):</label>
        <span>{selectedNode.parentNode || 'Нет'}</span>
      </div>
      <div className="inspector-section">
        <label>Позиция:</label>
        <pre>{JSON.stringify(selectedNode.position, null, 2)}</pre>
      </div>
    </div>
  );
};

export default InspectorView;