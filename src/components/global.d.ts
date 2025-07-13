/// <reference types="webxr" />

export {};

declare global {
  interface Navigator {
    xr?: XRSystem;
  }

  interface XRCPUDepthInformation extends XRDepthInformation {
    data: Uint8Array | Uint16Array;
    width: number;
    height: number;
    normDepthBufferFromNormView: Float32Array;
    rawValueToMeters: number;
  }
}
