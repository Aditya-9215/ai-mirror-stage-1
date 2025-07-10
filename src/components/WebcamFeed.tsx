import React from 'react';
import Webcam from 'react-webcam';

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: 'user',
};

export const WebcamFeed = React.forwardRef<Webcam, {}>((props, ref) => (
  <Webcam
    audio={false}
    height={480}
    ref={ref}
    screenshotFormat="image/jpeg"
    width={640}
    videoConstraints={videoConstraints}
    className="rounded-lg shadow-lg"
    {...props}
  />
));
