import React, { useRef, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as posedetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import {
  getShoulderWidth,
  getTorsoLength,
  getPixelHeight,
  convertPxToCm,
  convertCmToInch
} from '../utils/measurements';

interface Props {
  facingMode: 'user' | 'environment';
  arEnabled: boolean;
}

const PoseDetector: React.FC<Props> = ({ facingMode, arEnabled }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  useEffect(() => {
    const setupCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      video.srcObject = stream;
      await video.play();
    };

    const loadDetector = async () => {
      try {
        await tf.setBackend('webgl');
        console.log('✅ Using WebGL backend');
      } catch (err) {
        console.warn('⚠️ WebGL not available, falling back to CPU:', err);
        await tf.setBackend('cpu');
      }

      await tf.ready();

      const detectorConfig = {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };

      detectorRef.current = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        detectorConfig
      );

      console.log('✅ Pose detector created');
    };

    const detect = async () => {
      if (
        detectorRef.current &&
        videoRef.current &&
        canvasRef.current &&
        videoRef.current.readyState === 4
      ) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Match canvas size to video element's *displayed* size
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        const poses = await detectorRef.current.estimatePoses(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (poses.length > 0) {
          const keypoints = poses[0].keypoints;

          // Scaling factor if video is being stretched
          const scaleX = canvas.width / video.videoWidth;
          const scaleY = canvas.height / video.videoHeight;

          // Draw keypoints
          for (const keypoint of keypoints) {
            if (keypoint.score !== undefined && keypoint.score > 0.3) {
              const { x, y } = keypoint;
              ctx.beginPath();
              ctx.arc(x * scaleX, y * scaleY, 5, 0, 2 * Math.PI);
              ctx.fillStyle = 'red';
              ctx.fill();
            }
          }

          ctx.strokeStyle = 'blue';
          ctx.lineWidth = 2;
          ctx.fillStyle = 'yellow';
          ctx.font = '14px Arial';

          // Shoulder width
          const shoulderPx = getShoulderWidth(keypoints);
          if (shoulderPx) {
            const cm = convertPxToCm(shoulderPx, 60, video.videoWidth);
            const inch = convertCmToInch(cm);
            const leftShoulder = keypoints.find(k => k.name === 'left_shoulder')!;
            const rightShoulder = keypoints.find(k => k.name === 'right_shoulder')!;
            ctx.beginPath();
            ctx.moveTo(leftShoulder.x * scaleX, leftShoulder.y * scaleY);
            ctx.lineTo(rightShoulder.x * scaleX, rightShoulder.y * scaleY);
            ctx.stroke();
            ctx.fillText(
              `${shoulderPx.toFixed(1)} px | ${cm.toFixed(1)} cm | ${inch.toFixed(1)} in`,
              ((leftShoulder.x + rightShoulder.x) / 2) * scaleX,
              ((leftShoulder.y + rightShoulder.y) / 2) * scaleY - 10
            );
          }

          // Torso length
          const torsoPx = getTorsoLength(keypoints);
          if (torsoPx) {
            const cm = convertPxToCm(torsoPx, 60, video.videoWidth);
            const inch = convertCmToInch(cm);
            const shoulder = keypoints.find(k => k.name === 'left_shoulder')!;
            const hip = keypoints.find(k => k.name === 'left_hip')!;
            ctx.beginPath();
            ctx.moveTo(shoulder.x * scaleX, shoulder.y * scaleY);
            ctx.lineTo(hip.x * scaleX, hip.y * scaleY);
            ctx.stroke();
            ctx.fillText(
              `${torsoPx.toFixed(1)} px | ${cm.toFixed(1)} cm | ${inch.toFixed(1)} in`,
              shoulder.x * scaleX + 5,
              (shoulder.y + hip.y) / 2 * scaleY
            );
          }

          // Full height
          const heightPx = getPixelHeight(keypoints);
          if (heightPx) {
            const cm = convertPxToCm(heightPx, 60, video.videoWidth);
            const inch = convertCmToInch(cm);
            const nose = keypoints.find(k => k.name === 'nose')!;
            const ankle = keypoints.find(k => k.name === 'left_ankle')!;
            ctx.beginPath();
            ctx.moveTo(nose.x * scaleX, nose.y * scaleY);
            ctx.lineTo(ankle.x * scaleX, ankle.y * scaleY);
            ctx.stroke();
            ctx.fillText(
              `${heightPx.toFixed(1)} px | ${cm.toFixed(1)} cm | ${inch.toFixed(1)} in`,
              nose.x * scaleX + 5,
              (nose.y + ankle.y) / 2 * scaleY
            );
          }
        }
      }

      requestAnimationFrame(detect);
    };

    const init = async () => {
      await setupCamera();
      await loadDetector();
      detect();
    };

    init();
  }, [facingMode]);

  return (
    <div style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: 'auto',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default PoseDetector;
