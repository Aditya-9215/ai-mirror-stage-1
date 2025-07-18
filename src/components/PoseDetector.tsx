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
  convertDepthToCmUsingAR
} from '../utils/measurements';
import { getLatestDepthInfo } from './ar/arSession';

interface Props {
  facingMode: 'user' | 'environment';
  arEnabled: boolean;
}

const PoseDetector: React.FC<Props> = ({ facingMode, arEnabled }) => {
  const webcamRef = useRef<WebcamHandle>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await tf.setBackend('webgl');
      await tf.ready();
      if (cancelled) return;

      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      console.log('✅ Pose detector created');

      const loop = async () => {
        if (cancelled) return;

        const detector = detectorRef.current;
        const handle = webcamRef.current;
        const canvas = canvasRef.current;
        if (!detector || !handle || !canvas) {
          return requestAnimationFrame(loop);
        }

        const video = handle.video!;
        if (video.readyState < 2) {
          return requestAnimationFrame(loop);
        }

        // **1:1 canvas size** to video resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // mirror if front camera
        ctx.save();
        if (handle.isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        // no extra scaling: draw directly in video pixels
        const poses = await detector.estimatePoses(video);
        if (poses[0]) {
          const kp = poses[0].keypoints;

          // skeleton
          ctx.strokeStyle = 'lime';
          ctx.lineWidth = 2;
          poseDetection.util
            .getAdjacentPairs(poseDetection.SupportedModels.MoveNet)
            .forEach(([i, j]) => {
              const a = kp[i], b = kp[j];
              if (a.score! > 0.3 && b.score! > 0.3) {
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            });

          // keypoints
          ctx.fillStyle = 'red';
          kp.forEach((k) => {
            if (k.score! > 0.3) {
              ctx.beginPath();
              ctx.arc(k.x, k.y, 5, 0, 2 * Math.PI);
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

          let shoulderCm: number, torsoCm: number, heightCm: number;

          if (arEnabled) {
            const depth = getLatestDepthInfo();
            if (depth) {
              shoulderCm = convertDepthToCmUsingAR(
                kp[5], kp[6], depth,
                video.videoWidth, video.videoHeight
              )!;
              torsoCm = convertDepthToCmUsingAR(
                kp[5], kp[11], depth,
                video.videoWidth, video.videoHeight
              )!;
              heightCm = convertDepthToCmUsingAR(
                kp[0], kp[16], depth,
                video.videoWidth, video.videoHeight
              )!;
            } else {
              // fallback if depth info missing
              shoulderCm = convertPxToCm(swPx, 60, canvas.width);
              torsoCm    = convertPxToCm(tlPx, 60, canvas.width);
              heightCm   = convertPxToCm(hPx,  60, canvas.width);
            }
          } else {
            // pure pixel→cm
            shoulderCm = convertPxToCm(swPx, 60, canvas.width);
            torsoCm    = convertPxToCm(tlPx, 60, canvas.width);
            heightCm   = convertPxToCm(hPx,  60, canvas.width);
          }

          // draw text in canvas‐pixel coords
          ctx.fillStyle = 'white';
          ctx.font = '24px sans-serif';
          let y = 30;
          ctx.fillText(
            `Shoulder: ${shoulderCm.toFixed(1)}cm / ${convertCmToInch(shoulderCm).toFixed(1)}in`,
            10, y
          );
          y += 30;
          ctx.fillText(
            `Torso: ${torsoCm.toFixed(1)}cm / ${convertCmToInch(torsoCm).toFixed(1)}in`,
            10, y
          );
          y += 30;
          ctx.fillText(
            `Height: ${heightCm.toFixed(1)}cm / ${convertCmToInch(heightCm).toFixed(1)}in`,
            10, y
          );
        }

        requestAnimationFrame(loop);
      };

      requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
    };
  }, [arEnabled]);

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
