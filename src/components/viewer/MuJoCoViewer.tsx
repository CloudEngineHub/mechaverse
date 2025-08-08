"use client";
import { useEffect, useRef } from "react";
import { useMujocoViewer } from "@/contexts/MujocoViewerContext";
import { RotateCcw } from "lucide-react";

export default function MujocoViewer({
  useSimulation = false,
}: {
  useSimulation?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { registerIframeWindow, resetPose } = useMujocoViewer();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onload = () => {
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
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === "IFRAME_READY") {
        registerIframeWindow(iframe.contentWindow);
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("message", handleReady);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("message", handleReady);
      registerIframeWindow(null);
    };
  }, [registerIframeWindow]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fef4da",
          boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <iframe
          ref={iframeRef}
          src={
            useSimulation
              ? "/mujoco-sim/mujoco-demo-sim.html"
              : "/mujoco-sim/mujoco-demo.html"
          }
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; clipboard-read; clipboard-write"
          style={{
            width: "100%",
            height: "100%",
            margin: 0,
            padding: 0,
            border: "none",
            display: "block",
            background: "#fef4da",
            borderRadius: "12px",
          }}
          title="MuJoCo Physics Viewer"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        <button
          onClick={resetPose}
          aria-label="Reset Pose"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            background: "#f60002",
            border: "none",
            borderRadius: 12,
            padding: 10,
            boxShadow: "0 4px 15px rgba(102, 126, 234, 0.3)",
            cursor: "pointer",
            transition: "all 0.3s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow =
              "0 6px 20px rgba(102, 126, 234, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow =
              "0 4px 15px rgba(102, 126, 234, 0.3)";
          }}
        >
          <RotateCcw
            size={22}
            color="white"
            style={{
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
            }}
          />
        </button>
      </div>
    </div>
  );
}
