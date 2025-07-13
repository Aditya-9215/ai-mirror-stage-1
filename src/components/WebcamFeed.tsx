import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface WebcamHandle {
  video: HTMLVideoElement | null;
  isMirrored: boolean;
}

interface WebcamFeedProps {
  facingMode?: 'user' | 'environment';
}

export const WebcamFeed = forwardRef<WebcamHandle, WebcamFeedProps>(({ facingMode = 'user' }, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      } catch (err) {
        console.error('❌ getUserMedia error:', err);
      }
    };

    initWebcam();
  }, [facingMode]);

  useImperativeHandle(ref, () => ({
    video: videoRef.current,
    isMirrored: facingMode === 'user'
  }));

  return (
    <video
      ref={videoRef}
      style={{
        transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        borderRadius: '8px'
      }}
      muted
      playsInline
    />
  );
});
