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
import * as THREE from "three";

// Dynamic import for URDFManipulator to avoid SSR issues
let URDFManipulator: typeof HTMLElement | null = null;

// Register the URDFManipulator as a custom element (idempotent and race-safe)
const registerURDFManipulator = async () => {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __urdfViewerRegistered?: boolean };
  if (customElements.get("urdf-viewer") || w.__urdfViewerRegistered) return;
  try {
    if (!URDFManipulator) {
      const urdfModule = await import(
        "urdf-loader/src/urdf-manipulator-element.js"
      );
      URDFManipulator = urdfModule.default;
    }
    customElements.define("urdf-viewer", URDFManipulator);
    w.__urdfViewerRegistered = true;
  } catch (error: unknown) {
    // Ignore re-definition errors caused by concurrent registration attempts
    const message = (error as Error)?.message || "";
    if (
      message.includes("has already been used") ||
      (error as any)?.name === "NotSupportedError"
    ) {
      w.__urdfViewerRegistered = true;
      return;
    }
    throw error;
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
    selectedRobot,
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

  // Mapping from robot names to their URDF paths
  const robotPathMap: Record<string, string> = {
    Cassie: "/urdf/cassie/cassie.urdf",
    "SO-100": "/urdf/so-100/so_100.urdf",
    "Anymal B": "/urdf/anymal-b/anymal.urdf",
  };

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
      if (result.hasRobot && result.modelName) {
        // Only set hasDroppedRobot to true if it's not a selected example robot
        if (!selectedRobot || result.modelName !== selectedRobot) {
          setHasDroppedRobot(true);
        }
      } else {
        setHasDroppedRobot(false);
      }
    });

    return unsubscribe;
  }, [onRobotDetected, selectedRobot]);

  // Main effect to create and setup the viewer only once
  useEffect(() => {
    if (!containerRef.current) return;

    const cleanupFunctions: (() => void)[] = [];

    // Register the URDF manipulator first, then setup the viewer
    registerURDFManipulator().then(() => {
      // Create and configure the URDF viewer element
      const viewer = createUrdfViewer(containerRef.current!);
      viewerRef.current = viewer; // Store reference to the viewer

      // Setup mesh loading function
      setupMeshLoader(viewer, urlModifierFunc);

      // Use selected robot or default to SO-100
      const defaultUrdfPath = "/urdf/so-100/so_100.urdf";
      const urdfPath =
        selectedRobot && robotPathMap[selectedRobot]
          ? robotPathMap[selectedRobot]
          : defaultUrdfPath;

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

        // Fit robot to view after it's loaded
        fitRobotToView(viewer);
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
  }, [urlModifierFunc, alternativeRobotModels, selectedRobot]); // Added selectedRobot to dependencies

  // Function to fit the robot to the camera view
  const fitRobotToView = (viewer: URDFViewerElement) => {
    if (!viewer || !viewer.robot) {
      return;
    }

    try {
      // Create a bounding box for the robot
      const boundingBox = new THREE.Box3().setFromObject(viewer.robot);

      // Calculate the center of the bounding box
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);

      // Calculate the size of the bounding box
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      // Get the maximum dimension to ensure the entire robot is visible
      const maxDim = Math.max(size.x, size.y, size.z);

      // Isometric position along (1,1,1)
      const isoDirection = new THREE.Vector3(1, 1, 1).normalize();
      const distance = maxDim * 1.8; // padding factor for URDF
      const position = center
        .clone()
        .add(isoDirection.multiplyScalar(distance));
      viewer.camera.position.copy(position);
      viewer.controls.target.copy(center);

      // Transparent background on canvas if supported
      try {
        // @ts-ignore - urdf-viewer exposes renderer on shadow DOM in some builds
        const r = (viewer as any).renderer as THREE.WebGLRenderer | undefined;
        if (r) {
          r.setClearColor(0x000000, 0);
          r.setClearAlpha(0);
          (r.getContext().canvas as HTMLCanvasElement).style.background =
            "transparent";
        }
      } catch {}

      // Update controls and mark for redraw
      viewer.controls.update();
      viewer.redraw();
    } catch (error) {
      console.error("[RobotViewer] Error fitting robot to view:", error);
    }
  };

  // Effect to handle robot selection changes
  useEffect(() => {
    if (!viewerRef.current || !selectedRobot || !robotPathMap[selectedRobot])
      return;

    const urdfPath = robotPathMap[selectedRobot];

    // Clear the current robot by removing the urdf attribute first
    viewerRef.current.removeAttribute("urdf");

    // Small delay to ensure the attribute is cleared
    setTimeout(() => {
      if (viewerRef.current) {
        // Update the mesh loader first to ensure it's ready for the new URDF
        setupMeshLoader(viewerRef.current, urlModifierFunc);

        // Add a one-time event listener to confirm the URDF is processed
        const onUrdfProcessed = () => {
          // Fit robot to view after it's loaded
          if (viewerRef.current) {
            fitRobotToView(viewerRef.current);
          }

          viewerRef.current?.removeEventListener(
            "urdf-processed",
            onUrdfProcessed
          );
        };

        viewerRef.current.addEventListener("urdf-processed", onUrdfProcessed);

        viewerRef.current.setAttribute("urdf", urdfPath);
        viewerRef.current.setAttribute("package", packageRef.current);

        // Force a redraw
        if (viewerRef.current.redraw) {
          viewerRef.current.redraw();
        }
      }
    }, 100);
  }, [selectedRobot, urlModifierFunc]);

  // Effect to update the viewer when a new robot is dropped
  useEffect(() => {
    if (!viewerRef.current || !hasDroppedRobot || !customUrdfPath) return;

    // Update the viewer with the new URDF
    const loadPath =
      customUrdfPath.startsWith("blob:") && !customUrdfPath.includes("#.")
        ? customUrdfPath + "#.urdf"
        : customUrdfPath;

    // Clear the current robot by removing the urdf attribute first
    viewerRef.current.removeAttribute("urdf");

    // Small delay to ensure the attribute is cleared
    setTimeout(() => {
      if (viewerRef.current) {
        // Update the mesh loader first to ensure it's ready for the new URDF
        setupMeshLoader(viewerRef.current, urlModifierFunc);

        // Add a one-time event listener to confirm the URDF is processed
        const onUrdfProcessed = () => {
          // Fit robot to view after it's loaded
          if (viewerRef.current) {
            fitRobotToView(viewerRef.current);
          }

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
      }
    }, 100);
  }, [customUrdfPath, hasDroppedRobot, urlModifierFunc]);

  // Effect to update mesh loader when URL modifier function changes
  useEffect(() => {
    if (!viewerRef.current) return;

    // Create a debug wrapper for the URL modifier function
    const debugUrlModifier = urlModifierFunc
      ? (url: string) => {
          const result = urlModifierFunc(url);
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
        "w-full h-full transition-all duration-300 ease-in-out relative rounder-xl"
      )}
    >
      <div ref={containerRef} className="w-full h-full absolute inset-0" />

      {/* Joint highlight indicator */}
      {highlightedJoint && (
        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-2 rounded-md text-sm font-mono z-10">
          Joint: {highlightedJoint}
        </div>
      )}
    </div>
  );
};

export default UrdfViewer;
