export function convertPxToCm(pixels: number, fovDegrees: number, screenWidthPx: number): number {
  const fovRadians = (fovDegrees * Math.PI) / 180;
  const distanceToCamera = 65; // Adjusted from 50 to 35 for more realistic results
  const widthCm = 2 * distanceToCamera * Math.tan(fovRadians / 2);
  const cmPerPixel = widthCm / screenWidthPx;
  const result = pixels * cmPerPixel;

  console.log(`🧮 ${pixels}px ≈ ${result.toFixed(2)} cm (at ${distanceToCamera}cm, FOV: ${fovDegrees}°, width: ${screenWidthPx}px)`);

  return result;
}

export function convertCmToInch(cm: number): number {
  return cm / 2.54;
}

export function distance(a: any, b: any): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function getShoulderWidth(keypoints: any[]): number | null {
  const left = keypoints.find((kp) => kp.name === 'left_shoulder');
  const right = keypoints.find((kp) => kp.name === 'right_shoulder');
  return left && right ? distance(left, right) : null;
}

export function getTorsoLength(keypoints: any[]): number | null {
  const shoulder = keypoints.find((kp) => kp.name === 'left_shoulder');
  const hip = keypoints.find((kp) => kp.name === 'left_hip');
  return shoulder && hip ? distance(shoulder, hip) : null;
}

export function getPixelHeight(keypoints: any[]): number | null {
  const top = keypoints.find((kp) => kp.name === 'nose');
  const bottom = keypoints.find((kp) => kp.name === 'left_ankle' || kp.name === 'right_ankle');
  return top && bottom ? distance(top, bottom) : null;
}
