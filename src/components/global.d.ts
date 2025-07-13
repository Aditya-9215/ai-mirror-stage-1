// src/global.d.ts

export {};

declare global {
  interface Navigator {
    xr?: any;
  }

  interface XRCPUDepthInformation {
    width: number;
    height: number;
    data: Float32Array;
    getDepthInMeters(x: number, y: number): number;
  }
}
