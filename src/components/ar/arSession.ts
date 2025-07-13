// src/components/ar/arSession.ts

// Keep track of the active session and the latest depth frame info
let activeSession: XRSession | null = null;
let latestDepthInfo: XRCPUDepthInformation | null = null;
let xrRefSpace: XRReferenceSpace | null = null;

/**
 * Starts an immersive-ar session with depth sensing enabled.
 * Also kicks off the XR render loop to continuously update depth info.
 */
export async function startARSession(): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('⚠️ WebXR not available on this device');
    return false;
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!supported) {
    console.warn('⚠️ WebXR immersive‑ar not supported');
    return false;
  }

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

    console.log('✅ AR session started:', session);
    activeSession = session;

    // Set up a reference space for depth queries
    xrRefSpace = await session.requestReferenceSpace('viewer');

    // Start the XR frame loop
    session.requestAnimationFrame(onXRFrame);

    return true;
  } catch (err) {
    console.error('❌ Failed to start AR session:', err);
    return false;
  }
}

/**
 * Internal callback for each XR frame.
 * Grabs the depth info from the frame and schedules the next frame.
 */
function onXRFrame(time: DOMHighResTimeStamp, frame: XRFrame) {
  const session = frame.session;
  if (xrRefSpace) {
    const pose = frame.getViewerPose(xrRefSpace);
    if (pose && pose.views.length) {
      const view = pose.views[0];
      // This may return null if depth isn't ready
      const depth = frame.getDepthInformation(view);
      if (depth) {
        latestDepthInfo = depth;
      }
    }
  }

  // Queue up the next frame
  session.requestAnimationFrame(onXRFrame);
}

/** Returns the active XRSession, or null if none started */
export function getARSession(): XRSession | null {
  return activeSession;
}

/** Returns the most recent depth info, or null if not yet available */
export function getLatestDepthInfo(): XRCPUDepthInformation | null {
  return latestDepthInfo;
}
