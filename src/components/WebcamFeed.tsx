import React, { useEffect, forwardRef } from 'react';

export const WebcamFeed = forwardRef<HTMLVideoElement>((props, ref) => {
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
        if (ref && 'current' in ref && ref.current) {
          ref.current.srcObject = stream;
        }
      } catch (e) {
        console.error('Webcam error', e);
      }
    };
    start();
  }, [ref]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="webcam-video"
    />
  );
});
