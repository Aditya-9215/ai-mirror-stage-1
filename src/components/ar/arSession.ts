// src/components/ar/arSession.ts
let _xrSession: XRSession | null = null;
let _gl: WebGLRenderingContext | null = null;
let _xrRefSpace: XRReferenceSpace | null = null;
let _frameCallback: ((time: DOMHighResTimeStamp, frame: XRFrame) => void) | null = null;

function stopPageCameraIfAny() {
  try {
    const video = document.querySelector('video');
    if (video && video.srcObject) {
      const ms = video.srcObject as MediaStream;
      ms.getTracks().forEach(t => t.stop());
      // detach so PoseDetector will re-open when AR ends
      (video as HTMLVideoElement).srcObject = null;
      console.log('[AR] stopped page camera before XR request');
    }
  } catch (e) {
    console.warn('[AR] failed to stop page camera:', e);
  }
}

export async function startARSession(): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('❌ WebXR not supported on this device.');
    return false;
  }

  const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!isSupported) {
    console.warn('❌ immersive-ar not supported.');
    return false;
  }

  // Stop page camera first to avoid device camera conflicts.
  stopPageCameraIfAny();

  const overlayRoot = document.getElementById('overlay-root');

  // Do NOT include depth-sensing here by default — many UAs reject it.
  const sessionInit: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: overlayRoot ? ['dom-overlay', 'local-floor'] : ['local-floor']
  };

  if (overlayRoot) {
    (sessionInit as any).domOverlay = { root: overlayRoot };
  }

  try {
    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    _xrSession = session;
    console.log('[AR] session started', { domOverlay: !!overlayRoot });

    // Create XR-compatible WebGL context
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { xrCompatible: true }) as WebGLRenderingContext | null;
    if (!gl) {
      console.warn('[AR] Could not create XR-compatible WebGL context; session may still run but UX may vary.');
    } else {
      _gl = gl;

      // Create XRWebGLLayer if supported and set as baseLayer
      const XRWebGLLayerCtor = (window as any).XRWebGLLayer;
      if (XRWebGLLayerCtor) {
        try {
          const xrGlLayer = new XRWebGLLayerCtor(session, gl);
          await session.updateRenderState({ baseLayer: xrGlLayer });
        } catch (e) {
          console.warn('[AR] XRWebGLLayer/updateRenderState failed:', e);
        }
      } else {
        console.warn('[AR] XRWebGLLayer not available on this browser.');
      }

      // Request a reference space (local-floor preferred)
      try {
        _xrRefSpace = await session.requestReferenceSpace('local-floor');
      } catch {
        try {
          _xrRefSpace = await session.requestReferenceSpace('local');
        } catch {
          _xrRefSpace = null;
        }
      }

      // Frame loop that binds the XR framebuffer and clears it
      _frameCallback = (time: DOMHighResTimeStamp, frame: XRFrame) => {
        const sess = frame.session;
        const pose = _xrRefSpace ? frame.getViewerPose(_xrRefSpace) : null;

        const baseLayer = sess.renderState.baseLayer as any;
        if (_gl && baseLayer && baseLayer.framebuffer) {
          _gl.bindFramebuffer(_gl.FRAMEBUFFER, baseLayer.framebuffer);
          if (pose && pose.views && pose.views.length) {
            for (const view of pose.views) {
              const viewport = baseLayer.getViewport(view);
              if (viewport) {
                _gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
              } else {
                _gl.viewport(0, 0, _gl.drawingBufferWidth, _gl.drawingBufferHeight);
              }
              _gl.clearColor(0.0, 0.0, 0.0, 0.0);
              _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
              // no 3D content yet — this prevents black screen and lets UA composite camera
            }
          } else {
            // still clear to keep a valid framebuffer
            _gl.viewport(0, 0, _gl.drawingBufferWidth, _gl.drawingBufferHeight);
            _gl.clearColor(0.0, 0.0, 0.0, 0.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
          }
          _gl.bindFramebuffer(_gl.FRAMEBUFFER, null);
        }

        // request next frame
        sess.requestAnimationFrame(_frameCallback!);
      };

      session.requestAnimationFrame(_frameCallback);
    }

    session.addEventListener('end', () => {
      console.log('[AR] session ended (event)');
      cleanup();
      // notify page that AR ended so PoseDetector (or App) can restart camera if needed
      window.dispatchEvent(new CustomEvent('ar-session-ended'));
    });

    return true;
  } catch (err) {
    console.error('[AR] Failed to start session', err);
    cleanup();
    return false;
  }
}

export async function endARSession(): Promise<boolean> {
  try {
    if (_xrSession) {
      await _xrSession.end();
      // cleanup will be called by 'end' event as well
      return true;
    }
    return false;
  } catch (err) {
    console.error('[AR] Failed to end session', err);
    cleanup();
    return false;
  }
}

function cleanup() {
  try {
    if (_gl) {
      const ext = _gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      _gl = null;
    }
    _xrRefSpace = null;
    _frameCallback = null;
    _xrSession = null;
  } catch (e) {
    console.warn('[AR] cleanup error', e);
  }
}
