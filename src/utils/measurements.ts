// src/utils/measurements.ts
export function distance(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function getShoulderWidth(keypoints: any[]): number | null {
  const left = keypoints.find((k) => k.name === 'left_shoulder');
  const right = keypoints.find((k) => k.name === 'right_shoulder');
  return left?.score > 0.3 && right?.score > 0.3 ? distance(left, right) : null;
}

export function getTorsoLength(keypoints: any[]): number | null {
  const s = keypoints.find((k) => k.name === 'left_shoulder');
  const h = keypoints.find((k) => k.name === 'left_hip');
  return s?.score > 0.3 && h?.score > 0.3 ? distance(s, h) : null;
}

export function getPixelHeight(keypoints: any[]): number | null {
  const n = keypoints.find((k) => k.name === 'nose');
  const a = keypoints.find((k) => k.name === 'left_ankle');
  return n?.score > 0.3 && a?.score > 0.3 ? Math.abs(n.y - a.y) : null;
}

export function convertPxToCm(px: number, fovDeg: number, screenW: number, distCm = 65): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  const widthCm = 2 * distCm * Math.tan(fovRad / 2);
  return px / (screenW / widthCm);
}

export function convertCmToInch(cm: number): number {
  return cm / 2.54;
}

export function convertDepthToCmUsingAR(
  kp1: { x: number; y: number },
  kp2: { x: number; y: number },
  depthInfo: XRCPUDepthInformation,
  vw: number,
  vh: number
): number | null {
  const data = new Float32Array(depthInfo.data);
  const sample = (px: number, py: number) => {
    const i = Math.floor(px * depthInfo.width);
    const j = Math.floor(py * depthInfo.height);
    const z = data[i + j * depthInfo.width];
    return isFinite(z) ? z : null;
  };

  const u1 = kp1.x / vw, v1 = kp1.y / vh;
  const u2 = kp2.x / vw, v2 = kp2.y / vh;
  const d1 = sample(u1, v1), d2 = sample(u2, v2);
  if (d1 == null || d2 == null) return null;

  const dx = (u1 - u2) * 2 * d1 * Math.tan(0.5 * (60 * Math.PI/180));
  const dy = (v1 - v2) * 2 * d1 * Math.tan(0.5 * (60 * Math.PI/180)) * (vh/vw);
  const dz = d1 - d2;
  return Math.sqrt(dx*dx + dy*dy + dz*dz)*100;
}
