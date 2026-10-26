import { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "./AICamera.css";

type DetectedVehicle = {
  class: string;
  score: number;
  bbox: [number, number, number, number];
};

/**
 * Optional callback invoked after every detection frame.
 * videoWidth lets the detection bridge map bbox x-positions to road approaches.
 * Pass this prop to connect detections to the simulation engine.
 */
export type DetectionCallback = (
  detections: DetectedVehicle[],
  videoWidth: number
) => void;

interface AICameraProps {
  /** Called each frame with the detected vehicles and the video width.
   *  Omit to use the component standalone (original behaviour). */
  onDetection?: DetectionCallback;
}

const VEHICLE_CLASSES = new Set([
  "car",
  "bus",
  "truck",
  "motorcycle",
]);

export default function AICamera({ onDetection }: AICameraProps = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  // Keep latest callback in a ref so the RAF loop always calls the current one
  const onDetectionRef = useRef<DetectionCallback | undefined>(onDetection);
  useEffect(() => { onDetectionRef.current = onDetection; }, [onDetection]);

  const [status, setStatus] = useState("Loading AI model...");
  const [vehicles, setVehicles] = useState<DetectedVehicle[]>([]);
  const [source, setSource] = useState("none");

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        await tf.ready();
        const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });

        if (cancelled) {
          model.dispose();
          return;
        }

        modelRef.current = model;
        setStatus("AI model ready. Upload a video or enable your camera.");
      } catch (error) {
        console.error(error);
        setStatus("Could not load the AI model. Check your internet connection.");
      }
    }

    void loadModel();

    return () => {
      cancelled = true;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, []);

  function stopDetection() {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    busyRef.current = false;
  }

  function clearBoxes() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    setVehicles([]);
  }

  async function startDetection() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;

    if (!video || !canvas || !model) {
      setStatus("Please wait for the AI model to finish loading.");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setStatus("Waiting for the video to become ready...");
      return;
    }

    stopDetection();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    setStatus("AI detection running...");

    const detectFrame = async () => {
      if (video.paused || video.ended || !video.videoWidth) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      if (busyRef.current) {
        animationRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      busyRef.current = true;

      try {
        const predictions = await model.detect(video, 30, 0.45);

        const found = predictions.filter(
          (prediction) =>
            VEHICLE_CLASSES.has(prediction.class) &&
            prediction.score >= 0.45
        ) as DetectedVehicle[];

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.lineWidth = Math.max(2, canvas.width / 400);
        context.font = `${Math.max(14, canvas.width / 45)}px Arial`;

        for (const vehicle of found) {
          const [x, y, width, height] = vehicle.bbox;
          const label = `${vehicle.class} ${Math.round(vehicle.score * 100)}%`;

          context.strokeStyle = "#00ff88";
          context.fillStyle = "#00ff88";
          context.strokeRect(x, y, width, height);

          const labelWidth = context.measureText(label).width + 10;
          const labelHeight = Math.max(22, canvas.width / 35);
          const labelY = Math.max(labelHeight, y);

          context.fillRect(x, labelY - labelHeight, labelWidth, labelHeight);
          context.fillStyle = "#07130c";
          context.fillText(label, x + 5, labelY - 5);
        }

        setVehicles(found);

        // ── Bridge callback ──────────────────────────────────────────────
        // Report detections to any connected consumer (e.g. the simulation).
        // We always pass the current videoWidth so the bridge can map
        // horizontal position to road approaches.
        if (onDetectionRef.current) {
          onDetectionRef.current(found, video.videoWidth);
        }
      } catch (error) {
        console.error("Detection error:", error);
        setStatus("Detection error. Try another video.");
        stopDetection();
        return;
      } finally {
        busyRef.current = false;
      }

      animationRef.current = requestAnimationFrame(detectFrame);
    };

    animationRef.current = requestAnimationFrame(detectFrame);
  }

  async function enableCamera() {
    try {
      stopDetection();

      streamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.controls = false;
      video.muted = true;
      video.loop = false;

      await video.play();
      setSource("camera");
      await startDetection();
    } catch (error) {
      console.error(error);
      setStatus("Camera unavailable. Allow camera permission or use a video file.");
    }
  }

  async function loadVideo(file?: File) {
    if (!file || !videoRef.current) return;

    stopDetection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const video = videoRef.current;

    video.srcObject = null;
    video.src = URL.createObjectURL(file);
    video.controls = true;
    video.loop = true;

    setSource("video");
    clearBoxes();

    try {
      await video.play();
      await startDetection();
    } catch (error) {
      console.error(error);
      setStatus("Video could not start. Press Play, then try again.");
    }
  }

  return (
    <section className="ai-camera">
      <h2>AI Vehicle Detection Camera</h2>
      <p>
        Detect cars, buses, trucks and motorcycles from recorded traffic footage
        or a camera feed.
      </p>

      <div className="ai-camera-actions">
        <label className="ai-upload">
          Upload traffic video
          <input
            type="file"
            accept="video/*"
            onChange={(event) => {
              void loadVideo(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>

        <button type="button" onClick={() => void enableCamera()}>
          Enable live camera
        </button>

        <button
          type="button"
          onClick={() => {
            stopDetection();
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;

            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.srcObject = null;
            }

            setSource("none");
            clearBoxes();
            setStatus("Detection stopped.");
          }}
        >
          Stop
        </button>
      </div>

      <p className="ai-status" role="status">{status}</p>

      <div className="ai-video-stage">
        <video
          ref={videoRef}
          className="ai-video"
          playsInline
          muted
          onPlay={() => {
            if (source !== "none") void startDetection();
          }}
        />
        <canvas ref={canvasRef} className="ai-overlay" />
      </div>

      <div className="ai-stats">
        <div>
          <span>Detected vehicles</span>
          <strong>{vehicles.length}</strong>
        </div>
        {(["car", "bus", "truck", "motorcycle"] as const).map((type) => (
          <div key={type}>
            <span>{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
            <strong>
              {vehicles.filter((vehicle) => vehicle.class === type).length}
            </strong>
          </div>
        ))}
      </div>

      <p className="ai-note">
        Counts show vehicles detected in the current frame, not unique vehicles
        passing the camera.{" "}
        {onDetection
          ? "AI-Driven mode is active — detections are updating simulation demand."
          : "Enable AI-Driven mode in the simulation controls to connect detections to the signal controller."}
      </p>
    </section>
  );
}
