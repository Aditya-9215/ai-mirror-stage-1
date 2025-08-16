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
import { startARSession, endARSession } from './ar/arSession';

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
  ['right_knee', 'right_ankle'],
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
];

const PoseDetector: React.FC<Props> = ({ facingMode, arEnabled, onMeasurementsUpdate }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);

  useEffect(() => {
    let rafId = 0;
    let running = true;
    let xrHandlerCancel = false;

    const setupCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        video.srcObject = stream;
      } catch (err) {
        console.error('[Camera] getUserMedia failed', err);
        return;
      }

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
      if (detectorRef.current) return;
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
        { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      console.log('✅ Pose detector created');
    };

    const drawPoseResults = (poses: any[], mirror = false) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (poses.length === 0) return;
      const kps = poses[0].keypoints;

      ctx.save();
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

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
        const p1 = kps.find((k: any) => k.name === p1Name && (k.score ?? 0) > 0.3);
        const p2 = kps.find((k: any) => k.name === p2Name && (k.score ?? 0) > 0.3);
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    const detectFromVideo = async () => {
      if (!running) return;
      if (!detectorRef.current || !videoRef.current || !canvasRef.current) {
        rafId = requestAnimationFrame(detectFromVideo);
        return;
      }
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      if (video.readyState < 2) {
        rafId = requestAnimationFrame(detectFromVideo);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const poses = await detectorRef.current.estimatePoses(video);
      drawPoseResults(poses, facingMode === 'user');

      const vw = video.videoWidth;
      const FOV_DEG = 60;
      const DIST_CM = 65;
      let out: Measurements = {};
      if (poses.length > 0) {
        const kps = poses[0].keypoints;
        const shoulderPx = getShoulderWidth(kps);
        if (shoulderPx) {
          const cm = convertPxToCm(shoulderPx, FOV_DEG, vw, DIST_CM);
          out.shoulder = { px: shoulderPx, cm, inch: convertCmToInch(cm) };
        }
        const torsoPx = getTorsoLength(kps);
        if (torsoPx) {
          const cm = convertPxToCm(torsoPx, FOV_DEG, vw, DIST_CM);
          out.torso = { px: torsoPx, cm, inch: convertCmToInch(cm) };
        }
        const heightPx = getPixelHeight(kps);
        if (heightPx) {
          const cm = convertPxToCm(heightPx, FOV_DEG, vw, DIST_CM);
          out.height = { px: heightPx, cm, inch: convertCmToInch(cm) };
        }
      }
      onMeasurementsUpdate?.(out);

      rafId = requestAnimationFrame(detectFromVideo);
    };

    const handleXRBitmap = async (bitmap: ImageBitmap) => {
      if (!detectorRef.current || !canvasRef.current) {
        bitmap.close?.();
        return;
      }

      const canvas = canvasRef.current!;
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }

      const poses = await detectorRef.current.estimatePoses(bitmap);
      drawPoseResults(poses, false);

      const vw = bitmap.width;
      const FOV_DEG = 60;
      const DIST_CM = 65;
      let out: Measurements = {};
      if (poses.length > 0) {
        const kps = poses[0].keypoints;
        const shoulderPx = getShoulderWidth(kps);
        if (shoulderPx) {
          const cm = convertPxToCm(shoulderPx, FOV_DEG, vw, DIST_CM);
          out.shoulder = { px: shoulderPx, cm, inch: convertCmToInch(cm) };
        }
        const torsoPx = getTorsoLength(kps);
        if (torsoPx) {
          const cm = convertPxToCm(torsoPx, FOV_DEG, vw, DIST_CM);
          out.torso = { px: torsoPx, cm, inch: convertCmToInch(cm) };
        }
        const heightPx = getPixelHeight(kps);
        if (heightPx) {
          const cm = convertPxToCm(heightPx, FOV_DEG, vw, DIST_CM);
          out.height = { px: heightPx, cm, inch: convertCmToInch(cm) };
        }
      }
      onMeasurementsUpdate?.(out);
      bitmap.close?.();
    };

    (async () => {
      await loadDetector();
      await setupCamera();
      detectFromVideo();
    })();

    (async () => {
      if (arEnabled) {
        running = false;
        cancelAnimationFrame(rafId);
        if (videoRef.current && videoRef.current.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
          videoRef.current.srcObject = null;
        }

        xrHandlerCancel = false;

        const ok = await startARSession(async (bitmap: ImageBitmap) => {
          if (!xrHandlerCancel) await handleXRBitmap(bitmap);
          else bitmap.close?.();
        });

        if (!ok) {
          xrHandlerCancel = true;
          running = true;
          await setupCamera();
          detectFromVideo();
        }
      } else {
        xrHandlerCancel = true;
        await endARSession();
        setTimeout(async () => {
          running = true;
          await setupCamera();
          detectFromVideo();
        }, 300);
      }
    })();

    const videoElement = videoRef.current;
    return () => {
      running = false;
      xrHandlerCancel = true;
      cancelAnimationFrame(rafId);
      (async () => {
        try {
          await endARSession();
        } catch {}
      })();
      if (videoElement && videoElement.srcObject) {
        (videoElement.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        (videoElement as HTMLVideoElement).srcObject = null;
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
