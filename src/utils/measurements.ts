import { Keypoint } from '@tensorflow-models/pose-detection';

export function distance(a: Keypoint, b: Keypoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getShoulderWidth(keypoints: Keypoint[]): number | null {
  const left = keypoints.find(k => k.name === 'left_shoulder');
  const right = keypoints.find(k => k.name === 'right_shoulder');
  if (left && right && left.score! > 0.3 && right.score! > 0.3) {
    return distance(left, right);
  }
  return null;
}

export function getTorsoLength(keypoints: Keypoint[]): number | null {
  const shoulder = keypoints.find(k => k.name === 'left_shoulder');
  const hip = keypoints.find(k => k.name === 'left_hip');
  if (shoulder && hip && shoulder.score! > 0.3 && hip.score! > 0.3) {
    return distance(shoulder, hip);
  }
  return null;
}

export function getPixelHeight(keypoints: Keypoint[]): number | null {
  const nose = keypoints.find(k => k.name === 'nose');
  const leftAnkle = keypoints.find(k => k.name === 'left_ankle');
  const rightAnkle = keypoints.find(k => k.name === 'right_ankle');
  if (nose && leftAnkle && rightAnkle &&
      nose.score! > 0.3 && leftAnkle.score! > 0.3 && rightAnkle.score! > 0.3) {
    const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
    return Math.abs(avgAnkleY - nose.y);
  }
  return null;
}

// Convert pixels to cm using horizontal field-of-view approximation
export function convertPxToCm(pixels: number, fovDeg: number, frameWidth: number): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  const distanceCm = 50; // assume user is 50cm from camera
  const viewWidthCm = 2 * distanceCm * Math.tan(fovRad / 2);
  const pxPerCm = frameWidth / viewWidthCm;
  return pixels / pxPerCm;
}
