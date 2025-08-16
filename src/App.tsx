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

  const handleToggleCamera = () =>
    setFacingMode((f) => (f === 'user' ? 'environment' : 'user'));

  const handleStartStopAR = async () => {
    if (!arEnabled) {
      // start AR session (must be called from user gesture)
      const ok = await startARSession(async (bitmap?: ImageBitmap) => {
        if (!bitmap) return;
        // forward XR ImageBitmap into PoseDetector's handler
        try {
          if (poseRef.current?.processXRBitmap) {
            await poseRef.current.processXRBitmap(bitmap);
          } else {
            bitmap.close?.();
          }
        } catch (e) {
          console.warn('[App] processXRBitmap handler error:', e);
          bitmap.close?.();
        }
      });

      if (ok) {
        setArEnabled(true);
        console.log('[App] AR enabled');
      } else {
        console.warn('[App] AR start failed');
      }
    } else {
      // stop AR
      const ok = await endARSession();
      setArEnabled(false);
      console.log('[App] AR disabled', ok);
    }
  };

  return (
    <div className="App">
      {/* overlay root — this element is used as dom-overlay root by startARSession */}
      <div
        id="overlay-root"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}
      >
        {/* HUD that will be visible during XR (top-left). React keeps this updated. */}
        <div
          id="xr-hud"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: 14,
            lineHeight: '18px',
            borderRadius: 6,
            pointerEvents: 'none',
            minWidth: 180,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Measurements</div>
          <div id="xr-hud-shoulder">
            Shoulder: {measurements.shoulder ? `${measurements.shoulder.cm.toFixed(1)} cm` : '–'}
          </div>
          <div id="xr-hud-torso">
            Torso: {measurements.torso ? `${measurements.torso.cm.toFixed(1)} cm` : '–'}
          </div>
          <div id="xr-hud-height">
            Height: {measurements.height ? `${measurements.height.cm.toFixed(1)} cm` : '–'}
          </div>
        </div>
      </div>

      <header className="App-header">AI Mirror: AR Measurement Prototype</header>

      <div className="controls" style={{ margin: 12 }}>
        <button onClick={handleToggleCamera}>Toggle Camera ({facingMode})</button>

        <button onClick={handleStartStopAR} style={{ marginLeft: 8 }}>
          {arEnabled ? 'Disable AR' : 'Start AR'}
        </button>
      </div>

      <div className="video-wrapper" style={{ maxWidth: 960, margin: '0 auto' }}>
        <PoseDetector
          ref={poseRef}
          facingMode={facingMode}
          arEnabled={arEnabled}
          onMeasurementsUpdate={(m: Measurements) => setMeasurements(m)}
        />
      </div>

      <div style={{ marginTop: 12, color: '#fff', maxWidth: 960, marginLeft: 'auto', marginRight: 'auto' }}>
        <strong>Last measurements:</strong>
        <pre style={{ color: '#0f0' }}>{JSON.stringify(measurements, null, 2)}</pre>
      </div>
    </div>
  );
}

export default App;
