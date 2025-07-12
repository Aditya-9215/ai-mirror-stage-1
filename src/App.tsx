import React, { useEffect } from 'react';
import './App.css';
import './index.css';
import { PoseDetector } from './components/PoseDetector';

function App() {
  useEffect(() => {
    const initXR = async () => {
      if (!navigator.xr) {
        console.warn('❌ WebXR not available on this device');
        return;
      }

      const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!isARSupported) {
        console.warn('❌ Immersive AR not supported on this device');
        return;
      }

      try {
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['local', 'viewer'],
          optionalFeatures: ['depth-sensing', 'dom-overlay'],
          depthSensing: {
            usagePreference: ['cpu-optimized', 'gpu-optimized'],
            dataFormatPreference: ['luminance-alpha', 'float32']
          },
          domOverlay: {
            root: document.body
          }
        });

        console.log('✅ XR Session Started');

        // Detect depth-sensing availability
        const depthUsage = (session as any).depthUsage;
        const depthFormat = (session as any).depthDataFormat;

        if (depthUsage && depthFormat) {
          console.log('🎯 Depth Sensing Supported');
          console.log('   • Usage:', depthUsage);
          console.log('   • Format:', depthFormat);
        } else {
          console.log('⚠️ Depth sensing not enabled in this session');
        }

        // Later: Use session.requestAnimationFrame(...) for depth-based frame analysis
      } catch (error) {
        console.error('❌ Failed to start WebXR session with depth sensing:', error);
      }
    };

    // ✅ Call WebXR setup only on AR-capable, mobile-only devices
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      initXR();
    } else {
      console.log('ℹ️ Skipping AR session on non-mobile device');
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">AI Mirror: AR Measurement Prototype</header>
      <PoseDetector />
    </div>
  );
}

export default App;
