"use client";

import React, { useState, useEffect } from "react";
import FilterDropdown from "@/components/controls/FilterDropdown";
import { useRobot } from "@/hooks/useRobot";
import { useMujocoViewer } from "@/contexts/MujocoViewerContext";
import { DM_Mono } from "next/font/google";
import RobotCard from "./RobotCard";

export type FileType = "URDF" | "MJCF" | "SDF" | "USD";

export interface Example {
  name: string;
  fileType: FileType;
  path?: string;
}

const examples: Record<FileType, Example[]> = {
  URDF: [
    { name: "Cassie", fileType: "URDF", path: "/urdf/cassie/cassie.urdf" },
    { name: "SO-100", fileType: "URDF", path: "/urdf/so-100/so_100.urdf" },
    { name: "Anymal B", fileType: "URDF", path: "/urdf/anymal-b/anymal.urdf" },
  ],
  MJCF: [
    { name: "Humanoid", fileType: "MJCF", path: "/mjcf/humanoid/humanoid.xml" },
    { name: "Cassie", fileType: "MJCF", path: "/mjcf/cassie/scene.xml" },
    {
      name: "Shadow Hand",
      fileType: "MJCF",
      path: "/mjcf/shadow_hand/scene_right.xml",
    },
  ],
  SDF: [
    { name: "TurtleBot3", fileType: "SDF" },
    { name: "PR2", fileType: "SDF" },
    { name: "Pioneer", fileType: "SDF" },
  ],
  USD: [
    { name: "Industrial", fileType: "USD" },
    { name: "Drone", fileType: "USD" },
    { name: "Bike", fileType: "USD" },
  ],
};

const dmMono = DM_Mono({ subsets: ["latin"], weight: "400" });

interface ViewerControlsProps {
  onUploadClick: () => void;
  onExampleLoad?: (example: Example) => void;
  onFileTypeChange?: (fileType: FileType) => void;
  onToggleSimulation?: () => void;
  isSimulation?: boolean;
}

export default function ViewerControls({
  onUploadClick,
  onExampleLoad,
  onFileTypeChange,
  onToggleSimulation,
  isSimulation,
}: ViewerControlsProps) {
  const [selectedFileType, setSelectedFileType] = useState<FileType>("MJCF");
  const { selectedRobot, loadExampleRobot } = useRobot();
  const { loadPublicScene, currentScenePath } = useMujocoViewer();

  useEffect(() => {
    onFileTypeChange?.(selectedFileType);
  }, [selectedFileType, onFileTypeChange]);

  useEffect(() => {
    if (selectedFileType === "MJCF" && !currentScenePath) {
      loadPublicScene("cassie/scene.xml");
    }
  }, [selectedFileType, currentScenePath, loadPublicScene]);

  const handleExampleClick = (example: Example) => {
    if (example.fileType === "URDF" && example.path) {
      loadExampleRobot(example.name);
    } else if (example.fileType === "MJCF" && example.path) {
      setSelectedFileType("MJCF");
      loadPublicScene(example.path.replace("/mjcf/", ""));
      onFileTypeChange?.("MJCF");
    }
    onExampleLoad?.(example);
  };

  return (
    <div className="w-full h-full flex flex-col p-6">
      <div className="w-full grid grid-cols-4 gap-3 mb-3 items-stretch">
        <button
          onClick={onUploadClick}
          className={`${dmMono.className} col-span-3 w-full h-full flex items-center justify-center gap-2 px-10 py-3 rounded-md bg-[#FBE651] text-[#968612] hover:bg-[#ffb601]/80 transition-all text-xs font-normal leading-normal not-italic`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="19"
            viewBox="0 0 18 19"
            fill="none"
          >
            <mask
              id="mask0_2_100"
              style={{ maskType: "alpha" }}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="18"
              height="19"
            >
              <rect y="0.5" width="18" height="18" fill="#D9D9D9" />
            </mask>
            <g mask="url(#mask0_2_100)">
              <path
                d="M8.24999 6.36873L4.57499 10.0437C4.42499 10.1937 4.24999 10.2656 4.04999 10.2594C3.84999 10.2531 3.67499 10.175 3.52499 10.025C3.38749 9.87498 3.31562 9.69998 3.30937 9.49998C3.30312 9.29998 3.37499 9.12498 3.52499 8.97498L8.47499 4.02498C8.54999 3.94998 8.63124 3.89685 8.71874 3.8656C8.80624 3.83435 8.89999 3.81873 8.99999 3.81873C9.09999 3.81873 9.19374 3.83435 9.28124 3.8656C9.36874 3.89685 9.44999 3.94998 9.52499 4.02498L14.475 8.97498C14.6125 9.11248 14.6812 9.28435 14.6812 9.4906C14.6812 9.69685 14.6125 9.87498 14.475 10.025C14.325 10.175 14.1469 10.25 13.9406 10.25C13.7344 10.25 13.5562 10.175 13.4062 10.025L9.74999 6.36873V14.75C9.74999 14.9625 9.67812 15.1406 9.53437 15.2844C9.39062 15.4281 9.21249 15.5 8.99999 15.5C8.78749 15.5 8.60937 15.4281 8.46562 15.2844C8.32187 15.1406 8.24999 14.9625 8.24999 14.75V6.36873Z"
                fill="#A99B3A"
              />
            </g>
          </svg>
          Upload
        </button>
        <div className="col-span-1">
          <FilterDropdown
            value={selectedFileType}
            options={["URDF", "MJCF", "SDF", "USD"] as const}
            onChange={(v) => setSelectedFileType(v as FileType)}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {examples[selectedFileType].map((example, index) => {
          const isSelected =
            selectedFileType === "URDF"
              ? selectedRobot === example.name
              : !!(
                  currentScenePath &&
                  example.path &&
                  (currentScenePath.endsWith(
                    example.path.replace("/mjcf/", "")
                  ) ||
                    currentScenePath.endsWith(example.path))
                );
          return (
            <RobotCard
              key={index}
              index={index}
              example={example}
              isSelected={isSelected}
              handleExampleClick={handleExampleClick}
            />
          );
        })}
      </div>

      {/* {selectedFileType === "MJCF" && (
        <button
          onClick={onToggleSimulation}
          className={`px-4 py-2 rounded-xl border-2 border-black font-semibold transition-all ${
            isSimulation
              ? "bg-[#ffb601] text-black shadow-sm"
              : "bg-white hover:bg-gray-100"
          }`}
        >
          {isSimulation ? "Stop simulation" : "Run simulation"}
        </button>
      )} */}
    </div>
  );
}
