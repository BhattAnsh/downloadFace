"use client";

import { useEffect, useRef, useState } from "react";
import Image from 'next/image'
import * as faceapi from 'face-api.js'

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recordedStreamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const loadModelsAndStartVideo = async () => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      ]);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (outputCanvasRef.current) {
        outputCanvasRef.current.width = 640;
        outputCanvasRef.current.height = 480;
        recordedStreamRef.current = outputCanvasRef.current.captureStream(60);
        const recorder = new MediaRecorder(recordedStreamRef.current, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 2500000
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };
        setMediaRecorder(recorder);
      }
    };

    loadModelsAndStartVideo();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const detectFaces = async () => {
    if (canvasRef.current && videoRef.current && outputCanvasRef.current) {
      const displaySize = {
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight
      }

      faceapi.matchDimensions(canvasRef.current, displaySize)

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()

      const resizedDetections = faceapi.resizeResults(detections, displaySize)

      canvasRef.current.getContext('2d')?.clearRect(0, 0, displaySize.width, displaySize.height)
      faceapi.draw.drawDetections(canvasRef.current, resizedDetections)
      faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections)

      const ctx = outputCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, displaySize.width, displaySize.height);
        ctx.drawImage(videoRef.current, 0, 0);
        ctx.drawImage(canvasRef.current, 0, 0);
      }

      animationRef.current = requestAnimationFrame(detectFaces);
    }
  };

  const handlePlay = () => {
    detectFaces();
  };

  const startRecording = () => {
    if (mediaRecorder && outputCanvasRef.current) {
      setRecordedChunks([]);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      const canvasStream = outputCanvasRef.current.captureStream();
      const recorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);

        const previewVideo = document.querySelector('video[data-preview]') as HTMLVideoElement;
        if (previewVideo) {
          previewVideo.src = url;
          previewVideo.load();
          previewVideo.play();
        }
      };
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const saveVideo = () => {
    if (!recordedChunks.length) return;

    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recorded-video.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            className="border-2 border-gray-500"
            onPlay={handlePlay}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0"
          />
          <canvas
            ref={outputCanvasRef}
            className="hidden"
          />
        </div>

        {previewUrl && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Preview:</h3>
            <div className="relative">
              <video
                data-preview
                src={previewUrl}
                controls
                width={640}
                height={480}
                className="border-2 border-gray-500"
                onPlay={() => handlePlay()}
              />
              <canvas
                ref={previewCanvasRef}
                width={640}
                height={480}
                className="absolute top-0 left-0 pointer-events-none"
              />
            </div>
          </div>
        )}

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`btn ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`}
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
          <button
            onClick={saveVideo}
            className="btn"
            disabled={!recordedChunks.length}
          >
            Save Video
          </button>
        </div>
      </main>
    </div>
  );
}

