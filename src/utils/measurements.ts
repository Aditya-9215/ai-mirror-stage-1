export function distance(p1: any, p2: any): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export function getShoulderWidth(keypoints: any[]): number | null {
  const left = keypoints.find((k) => k.name === 'left_shoulder');
  const right = keypoints.find((k) => k.name === 'right_shoulder');
  if (left?.score! > 0.3 && right?.score! > 0.3) return distance(left, right);
  return null;
}

export function getTorsoLength(keypoints: any[]): number | null {
  const sh = keypoints.find((k) => k.name === 'left_shoulder');
  const hip = keypoints.find((k) => k.name === 'left_hip');
  if (sh?.score! > 0.3 && hip?.score! > 0.3) return distance(sh, hip);
  return null;
}

export function getPixelHeight(keypoints: any[]): number | null {
  const top = keypoints.find((k) => k.name === 'nose');
  const bot = keypoints.find((k) => k.name === 'left_ankle');
  if (top?.score! > 0.3 && bot?.score! > 0.3) return distance(top, bot);
  return null;
}

export function convertPxToCm(
  px: number,
  fovDeg: number,
  screenWidthPx: number
): number {
  const fov = (fovDeg * Math.PI) / 180;
  const distCm = 65; // assume 65cm
  const widthCm = 2 * distCm * Math.tan(fov / 2);
  const cmPerPx = widthCm / screenWidthPx;
  return px * cmPerPx;
}

export function convertCmToInch(cm: number): number {
  return cm / 2.54;
}
