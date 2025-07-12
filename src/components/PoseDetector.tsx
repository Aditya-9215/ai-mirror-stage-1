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
} from '../utils/measurements';

export const PoseDetector: React.FC = () => {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const run = async () => {
      await tf.setBackend('webgl');
      await tf.ready();

      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );

      const drawLoop = async () => {
        const video = webcamRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === 4) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const cw = video.clientWidth;
          const ch = video.clientHeight;

          // match canvas to displayed video size
          canvas.width = cw;
          canvas.height = ch;

          const scaleX = cw / vw;
          const scaleY = ch / vh;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, cw, ch);

          const poses = await detector.estimatePoses(video);
          if (poses.length === 0) {
            requestAnimationFrame(drawLoop);
            return;
          }

          const keypoints = poses[0].keypoints;

          // Draw skeleton
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

          // Draw keypoints
          ctx.fillStyle = 'red';
          keypoints.forEach((kp) => {
            if (kp.score! > 0.3) {
              ctx.beginPath();
              ctx.arc(kp.x * scaleX, kp.y * scaleY, 5, 0, 2 * Math.PI);
              ctx.fill();
            }
          });

          // Measurements
          const shoulderPx = getShoulderWidth(keypoints);
          const torsoPx = getTorsoLength(keypoints);
          const heightPx = getPixelHeight(keypoints);
          const fov = 60; // degrees

          const shoulderCm =
            shoulderPx != null ? convertPxToCm(shoulderPx, fov, cw) : null;
          const torsoCm =
            torsoPx != null ? convertPxToCm(torsoPx, fov, cw) : null;
          const heightCm =
            heightPx != null ? convertPxToCm(heightPx, fov, cw) : null;

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
