export function pxToCm(
  pxDistance: number,
  fovDegrees: number = 60,
  resolutionHeight: number = 720,
  realWorldDistanceToCamera: number = 60 // in cm
): number {
  const fovRadians = (fovDegrees * Math.PI) / 180;
  const pixelSizeCm = 2 * realWorldDistanceToCamera * Math.tan(fovRadians / 2) / resolutionHeight;
  return pxDistance * pixelSizeCm;
}
