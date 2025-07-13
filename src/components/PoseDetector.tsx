import React, { useEffect, useRef } from 'react';
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

interface PoseDetectorProps {
  facingMode?: 'user' | 'environment';
}

export const PoseDetector: React.FC<PoseDetectorProps> = ({ facingMode = 'user' }) => {
  const webcamRef = useRef<WebcamHandle>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let detector: poseDetection.PoseDetector;

    const run = async () => {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('✅ TensorFlow ready');

      detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
      );
      console.log('✅ Pose detector created');

      const detect = async () => {
        const handle = webcamRef.current;
        const videoEl = handle?.video;
        const mirror = handle?.isMirrored;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!videoEl || !canvas || !ctx || !detector) {
          requestAnimationFrame(detect);
          return;
        }

        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const poses = await detector.estimatePoses(videoEl);
        if (poses.length === 0) {
          requestAnimationFrame(detect);
          return;
        }

        const keypoints = poses[0].keypoints;
        const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet);

        ctx.save();

        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        // Draw skeleton lines
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;
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

        ctx.restore();

        // Measurement
        const shoulderPx = getShoulderWidth(keypoints);
        const torsoPx = getTorsoLength(keypoints);
        const heightPx = getPixelHeight(keypoints);
        const fov = 60;

        const depthInfo = getLatestDepthInfo();
        let shoulderCm = null, torsoCm = null, heightCm = null;

        if (depthInfo && shoulderPx !== null && torsoPx !== null && heightPx !== null) {
          shoulderCm = convertDepthToCmUsingAR(keypoints[5], keypoints[6], depthInfo, canvas.width, canvas.height);
          torsoCm = convertDepthToCmUsingAR(keypoints[5], keypoints[11], depthInfo, canvas.width, canvas.height);
          heightCm = convertDepthToCmUsingAR(keypoints[0], keypoints[16], depthInfo, canvas.width, canvas.height);
        } else {
          if (shoulderPx) shoulderCm = convertPxToCm(shoulderPx, fov, canvas.width);
          if (torsoPx) torsoCm = convertPxToCm(torsoPx, fov, canvas.width);
          if (heightPx) heightCm = convertPxToCm(heightPx, fov, canvas.width);
        }

        // Display measurements
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        let offsetY = 20;

        if (shoulderCm && shoulderPx) {
          ctx.fillText(
            `Shoulder: ${shoulderCm.toFixed(1)} cm / ${convertCmToInch(shoulderCm).toFixed(1)} in / ${shoulderPx.toFixed(0)} px`,
            10,
            offsetY
          );
          offsetY += 20;
        }

        if (torsoCm && torsoPx) {
          ctx.fillText(
            `Torso: ${torsoCm.toFixed(1)} cm / ${convertCmToInch(torsoCm).toFixed(1)} in / ${torsoPx.toFixed(0)} px`,
            10,
            offsetY
          );
          offsetY += 20;
        }

        if (heightCm && heightPx) {
          ctx.fillText(
            `Height: ${heightCm.toFixed(1)} cm / ${convertCmToInch(heightCm).toFixed(1)} in / ${heightPx.toFixed(0)} px`,
            10,
            offsetY
          );
        }

        requestAnimationFrame(detect);
      };

      detect();
    };

    run();
  }, [facingMode]);

  return (
    <div className="pose-wrapper">
      <div className="video-container">
        <WebcamFeed ref={webcamRef} facingMode={facingMode} />
        <canvas ref={canvasRef} className="pose-canvas" />
      </div>
    </div>
  );
};
