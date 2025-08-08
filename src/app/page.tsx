"use client";

import RobotViewer from "@/components/viewer/RobotViewer";
import ViewerControls from "@/components/controls/ViewerControls";
import FullScreenDragDrop from "@/components/FullScreenDragDrop";
import { RobotProvider } from "@/contexts/RobotContext";
import MujocoViewer from "@/components/viewer/MuJoCoViewer";
import { MujocoViewerProvider } from "@/contexts/MujocoViewerContext";
import { useState } from "react";
import { FileType } from "@/components/controls/ViewerControls";
import Navbar from "@/components/misc/Navbar";

export default function Home() {
  const [showFullScreenDragDrop, setShowFullScreenDragDrop] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<FileType>("MJCF");
  const [useSimulation, setUseSimulation] = useState<boolean>(false);

  const switchToMjcf = () => setSelectedFileType("MJCF");

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Navbar */}
      <Navbar />
      {/* Main content area */}
      <MujocoViewerProvider>
        <RobotProvider>
          <main className="flex flex-1 w-full h-[90vh] min-h-0 bg-[#FCF4DD] p-6">
            <div className="flex flex-row w-full h-full gap-6">
              {/* Robot Selector section */}
              <div className="flex-[2] min-w-0 w-full h-full bg-[#FFFBF1] rounded-3xl flex items-center justify-center overflow-hidden">
                <ViewerControls
                  onUploadClick={() => setShowFullScreenDragDrop(true)}
                  onFileTypeChange={setSelectedFileType}
                  onToggleSimulation={() => setUseSimulation((v) => !v)}
                  isSimulation={useSimulation}
                />
              </div>
              {/* Viewer section */}
              <div
                className="flex-[4] min-w-0 h-full flex items-center justify-center bg-[#fef4da] rounded-3xl overflow-hidden"
                style={{ minWidth: "60%" }}
              >
                {selectedFileType === "MJCF" ? (
                  <MujocoViewer useSimulation={useSimulation} />
                ) : (
                  <RobotViewer />
                )}
              </div>
            </div>
          </main>

          {/* Full Screen Drag Drop Overlay */}
          {showFullScreenDragDrop && (
            <div className="absolute inset-0">
              <FullScreenDragDrop
                onClose={() => setShowFullScreenDragDrop(false)}
                onSwitchToMjcf={switchToMjcf}
              />
            </div>
          )}
        </RobotProvider>
      </MujocoViewerProvider>
    </div>
  );
}
