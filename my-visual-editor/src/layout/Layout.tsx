import React from 'react';
import { ReactFlowProvider } from 'reactflow';
import Canvas from '../features/Canvas/Canvas';
import Palette from '../features/Palette/Palette';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <Palette />

      <div className="layout-main-area">
        <ReactFlowProvider>
          <div className="layout-canvas">
            <Canvas />
          </div>
        </ReactFlowProvider>

        <div className="layout-inspector">
          <h2>Inspector</h2>
        </div>
      </div>

      <div className="layout-output">
        <h2>Output</h2>
      </div>
    </div>
  );
};

export default Layout;