// src/App.tsx
import React, { useRef, useState, useEffect } from 'react';
import './App.css';
import './index.css';
import PoseDetector, { Measurements } from './components/PoseDetector';
import { startARSession, endARSession } from './components/ar/arSession';

function App() {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [arEnabled, setArEnabled] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements>({});
  const poseRef = useRef<any>(null);

  // keep measurements visible in normal page (below) and also update the overlay-root for AR
  useEffect(() => {
    // update the overlay root (used by dom-overlay while in immersive-ar)
    const root = document.getElementById('overlay-root');
    if (!root) return;
    if (!measurements || Object.keys(measurements).length === 0) {
      root.innerHTML = '';
      return;
    }
    const html = Object.entries(measurements)
      .map(([k, v]) => {
        const val = v as any;
        return `<div style="font-size:14px;line-height:1.2">${k}: ${val.cm.toFixed(1)} cm / ${val.inch.toFixed(1)} in</div>`;
      })
      .join('');
    root.innerHTML = `<div style="
      position:fixed;
      top:12px;
      left:12px;
      background: rgba(0,0,0,0.55);
      color:white;
      padding:8px 10px;
      border-radius:8px;
      z-index:99999;
      pointer-events:none;
      font-family: Arial, sans-serif;
    ">${html}</div>`;
  }, [measurements]);

  // called from PoseDetector (video path) and from AR frame processing path
  const onMeasurementsUpdate = (m: Measurements) => {
    // small guard: only update state if there is a measurement
    if (!m) return;
    const hasAny =
      (m.shoulder && Number.isFinite(m.shoulder.cm)) ||
      (m.torso && Number.isFinite(m.torso.cm)) ||
      (m.height && Number.isFinite(m.height.cm));
    if (hasAny) {
      setMeasurements(m);
      console.debug('[App] measurements updated', m);
    }
  };

  const handleStartStopAR = async () => {
    if (!arEnabled) {
      // start AR session; pass a frame handler so each XR frame's ImageBitmap is forwarded
      const ok = await startARSession(async (bitmap?: ImageBitmap) => {
        if (!bitmap) return;
        // give visual feedback in console — confirm we got an XR frame
        console.debug('[App] received XR frame bitmap', { width: bitmap.width, height: bitmap.height });

        // forward bitmap to PoseDetector (imperative handle)
        try {
          if (poseRef.current?.processXRBitmap) {
            await poseRef.current.processXRBitmap(bitmap);
          } else {
            console.warn('[App] poseRef has no processXRBitmap');
          }
        } catch (e) {
          console.warn('[App] error processing XR bitmap', e);
        } finally {
          // PoseDetector/processXRBitmap already calls bitmap.close, but close again to be safe
          bitmap.close?.();
        }
      });

      if (ok) {
        setArEnabled(true);
        console.log('[App] AR started');
      } else {
        console.warn('[App] AR start failed');
      }
    } else {
      // stop AR
      try {
        await endARSession();
      } catch (e) {
        console.warn('[App] endARSession error', e);
      }
      setArEnabled(false);
      // clear overlay-root
      const root = document.getElementById('overlay-root');
      if (root) root.innerHTML = '';
      console.log('[App] AR stopped');
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
          onMeasurementsUpdate={onMeasurementsUpdate}
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
