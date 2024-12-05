'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

interface WebSocketResponse {
  multiHandLandmarks?: HandLandmark[][];
  resultData?: string;
  message?: string;
  error?: string;
}

const WEBSOCKET_URL = 'ws://localhost:9000/asl';

const WebcamCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timer | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isConnectingRef = useRef(false);

  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Cleanup function
  // const cleanup = useCallback(() => {
  //   // Clear frame capture interval
  //   if (frameIntervalRef.current) {
  //     clearInterval(frameIntervalRef.current);
  //     frameIntervalRef.current = null;
  //   }

  //   // Clear reconnection timeout
  //   if (reconnectTimeoutRef.current) {
  //     clearTimeout(reconnectTimeoutRef.current);
  //     reconnectTimeoutRef.current = undefined;
  //   }

  //   // Close WebSocket
  //   if (wsRef.current) {
  //     wsRef.current.onclose = null; // Remove onclose handler to prevent reconnection
  //     wsRef.current.close();
  //     wsRef.current = null;
  //   }

  //   // Stop media stream
  //   if (streamRef.current) {
  //     streamRef.current.getTracks().forEach(track => track.stop());
  //     streamRef.current = null;
  //   }

  //   setIsConnected(false);
  // }, []);

  // Function to capture and send frame
  const captureAndSendFrame = useCallback(() => {
    if (!streamRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const track = streamRef.current.getVideoTracks()[0];
      //@ts-ignore
      const imageCapture = new ImageCapture(track);

      imageCapture.grabFrame()
        .then((imageBitmap: any) => {
          const canvas = document.createElement('canvas');
          canvas.width = imageBitmap.width;
          canvas.height = imageBitmap.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(imageBitmap, 0, 0);
          const base64data = canvas.toDataURL('image/jpeg', 0.5);
          if (base64data && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(base64data);
          }
        })
        .catch((err: any) => console.log('Error capturing frame:', err));
    } catch (err) {
      console.error('Error in frame capture:', err);
    }
  }, []);

  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;
    // cleanup(); // Clean up any existing connection

    try {
      console.log('Setting up new WebSocket connection...');
      wsRef.current = new WebSocket(WEBSOCKET_URL);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        setError('');
        isConnectingRef.current = false;

        // Start frame capture only after connection is established
        if (!frameIntervalRef.current) {
          frameIntervalRef.current = setInterval(captureAndSendFrame, 1000 / 15);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket Disconnected');
        setIsConnected(false);
        isConnectingRef.current = false;
        // cleanup();

        // // Schedule reconnection
        // if (!reconnectTimeoutRef.current) {
        //   reconnectTimeoutRef.current = setTimeout(() => {
        //     reconnectTimeoutRef.current = undefined;
        //     setupWebSocket();
        //   }, 3000);
        // }
      };

      // wsRef.current.onerror = (event) => {
      //   console.error('WebSocket Error:', event);
      //   setError('Connection error');
      //   isConnectingRef.current = false;
      // };

      wsRef.current.onmessage = (event) => {
        try {
          const response: WebSocketResponse = JSON.parse(event.data);
          //@ts-ignore
          // console.log("response",response.multiHandLandmarks[0])

          // Create overlay canvas if it doesn't exist
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Clear previous drawing
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Set canvas size to match video
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // if (response.error) {
          //   setError(response.error);
          //   return;
          // }

          if (response.multiHandLandmarks && response.multiHandLandmarks[0]) {
            const landmarks = response.multiHandLandmarks[0];

            // Draw hand connections (skeleton)
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';

            // Define hand connections
            const handConnections = [
              // Thumb
              [0, 1], [1, 2], [2, 3], [3, 4],
              // Index finger
              [0, 5], [5, 6], [6, 7], [7, 8],
              // Middle finger
              [0, 9], [9, 10], [10, 11], [11, 12],
              // Ring finger
              [0, 13], [13, 14], [14, 15], [15, 16],
              // Pinky
              [0, 17], [17, 18], [18, 19], [19, 20],
              // Palm base
              [0, 5], [5, 9], [9, 13], [13, 17]
            ];

            // Draw connections
            handConnections.forEach(([start, end]) => {
              const startLandmark = landmarks[start];
              const endLandmark = landmarks[end];

              ctx.beginPath();
              ctx.moveTo(
                startLandmark.x * canvas.width,
                startLandmark.y * canvas.height
              );
              ctx.lineTo(
                endLandmark.x * canvas.width,
                endLandmark.y * canvas.height
              );
              ctx.stroke();
            });

            // Draw landmarks
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            landmarks.forEach((landmark) => {
              ctx.beginPath();
              ctx.arc(
                landmark.x * canvas.width,
                landmark.y * canvas.height,
                4,
                0,
                2 * Math.PI
              );
              ctx.fill();
            });

            // Calculate hand center for text placement
            const centerX = landmarks.reduce((sum, lm) => sum + lm.x, 0) / landmarks.length;
            const centerY = landmarks.reduce((sum, lm) => sum + lm.y, 0) / landmarks.length;

            // Draw predicted letter
            if (response.resultData) {
              ctx.font = 'bold 48px Arial';
              ctx.fillStyle = 'white';
              ctx.strokeStyle = 'black';
              ctx.lineWidth = 3;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';

              // Position text above hand
              const textY = (centerY * canvas.height) - 50;
              const textX = centerX * canvas.width;

              // Draw text stroke
              ctx.strokeText(response.resultData, textX, textY);
              // Draw text fill
              ctx.fillText(response.resultData, textX, textY);

              // Update result state
              // setResult(response.resultData);
            }
          } else if (response.resultData) {
            setResult(response.resultData);
          }
        } catch (e) {
          console.error('Error parsing response:', e);
        }
      };
    } catch (err) {
      console.error('Error setting up WebSocket:', err);
      setError('Failed to connect to server');
      isConnectingRef.current = false;
    }
  }, [captureAndSendFrame]);

  // Setup webcam
  const setupWebcam = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices API not available');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

    } catch (err) {
      // console.error('Error accessing webcam:', err);
      // setError('Could not access webcam');
    }
  };

  // Initialize everything
  useEffect(() => {
    setupWebcam();
    setupWebSocket();
    // Cleanup on unmount
    // return cleanup;
  }, [setupWebcam]);

  return (
    <div className="relative w-full max-w-2xl mx-auto p-4">
      <div className="relative">
        <video
          // style={{zIndex:'99999'}}
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-lg shadow-lg"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ zIndex: 1 }}
        ></canvas>

        <div className="absolute top-4 right-4 flex items-center space-x-2 bg-black bg-opacity-50 rounded-full px-3 py-1">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
            } ${isConnected ? 'animate-pulse' : ''}`} />
          <span className="text-sm font-medium text-white">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {!isConnected && !isConnectingRef.current && (
          <button
            onClick={setupWebSocket}
            className="absolute top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>

      <div className="mt-4 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">ASL Recognition Result:</h3>
        {error ? (
          <div className="text-red-500">
            <p>{error}</p>
            {error.includes('connect') && !isConnectingRef.current && (
              <button
                onClick={setupWebSocket}
                className="mt-2 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        ) : (
          <p className="text-3xl font-bold text-center">
            {result || 'No gesture detected'}
          </p>
        )}
      </div>
      {/* <canvas ref={canvasRef}></canvas> */}
    </div>
  );
};

export default WebcamCapture;