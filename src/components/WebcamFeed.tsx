import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export type WebcamHandle = {
  video: HTMLVideoElement;
};

export const WebcamFeed = forwardRef<WebcamHandle>((_, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    video: videoRef.current!,
  }));

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access error:', err);
      }
    };
    startCamera();
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-auto object-cover"
      style={{ position: 'absolute', top: 0, left: 0 }}
    />
  );
});
