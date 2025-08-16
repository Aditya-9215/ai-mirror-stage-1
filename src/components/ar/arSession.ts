// src/components/ar/arSession.ts
let _xrSession: XRSession | null = null;
let _gl: WebGLRenderingContext | null = null;
let _xrRefSpace: XRReferenceSpace | null = null;
let _frameCallback: ((time: DOMHighResTimeStamp, frame: XRFrame) => void) | null = null;

/**
 * Start an immersive-ar session.
 * onXRFrame (optional) will be called with an ImageBitmap for each XR frame (if framebuffer read succeeds).
 */
export async function startARSession(
  onXRFrame?: (bitmap: ImageBitmap) => Promise<void> | void
): Promise<boolean> {
  if (!navigator.xr) {
    console.warn('❌ WebXR not supported on this device.');
    return false;
  }

  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (!supported) {
    console.warn('❌ immersive-ar not supported.');
    return false;
  }

  // Pause any page camera to avoid conflicts (pause rather than nulling to reduce flicker)
  try {
    const pageVideo = document.querySelector('video') as HTMLVideoElement | null;
    if (pageVideo && pageVideo.srcObject) {
      try {
        pageVideo.pause();
        console.log('[AR] paused page camera before XR request');
      } catch { /* ignore */ }
    }
  } catch (e) {
    // ignore
  }

  const overlayRoot = document.getElementById('overlay-root');
  const sessionInit: XRSessionInit = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: overlayRoot ? ['dom-overlay', 'local-floor'] : ['local-floor'],
  };
  if (overlayRoot) (sessionInit as any).domOverlay = { root: overlayRoot };

  try {
    const session = await navigator.xr.requestSession('immersive-ar', sessionInit);
    _xrSession = session;
    console.log('[AR] session started', { domOverlay: !!overlayRoot });

    // create an offscreen canvas + gl context
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { xrCompatible: true }) as WebGLRenderingContext | null;
    if (!gl) {
      console.warn('[AR] could not create XR-compatible WebGL context; frame capture may fail.');
    } else {
      _gl = gl;
      const XRWebGLLayerCtor = (window as any).XRWebGLLayer;
      if (XRWebGLLayerCtor) {
        try {
          const xrGlLayer = new XRWebGLLayerCtor(session, gl);
          await session.updateRenderState({ baseLayer: xrGlLayer });
        } catch (e) {
          console.warn('[AR] XRWebGLLayer/updateRenderState failed:', e);
        }
      } else {
        console.warn('[AR] XRWebGLLayer constructor not present.');
      }

      try {
        _xrRefSpace = await session.requestReferenceSpace('local-floor');
      } catch {
        try {
          _xrRefSpace = await session.requestReferenceSpace('local');
        } catch {
          _xrRefSpace = null;
        }
      }

      _frameCallback = (time: DOMHighResTimeStamp, frame: XRFrame) => {
        const sess = frame.session;
        const baseLayer = sess.renderState.baseLayer as any;

        if (_gl && baseLayer && baseLayer.framebuffer) {
          _gl.bindFramebuffer(_gl.FRAMEBUFFER, baseLayer.framebuffer);

          const pose = _xrRefSpace ? frame.getViewerPose(_xrRefSpace) : null;
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
            }
          } else {
            _gl.viewport(0, 0, _gl.drawingBufferWidth, _gl.drawingBufferHeight);
            _gl.clearColor(0.0, 0.0, 0.0, 0.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
          }

          // optionally capture framebuffer and create ImageBitmap
          if (onXRFrame && _gl) {
            try {
              const width = (baseLayer.framebufferWidth) || _gl.drawingBufferWidth;
              const height = (baseLayer.framebufferHeight) || _gl.drawingBufferHeight;

              const buf = new Uint8Array(width * height * 4);
              _gl.readPixels(0, 0, width, height, _gl.RGBA, _gl.UNSIGNED_BYTE, buf);

              const imageData = new ImageData(new Uint8ClampedArray(buf.buffer), width, height);

              createImageBitmap(imageData)
                .then(async (bitmap) => {
                  try {
                    await onXRFrame(bitmap);
                  } catch (e) {
                    console.warn('[AR] onXRFrame handler failed:', e);
                  } finally {
                    bitmap.close?.();
                  }
                })
                .catch((err) => {
                  console.warn('[AR] createImageBitmap failed:', err);
                });
            } catch (e) {
              console.warn('[AR] readPixels/createImageBitmap failed:', e);
            }
          }

          _gl.bindFramebuffer(_gl.FRAMEBUFFER, null);
        }

        sess.requestAnimationFrame(_frameCallback!);
      };

      session.requestAnimationFrame(_frameCallback);
    }

    session.addEventListener('end', () => {
      console.log('[AR] session ended (event)');
      cleanup();

      // attempt to resume page camera if it exists
      try {
        const pageVideo = document.querySelector('video') as HTMLVideoElement | null;
        if (pageVideo && pageVideo.srcObject) {
          pageVideo.play().catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    });

    return true;
  } catch (err) {
    console.error('[AR] Failed to start session', err);
    cleanup();

    // try to resume page camera even on failure
    try {
      const pageVideo = document.querySelector('video') as HTMLVideoElement | null;
      if (pageVideo && pageVideo.srcObject) {
        pageVideo.play().catch(() => {});
      }
    } catch {}

    return false;
  }
}

export async function endARSession(): Promise<boolean> {
  try {
    if (_xrSession) {
      await _xrSession.end();
      cleanup();
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
