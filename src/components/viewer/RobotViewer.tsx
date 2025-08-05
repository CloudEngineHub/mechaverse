"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

import { useRobot } from "@/hooks/useRobot";
import {
  createUrdfViewer,
  setupMeshLoader,
  setupJointHighlighting,
  setupModelLoading,
  URDFViewerElement,
} from "@/components/viewer/urdfViewerHelpers";

// Dynamic import for URDFManipulator to avoid SSR issues
let URDFManipulator: typeof HTMLElement | null = null;

// Register the URDFManipulator as a custom element if it hasn't been already
const registerURDFManipulator = async () => {
  if (typeof window !== "undefined" && !customElements.get("urdf-viewer")) {
    if (!URDFManipulator) {
      const urdfModule = await import(
        "urdf-loader/src/urdf-manipulator-element.js"
      );
      URDFManipulator = urdfModule.default;
    }
    customElements.define("urdf-viewer", URDFManipulator);
  }
};

const UrdfViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedJoint, setHighlightedJoint] = useState<string | null>(null);
  const {
    registerUrdfProcessor,
    onRobotDetected,
    robotBlobUrls,
    alternativeRobotModels,
  } = useRobot();

  const viewerRef = useRef<URDFViewerElement | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

  // Add state for custom URDF path
  const [customUrdfPath, setCustomUrdfPath] = useState<string | null>(null);
  const [urlModifierFunc, setUrlModifierFunc] = useState<
    ((url: string) => string) | null
  >(null);

  const packageRef = useRef<string>("");

  // State to track if we have a dropped robot
  const [hasDroppedRobot, setHasDroppedRobot] = useState(false);

  // Implement UrdfProcessor interface for drag and drop
  const urdfProcessor = useMemo(
    () => ({
      loadUrdf: (urdfPath: string) => {
        setCustomUrdfPath(urdfPath);
        setHasDroppedRobot(true);
      },
      setUrlModifierFunc: (func: (url: string) => string) => {
        setUrlModifierFunc(() => func);
      },
      getPackage: () => {
        return packageRef.current;
      },
    }),
    []
  );

  // Register the URDF processor with the global drag and drop context
  useEffect(() => {
    registerUrdfProcessor(urdfProcessor);
  }, [registerUrdfProcessor, urdfProcessor]);

  // Listen for robot detection events
  useEffect(() => {
    const unsubscribe = onRobotDetected((result) => {
      console.log("🤖 Robot detection callback triggered:", result);
      if (result.hasRobot && result.modelName) {
        console.log("🤖 Robot detected:", result.modelName);
        setHasDroppedRobot(true);
      } else {
        console.log("❌ No robot detected");
        setHasDroppedRobot(false);
      }
    });

    return unsubscribe;
  }, [onRobotDetected]);

  // Main effect to create and setup the viewer only once
  useEffect(() => {
    if (!containerRef.current) return;

    const cleanupFunctions: (() => void)[] = [];

    // Register the URDF manipulator first, then setup the viewer
    registerURDFManipulator().then(() => {
      // Create and configure the URDF viewer element
      const viewer = createUrdfViewer(containerRef.current!, true);
      viewerRef.current = viewer; // Store reference to the viewer

      // Setup mesh loading function
      setupMeshLoader(viewer, urlModifierFunc);

      // Always start with the default T12 robot
      const urdfPath = "/urdf/T12/urdf/T12.URDF";

      // Setup model loading if a path is available
      if (urdfPath) {
        const cleanupModelLoading = setupModelLoading(
          viewer,
          urdfPath,
          packageRef.current,
          setCustomUrdfPath,
          alternativeRobotModels
        );
        cleanupFunctions.push(cleanupModelLoading);
      }

      // Setup joint highlighting
      const cleanupJointHighlighting = setupJointHighlighting(
        viewer,
        setHighlightedJoint
      );
      cleanupFunctions.push(cleanupJointHighlighting);

      // Setup animation event handler for the default model or when hasAnimation is true
      const onModelProcessed = () => {
        hasInitializedRef.current = true;
      };

      viewer.addEventListener("urdf-processed", onModelProcessed);
      cleanupFunctions.push(() => {
        viewer.removeEventListener("urdf-processed", onModelProcessed);
      });
    });

    // Return cleanup function
    return () => {
      hasInitializedRef.current = false;
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [urlModifierFunc, alternativeRobotModels]); // Removed hasDroppedRobot and customUrdfPath from dependencies

  // Effect to update the viewer when a new robot is dropped
  useEffect(() => {
    if (!viewerRef.current || !hasDroppedRobot || !customUrdfPath) return;

    console.log("🔄 Loading dropped robot:", customUrdfPath);

    // Update the viewer with the new URDF
    const loadPath =
      customUrdfPath.startsWith("blob:") && !customUrdfPath.includes("#.")
        ? customUrdfPath + "#.urdf"
        : customUrdfPath;

    console.log("🔄 Setting URDF path:", loadPath);

    // Clear the current robot by removing the urdf attribute first
    viewerRef.current.removeAttribute("urdf");

    // Small delay to ensure the attribute is cleared
    setTimeout(() => {
      if (viewerRef.current) {
        // Update the mesh loader first to ensure it's ready for the new URDF
        console.log("🔄 Updating mesh loader before loading URDF");
        setupMeshLoader(viewerRef.current, urlModifierFunc);

        // Add a one-time event listener to confirm the URDF is processed
        const onUrdfProcessed = () => {
          console.log("✅ URDF processed successfully:", loadPath);
          viewerRef.current?.removeEventListener(
            "urdf-processed",
            onUrdfProcessed
          );
        };

        viewerRef.current.addEventListener("urdf-processed", onUrdfProcessed);

        viewerRef.current.setAttribute("urdf", loadPath);
        viewerRef.current.setAttribute("package", packageRef.current);

        // Force a redraw
        if (viewerRef.current.redraw) {
          viewerRef.current.redraw();
        }

        console.log("🔄 URDF attributes set, redraw called");
      }
    }, 100);
  }, [customUrdfPath, hasDroppedRobot, urlModifierFunc]);

  // Effect to update mesh loader when URL modifier function changes
  useEffect(() => {
    if (!viewerRef.current) return;

    console.log("🔄 Updating mesh loader with new URL modifier function");

    // Create a debug wrapper for the URL modifier function
    const debugUrlModifier = urlModifierFunc
      ? (url: string) => {
          const result = urlModifierFunc(url);
          console.log(`🔗 URL modifier: ${url} -> ${result}`);
          return result;
        }
      : null;

    setupMeshLoader(viewerRef.current, debugUrlModifier);
  }, [urlModifierFunc]);

  // Separate effect to handle theme changes without recreating the viewer
  useEffect(() => {
    if (!viewerRef.current) return;

    // Theme changes are handled by the container style in createUrdfViewer
    // No need to update background here as it's already set during creation
  }, []);

  return (
    <div
      className={cn(
        "w-full h-full transition-all duration-300 ease-in-out relative"
      )}
    >
      <div ref={containerRef} className="w-full h-full absolute inset-0" />

      {/* Joint highlight indicator */}
      {highlightedJoint && (
        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded-md text-sm font-mono z-10">
          Joint: {highlightedJoint}
        </div>
      )}

      {/* Robot status indicator */}
      {hasDroppedRobot && (
        <div className="absolute top-4 left-4 bg-green-600/80 text-white px-3 py-2 rounded-md text-sm font-medium z-10">
          🤖 Custom Robot Loaded
        </div>
      )}
    </div>
  );
};

export default UrdfViewer;
