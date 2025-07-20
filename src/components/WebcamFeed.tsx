import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface WebcamHandle {
  video: HTMLVideoElement;
}

export interface WebcamFeedProps {
  facingMode: 'user' | 'environment';
}

export const WebcamFeed = forwardRef<WebcamHandle, WebcamFeedProps>(
  ({ facingMode }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      video: videoRef.current!,
    }));

    useEffect(() => {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
          });
          videoRef.current!.srcObject = stream;
          await videoRef.current!.play();
        } catch (e) {
          console.error('❌ getUserMedia error:', e);
        }
      })();
    }, [facingMode]);

    return <video className="webcam-video" ref={videoRef} />;
  }
);
