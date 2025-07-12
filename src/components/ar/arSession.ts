export async function startARSession(): Promise<boolean> {
  if (navigator.xr) {
    const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (isSupported) {
      try {
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['depth-sensing'],
          depthSensing: {
            usagePreference: ['cpu-optimized'],
            dataFormatPreference: ['luminance-alpha'],
          },
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: document.body },
        });

        // ✅ Use the session variable to prevent lint error
        console.log('✅ AR session started:', session);

        return true;
      } catch (e) {
        console.error('❌ Failed to start WebXR session with depth sensing:', e);
      }
    } else {
      console.warn('⚠️ WebXR immersive-ar session not supported');
    }
  } else {
    console.warn('⚠️ WebXR not supported');
  }
  return false;
}
