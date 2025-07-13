import React, { useState } from 'react';
import './App.css';
import './index.css';
import { PoseDetector } from './components/PoseDetector';
import { startARSession } from './components/ar/arSession';

function App() {
  const [arStarted, setArStarted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const handleStartAR = async () => {
    const started = await startARSession();
    if (started) {
      setArStarted(true);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="App">
      <header className="App-header">AI Mirror: AR Measurement Prototype</header>

      <div style={{ margin: '10px' }}>
        <button onClick={toggleCamera}>
          Switch to {facingMode === 'user' ? 'Back' : 'Front'} Camera
        </button>
      </div>

      {!arStarted && (
        <button className="start-ar-button" onClick={handleStartAR}>
          Start AR Session
        </button>
      )}

      <PoseDetector facingMode={facingMode} />
    </div>
  );
}

export default App;
