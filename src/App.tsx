import React, { useState } from 'react';
import './App.css';
import './index.css';
import PoseDetector from './components/PoseDetector';
import { startARSession } from './components/ar/arSession';

function App() {
  const [arStarted, setArStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const handleStartAR = async () => {
    const ok = await startARSession();
    if (ok) setArStarted(true);
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="App">
      <header className="App-header">
        AI Mirror: AR Measurement Prototype
      </header>

      <div className="controls">
        <button onClick={toggleCamera}>
          Switch to {facingMode === 'user' ? 'Back' : 'Front'} Camera
        </button>

        {!arStarted && (
          <button onClick={handleStartAR}>
            Start AR Session
          </button>
        )}
      </div>

      <PoseDetector facingMode={facingMode} arEnabled={arStarted} />
    </div>
  );
}

export default App;
