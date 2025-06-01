import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import CanvasComponent from '../features/Canvas/Canvas';
import Palette from '../features/Palette/Palette';
import InspectorView from '../features/Inspector/InspectorView';
import OutputView from '../features/OutputView/OutputView';
import './Layout.css';
import { useAppStore } from '../store/store';

const EdgeCounterDisplay: React.FC = () => {
  const edgesCount = useAppStore((state) => state.edges.length);
  return (
    <div className="edge-counter-display">
      Edges in Store: {edgesCount}
    </div>
  );
};

const Layout: React.FC = () => {
  return (
    <ReactFlowProvider>
      <div className="layout-container">
        <EdgeCounterDisplay />
        
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