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
  
  // Add hover state for body highlighting
  const [highlightedBody, setHighlightedBody] = useState<string | null>(null);

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
        case "BODY_MOUSEOVER": {
          setHighlightedBody(event.data.bodyName);
          break;
        }
        case "BODY_MOUSEOUT": {
          setHighlightedBody(null);
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

        {/* Body hover indicator */}
        {highlightedBody && (
          <div
            className={
              "font-mono absolute bottom-4 left-4 text-[#9b8632] px-3 py-2 rounded-md text-sm z-10 flex items-center gap-2"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="17"
              height="16"
              viewBox="0 0 17 16"
              fill="none"
            >
              <mask
                id="mask0_2_350"
                style={{ maskType: "alpha" }}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="17"
                height="16"
              >
                <rect x="0.5" width="16" height="16" fill="#D9D9D9" />
              </mask>
              <g mask="url(#mask0_2_350)">
                <path
                  d="M4.15006 14C3.87229 14 3.63618 13.9028 3.44173 13.7083C3.24729 13.5139 3.15007 13.2778 3.15007 13C3.15007 12.7222 3.24729 12.4861 3.44173 12.2916C3.63618 12.0972 3.87229 12 4.15006 12H5.21673L3.51673 6.43331C3.21673 6.26664 2.96951 6.0222 2.77507 5.69997C2.58062 5.37775 2.4834 5.03331 2.4834 4.66664C2.4834 4.11109 2.67784 3.63886 3.06673 3.24997C3.45562 2.86109 3.92784 2.66664 4.4834 2.66664C4.91673 2.66664 5.30284 2.79164 5.64173 3.04164C5.98062 3.29164 6.21673 3.61109 6.35006 3.99997H8.4834V3.33331C8.4834 3.14442 8.54729 2.98609 8.67507 2.85831C8.80284 2.73053 8.96118 2.66664 9.15006 2.66664C9.25006 2.66664 9.34729 2.68886 9.44173 2.73331C9.53618 2.77775 9.61673 2.84442 9.6834 2.93331L10.8167 1.86664C10.9167 1.76664 11.0362 1.70275 11.1751 1.67497C11.314 1.6472 11.4501 1.66664 11.5834 1.73331L14.1834 2.93331C14.3167 2.99997 14.4084 3.0972 14.4584 3.22497C14.5084 3.35275 14.5056 3.47775 14.4501 3.59997C14.3834 3.73331 14.2862 3.81942 14.1584 3.85831C14.0306 3.8972 13.9056 3.88886 13.7834 3.83331L11.3834 2.73331L9.81673 4.19997V5.13331L11.3834 6.56664L13.7834 5.46664C13.9056 5.41109 14.0334 5.40553 14.1667 5.44997C14.3001 5.49442 14.3945 5.57775 14.4501 5.69997C14.5167 5.83331 14.5223 5.96109 14.4667 6.08331C14.4112 6.20553 14.3167 6.29997 14.1834 6.36664L11.5834 7.59997C11.4501 7.66664 11.314 7.68609 11.1751 7.65831C11.0362 7.63053 10.9167 7.56664 10.8167 7.46664L9.6834 6.39997C9.61673 6.46664 9.53618 6.52775 9.44173 6.58331C9.34729 6.63886 9.25006 6.66664 9.15006 6.66664C8.96118 6.66664 8.80284 6.60275 8.67507 6.47497C8.54729 6.3472 8.4834 6.18886 8.4834 5.99997V5.33331H6.35006C6.31673 5.4222 6.28062 5.50553 6.24173 5.58331C6.20284 5.66109 6.15006 5.74442 6.0834 5.83331L9.41673 12H10.8167C11.0945 12 11.3306 12.0972 11.5251 12.2916C11.7195 12.4861 11.8167 12.7222 11.8167 13C11.8167 13.2778 11.7195 13.5139 11.5251 13.7083C11.3306 13.9028 11.0945 14 10.8167 14H4.15006ZM4.4834 5.33331C4.67229 5.33331 4.83062 5.26942 4.9584 5.14164C5.08618 5.01386 5.15006 4.85553 5.15006 4.66664C5.15006 4.47775 5.08618 4.31942 4.9584 4.19164C4.83062 4.06386 4.67229 3.99997 4.4834 3.99997C4.29451 3.99997 4.13618 4.06386 4.0084 4.19164C3.88062 4.31942 3.81673 4.47775 3.81673 4.66664C3.81673 4.85553 3.88062 5.01386 4.0084 5.14164C4.13618 5.26942 4.29451 5.33331 4.4834 5.33331ZM6.5834 12H7.8834L5.01673 6.66664H4.95006L6.5834 12Z"
                  fill="#968612"
                />
              </g>
            </svg>
            {highlightedBody}
          </div>
        )}
      </div>
    </div>
  );
}
