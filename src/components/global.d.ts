// src/global.d.ts
export {};

declare global {
  interface Navigator {
    xr?: any;
  }

  interface XRCPUDepthInformation {
    width: number;
    height: number;
    data: ArrayBuffer; // actual data, will cast to Float32Array
  }

  interface XRFrame {
    getDepthInformation(view: any): XRCPUDepthInformation | undefined;
    session: XRSession;
  }

  interface XRSession {
    requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
  }

  interface XRReferenceSpace {}
}
