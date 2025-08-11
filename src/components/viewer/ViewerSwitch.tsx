"use client";

import { useRobot } from "@/hooks/useRobot";
import { useMemo } from "react";
import MjcfViewer from "./MjcfViewer";
import { MujocoSceneProvider } from "@/contexts/MujocoSceneProvider";
import UrdfViewer from "./UrdfViewer";
import { UrdfRuntimeProvider } from "@/contexts/UrdfRuntimeContext";
import type { RobotFileType } from "@/types/robot";
import UsdViewer from "./UsdViewer";

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
      // return <Placeholder label="USD" />;
      return <UsdViewer />;

    default:
      return (
        <UrdfRuntimeProvider>
          <UrdfViewer />
        </UrdfRuntimeProvider>
      );
  }
}
