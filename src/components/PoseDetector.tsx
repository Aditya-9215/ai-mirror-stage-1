// src/components/PoseDetector.tsx

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
} from '../utils/measurements';
import { getDepthAtCenter } from './ar/arSession';

interface Props {
  facingMode: 'user' | 'environment';
  arEnabled: boolean;
}

const FOV_DEGREES = 60;

const PoseDetector: React.FC<Props> = ({ facingMode, arEnabled }) => {
  const webcamRef = useRef<WebcamHandle>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const depthCmRef = useRef<number>(65);

  // Initialize MoveNet
  useEffect(() => {
    (async () => {
      await tf.setBackend('webgl');
      await tf.ready();

      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      console.log('✅ Pose detector created');

      // If AR enabled, grab one depth sample
      if (arEnabled) {
        const session = await (navigator.xr as any).requestSession('immersive-ar', {
          requiredFeatures: ['depth-sensing', 'viewer'],
        });
        const refSpace = await session.requestReferenceSpace('viewer');
        const cm = await getDepthAtCenter(session, refSpace);
        if (cm != null) depthCmRef.current = cm;
      }
    })();
  }, [arEnabled]);

  // Render loop
  useEffect(() => {
    let raf: number;

    const render = async () => {
      const detector = detectorRef.current;
      const handle = webcamRef.current;
      const canvas = canvasRef.current;
      if (!detector || !handle || !canvas) {
        raf = requestAnimationFrame(render);
        return;
      }
      const video = handle.video;
      if (!video || video.readyState < 2) {
        raf = requestAnimationFrame(render);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Pose estimation
      const poses = await detector.estimatePoses(video);
      if (poses[0]) {
        const kp = poses[0].keypoints;

        // Draw skeleton
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;
        poseDetection.util
          .getAdjacentPairs(poseDetection.SupportedModels.MoveNet)
          .forEach(([i, j]) => {
            const a = kp[i],
              b = kp[j];
            if (a.score! > 0.3 && b.score! > 0.3) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          });

        // Draw keypoints
        ctx.fillStyle = 'red';
        kp.forEach((p) => {
          if (p.score! > 0.3) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
            ctx.fill();
          }
        });

        // Pixel measurements
        const swPx = getShoulderWidth(kp) ?? 0;
        const tlPx = getTorsoLength(kp) ?? 0;
        const hPx = getPixelHeight(kp) ?? 0;

        // Convert to cm (use depthCmRef for AR, else FOV default)
        const depthCm = arEnabled ? depthCmRef.current : undefined;
        const swCm = convertPxToCm(swPx, FOV_DEGREES, canvas.width, depthCm);
        const tlCm = convertPxToCm(tlPx, FOV_DEGREES, canvas.width, depthCm);
        const hCm = convertPxToCm(hPx, FOV_DEGREES, canvas.width, depthCm);

        // Text overlay
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        let y = 20;
        ctx.fillText(`Mode: ${arEnabled ? 'AR' : 'FOV'}`, 10, y);
        y += 20;
        ctx.fillText(
          `Shoulder: ${swCm.toFixed(1)} cm / ${convertCmToInch(swCm).toFixed(1)} in`,
          10,
          y
        );
        y += 20;
        ctx.fillText(
          `Torso: ${tlCm.toFixed(1)} cm / ${convertCmToInch(tlCm).toFixed(1)} in`,
          10,
          y
        );
        y += 20;
        ctx.fillText(
          `Height: ${hCm.toFixed(1)} cm / ${convertCmToInch(hCm).toFixed(1)} in`,
          10,
          y
        );
      }

      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [arEnabled]);

  return (
    <div className="video-container">
      <WebcamFeed facingMode={facingMode} ref={webcamRef} />
      <canvas className="pose-canvas" ref={canvasRef} />
    </div>
  );
};

export default PoseDetector;
