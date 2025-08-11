"use client";
import { useEffect, useRef, useState } from "react";
import { useMujocoScene } from "@/contexts/MujocoSceneProvider";
import { useRobot } from "@/hooks/useRobot";
import { RotateCcw, Play, Square, Pause } from "lucide-react";

export default function MjcfViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    registerIframeWindow,
    resetPose,
    setTheme,
    pauseSimulation,
    resumeSimulation,
  } = useMujocoScene();
  const {
    activeRobotType,
    setActiveRobotType,
    setActiveRobotOwner,
    setActiveRobotName,
  } = useRobot();
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Ensure we have an MJCF robot selected when this viewer is mounted
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
    console.log("🔧 Setting up iframe effect for key:", iframeKey, iframe?.src);
    if (!iframe) return;

    iframe.onload = () => {
      console.log("🔄 Iframe loaded:", iframe.src);
      // Wait for IFRAME_READY to ensure wasm/vfs are initialized
    };

    iframe.onerror = (error) => {
      console.error("❌ Iframe failed to load:", error);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) {
        return;
      }
      switch (event.data.type) {
        case "SCENE_LOADED":
          break;
        case "ERROR":
          console.error("❌ Iframe error:", event.data.error);
          break;
        default:
        // No-op
      }
    };

    const handleReady = (event: MessageEvent) => {
      console.log("📨 Parent received message:", event.data?.type, {
        source:
          event.source === iframe.contentWindow
            ? "correct-iframe"
            : "other-source",
        currentIframeSrc: iframe.src,
        iframeKey,
      });
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === "IFRAME_READY") {
        console.log("🟢 Iframe ready, registering window and setting theme");
        registerIframeWindow(iframe.contentWindow);
        // Push CSS variable-based theme to iframe once ready
        const styles = getComputedStyle(document.documentElement);
        const sceneBg = styles.getPropertyValue("--mujoco-scene-bg").trim();
        const floor = styles.getPropertyValue("--mujoco-scene-bg").trim();
        setTheme({ sceneBg, floor, ambient: floor, hemi: floor });
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("message", handleReady);

    return () => {
      console.log("🧹 Cleaning up iframe effect for key:", iframeKey);
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("message", handleReady);
      registerIframeWindow(null);
    };
  }, [registerIframeWindow, setTheme, iframeKey]);

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
          key={iframeKey}
          ref={iframeRef}
          src={
            isSimulating
              ? "/mujoco/mujoco-simulator.html"
              : "/mujoco/mujoco-viewer.html"
          }
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
          {isSimulating && (
            <button
              onClick={() => {
                if (isPaused) {
                  resumeSimulation();
                  setIsPaused(false);
                } else {
                  pauseSimulation();
                  setIsPaused(true);
                }
              }}
              aria-label={isPaused ? "Resume simulation" : "Pause simulation"}
              className="flex items-center justify-center text-sm gap-2 text-brand bg-highlight border-none rounded-lg p-2 cursor-pointer hover:bg-highlight/80 transition-all"
            >
              {isPaused ? (
                <Play size={17} className="text-[#968612]" />
              ) : (
                <Pause size={17} className="text-[#968612]" />
              )}
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}

          <button
            onClick={() => {
              const newSimulating = !isSimulating;
              console.log("🔄 Switching simulation mode:", {
                from: isSimulating,
                to: newSimulating,
              });
              setIsSimulating(newSimulating);
              if (!newSimulating) {
                // When stopping simulation, reset pause state
                setIsPaused(false);
              }
              // Force iframe reload when switching modes
              setIframeKey((prev) => prev + 1);
              // Unregister the current iframe window since we're switching
              registerIframeWindow(null);
            }}
            aria-label={isSimulating ? "Stop simulation" : "Start simulation"}
            className="flex items-center justify-center text-sm gap-2 text-brand bg-highlight border-none rounded-lg p-2 cursor-pointer hover:bg-highlight/80 transition-all"
          >
            {isSimulating ? (
              <Square size={17} className="text-[#968612]" />
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
