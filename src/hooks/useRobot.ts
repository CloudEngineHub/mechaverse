import { RobotContextType, RobotContext } from "@/contexts/RobotContext";
import { useContext } from "react";

// Custom hook to use the URDF context
export const useRobot = (): RobotContextType => {
  const context = useContext(RobotContext);
  if (context === undefined) {
    throw new Error("useRobot must be used within a RobotProvider");
  }
  return context;
};
