// src/components/WebcamFeed.tsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from 'react';

export interface WebcamHandle {
  video: HTMLVideoElement;
  isMirrored: boolean;
}

export const WebcamFeed = forwardRef<WebcamHandle>((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMirrored, setMirrored] = useState(true);

  useImperativeHandle(ref, () => ({
    video: videoRef.current!,
    isMirrored,
  }));

  useEffect(() => {
    async function startCamera() {
      try {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const facingMode = isMobile ? 'environment' : 'user';
        setMirrored(facingMode === 'user');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('❌ getUserMedia error:', err);
      }
    }
    startCamera();
  }, []);

  return (
    <video
      ref={videoRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: isMirrored ? 'scaleX(-1)' : 'none',
      }}
      muted
      playsInline
    />
  );
});
