// src/components/PoseDetector.tsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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
import { endARSession } from './ar/arSession';

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

const PoseDetector = forwardRef(function PoseDetector(
  { facingMode, arEnabled, onMeasurementsUpdate }: Props,
  ref
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<posedetection.PoseDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const onMeasurementsUpdateRef = useRef<typeof onMeasurementsUpdate>(onMeasurementsUpdate);

  // Keep callback stable
  useEffect(() => {
    onMeasurementsUpdateRef.current = onMeasurementsUpdate;
  }, [onMeasurementsUpdate]);

  const ensureDetector = async () => {
    if (detectorRef.current) return;
    try {
      await tf.setBackend('webgl');
    } catch {
      await tf.setBackend('cpu');
    }
    await tf.ready();
    detectorRef.current = await posedetection.createDetector(
      posedetection.SupportedModels.MoveNet,
      { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );
    console.log('✅ Pose detector created');
  };

  const extractMeasurementsFromPoses = (poses: any[], vw: number): Measurements => {
    const out: Measurements = {};
    if (!poses || poses.length === 0) return out;
    const kps = poses[0].keypoints;
    const FOV_DEG = 60;
    const DIST_CM = 65;

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
    return out;
  };

  const drawPosesAndMeasurements = (poses: any[], vw: number, mirror = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!poses || poses.length === 0) return;
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
    for (const [a, b] of SKELETON_CONNECTIONS) {
      const p1 = kps.find((k: any) => k.name === a && (k.score ?? 0) > 0.3);
      const p2 = kps.find((k: any) => k.name === b && (k.score ?? 0) > 0.3);
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
    ctx.restore();

    const m = extractMeasurementsFromPoses(poses, vw);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(10, 10, 240, 90);
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    let y = 30;
    (Object.keys(m) as (keyof Measurements)[]).forEach((k) => {
      const val = m[k];
      if (val) {
        ctx.fillText(`${k}: ${val.cm.toFixed(1)} cm / ${val.inch.toFixed(1)} in`, 20, y);
        y += 18;
      }
    });
  };

  // helper: only call parent when we have at least one measurement
  const emitIfNonEmpty = (m: Measurements) => {
    if (!m) return;
    const hasAny =
      (m.shoulder && Number.isFinite(m.shoulder.cm)) ||
      (m.torso && Number.isFinite(m.torso.cm)) ||
      (m.height && Number.isFinite(m.height.cm));
    if (hasAny) onMeasurementsUpdateRef.current?.(m);
  };

  useImperativeHandle(ref, () => ({
    processXRBitmap: async (bitmap: ImageBitmap) => {
      await ensureDetector();
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
      drawPosesAndMeasurements(poses, bitmap.width, false);
      emitIfNonEmpty(extractMeasurementsFromPoses(poses, bitmap.width));
      bitmap.close?.();
    },
  }));

  useEffect(() => {
    let mounted = true;

    const setupCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      // If the video already has a stream attached, don't request a new one.
      if (video.srcObject) {
        try {
          if (video.readyState >= 2) return;
          await video.play().catch(() => {});
          return;
        } catch {/* fall through */}
      }

      try {
        // Lower res + fps to keep things stable
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 20 }
          },
          audio: false,
        });

        const tracks = stream.getVideoTracks();
        tracks.forEach((t) => {
          t.addEventListener('ended', () => {
            console.debug('[PoseDetector] video track ended:', t.label);
          });
          t.addEventListener('mute', () => {
            console.debug('[PoseDetector] video track muted:', t.label);
          });
        });

        video.srcObject = stream;
        console.debug('[PoseDetector] attached MediaStream to video (reduced res)');
      } catch (err) {
        console.error('[PoseDetector] getUserMedia failed', err);
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

    const detectFromVideo = async () => {
      if (!mounted) return;
      await ensureDetector();
      if (!detectorRef.current || !videoRef.current || !canvasRef.current) {
        rafRef.current = requestAnimationFrame(detectFromVideo);
        return;
      }

      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectFromVideo);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const poses = await detectorRef.current.estimatePoses(video);
      drawPosesAndMeasurements(poses, video.videoWidth, facingMode === 'user');
      emitIfNonEmpty(extractMeasurementsFromPoses(poses, video.videoWidth));

      rafRef.current = requestAnimationFrame(detectFromVideo);
    };

    (async () => {
      await ensureDetector();
      await setupCamera();
      detectFromVideo();
    })();

    const videoElement = videoRef.current;

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      if (videoElement && videoElement.srcObject) {
        console.debug('[PoseDetector] cleaning up and stopping MediaStream on video element');
        (videoElement.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoElement.srcObject = null;
      }

      (async () => {
        try { await endARSession(); } catch {}
      })();
      detectorRef.current = null;
    };
  }, [facingMode]); // ← only run when facingMode changes

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
});

export default PoseDetector;
