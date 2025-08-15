// src/components/ar/arSession.ts
let _xrSession: XRSession | null = null;

export async function startARSession(): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('❌ WebXR not supported on this device.');
    return false;
  }

  const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!isARSupported) {
    console.warn('❌ immersive-ar not supported.');
    return false;
  }

  const overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) {
    console.warn('⚠️ overlay-root not found. Add <div id="overlay-root"></div> to index.html for dom-overlay.');
    // You can still start immersive-ar without dom-overlay if you implement a WebGL XR render loop.
    // For now, bail to avoid the black fullscreen experience.
    return false;
  }

  const sessionInit: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'depth-sensing'],
  };

  (sessionInit as any).domOverlay = { root: overlayRoot };
  (sessionInit as any).depthSensing = {
    usagePreference: ['cpu-optimized', 'gpu-optimized'],
    dataFormatPreference: ['luminance-alpha', 'float32'],
  };

  try {
    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    _xrSession = session;
    console.log('[AR] Session started', { domOverlay: !!overlayRoot });

    session.addEventListener('end', () => {
      console.log('[AR] Session ended');
      _xrSession = null;
    });

    return true;
  } catch (err) {
    console.error('❌ Failed to start AR session', err);
    return false;
  }
}

export async function endARSession(): Promise<boolean> {
  try {
    if (_xrSession) {
      await _xrSession.end();
      _xrSession = null;
      console.log('[AR] Programmatically ended');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[AR] Failed to end session', err);
    return false;
  }
}
