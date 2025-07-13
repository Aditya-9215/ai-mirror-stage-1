// src/components/WebcamFeed.tsx

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from 'react';

export interface WebcamHandle {
  video: HTMLVideoElement;
}

export const WebcamFeed = forwardRef<WebcamHandle>((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose the raw <video> element to parent via ref
  useImperativeHandle(ref, () => ({
    video: videoRef.current!,
  }));

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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
        height: 'auto',
        objectFit: 'cover',
      }}
      muted
      playsInline
    />
  );
});
