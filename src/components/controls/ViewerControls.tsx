"use client";

import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRobot } from "@/hooks/useRobot";
import { useMujocoViewer } from "@/contexts/MujocoViewerContext";

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
      <div className="w-full flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onUploadClick}
            className="px-4 py-2 rounded-xl bg-[#ffb601] border-2 border-black font-semibold text-black shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            Upload
          </button>
          <span className="text-xl font-semibold text-gray-900">
            your robot
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={selectedFileType}
            onValueChange={(value) => setSelectedFileType(value as FileType)}
          >
            <SelectTrigger className="min-w-[140px] border-2 border-black rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["URDF", "MJCF", "SDF", "USD"] as FileType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedFileType === "MJCF" && (
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
          )}
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          Or try one of our examples
        </h2>
      </div>

      <div className="flex flex-wrap gap-4">
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
            <button
              key={index}
              onClick={() => handleExampleClick(example)}
              className={`group relative overflow-hidden rounded-2xl border-2 border-black p-4 text-left transition-all ${
                isSelected
                  ? "bg-[#ffb601] shadow-md"
                  : "bg-white hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-black">{example.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full border border-black bg-black/5">
                  {example.fileType}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                {example.path ? example.path.split("/").pop() : "Example"}
              </div>
            </button>
          );
        })}
      </div>

      {selectedFileType === "MJCF" && (
        <div className="mt-4 text-xs text-gray-700 font-mono">
          MJCF body dragging is under development and not yet fully operational.
        </div>
      )}
    </div>
  );
}
