import React, { useEffect, useMemo } from "react";
import { useRobot } from "@/hooks/useRobot";

/**
 * Component that only handles initializing the URDF processor
 * This component doesn't render anything visible, just initializes the processor
 */
const UrdfProcessorInitializer: React.FC = () => {
  const { registerUrdfProcessor } = useRobot();

  // Create the URDF processor
  const urdfProcessor = useMemo(
    () => ({
      loadUrdf: (urdfPath: string) => {
        console.log("📂 URDF path set:", urdfPath);
        // This will be handled by the actual viewer component
        return urdfPath;
      },
      setUrlModifierFunc: (func: (url: string) => string) => {
        console.log("🔗 URL modifier function set");
        return func;
      },
      getPackage: () => {
        return "";
      },
    }),
    []
  );

  // Register the URDF processor with the context
  useEffect(() => {
    registerUrdfProcessor(urdfProcessor);
  }, [registerUrdfProcessor, urdfProcessor]);

  // This component doesn't render anything
  return null;
};

export default UrdfProcessorInitializer;
