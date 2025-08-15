// src/components/ar/arSession.ts
let _xrSession: XRSession | null = null;
let _gl: WebGLRenderingContext | null = null;
let _xrRefSpace: XRReferenceSpace | null = null;
let _frameCallback: ((time: DOMHighResTimeStamp, frame: XRFrame) => void) | null = null;

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

  const overlayRoot = document.getElementById('overlay-root');

  const sessionInit: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'depth-sensing', 'local-floor'],
  };

  if (overlayRoot) {
    // allow dom overlay if available; this keeps the DOM visible on top
    (sessionInit as any).domOverlay = { root: overlayRoot };
  }

  try {
    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    _xrSession = session;
    console.log('[AR] session started', { domOverlay: !!overlayRoot });

    // Create an off-screen canvas + XR-compatible WebGL context
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { xrCompatible: true }) as WebGLRenderingContext | null;

    if (!gl) {
      console.warn('[AR] failed to create XR-compatible WebGL context; session may still run but could show black.');
    } else {
      _gl = gl;

      // Create and set XRWebGLLayer as the session base layer
      // (some TypeScript environments don't have XRWebGLLayer typed)
      const XRWebGLLayerCtor = (window as any).XRWebGLLayer;
      if (!XRWebGLLayerCtor) {
        console.warn('[AR] XRWebGLLayer constructor not found on window; continuing without explicit layer.');
      } else {
        const xrGlLayer = new XRWebGLLayerCtor(session, gl);
        await session.updateRenderState({ baseLayer: xrGlLayer });
      }

      // Request a reference space
      try {
        _xrRefSpace = await session.requestReferenceSpace('local-floor');
      } catch {
        _xrRefSpace = await session.requestReferenceSpace('local');
      }

      // Frame loop
      _frameCallback = (time: DOMHighResTimeStamp, frame: XRFrame) => {
        if (!frame) return;
        const sessionLocal = frame.session;
        const pose = frame.getViewerPose(_xrRefSpace!);
        if (!pose) {
          // keep the loop alive even if pose missing
          sessionLocal.requestAnimationFrame(_frameCallback!);
          return;
        }

        // Bind XR framebuffer
        const baseLayer = sessionLocal.renderState.baseLayer as any;
        if (baseLayer && _gl) {
          _gl.bindFramebuffer(_gl.FRAMEBUFFER, baseLayer.framebuffer);

          // For each view, set viewport and clear
          for (const view of pose.views) {
            const viewport = baseLayer.getViewport(view);
            if (viewport) {
              _gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            } else {
              // Fallback to full size
              _gl.viewport(0, 0, _gl.drawingBufferWidth, _gl.drawingBufferHeight);
            }
            // Clear but keep alpha 0 so camera background can show through
            _gl.clearColor(0.0, 0.0, 0.0, 0.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
            // (Optional) Draw simple debugging content here if desired
          }
        }

        // request next frame
        sessionLocal.requestAnimationFrame(_frameCallback!);
      };

      session.requestAnimationFrame(_frameCallback);
    }

    session.addEventListener('end', () => {
      console.log('[AR] session ended (event)');
      cleanup();
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
      // 'end' event will call cleanup, but call here also
      cleanup();
      console.log('[AR] session ended (programmatic)');
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
    if (_xrSession) {
      // session.end() triggers 'end' event which will call cleanup; ensure we don't double-run heavy steps
      _xrSession = null;
    }
    if (_gl) {
      const ext = _gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      _gl = null;
    }
    _xrRefSpace = null;
    _frameCallback = null;
  } catch (e) {
    console.warn('[AR] cleanup error', e);
  }
}
