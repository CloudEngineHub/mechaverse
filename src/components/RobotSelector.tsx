"use client";

import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FileType = "URDF" | "MJCF" | "SDF" | "USD";

export interface Example {
  name: string;
  fileType: FileType;
}

const examples: Record<FileType, Example[]> = {
  URDF: [
    {
      name: "Cassie",
      fileType: "URDF",
    },
    {
      name: "SO-100",
      fileType: "URDF",
    },
    {
      name: "Anymal B",
      fileType: "URDF",
    },
  ],
  MJCF: [
    {
      name: "Humanoid",
      fileType: "MJCF",
    },
    {
      name: "Ant Robot",
      fileType: "MJCF",
    },
    {
      name: "Swimmer",
      fileType: "MJCF",
    },
  ],
  SDF: [
    {
      name: "TurtleBot3",
      fileType: "SDF",
    },
    {
      name: "PR2",
      fileType: "SDF",
    },
    {
      name: "Pioneer",
      fileType: "SDF",
    },
  ],
  USD: [
    {
      name: "Industrial",
      fileType: "USD",
    },
    {
      name: "Drone",
      fileType: "USD",
    },
    {
      name: "Bike",
      fileType: "USD",
    },
  ],
};

interface RobotSelectorProps {
  onUploadClick: () => void;
  onExampleLoad?: (example: Example) => void;
}

export default function RobotSelector({
  onUploadClick,
  onExampleLoad,
}: RobotSelectorProps) {
  const [selectedFileType, setSelectedFileType] = useState<FileType>("URDF");

  const handleExampleClick = (example: Example) => {
    onExampleLoad?.(example);
  };

  return (
    <div className="w-full h-full flex flex-col p-8">
      {/* Upload Section */}
      <div className="w-full flex flex-row items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          <button
            onClick={onUploadClick}
            className="bg-[#ffb601] text-black px-3 py-1 rounded-lg hover:bg-[#ffb601]/80 hover:-translate-y-1 transition-all font-bold"
          >
            Upload
          </button>{" "}
          your robot
        </h2>
      </div>{" "}
      {/* Header */}
      <div className="w-full flex flex-row items-center gap-3 mb-4">
        <h2 className="text-lg font-bold text-gray-900 font-geist-mono">
          Or <span className="text-[#ffb601]">try</span> these one of our{" "}
          <span className="text-[#ffb601]">examples</span>
        </h2>

        {/* File Type Dropdown */}
        <Select
          value={selectedFileType}
          onValueChange={(value) => setSelectedFileType(value as FileType)}
        >
          <SelectTrigger>
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
      </div>
      {/* Example Cards */}
      <div className="grid grid-cols-3 gap-4 mb-4 w-full">
        {examples[selectedFileType].map((example, index) => (
          <button
            key={index}
            onClick={() => handleExampleClick(example)}
            className="bg-[#f60001] rounded-lg px-3 py-1 text-left hover:bg-[#f60001]/80 hover:shadow-md hover:-translate-y-1 transition-all group h-10 flex items-center justify-center"
          >
            <h3 className="font-bold text-black font-helvetica-now-display">
              {example.name}
            </h3>
          </button>
        ))}
      </div>
    </div>
  );
}
