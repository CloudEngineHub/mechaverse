"use client";
import { useEffect, useRef, useState } from "react";
import { useMujocoScene } from "@/hooks/useMujocoScene";
import { useRobot } from "@/hooks/useRobot";
import { RotateCcw, Play, Pause } from "lucide-react";

export default function MjcfViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { registerIframeWindow, resetPose, pauseSimulation, resumeSimulation } =
    useMujocoScene();
  const {
    activeRobotType,
    setActiveRobotType,
    setActiveRobotOwner,
    setActiveRobotName,
  } = useRobot();
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (activeRobotType !== "MJCF") {
      setActiveRobotType("MJCF");
      setActiveRobotOwner("placeholder");
      setActiveRobotName("humanoid"); // Default to humanoid as it's a good MJCF example
    }
  }, [
    activeRobotType,
    setActiveRobotType,
    setActiveRobotOwner,
    setActiveRobotName,
  ]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onerror = (error) => {
      console.error("[MJCF] ❌ Iframe failed to load:", error);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      switch (event.data?.type) {
        case "IFRAME_READY": {
          registerIframeWindow(iframe.contentWindow);
          break;
        }
        case "ERROR": {
          console.error("❌ Iframe error:", event.data.error);
          break;
        }
        case "SCENE_LOADED": {
          // Ensure UI shows paused by default after any scene load
          setIsSimulating(false);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      registerIframeWindow(null);
    };
  }, [registerIframeWindow]);

  return (
    <div className="w-full h-full flex flex-row relative">
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--mujoco-scene-bg)",
          boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <iframe
          ref={iframeRef}
          src={"/mujoco/mujoco.html"}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          style={{
            width: "100%",
            height: "100%",
            margin: 0,
            padding: 0,
            border: "none",
            display: "block",
            background: "var(--mujoco-scene-bg)",
            borderRadius: "12px",
          }}
          title="MuJoCo Physics Viewer"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        <button
          onClick={resetPose}
          aria-label="Reset Pose"
          className="absolute top-3 right-3 z-10 bg-[#fefbf1] border-none rounded-lg p-2 cursor-pointer hover:bg-[#fefbf1]/80 transition-all"
        >
          <RotateCcw size={22} className="text-[#968612]" />
        </button>

        {/* Simulation Control Buttons */}
        <div className="absolute bottom-3 right-3 z-10 flex gap-2">
          <button
            onClick={() => {
              if (isSimulating) {
                pauseSimulation();
                setIsSimulating(false);
              } else {
                setIsSimulating(true);
                resumeSimulation();
              }
            }}
            aria-label={isSimulating ? "Pause simulation" : "Resume simulation"}
            className="flex items-center justify-center font-mono text-sm gap-2 text-brand bg-highlight border-none rounded-lg p-2 cursor-pointer hover:bg-highlight/80 transition-all"
          >
            {isSimulating ? (
              <Pause size={17} className="text-[#968612]" />
            ) : (
              <Play size={17} className="text-[#968612]" />
            )}
            {isSimulating ? "Stop" : "Simulate"}
          </button>
        </div>
      </div>
    </div>
  );
}
