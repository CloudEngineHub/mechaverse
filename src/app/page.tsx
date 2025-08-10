"use client";

import { useMemo, useState } from "react";

// Contexts
import { RobotProvider } from "@/contexts/RobotContext";
import {
  MujocoIframeProvider,
  useMujocoIframe,
} from "@/contexts/MujocoIframeContext";
import { UrdfRuntimeProvider } from "@/contexts/UrdfRuntimeContext";

// Components
import Navbar from "@/components/misc/Navbar";
import ViewerControls from "@/components/controls/ViewerControls";
import UrdfViewer from "@/components/viewer/UrdfViewer";
import MujocoViewer from "@/components/viewer/MjcfViewer";
import FullScreenDragDrop from "@/components/FullScreenDragDrop";

import { useRobot } from "@/hooks/useRobot";

function ViewerSwitch({ useSimulation }: { useSimulation: boolean }) {
  const { currentScenePath } = useMujocoIframe();
  const { activeType } = useRobot();

  const mode: "MJCF" | "URDF" = useMemo(() => {
    if (currentScenePath) return "MJCF";
    return activeType === "MJCF" ? "MJCF" : "URDF";
  }, [currentScenePath, activeType]);

  return mode === "MJCF" ? (
    <MujocoViewer useSimulation={useSimulation} />
  ) : (
    <UrdfViewer />
  );
}

export default function Home() {
  const [showFullScreenDragDrop, setShowFullScreenDragDrop] = useState(false);
  const [useSimulation, setUseSimulation] = useState<boolean>(false);

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Navbar */}
      <Navbar />
      {/* Main content area */}
      <RobotProvider>
        <UrdfRuntimeProvider>
          <MujocoIframeProvider>
            <main className="flex flex-1 w-full h-[90vh] min-h-0 bg-[#FCF4DD] p-6">
              <div className="flex flex-row w-full h-full gap-6">
                {/* Robot Selector section */}
                <div className="flex-[2] min-w-0 w-full h-full bg-[#FFFBF1] rounded-3xl overflow-hidden">
                  <ViewerControls
                    onUploadClick={() => setShowFullScreenDragDrop(true)}
                    onFileTypeChange={() => {}}
                    onToggleSimulation={() => setUseSimulation((v) => !v)}
                    isSimulation={useSimulation}
                  />
                </div>
                {/* Viewer section */}
                <div
                  className="flex-[4] min-w-0 h-full flex items-center justify-center bg-[#fef4da] rounded-3xl overflow-hidden"
                  style={{ minWidth: "60%" }}
                >
                  <ViewerSwitch useSimulation={useSimulation} />
                </div>
              </div>
            </main>

            {/* Full Screen Drag Drop Overlay */}
            {showFullScreenDragDrop && (
              <div className="absolute inset-0">
                <FullScreenDragDrop
                  onClose={() => setShowFullScreenDragDrop(false)}
                  onSwitchToMjcf={() => {
                    /* viewer will switch automatically when an MJCF scene is loaded */
                  }}
                />
              </div>
            )}
          </MujocoIframeProvider>
        </UrdfRuntimeProvider>
      </RobotProvider>
    </div>
  );
}
