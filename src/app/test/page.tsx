'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

const HolisticComponent = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scriptsLoaded, setScriptsLoaded] = useState({
    holistic: false,
    camera: false,
    drawingUtils: false
  });

  useEffect(() => {
    // Check if all scripts are loaded
    if (!Object.values(scriptsLoaded).every(Boolean)) return;

    let holistic: any;
    let camera: any;

    const initializeHolistic = async () => {
      try {
        const Holistic = (window as any).Holistic;
        const Camera = (window as any).Camera;
        const drawConnectors = (window as any).drawConnectors;
        const drawLandmarks = (window as any).drawLandmarks;
        const { POSE_CONNECTIONS, FACEMESH_TESSELATION, HAND_CONNECTIONS } = (window as any);

        if (!videoRef.current || !canvasRef.current) return;

        holistic = new Holistic({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
          }
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        holistic.onResults((results: any) => {
          const canvas = canvasRef.current;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.save();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw the video frame
          ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

          // Draw face mesh
          if (results.faceLandmarks) {
            drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, {
              color: '#C0C0C070',
              lineWidth: 1,
            });
          }

          // Draw pose
          if (results.poseLandmarks) {
            drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
              color: '#00FF00',
              lineWidth: 2,
            });
            drawLandmarks(ctx, results.poseLandmarks, {
              color: '#FF0000',
              lineWidth: 1,
              radius: 2,
            });
          }

          // Draw hands
          if (results.leftHandLandmarks) {
            drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, {
              color: '#00FF00',
              lineWidth: 2,
            });
            drawLandmarks(ctx, results.leftHandLandmarks, {
              color: '#FF0000',
              lineWidth: 1,
              radius: 2,
            });
          }
          if (results.rightHandLandmarks) {
            drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, {
              color: '#00FF00',
              lineWidth: 2,
            });
            drawLandmarks(ctx, results.rightHandLandmarks, {
              color: '#FF0000',
              lineWidth: 1,
              radius: 2,
            });
          }

          ctx.restore();
          setIsLoading(false);
        });

        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await holistic.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        await camera.start();

      } catch (error) {
        console.error('Error initializing MediaPipe:', error);
        setIsLoading(false);
      }
    };

    initializeHolistic();

    return () => {
      if (holistic) holistic.close();
      if (camera) camera.stop();
    };
  }, [scriptsLoaded]);

  const handleScriptLoad = (scriptName: keyof typeof scriptsLoaded) => {
    setScriptsLoaded(prev => ({
      ...prev,
      [scriptName]: true
    }));
  };

  return (
    <>
      {/* Load all required scripts from CDN */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js"
        onLoad={() => handleScriptLoad('holistic')}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
        onLoad={() => handleScriptLoad('camera')}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
        onLoad={() => handleScriptLoad('drawingUtils')}
      />
      
      <div className="relative w-full max-w-2xl mx-auto p-4">
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white">Loading MediaPipe...</div>
            </div>
          )}
          <video
            ref={videoRef}
            className="absolute w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute w-full h-full"
            width={640}
            height={480}
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>
      </div>
    </>
  );
};

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          MediaPipe Holistic Detection
        </h1>
        <HolisticComponent />
      </div>
    </div>
  );
}