import React from 'react';
import CanvasWrapper from '../features/Canvas/Canvas';
import Palette from '../features/Palette/Palette';
import InspectorView from '../features/Inspector/InspectorView';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <Palette />

      <div className="canvas-container">
        <CanvasWrapper />
      </div>

      <div className="inspector-container">
        <InspectorView />
      </div>
    </div>
  );
};

export default Layout;