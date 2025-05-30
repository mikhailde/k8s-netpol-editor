import React from 'react';

import './Palette.css';

const Palette = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside>
      <div className="description">Можно перетаскивать эти узлы на рабочую область:</div>
      <div className="dndnode" onDragStart={(event) => onDragStart(event, 'namespace')} draggable>
        Неймспейс
      </div>
    </aside>
  );
};

export default Palette;