import { useEffect, useRef } from "react";
import { Eye } from "lucide-react";
import { POSE_CONNECTIONS, type Landmarks } from "../lib/pose";
import { viewAngleLabel, type ViewAngle } from "../lib/viewAngle";

interface Props {
  videoRef: React.RefObject<HTMLVideoElement>;
  landmarks: Landmarks | null;
  mirrored?: boolean;
  viewAngle?: ViewAngle;
  supportedViews?: ViewAngle[];
}

export function CameraView({ videoRef, landmarks, mirrored = true, viewAngle, supportedViews }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size canvas to match video intrinsic dimensions
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    if (canvas.width !== vw) canvas.width = vw;
    if (canvas.height !== vh) canvas.height = vh;

    ctx.clearRect(0, 0, vw, vh);
    if (!landmarks) return;

    // Draw connections with neon glow
    ctx.save();
    ctx.shadowColor = "rgba(16,185,129,0.7)";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    for (const [a, b] of POSE_CONNECTIONS) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb) continue;
      if ((la.visibility ?? 1) < 0.4 || (lb.visibility ?? 1) < 0.4) continue;
      const grad = ctx.createLinearGradient(la.x * vw, la.y * vh, lb.x * vw, lb.y * vh);
      grad.addColorStop(0, "rgba(16,185,129,0.9)");
      grad.addColorStop(1, "rgba(52,211,153,0.7)");
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(la.x * vw, la.y * vh);
      ctx.lineTo(lb.x * vw, lb.y * vh);
      ctx.stroke();
    }
    ctx.restore();

    // Draw joints with outer glow rings
    for (const lm of landmarks) {
      if ((lm.visibility ?? 1) < 0.4) continue;
      const x = lm.x * vw;
      const y = lm.y * vh;
      // Outer glow ring
      ctx.save();
      ctx.shadowColor = "rgba(16,185,129,0.9)";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "rgba(52,211,153,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // Inner filled dot
      ctx.save();
      ctx.fillStyle = "#fef3c7";
      ctx.shadowColor = "rgba(254,243,199,0.8)";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [landmarks, videoRef]);

  return (
    <div className="relative w-full h-full md:h-auto md:aspect-video md:rounded-2xl md:shadow-2xl md:ring-1 md:ring-white/10 overflow-hidden bg-black">
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${
          mirrored ? "scale-x-[-1]" : ""
        }`}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${
          mirrored ? "scale-x-[-1]" : ""
        }`}
      />
      {viewAngle && viewAngle !== "unknown" && (
        <div
          className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold glass-card ${
            supportedViews && !supportedViews.includes(viewAngle)
              ? "text-amber-300 border-amber-500/30"
              : "text-emerald-300 border-emerald-500/30"
          }`}
        >
          <Eye size={11} className="shrink-0" />
          {viewAngleLabel(viewAngle)}
        </div>
      )}
    </div>
  );
}
