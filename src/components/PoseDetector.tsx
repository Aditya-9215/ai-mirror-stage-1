// src/components/PoseDetector.tsx
import React, { useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { WebcamFeed, WebcamHandle } from './WebcamFeed';
import {
  getShoulderWidth,
  getTorsoLength,
  getPixelHeight,
  convertPxToCm,
  convertCmToInch,
  convertDepthToCmUsingAR
} from '../utils/measurements';
import { getLatestDepthInfo } from './ar/arSession';

export const PoseDetector: React.FC = () => {
  const webcamRef = useRef<WebcamHandle>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let detector: poseDetection.PoseDetector;

    async function init() {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('✅ TensorFlow ready');

      detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      console.log('✅ Pose detector created');

      requestAnimationFrame(renderFrame);
    }

    async function renderFrame() {
      const videoEl = webcamRef.current?.video;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!videoEl || !canvas || !ctx || !detector) {
        requestAnimationFrame(renderFrame);
        return;
      }

      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const cw = videoEl.clientWidth;
      const ch = videoEl.clientHeight;
      if (vw === 0 || vh === 0) {
        requestAnimationFrame(renderFrame);
        return;
      }

      // match canvas to displayed video
      canvas.width = cw;
      canvas.height = ch;
      const scaleX = cw / vw;
      const scaleY = ch / vh;

      ctx.clearRect(0, 0, cw, ch);

      const poses = await detector.estimatePoses(videoEl);
      if (poses.length > 0) {
        const keypoints = poses[0].keypoints;

        // draw skeleton
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'lime';
        poseDetection.util
          .getAdjacentPairs(poseDetection.SupportedModels.MoveNet)
          .forEach(([i, j]) => {
            const a = keypoints[i];
            const b = keypoints[j];
            if (a.score! > 0.3 && b.score! > 0.3) {
              ctx.beginPath();
              ctx.moveTo(a.x * scaleX, a.y * scaleY);
              ctx.lineTo(b.x * scaleX, b.y * scaleY);
              ctx.stroke();
            }
          });

        // draw keypoints
        ctx.fillStyle = 'red';
        keypoints.forEach((kp) => {
          if (kp.score! > 0.3) {
            ctx.beginPath();
            ctx.arc(kp.x * scaleX, kp.y * scaleY, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        // measurements
        const fov = 60;
        const depthInfo = getLatestDepthInfo();
        const useAR = !!depthInfo;

        const shoulderPx = getShoulderWidth(keypoints) ?? 0;
        const torsoPx    = getTorsoLength(keypoints) ?? 0;
        const heightPx   = getPixelHeight(keypoints) ?? 0;

        const shoulderCm = useAR
          ? convertDepthToCmUsingAR(keypoints[5], keypoints[6], depthInfo!, vw, vh, fov)
          : convertPxToCm(shoulderPx, fov, cw);
        const torsoCm = useAR
          ? convertDepthToCmUsingAR(keypoints[5], keypoints[11], depthInfo!, vw, vh, fov)
          : convertPxToCm(torsoPx, fov, cw);
        const heightCm = useAR
          ? convertDepthToCmUsingAR(keypoints[0], keypoints[16], depthInfo!, vw, vh, fov)
          : convertPxToCm(heightPx, fov, cw);

        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        let y = 20;
        if (shoulderCm != null) {
          ctx.fillText(
            `Shoulder: ${shoulderCm.toFixed(1)} cm / ${convertCmToInch(shoulderCm).toFixed(1)} in`,
            10,
            y
          );
          y += 20;
        }
        if (torsoCm != null) {
          ctx.fillText(
            `Torso: ${torsoCm.toFixed(1)} cm / ${convertCmToInch(torsoCm).toFixed(1)} in`,
            10,
            y
          );
          y += 20;
        }
        if (heightCm != null) {
          ctx.fillText(
            `Height: ${heightCm.toFixed(1)} cm / ${convertCmToInch(heightCm).toFixed(1)} in`,
            10,
            y
          );
        }
      }

      requestAnimationFrame(renderFrame);
    }

    init();
  }, []);

  return (
    <div className="pose-wrapper">
      <div className="video-container">
        <WebcamFeed ref={webcamRef} />
        <canvas ref={canvasRef} className="pose-canvas" />
      </div>
    </div>
  );
};
