// src/components/PoseDetector.tsx
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

export type MeasurementTriple = { px: number; cm: number; inch: number };
export type Measurements = {
  shoulder?: MeasurementTriple;
  torso?: MeasurementTriple;
  height?: MeasurementTriple;
};

interface Props {
  facingMode: 'user' | 'environment';
  arEnabled: boolean;
  onMeasurementsUpdate?: (m: Measurements) => void;
}

const SKELETON_CONNECTIONS: [string, string][] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle']
];

const PoseDetector: React.FC<Props> = ({ facingMode, arEnabled, onMeasurementsUpdate }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  useEffect(() => {
    let rafId = 0;

    const setupCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.play().then(resolve).catch(() => resolve());
        };
        if (video.readyState >= 2) {
          video.play().then(resolve).catch(() => resolve());
        } else {
          video.addEventListener('loadeddata', onLoaded);
        }
      });
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

      detectorRef.current = await posedetection.createDetector(
        posedetection.SupportedModels.MoveNet,
        {
          modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        }
      );

      console.log('✅ Pose detector created');
    };

    const detect = async () => {
      if (!detectorRef.current || !videoRef.current || !canvasRef.current) {
        rafId = requestAnimationFrame(detect);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx || video.readyState < 2) {
        rafId = requestAnimationFrame(detect);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        rafId = requestAnimationFrame(detect);
        return;
      }

      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      const poses = await detectorRef.current.estimatePoses(video);
      let out: Measurements = {};

      if (poses.length > 0) {
        const kps = poses[0].keypoints;

        for (const kp of kps) {
          if (kp.score && kp.score > 0.3) {
            ctx.beginPath();
            ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'red';
            ctx.fill();
          }
        }

        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        for (const [p1Name, p2Name] of SKELETON_CONNECTIONS) {
          const p1 = kps.find(k => k.name === p1Name && (k.score ?? 0) > 0.3);
          const p2 = kps.find(k => k.name === p2Name && (k.score ?? 0) > 0.3);
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        const FOV_DEG = 60;
        const DIST_CM = 65;
        const screenW = vw;

        const shoulderPx = getShoulderWidth(kps);
        if (shoulderPx) {
          const cm = convertPxToCm(shoulderPx, FOV_DEG, screenW, DIST_CM);
          out.shoulder = { px: shoulderPx, cm, inch: convertCmToInch(cm) };
        }

        const torsoPx = getTorsoLength(kps);
        if (torsoPx) {
          const cm = convertPxToCm(torsoPx, FOV_DEG, screenW, DIST_CM);
          out.torso = { px: torsoPx, cm, inch: convertCmToInch(cm) };
        }

        const heightPx = getPixelHeight(kps);
        if (heightPx) {
          const cm = convertPxToCm(heightPx, FOV_DEG, screenW, DIST_CM);
          out.height = { px: heightPx, cm, inch: convertCmToInch(cm) };
        }
      }

      ctx.restore();

      onMeasurementsUpdate?.(out);

      rafId = requestAnimationFrame(detect);
    };

    const init = async () => {
      await setupCamera();
      await loadDetector();
      detect();
    };

    init();

    // ✅ FIX: capture stable ref before cleanup to avoid ESLint warning & Netlify CI error
    const videoElement = videoRef.current;

    return () => {
      cancelAnimationFrame(rafId);
      if (videoElement && videoElement.srcObject) {
        (videoElement.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoElement.srcObject = null;
      }
      detectorRef.current = null;
    };
  }, [facingMode, arEnabled, onMeasurementsUpdate]);

  return (
    <div style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: 'auto',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)',
          display: 'block',
        }}
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="pose-canvas"
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
