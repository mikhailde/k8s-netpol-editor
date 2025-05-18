import React from 'react';
import CanvasWrapper from '../features/Canvas/Canvas';
import Palette from '../features/Palette/Palette';
import InspectorView from '../features/Inspector/InspectorView';
import './Layout.css';
import { useAppStore } from '../store/store';

const EdgeCounterDisplay: React.FC = () => {
  const edgesCount = useAppStore((state) => state.edges.length);
  console.log('[EdgeCounterDisplay] Edges count from store:', edgesCount);
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, backgroundColor: 'rgba(200, 200, 200, 0.8)', padding: '5px 10px', zIndex: 10000, borderBottomLeftRadius: '5px' }}>
      Edges in Store: {edgesCount}
    </div>
  );
};

const Layout: React.FC = () => {
  return (
    <div className="layout-container">
      <EdgeCounterDisplay />
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