// src/utils/measurements.ts

export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export function convertPxToCm(px: number, fovDegrees: number, screenWidthPx: number, distanceToCameraCm = 65): number {
  const fovRadians = (fovDegrees * Math.PI) / 180;
  const widthCm = 2 * distanceToCameraCm * Math.tan(fovRadians / 2);
  const pxPerCm = screenWidthPx / widthCm;
  return px / pxPerCm;
}

export function convertCmToInch(cm: number): number {
  return cm / 2.54;
}

export function getShoulderWidth(keypoints: any[]): number | null {
  const left = keypoints[5], right = keypoints[6];
  return left?.score > 0.3 && right?.score > 0.3 ? distance(left, right) : null;
}

export function getTorsoLength(keypoints: any[]): number | null {
  const shoulder = keypoints[5], hip = keypoints[11];
  return shoulder?.score > 0.3 && hip?.score > 0.3 ? distance(shoulder, hip) : null;
}

export function getPixelHeight(keypoints: any[]): number | null {
  const top = keypoints[0], bottom = keypoints[16];
  return top?.score > 0.3 && bottom?.score > 0.3 ? Math.abs(top.y - bottom.y) : null;
}

// ————————————————————————————————————————————————————————————————
// Step 2.3+2.4: Accurate, distance‑independent conversion via AR depth + pinhole camera
export function convertDepthToCmUsingAR(
  kp1: { x: number; y: number },
  kp2: { x: number; y: number },
  depthInfo: XRCPUDepthInformation,
  videoWidth: number,
  videoHeight: number,
  hFovDegrees = 60    // Adjust if your device reports a different horizontal FOV
): number | null {
  if (!depthInfo) return null;

  // Half‑angles
  const hHalf = (hFovDegrees * Math.PI/180) / 2;
  const vHalf = Math.atan(Math.tan(hHalf) * (videoHeight / videoWidth));

  // Project pixel (px,py) + depth z → 3D point {X,Y,Z}
  const project = (px: number, py: number): { X: number; Y: number; Z: number } | null => {
    const u = px / videoWidth;
    const v = py / videoHeight;
    const ix = Math.floor(u * depthInfo.width);
    const iy = Math.floor(v * depthInfo.height);
    const idx = ix + iy * depthInfo.width;
    const z = (depthInfo.data as Float32Array)[idx];
    if (!isFinite(z) || z <= 0) return null;

    // normalized coords in [–1…1]
    const xn = (u - 0.5) * 2;
    const yn = (v - 0.5) * 2;

    // back‑project
    const X = Math.tan(hHalf) * z * xn;
    const Y = Math.tan(vHalf) * z * yn;
    return { X, Y, Z: z };
  };

  const P1 = project(kp1.x, kp1.y);
  const P2 = project(kp2.x, kp2.y);
  if (!P1 || !P2) return null;

  // Euclidean distance in meters
  const dx = P1.X - P2.X;
  const dy = P1.Y - P2.Y;
  const dz = P1.Z - P2.Z;
  const meters = Math.sqrt(dx*dx + dy*dy + dz*dz);
  return meters * 100;  // convert to cm
}
