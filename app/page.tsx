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
                video: { width: 300, height: 200}, // Forces a widescreen aspect ratio
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

            // Ensure canvas size matches video size



            // Detect faces from the video stream
            const detections = await faceapi
                .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks();

            // Resize detections to match the video size
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            // Get canvas contexts
            const overlayCtx = canvasRef.current?.getContext("2d") as CanvasRenderingContext2D | null;
            const outputCtx = outputCanvasRef.current?.getContext("2d") as CanvasRenderingContext2D | null;

            if (overlayCtx && outputCtx) {
                // Clear the output canvas first, but not the overlay canvas
                outputCtx.clearRect(0, 0, displaySize.width, displaySize.height);

                // Draw video frame on the output canvas
                outputCtx.drawImage(videoRef.current, 0, 0, displaySize.width, displaySize.height);

                // Clear the overlay canvas to avoid old face detections from lingering
                overlayCtx.clearRect(0, 0, displaySize.width, displaySize.height);

                // Draw face detection results and landmarks on the overlay canvas
                faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                faceapi.draw.drawFaceLandmarks(outputCanvasRef.current, resizedDetections);

                // Draw the overlay canvas (with detections and landmarks) on the output canvas
                outputCtx.drawImage(overlayCtx.canvas, 0, 0);
            }
        }

        // Request the next animation frame
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
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 bg-gray-100">
            <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
                <div className="relative">
                    <div className="relative w-full ">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className="border-4 border-blue-500 rounded-lg shadow-lg w-full h-full object-cover"
                            onPlay={handlePlay}
                        />
                    </div>                    <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    />
                    <canvas
                        ref={outputCanvasRef}
                        className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    />
                </div>

                {previewUrl && (
                    <div className="mt-4">
                        <h3 className="text-xl font-semibold mb-2">Preview:</h3>
                        <video
                            src={previewUrl}
                            controls
                            className="border-4 border-green-500 rounded-lg shadow-lg w-full max-w-lg"
                        />
                    </div>
                )}

                <div className="flex gap-4 items-center flex-col sm:flex-row">
                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`btn px-6 py-2 rounded-lg text-white text-lg shadow ${isRecording ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                            }`}
                    >
                        {isRecording ? "Stop Recording" : "Start Recording"}
                    </button>
                    <button
                        onClick={saveVideo}
                        className="btn px-6 py-2 rounded-lg bg-green-600 text-white text-lg shadow hover:bg-green-700"
                        disabled={!recordedChunks.length}
                    >
                        Save Video
                    </button>
                </div>
            </main>
        </div>
    );
}
