import React, {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
} from 'react';

export interface WebcamHandle {
  video: HTMLVideoElement | null;
  isMirrored: boolean;
}

interface WebcamFeedProps {
  facingMode: 'user' | 'environment';
}

export const WebcamFeed = forwardRef<WebcamHandle, WebcamFeedProps>(
  ({ facingMode }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const isMirrored = facingMode === 'user';

    useImperativeHandle(ref, () => ({
      video: videoRef.current,
      isMirrored,
    }));

    useEffect(() => {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: false,
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // wait for metadata then play
            videoRef.current.onloadedmetadata = () => {
              videoRef.current!
                .play()
                .catch((err) => console.warn('Play error:', err));
            };
          }
        } catch (e) {
          console.error('❌ getUserMedia error:', e);
        }
      })();
    }, [facingMode]);

    return (
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isMirrored ? 'scaleX(-1)' : 'none',
        }}
      />
    );
  }
);
