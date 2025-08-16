// src/App.tsx
import React, { useRef, useState } from 'react';
import './App.css';
import './index.css';
import PoseDetector, { Measurements } from './components/PoseDetector';
import { startARSession, endARSession } from './components/ar/arSession';

function App() {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [arEnabled, setArEnabled] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements>({});
  const poseRef = useRef<any>(null);

  const handleStartStopAR = async () => {
    if (!arEnabled) {
      // must be called directly from a user gesture
      const ok = await startARSession(async (bitmap: ImageBitmap) => {
        try {
          // forward XR frames into PoseDetector
          await poseRef.current?.processXRBitmap(bitmap);
        } catch (e) {
          console.warn('[App] processXRBitmap failed', e);
        } finally {
          bitmap.close?.();
        }
      });
      setArEnabled(!!ok);
    } else {
      await endARSession();
      setArEnabled(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">AI Mirror: AR Measurement Prototype</header>

      <div className="controls">
        <button
          onClick={() =>
            setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))
          }
        >
          Toggle Camera ({facingMode})
        </button>

        <button onClick={handleStartStopAR}>
          {arEnabled ? 'Disable AR' : 'Start AR'}
        </button>
      </div>

      <div className="video-wrapper">
        <PoseDetector
          ref={poseRef}
          facingMode={facingMode}
          arEnabled={arEnabled}
          onMeasurementsUpdate={(m) => setMeasurements(m)}
        />
      </div>

      <div style={{ marginTop: 12, color: '#fff' }}>
        <strong>Last measurements:</strong>
        <pre style={{ color: '#0f0' }}>{JSON.stringify(measurements, null, 2)}</pre>
      </div>
    </div>
  );
}

export default App;
