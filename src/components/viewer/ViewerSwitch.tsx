"use client";

import { useRobot } from "@/hooks/useRobot";
import { useMemo } from "react";
import MjcfViewer from "./MjcfViewer";
import { MujocoSceneProvider } from "@/contexts/MujocoSceneProvider";
import UrdfViewer from "./UrdfViewer";
import { UrdfRuntimeProvider } from "@/contexts/UrdfRuntimeContext";
import type { RobotFileType } from "@/types/robot";

function Placeholder({ label }: { label: string }) {
  return (
    <div className="w-full h-full grid place-items-center rounded-xl border border-dashed border-zinc-300 text-zinc-500">
      <div className="text-sm">{label} viewer TBD</div>
    </div>
  );
}

export default function ViewerSwitch() {
  const { activeRobotType } = useRobot();

  const mode: RobotFileType | "URDF" | null = useMemo(() => {
    // Default to URDF if unset
    return activeRobotType ?? "URDF";
  }, [activeRobotType]);

  switch (mode) {
    case "MJCF":
      return (
        <MujocoSceneProvider>
          <MjcfViewer />
        </MujocoSceneProvider>
      );
    case "URDF":
      return (
        <UrdfRuntimeProvider>
          <UrdfViewer />
        </UrdfRuntimeProvider>
      );
    case "USD":
      return <Placeholder label="USD" />;
    default:
      return (
        <UrdfRuntimeProvider>
          <UrdfViewer />
        </UrdfRuntimeProvider>
      );
  }
}
