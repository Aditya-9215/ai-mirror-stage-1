// src/App.tsx

import React, { useState } from 'react';
import './App.css';
import './index.css';
import PoseDetector from './components/PoseDetector';
import { startARSession } from './components/ar/arSession';

function App() {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [arEnabled, setArEnabled] = useState(false);

  return (
    <div className="App">
      <header className="App-header">
        AI Mirror: AR Measurement Prototype
      </header>

      <div className="controls">
        <button
          onClick={() =>
            setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))
          }
        >
          Toggle Camera ({facingMode})
        </button>

        <button
          onClick={async () => {
            if (!arEnabled) {
              const ok = await startARSession(); // user gesture
              if (ok) setArEnabled(true);
            } else {
              setArEnabled(false);
            }
          }}
        >
          {arEnabled ? 'Disable AR' : 'Start AR'}
        </button>
      </div>

      <div className="video-wrapper">
        <PoseDetector facingMode={facingMode} arEnabled={arEnabled} />
      </div>
    </div>
  );
}

export default App;
