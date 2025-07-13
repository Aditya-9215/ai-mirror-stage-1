// src/components/PoseDetector.tsx

import React, { useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { WebcamFeed } from './WebcamFeed';
import {
  getShoulderWidth,
  getTorsoLength,
  getPixelHeight,
  convertPxToCm,
  convertCmToInch,
  compute3DDistance,
} from '../utils/measurements';
import { getLatestDepthInfo } from './ar/arSession';

export const PoseDetector: React.FC = () => {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const run = async () => {
      // 1. Initialize TensorFlow.js
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('✅ TensorFlow ready');

      // 2. Create a MoveNet pose detector
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      console.log('✅ Pose detector created');

      // 3. Main draw loop
      const drawLoop = async () => {
        const video = webcamRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== 4) {
          requestAnimationFrame(drawLoop);
          return;
        }

        // 3a. Match canvas to displayed video size
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const cw = video.clientWidth;
        const ch = video.clientHeight;
        const scaleX = cw / vw;
        const scaleY = ch / vh;

        canvas.width = cw;
        canvas.height = ch;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          requestAnimationFrame(drawLoop);
          return;
        }
        ctx.clearRect(0, 0, cw, ch);

        // 3b. Estimate poses
        const poses = await detector.estimatePoses(video);
        if (poses.length === 0) {
          requestAnimationFrame(drawLoop);
          return;
        }
        const keypoints = poses[0].keypoints;

        // 3c. Draw skeleton
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

        // 3d. Draw keypoints
        ctx.fillStyle = 'red';
        keypoints.forEach((kp) => {
          if (kp.score! > 0.3) {
            ctx.beginPath();
            ctx.arc(kp.x * scaleX, kp.y * scaleY, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        // 3e. Compute measurements
        const depthInfo = getLatestDepthInfo();
        let shoulderCm: number | null = null;
        let torsoCm: number | null = null;
        let heightCm: number | null = null;

        // Try 3D if depth available
        if (depthInfo) {
          const s3d = compute3DDistance(
            keypoints[5], // left_shoulder index
            keypoints[6], // right_shoulder index
            depthInfo,
            vw,
            vh
          );
          const t3d = compute3DDistance(
            keypoints[5],
            keypoints[11], // left_hip index
            depthInfo,
            vw,
            vh
          );
          const h3d = compute3DDistance(
            keypoints[0], // nose index
            keypoints[15], // left_ankle index
            depthInfo,
            vw,
            vh
          );
          shoulderCm = s3d;
          torsoCm = t3d;
          heightCm = h3d;
        }

        // Fallback to 2D approximation
        const fov = 60;
        const shoulderPx = getShoulderWidth(keypoints);
        const torsoPx = getTorsoLength(keypoints);
        const heightPx = getPixelHeight(keypoints);

        if (shoulderCm == null && shoulderPx != null) {
          shoulderCm = convertPxToCm(shoulderPx, fov, cw);
        }
        if (torsoCm == null && torsoPx != null) {
          torsoCm = convertPxToCm(torsoPx, fov, cw);
        }
        if (heightCm == null && heightPx != null) {
          heightCm = convertPxToCm(heightPx, fov, cw);
        }

        // 3f. Draw measurement text
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        let y = 20;

        if (shoulderCm != null && shoulderPx != null) {
          ctx.fillText(
            `Shoulder: ${shoulderCm.toFixed(1)} cm / ${convertCmToInch(
              shoulderCm
            ).toFixed(1)} in / ${shoulderPx.toFixed(0)} px`,
            10,
            y
          );
          y += 20;
        }
        if (torsoCm != null && torsoPx != null) {
          ctx.fillText(
            `Torso: ${torsoCm.toFixed(1)} cm / ${convertCmToInch(
              torsoCm
            ).toFixed(1)} in / ${torsoPx.toFixed(0)} px`,
            10,
            y
          );
          y += 20;
        }
        if (heightCm != null && heightPx != null) {
          ctx.fillText(
            `Height: ${heightCm.toFixed(1)} cm / ${convertCmToInch(
              heightCm
            ).toFixed(1)} in / ${heightPx.toFixed(0)} px`,
            10,
            y
          );
        }

        requestAnimationFrame(drawLoop);
      };

      drawLoop();
    };

    run();
  }, []);

  return (
    <div className="pose-wrapper">
      <WebcamFeed ref={webcamRef} />
      <canvas ref={canvasRef} className="pose-canvas" />
    </div>
  );
};
