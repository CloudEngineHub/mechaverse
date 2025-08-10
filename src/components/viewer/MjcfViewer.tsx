"use client";
import { useEffect, useRef } from "react";
import { useMujocoIframe } from "@/contexts/MujocoIframeContext";
import { RotateCcw } from "lucide-react";

export default function MujocoViewer({
  useSimulation = false,
}: {
  useSimulation?: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { registerIframeWindow, resetPose, setTheme } = useMujocoIframe();

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
        // Push CSS variable-based theme to iframe once ready
        const styles = getComputedStyle(document.documentElement);
        const sceneBg = styles.getPropertyValue("--mv-scene-bg").trim();
        const floor = styles.getPropertyValue("--mv-floor").trim();
        setTheme({ sceneBg, floor, ambient: floor, hemi: floor });
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
          background: "var(--mv-scene-bg)",
          boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <iframe
          ref={iframeRef}
          src={
            useSimulation
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
            background: "var(--mv-scene-bg)",
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
      </div>
    </div>
  );
}
