"use client";

import { useState } from "react";

// Contexts
import { RobotProvider } from "@/contexts/RobotContext";
import { UrdfRuntimeProvider } from "@/contexts/UrdfRuntimeContext";

// Components
import Navbar from "@/components/misc/Navbar";
import ViewerControls from "@/components/controls/ViewerControls";
import ViewerSwitch from "@/components/viewer/ViewerSwitch";
import FullScreenDragDrop from "@/components/FullScreenDragDrop";

export default function Home() {
  const [showFullScreenDragDrop, setShowFullScreenDragDrop] = useState(false);

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Navbar */}
      <Navbar />
      {/* Main content area */}
      <RobotProvider>
        <UrdfRuntimeProvider>
          <main className="flex flex-1 w-full h-[90vh] min-h-0 bg-[#FCF4DD] p-6">
            <div className="flex flex-row w-full h-full gap-6">
              {/* Robot Selector section */}
              <div className="flex-[2] min-w-0 w-full h-full bg-[#FFFBF1] rounded-3xl overflow-hidden">
                <ViewerControls
                  onUploadClick={() => setShowFullScreenDragDrop(true)}
                />
              </div>
              {/* Viewer section */}
              <div
                className="flex-[4] min-w-0 h-full flex items-center justify-center bg-[#fef4da] rounded-3xl overflow-hidden"
                style={{ minWidth: "60%" }}
              >
                <ViewerSwitch />
              </div>
            </div>
          </main>

          {/* Full Screen Drag Drop Overlay */}
          {showFullScreenDragDrop && (
            <div className="absolute inset-0">
              <FullScreenDragDrop
                onClose={() => setShowFullScreenDragDrop(false)}
              />
            </div>
          )}
        </UrdfRuntimeProvider>
      </RobotProvider>
    </div>
  );
}
