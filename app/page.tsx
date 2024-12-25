"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

export default function Home() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const outputCanvasRef = useRef<HTMLCanvasElement>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        const loadModelsAndStartVideo = async () => {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
            ]);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 300, height: 200 },
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
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
    }, [previewUrl]);

    const detectFaces = async () => {
        if (canvasRef.current && videoRef.current && outputCanvasRef.current) {
            const displaySize = {
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
            };

            const detections = await faceapi
                .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            const overlayCtx = canvasRef.current?.getContext("2d");
            const outputCtx = outputCanvasRef.current?.getContext("2d");

            if (overlayCtx && outputCtx) {
                outputCtx.clearRect(0, 0, displaySize.width, displaySize.height);
                outputCtx.drawImage(videoRef.current, 0, 0, displaySize.width, displaySize.height);

                overlayCtx.clearRect(0, 0, displaySize.width, displaySize.height);

                faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                faceapi.draw.drawFaceLandmarks(outputCanvasRef.current, resizedDetections);

                outputCtx.drawImage(overlayCtx.canvas, 0, 0);
            }
        }

        animationRef.current = requestAnimationFrame(detectFaces);
    };

    const handlePlay = () => {
        detectFaces();
    };

    const startRecording = () => {
        if (outputCanvasRef.current) {
            const canvasStream = outputCanvasRef.current.captureStream();
            const recorder = new MediaRecorder(canvasStream, {
                mimeType: "video/webm;codecs=vp9",
                videoBitsPerSecond: 2500000,
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
        <div className="flex flex-col items-center min-h-screen p-6 sm:p-12 bg-neutral-900 text-neutral-200">
            <h1 className="text-3xl font-bold mb-6 text-center text-white">Face Detection and Recording</h1>
            <main className="flex flex-col items-center gap-8 w-full max-w-4xl">
                <div className="relative w-full max-w-2xl aspect-video bg-neutral-800 rounded-lg overflow-hidden shadow-lg">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        onPlay={handlePlay}
                    />
                    <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    />
                    <canvas
                        ref={outputCanvasRef}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    />
                </div>

                {previewUrl && (
                    <div className="w-full max-w-md">
                        <h2 className="text-lg font-semibold text-neutral-300 mb-3">Preview</h2>
                        <video
                            src={previewUrl}
                            controls
                            className="w-full rounded-lg shadow-md"
                        />
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`px-6 py-3 text-lg font-medium rounded-lg shadow-md transition-all ${
                            isRecording
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                    >
                        {isRecording ? "Stop Recording" : "Start Recording"}
                    </button>
                    <button
                        onClick={saveVideo}
                        className="px-6 py-3 text-lg font-medium rounded-lg shadow-md bg-green-600 hover:bg-green-700 text-white"
                        disabled={!recordedChunks.length}
                    >
                        Save Video
                    </button>
                </div>
            </main>
        </div>
    );
}
