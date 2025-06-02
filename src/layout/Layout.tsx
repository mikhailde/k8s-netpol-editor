import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import CanvasComponent from '../features/Canvas/Canvas';
import Palette from '../features/Palette/Palette';
import InspectorView from '../features/Inspector/InspectorView';
import OutputView from '../features/OutputView/OutputView';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <ReactFlowProvider>
      <div className="layout-container">
        
        <Palette /> 

        <div className="canvas-container">
          <CanvasComponent />
        </div>

        <div className="inspector-container">
          <div className="inspector-panel">
            <InspectorView />
          </div>
          <div className="output-panel">
            <OutputView />
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default Layout;