import React from 'react';
import Canvas from '../components/Canvas/Canvas';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <div className="layout-palette">
        <h2>Palette</h2>
      </div>
      <div className="layout-main-area">
        <div className="layout-canvas">
          <Canvas />
        </div>
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