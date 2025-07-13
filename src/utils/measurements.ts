// src/utils/measurements.ts

/**
 * Euclidean distance between two 2D points.
 */
export function distance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/**
 * Shoulder width in pixels (left_shoulder to right_shoulder).
 */
export function getShoulderWidth(keypoints: any[]): number | null {
  const left = keypoints.find((kp) => kp.name === 'left_shoulder');
  const right = keypoints.find((kp) => kp.name === 'right_shoulder');
  if (left?.score! > 0.3 && right?.score! > 0.3) {
    return distance(left, right);
  }
  return null;
}

/**
 * Torso length in pixels (left_shoulder to left_hip).
 */
export function getTorsoLength(keypoints: any[]): number | null {
  const shoulder = keypoints.find((kp) => kp.name === 'left_shoulder');
  const hip = keypoints.find((kp) => kp.name === 'left_hip');
  if (shoulder?.score! > 0.3 && hip?.score! > 0.3) {
    return distance(shoulder, hip);
  }
  return null;
}

/**
 * Pixel height from nose to left_ankle.
 */
export function getPixelHeight(keypoints: any[]): number | null {
  const top = keypoints.find((kp) => kp.name === 'nose');
  const bottom = keypoints.find((kp) => kp.name === 'left_ankle');
  if (top?.score! > 0.3 && bottom?.score! > 0.3) {
    return distance(top, bottom);
  }
  return null;
}

/**
 * Convert a pixel measurement to centimeters.
 *
 * @param px            The pixel distance to convert.
 * @param fovDeg        The camera field‑of‑view in degrees.
 * @param frameWidthPx  The displayed video width in pixels.
 * @param depthCm       (Optional) Actual distance from camera to subject in cm.
 *                       If omitted, defaults to 65 cm.
 */
export function convertPxToCm(
  px: number,
  fovDeg: number,
  frameWidthPx: number,
  depthCm: number = 65
): number {
  const fovRad = (fovDeg * Math.PI) / 180;
  // physical width of view at subject distance
  const viewWidthCm = 2 * depthCm * Math.tan(fovRad / 2);
  const cmPerPx = viewWidthCm / frameWidthPx;
  const cm = px * cmPerPx;
  return cm;
}

/**
 * Simple cm → inch conversion.
 */
export function convertCmToInch(cm: number): number {
  return cm / 2.54;
}

/**
 * Compute the true 3D distance (in cm) between two keypoints using per‑pixel depth.
 *
 * @param kp1           First keypoint { x, y } in pixel coordinates.
 * @param kp2           Second keypoint { x, y } in pixel coordinates.
 * @param depthInfo     XRCPUDepthInformation from WebXR.
 * @param videoWidth    Raw video width (in pixels) used by the pose detector.
 * @param videoHeight   Raw video height (in pixels).
 */
export function compute3DDistance(
  kp1: { x: number; y: number },
  kp2: { x: number; y: number },
  depthInfo: XRCPUDepthInformation,
  videoWidth: number,
  videoHeight: number
): number | null {
  // Helper to sample depth (in meters) at a keypoint
  const sampleDepth = (x: number, y: number): number | null => {
    const u = x / videoWidth;
    const v = y / videoHeight;
    const px = Math.floor(u * depthInfo.width);
    const py = Math.floor(v * depthInfo.height);
    const idx = px + py * depthInfo.width;
    const dataArray = depthInfo.data as Uint8Array | Uint16Array;
const meters = dataArray[idx];

    return isFinite(meters) ? meters : null;
  };

  const z1 = sampleDepth(kp1.x, kp1.y);
  const z2 = sampleDepth(kp2.x, kp2.y);
  if (z1 == null || z2 == null) return null;

  // Pixel separation (2D)
  const dx = kp1.x - kp2.x;
  const dy = kp1.y - kp2.y;
  // Depth difference in cm
  const dz = (z1 - z2) * 100;

  // 3D distance (Pythagoras)
  return Math.hypot(dx, dy, dz);
}
