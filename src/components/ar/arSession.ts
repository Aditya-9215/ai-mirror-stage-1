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

  const sessionInit: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: []
  };

  // DOM Overlay feature detection
  const overlayRoot = document.getElementById('overlay-root');
  const domOverlaySupported = await navigator.xr.isSessionSupported('immersive-ar')
    .then(() => {
      try {
        sessionInit.optionalFeatures?.push('dom-overlay');
        if (overlayRoot) {
          (sessionInit as any).domOverlay = { root: overlayRoot };
          return true;
        }
      } catch {
        console.warn('⚠️ dom-overlay setup failed.');
      }
      return false;
    });

  // Depth Sensing feature detection
  const supportsDepth = 'depth-sensing' in XRSession.prototype;
  if (supportsDepth) {
    try {
      sessionInit.optionalFeatures?.push('depth-sensing');
      (sessionInit as any).depthSensing = {
        usagePreference: ['cpu-optimized', 'gpu-optimized'],
        dataFormatPreference: ['luminance-alpha', 'float32']
      };
    } catch {
      console.warn('⚠️ depth-sensing setup failed.');
    }
  }

  try {
    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    console.log('✅ AR session started:', session);
    return true;
  } catch (err) {
    console.error('❌ Failed to start AR session', err);
    return false;
  }
}
