import React from 'react';
import styles from './Palette.module.css';

const NamespaceIcon = () => (
  <svg className={styles.nodeIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.78 7.5L12.53 2.75A1 1 0 0011.47 2.75L3.22 7.5A1 1 0 002.5 8.4V15.6A1 1 0 003.22 16.5L11.47 21.25A1 1 0 0012.53 21.25L20.78 16.5A1 1 0 0021.5 15.6V8.4A1 1 0 0020.78 7.5ZM4.5 15.03V8.97L12 13.21L19.5 8.97V15.03L12 19.28L4.5 15.03ZM12 11.22L5.11 7.5L12 3.78L18.89 7.5L12 11.22Z"/>
  </svg>
);

const PodGroupIcon = () => (
  <svg className={styles.nodeIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 18H4A2 2 0 012 16V14A2 2 0 014 12H20A2 2 0 0122 14V16A2 2 0 0120 18M20 10H4A2 2 0 012 8V6A2 2 0 014 4H20A2 2 0 0122 6V8A2 2 0 0120 10M7 7H5V9H7V7M7 15H5V17H7V15Z"/>
  </svg>
);


const Palette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, nodeType: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      console.log(`Элемент ${nodeType} активирован клавишей ${event.key}. Логика drag-and-drop с клавиатуры требует доп. реализации.`);
    }
  };

  return (
    <aside className={`palette-panel ${styles.palettePanel}`}>
      <div className={styles.description}>Перетащите узлы на холст:</div>

      <div
        className={`${styles.dndNode} ${styles.dndNodeNamespace}`}
        onDragStart={(event) => onDragStart(event, 'namespace')}
        draggable
        tabIndex={0}
        role="button"
        aria-label="Перетащить Неймспейс на холст"
        onKeyDown={(event) => handleKeyDown(event, 'namespace')}
      >
        <NamespaceIcon />
        <span>Неймспейс</span>
      </div>

      <div
        className={`${styles.dndNode} ${styles.dndNodePodGroup}`}
        onDragStart={(event) => onDragStart(event, 'podGroup')}
        draggable
        tabIndex={0}
        role="button"   
        aria-label="Перетащить Группу Подов на холст"
        onKeyDown={(event) => handleKeyDown(event, 'podGroup')}
      >
        <PodGroupIcon />
        <span>Группа Подов</span>
      </div>
    </aside>
  );
};

export default Palette;