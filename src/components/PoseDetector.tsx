import React, { useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { WebcamFeed } from './WebcamFeed';
import {
  getShoulderWidth,
  getTorsoLength,
  getPixelHeight
} from '../utils/measurements';

export const PoseDetector: React.FC = () => {
  const webcamRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const run = async () => {
      // 1️⃣ Initialize WebGL backend
      await tf.setBackend('webgl');
      await tf.ready();

      // 2️⃣ Create MoveNet detector
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );

      // 3️⃣ Draw loop
      const drawLoop = async () => {
        const video = webcamRef.current?.video as HTMLVideoElement;
        const canvas = canvasRef.current;
        if (video?.readyState === 4 && canvas) {
          // Match canvas to video size
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // 4️⃣ Estimate poses
            const poses = await detector.estimatePoses(video);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (poses.length > 0) {
              const keypoints = poses[0].keypoints;

              // — Draw skeleton lines —
              const adjacentPairs = poseDetection.util.getAdjacentPairs(
                poseDetection.SupportedModels.MoveNet
              );
              ctx.lineWidth = 2;
              ctx.strokeStyle = 'lime';
              adjacentPairs.forEach(([i, j]) => {
                const kp1 = keypoints[i];
                const kp2 = keypoints[j];
                if (kp1.score! > 0.3 && kp2.score! > 0.3) {
                  ctx.beginPath();
                  ctx.moveTo(kp1.x, kp1.y);
                  ctx.lineTo(kp2.x, kp2.y);
                  ctx.stroke();
                }
              });

              // — Draw keypoints —
              keypoints.forEach((kp) => {
                if (kp.score! > 0.3) {
                  ctx.beginPath();
                  ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
                  ctx.fillStyle = 'red';
                  ctx.fill();
                }
              });

              // — Compute & display measurements —
              const shoulderPx = getShoulderWidth(keypoints);
              const torsoPx    = getTorsoLength(keypoints);
              const heightPx   = getPixelHeight(keypoints);

              ctx.fillStyle = 'white';
              ctx.font = '16px sans-serif';
              let offsetY = 20;
              if (shoulderPx !== null) {
                ctx.fillText(`Shoulder: ${shoulderPx.toFixed(0)}px`, 10, offsetY);
                offsetY += 20;
              }
              if (torsoPx !== null) {
                ctx.fillText(`Torso: ${torsoPx.toFixed(0)}px`, 10, offsetY);
                offsetY += 20;
              }
              if (heightPx !== null) {
                ctx.fillText(`Height: ${heightPx.toFixed(0)}px`, 10, offsetY);
              }
            }
          }
        }
        requestAnimationFrame(drawLoop);
      };

      drawLoop();
    };

    run();
  }, []);

  return (
    <div className="relative inline-block">
      <WebcamFeed ref={webcamRef} />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 pointer-events-none"
      />
    </div>
  );
};
