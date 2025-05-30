import React from 'react';
import './Palette.css';

interface PaletteItem {
  type: string;
  label: string;
}

const paletteNodeTypes: PaletteItem[] = [
  { type: 'namespace', label: 'Неймспейс' },
];

const Palette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="palette-container">
      <div className="description">Можно перетаскивать эти узлы на рабочую область:</div>
      {paletteNodeTypes.map((item) => (
        <div
          key={item.type}
          className="dndnode"
          onDragStart={(event) => onDragStart(event, item.type)}
          draggable
        >
          {item.label}
        </div>
      ))}
    </aside>
  );
};

export default Palette;