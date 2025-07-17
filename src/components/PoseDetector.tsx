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

interface PoseDetectorProps {
  facingMode: 'user' | 'environment';
  arEnabled: boolean;
}

const PoseDetector: React.FC<PoseDetectorProps> = ({ facingMode, arEnabled }) => {
  const webcamRef = useRef<WebcamHandle>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fix: allow null initial value
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);

  useEffect(() => {
    tf.setBackend('webgl')
      .then(() => tf.ready())
      .then(async () => {
        detectorRef.current = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
        );
        console.log('✅ Pose detector created');
        requestAnimationFrame(drawLoop);
      });
  }, []);

  const drawLoop = async () => {
    const detector = detectorRef.current;
    const handle = webcamRef.current;
    const canvas = canvasRef.current;
    if (!detector || !handle || !canvas) {
      return requestAnimationFrame(drawLoop);
    }

    const video = handle.video!;
    if (video.readyState < 2) {
      return requestAnimationFrame(drawLoop);
    }

    const ctx = canvas.getContext('2d')!;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    canvas.width = cw;
    canvas.height = ch;
    ctx.clearRect(0, 0, cw, ch);

    // mirror if needed
    ctx.save();
    if (handle.isMirrored) {
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
    }

    const sx = cw / vw;
    const sy = ch / vh;

    const poses = await detector.estimatePoses(video);
    if (poses[0]) {
      const kp = poses[0].keypoints;

      // skeleton
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      poseDetection.util
        .getAdjacentPairs(poseDetection.SupportedModels.MoveNet)
        .forEach(([i, j]) => {
          const a = kp[i],
            b = kp[j];
          if (a.score! > 0.3 && b.score! > 0.3) {
            ctx.beginPath();
            ctx.moveTo(a.x * sx, a.y * sy);
            ctx.lineTo(b.x * sx, b.y * sy);
            ctx.stroke();
          }
        });

      // keypoints
      ctx.fillStyle = 'red';
      kp.forEach((k) => {
        if (k.score! > 0.3) {
          ctx.beginPath();
          ctx.arc(k.x * sx, k.y * sy, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }
    ctx.restore();

    // measurements
    if (poses[0]) {
      const kp = poses[0].keypoints;
      const swPx = getShoulderWidth(kp) ?? 0;
      const tlPx = getTorsoLength(kp) ?? 0;
      const hPx = getPixelHeight(kp) ?? 0;

      const shoulderCm = convertPxToCm(swPx, 60, cw);
      const torsoCm = convertPxToCm(tlPx, 60, cw);
      const heightCm = convertPxToCm(hPx, 60, cw);

      ctx.fillStyle = 'white';
      ctx.font = '16px sans-serif';
      let y = 20;
      ctx.fillText(
        `Shoulder: ${shoulderCm.toFixed(1)} cm / ${convertCmToInch(
          shoulderCm
        ).toFixed(1)} in`,
        10,
        y
      );
      y += 20;
      ctx.fillText(
        `Torso: ${torsoCm.toFixed(1)} cm / ${convertCmToInch(torsoCm).toFixed(1)} in`,
        10,
        y
      );
      y += 20;
      ctx.fillText(
        `Height: ${heightCm.toFixed(1)} cm / ${convertCmToInch(heightCm).toFixed(1)} in`,
        10,
        y
      );
    }

    requestAnimationFrame(drawLoop);
  };

  return (
    <div className="pose-wrapper">
      <div className="video-container">
        <WebcamFeed ref={webcamRef} facingMode={facingMode} />
        <canvas ref={canvasRef} className="pose-canvas" />
      </div>
    </div>
  );
};

export default PoseDetector;
