import type { Keypoint } from '@tensorflow-models/pose-detection';

function distance(a: Keypoint, b: Keypoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Get shoulder width (px)
 */
export function getShoulderWidth(keypoints: Keypoint[]): number | null {
  const left = keypoints.find(k => k.name === 'left_shoulder');
  const right = keypoints.find(k => k.name === 'right_shoulder');
  if (
    left !== undefined &&
    right !== undefined &&
    left.score! > 0.3 &&
    right.score! > 0.3
  ) {
    return distance(left, right);
  }
  return null;
}

/**
 * Get torso length (neck to hip) in px
 */
export function getTorsoLength(keypoints: Keypoint[]): number | null {
  const leftShoulder = keypoints.find(k => k.name === 'left_shoulder');
  const rightShoulder = keypoints.find(k => k.name === 'right_shoulder');
  const leftHip = keypoints.find(k => k.name === 'left_hip');

  if (
    leftShoulder !== undefined &&
    rightShoulder !== undefined &&
    leftHip !== undefined &&
    leftShoulder.score! > 0.3 &&
    rightShoulder.score! > 0.3 &&
    leftHip.score! > 0.3
  ) {
    // approximate neck as midpoint of shoulders
    const neck: Keypoint = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      score: (leftShoulder.score! + rightShoulder.score!) / 2,
      name: 'neck',
    };
    return distance(neck, leftHip);
  }
  return null;
}

/**
 * Get approximate height in px (nose to average ankle)
 */
export function getPixelHeight(keypoints: Keypoint[]): number | null {
  const nose = keypoints.find(k => k.name === 'nose');
  const leftAnkle = keypoints.find(k => k.name === 'left_ankle');
  const rightAnkle = keypoints.find(k => k.name === 'right_ankle');

  if (
    nose !== undefined &&
    leftAnkle !== undefined &&
    rightAnkle !== undefined &&
    nose.score! > 0.3 &&
    leftAnkle.score! > 0.3 &&
    rightAnkle.score! > 0.3
  ) {
    const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;
    return Math.abs(avgAnkleY - nose.y);
  }
  return null;
}
