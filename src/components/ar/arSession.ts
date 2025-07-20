// src/components/ar/arSession.ts

/**
 * Attempt to start an immersive‑AR session (with depth if available).
 * Must be called directly from a user gesture (e.g. button click).
 * Returns true if successful, false otherwise.
 */
export async function startARSession(): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('⚠️ WebXR not supported');
    return false;
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!supported) {
    console.warn('⚠️ immersive‑ar not supported');
    return false;
  }

  try {
    await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['depth-sensing', 'viewer'],
      optionalFeatures: ['dom-overlay'],
    });
    console.log('✅ AR session started');
    return true;
  } catch (err) {
    console.warn('❌ Failed to start AR session', err);
    return false;
  }
}

/**
 * Grab the depth in centimeters at the center of the view for one frame.
 * You can call this later once you have a live session & reference space.
 */
export async function getDepthAtCenter(
  session: XRSession,
  refSpace: XRReferenceSpace
): Promise<number | null> {
  return new Promise((resolve) => {
    session.requestAnimationFrame((_, frame) => {
      const getInfo = (frame as any).getDepthInformation;
      if (typeof getInfo !== 'function') {
        return resolve(null);
      }
      const pose = frame.getViewerPose(refSpace);
      if (!pose) {
        return resolve(null);
      }
      const view = pose.views[0];
      const depthInfo = getInfo.call(frame, view);
      if (!depthInfo || !depthInfo.data) {
        return resolve(null);
      }
      const cx = Math.floor(depthInfo.width / 2);
      const cy = Math.floor(depthInfo.height / 2);
      const idx = cy * depthInfo.width + cx;
      // depthInfo.data is a buffer of raw millimeter values
      const buf = new Uint16Array(depthInfo.data.buffer || depthInfo.data);
      const rawMm = buf[idx];
      const cm = (rawMm / 1000) * 100;
      resolve(cm);
    });
  });
}
