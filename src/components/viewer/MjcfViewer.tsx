"use client";
import { useEffect, useRef, useState } from "react";
import { useMujocoScene } from "@/contexts/MujocoSceneProvider";
import { RotateCcw } from "lucide-react";

export default function MjcfViewer() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { registerIframeWindow, resetPose, setTheme } = useMujocoScene();
  const [isSimulating, setIsSimulating] = useState(false);

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
        const sceneBg = styles.getPropertyValue("--mujoco-scene-bg").trim();
        const floor = styles.getPropertyValue("--mujoco-scene-bg").trim();
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

        <button
          onClick={() => {
            setIsSimulating(!isSimulating);
          }}
          aria-label="Toggle physics"
          className="absolute flex items-center justify-center text-sm gap-2 text-brand bottom-3 right-3 z-10 bg-highlight border-none rounded-lg p-2 cursor-pointer hover:bg-highlight transition-all"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="16"
            viewBox="0 0 17 16"
            fill="none"
          >
            <mask
              id="mask0_2_398"
              style={{ maskType: "alpha" }}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="17"
              height="16"
            >
              <rect x="0.5" width="16" height="16" fill="#D9D9D9" />
            </mask>
            <g mask="url(#mask0_2_398)">
              <path
                d="M5.03333 8.66663L8.5 10.6666L11.9667 8.66663L9.16667 7.04996V9.33329H7.83333V7.04996L5.03333 8.66663ZM7.83333 5.51663V5.23329C7.34444 5.08885 6.94444 4.81385 6.63333 4.40829C6.32222 4.00274 6.16667 3.53329 6.16667 2.99996C6.16667 2.35551 6.39444 1.80551 6.85 1.34996C7.30556 0.894404 7.85556 0.666626 8.5 0.666626C9.14444 0.666626 9.69445 0.894404 10.15 1.34996C10.6056 1.80551 10.8333 2.35551 10.8333 2.99996C10.8333 3.53329 10.6778 4.00274 10.3667 4.40829C10.0556 4.81385 9.65556 5.08885 9.16667 5.23329V5.51663L13.8333 8.19996C14.0444 8.32218 14.2083 8.48607 14.325 8.69163C14.4417 8.89718 14.5 9.12218 14.5 9.36663V10.6333C14.5 10.8777 14.4417 11.1027 14.325 11.3083C14.2083 11.5138 14.0444 11.6777 13.8333 11.8L9.16667 14.4833C8.95556 14.6055 8.73333 14.6666 8.5 14.6666C8.26667 14.6666 8.04444 14.6055 7.83333 14.4833L3.16667 11.8C2.95556 11.6777 2.79167 11.5138 2.675 11.3083C2.55833 11.1027 2.5 10.8777 2.5 10.6333V9.36663C2.5 9.12218 2.55833 8.89718 2.675 8.69163C2.79167 8.48607 2.95556 8.32218 3.16667 8.19996L7.83333 5.51663ZM7.83333 11.8166L3.83333 9.51663V10.6333L8.5 13.3333L13.1667 10.6333V9.51663L9.16667 11.8166C8.95556 11.9388 8.73333 12 8.5 12C8.26667 12 8.04444 11.9388 7.83333 11.8166ZM8.5 3.99996C8.77778 3.99996 9.01389 3.90274 9.20833 3.70829C9.40278 3.51385 9.5 3.27774 9.5 2.99996C9.5 2.72218 9.40278 2.48607 9.20833 2.29163C9.01389 2.09718 8.77778 1.99996 8.5 1.99996C8.22222 1.99996 7.98611 2.09718 7.79167 2.29163C7.59722 2.48607 7.5 2.72218 7.5 2.99996C7.5 3.27774 7.59722 3.51385 7.79167 3.70829C7.98611 3.90274 8.22222 3.99996 8.5 3.99996Z"
                fill="#968612"
              />
            </g>
          </svg>
          Simulate
        </button>
      </div>
    </div>
  );
}
