import React, { useState } from 'react';
import './App.css';
import './index.css';
import { PoseDetector } from './components/PoseDetector';
import { startARSession } from './components/ar/arSession';

function App() {
  const [arStarted, setArStarted] = useState(false);

  const handleStartAR = async () => {
    const started = await startARSession();
    if (started) {
      setArStarted(true);
    }
  };

  return (
    <div className="App">
      <header className="App-header">AI Mirror: AR Measurement Prototype</header>

      {!arStarted && (
        <button className="start-ar-button" onClick={handleStartAR}>
          Start AR Session
        </button>
      )}

      <PoseDetector />
    </div>
  );
}

export default App;
