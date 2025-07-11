import React, { useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { WebcamFeed } from './WebcamFeed';
import {
  getShoulderWidth,
  getTorsoLength,
  getPixelHeight,
  convertPxToCm
} from '../utils/measurements';

export const PoseDetector: React.FC = () => {
  const webcamRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const run = async () => {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('✅ TensorFlow ready');

      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      console.log('✅ Pose detector created');

      const drawLoop = async () => {
        const video = webcamRef.current?.video as HTMLVideoElement;
        const canvas = canvasRef.current;
        if (video?.readyState === 4 && canvas) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const poses = await detector.estimatePoses(video);
            console.log('📸 Poses:', poses);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (poses.length > 0) {
              const keypoints = poses[0].keypoints;

              // Draw skeleton
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

              // Draw keypoints
              keypoints.forEach((kp) => {
                if (kp.score! > 0.3) {
                  ctx.beginPath();
                  ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
                  ctx.fillStyle = 'red';
                  ctx.fill();
                }
              });

              // Measurements
              const shoulderPx = getShoulderWidth(keypoints);
              const torsoPx = getTorsoLength(keypoints);
              const heightPx = getPixelHeight(keypoints);
              const fovDegrees = 60;

              const shoulderCm = shoulderPx ? convertPxToCm(shoulderPx, fovDegrees, canvas.width) : null;
              const torsoCm = torsoPx ? convertPxToCm(torsoPx, fovDegrees, canvas.width) : null;
              const heightCm = heightPx ? convertPxToCm(heightPx, fovDegrees, canvas.width) : null;

              const shoulderIn = shoulderCm ? shoulderCm / 2.54 : null;
              const torsoIn = torsoCm ? torsoCm / 2.54 : null;
              const heightIn = heightCm ? heightCm / 2.54 : null;

              ctx.fillStyle = 'white';
              ctx.font = '16px sans-serif';
              let offsetY = 20;

              // Show all 3 units always if values exist
              if (shoulderPx !== null && shoulderCm !== null && shoulderIn !== null) {
                ctx.fillText(`Shoulder: ${shoulderPx.toFixed(0)} px | ${shoulderCm.toFixed(1)} cm | ${shoulderIn.toFixed(1)} in`, 10, offsetY);
                offsetY += 20;
              }
              if (torsoPx !== null && torsoCm !== null && torsoIn !== null) {
                ctx.fillText(`Torso: ${torsoPx.toFixed(0)} px | ${torsoCm.toFixed(1)} cm | ${torsoIn.toFixed(1)} in`, 10, offsetY);
                offsetY += 20;
              }
              if (heightPx !== null && heightCm !== null && heightIn !== null) {
                ctx.fillText(`Height: ${heightPx.toFixed(0)} px | ${heightCm.toFixed(1)} cm | ${heightIn.toFixed(1)} in`, 10, offsetY);
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
    <div className="pose-wrapper">
      <div className="video-container">
        <WebcamFeed ref={webcamRef} />
        <canvas ref={canvasRef} className="pose-canvas" />
      </div>
    </div>
  );
};
