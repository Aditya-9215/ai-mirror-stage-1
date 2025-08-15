// src/App.tsx
import React, { useState } from 'react';
import './App.css';
import './index.css';
import PoseDetector, { Measurements } from './components/PoseDetector';
import { startARSession, endARSession } from './components/ar/arSession';

function App() {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [arEnabled, setArEnabled] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);

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
              const ok = await startARSession(); // must be a user gesture
              if (ok) setArEnabled(true);
            } else {
              await endARSession();
              setArEnabled(false);
            }
          }}
        >
          {arEnabled ? 'Disable AR' : 'Start AR'}
        </button>
      </div>

      <div className="video-wrapper" style={{ position: 'relative' }}>
        <PoseDetector
          facingMode={facingMode}
          arEnabled={arEnabled}
          onMeasurementsUpdate={setMeasurements}
        />

        {measurements && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              padding: 10,
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.35,
              zIndex: 10,
              minWidth: 220,
            }}
          >
            <div style={{ opacity: 0.8, marginBottom: 4 }}>Measurements (FOV estimate)</div>
            <div>
              <strong>Shoulder</strong> — {measurements.shoulder ? (
                <>
                  {measurements.shoulder.px.toFixed(0)} px | {measurements.shoulder.cm.toFixed(1)} cm | {measurements.shoulder.inch.toFixed(2)} in
                </>
              ) : '—'}
            </div>
            <div>
              <strong>Torso</strong> — {measurements.torso ? (
                <>
                  {measurements.torso.px.toFixed(0)} px | {measurements.torso.cm.toFixed(1)} cm | {measurements.torso.inch.toFixed(2)} in
                </>
              ) : '—'}
            </div>
            <div>
              <strong>Height</strong> — {measurements.height ? (
                <>
                  {measurements.height.px.toFixed(0)} px | {measurements.height.cm.toFixed(1)} cm | { measurements.height.inch.toFixed(2)} in
                </>
              ) : '—'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
