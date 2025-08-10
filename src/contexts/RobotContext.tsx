"use client";

import React, { createContext, useState, ReactNode } from "react";
import { RobotFileType } from "@/types/robot";

const defaultRobotOwner = "placeholder";
const defaultRobotName = "so-100";

// Public API available to sub-components
export type RobotContextType = {
  activeRobotType: RobotFileType | null;
  setActiveRobotType: (type: RobotFileType | null) => void;
  activeRobotOwner: string | null;
  activeRobotName: string | null; // slug (repo_name)
  setActiveRobotOwner: (owner: string | null) => void;
  setActiveRobotName: (name: string | null) => void;
};

export const RobotContext = createContext<RobotContextType | undefined>(
  undefined
);

export const RobotProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [activeRobotType, setActiveRobotType] = useState<RobotFileType | null>(
    null
  );
  const [activeRobotOwner, setActiveRobotOwner] = useState<string | null>(
    defaultRobotOwner
  );
  const [activeRobotName, setActiveRobotName] = useState<string | null>(
    defaultRobotName
  );

  // Public API available to sub-components (shared in return statement below)
  const contextValue: RobotContextType = {
    activeRobotType,
    setActiveRobotType,
    activeRobotOwner,
    activeRobotName,
    setActiveRobotOwner,
    setActiveRobotName,
  };

  return (
    <RobotContext.Provider value={contextValue}>
      {children}
    </RobotContext.Provider>
  );
};
