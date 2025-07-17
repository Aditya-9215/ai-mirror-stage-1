// src/components/ar/arSession.ts
let activeSession: XRSession | null = null;
let latestDepthInfo: XRCPUDepthInformation | null = null;
let xrRefSpace: XRReferenceSpace | null = null;

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
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local', 'depth-sensing', 'dom-overlay'],
      depthSensing: {
        usagePreference: ['cpu-optimized'],
        dataFormatPreference: ['luminance-alpha'],
      },
      domOverlay: { root: document.body },
    });
    activeSession = session;
    xrRefSpace = await session.requestReferenceSpace('local');
    session.requestAnimationFrame(onXRFrame);
    console.log('✅ AR session started');
    return true;
  } catch (e) {
    console.error('❌ Failed to start AR session', e);
    return false;
  }
}

function onXRFrame(time: DOMHighResTimeStamp, frame: XRFrame) {
  const viewerPose = frame.getViewerPose?.(xrRefSpace!) 
                   ?? /* fallback if needed */ null;
  const depthInfo = frame.getDepthInformation?.(viewerPose?.views[0]);
  if (depthInfo) {
    latestDepthInfo = depthInfo;
  }
  activeSession!.requestAnimationFrame(onXRFrame);
}

export function getLatestDepthInfo(): XRCPUDepthInformation | null {
  return latestDepthInfo;
}
