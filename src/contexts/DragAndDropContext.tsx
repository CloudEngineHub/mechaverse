"use client";
import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";

import { useRobot } from "@/hooks/useRobot";
import { dataTransferToFiles } from "@/lib/robotUploadSupport";
import { publishRobotFilesUpload } from "@/lib/robotFilesEvents";

export type DragAndDropContextType = {
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
  onComplete?: () => void;
};

export const DragAndDropContext = createContext<
  DragAndDropContextType | undefined
>(undefined);
interface DragAndDropProviderProps {
  children: ReactNode;
  onComplete?: () => void;
}

export const DragAndDropProvider: React.FC<DragAndDropProviderProps> = ({
  children,
  onComplete = () => {},
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const { setActiveRobotType, setActiveRobotOwner, setActiveRobotName } =
    useRobot();

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const containerEl = internalContainerRef.current;
    if (containerEl && !containerEl.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      // If no data transfer, return
      if (!e.dataTransfer) return;

      try {
        // Collect all dropped files including folders (DirectoryEntry API)
        const filesFromDtMap = await dataTransferToFiles(e.dataTransfer);
        const files = Object.values(filesFromDtMap);

        // Detect primary files for each supported type (URDF, USD, MJCF)
        const detectRobotFiles = async (
          inputFiles: File[]
        ): Promise<{
          urdfFile?: File;
          usdFile?: File;
          mjcfFile?: File;
        }> => {
          let urdfFile: File | undefined;
          let usdFile: File | undefined;
          let mjcfFile: File | undefined;

          for (const file of inputFiles) {
            const lower = file.name.toLowerCase();
            if (!urdfFile && lower.endsWith(".urdf")) {
              urdfFile = file;
              continue;
            }
            if (!usdFile) {
              const ext = lower.split(".").pop();
              if (ext && ["usd", "usdz", "usda", "usdc"].includes(ext)) {
                usdFile = file;
                continue;
              }
            }
            // We want to prioritize scene files (with <include ...>) over robot.xml/cassie.xml if present.
            if (lower.endsWith(".xml")) {
              try {
                const text = await file.text();
                if (/<\s*mujoco[\s>]/i.test(text)) {
                  // If this file includes another file, it's likely a scene file and should be prioritized.
                  const hasInclude =
                    /<\s*include\s+file\s*=\s*["'][^"']+["']\s*\/?>/i.test(
                      text
                    );
                  if (hasInclude) {
                    // Always prefer a scene file if found
                    mjcfFile = file;
                  } else if (!mjcfFile) {
                    // Only set if we haven't found a scene file yet
                    mjcfFile = file;
                  }
                }
              } catch {
                // Ignore read errors and continue
              }
            }
          }
          return { urdfFile, usdFile, mjcfFile };
        };

        const { urdfFile, usdFile, mjcfFile } = await detectRobotFiles(files);

        /*
         * We display in the following order of preference if multiple file types are dropped
         * 1. MJCF
         * 2. USD
         * 3. URDF
         */

        if (mjcfFile) {
          // Handle MJCF files by switching to MJCF viewer and publishing to event bus
          console.log("Mujoco file detected");
          setActiveRobotType("MJCF");
          const owner = (
            globalThis.crypto?.randomUUID
              ? globalThis.crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10)
          ) as string;
          const name = (mjcfFile.name || "uploaded-mjcf").replace(
            /\.[^/.]+$/,
            ""
          );
          setActiveRobotOwner(owner);
          setActiveRobotName(name);

          // Unified: publish full files map with primary MJCF path
          publishRobotFilesUpload({
            owner,
            name,
            files: filesFromDtMap,
            primary: { type: "MJCF", path: "/" + mjcfFile.name },
          });

          onComplete();
          return;
        } else if (usdFile) {
          // Handle USD files by switching to USD viewer and publishing to event bus
          console.log("USD file detected");
          setActiveRobotType("USD");
          // Generate a unique identifier for this uploaded USD
          const owner = (
            globalThis.crypto?.randomUUID
              ? globalThis.crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10)
          ) as string;
          const repo = (usdFile?.name || "uploaded-usd").replace(
            /\.[^/.]+$/,
            ""
          );
          setActiveRobotOwner(owner);
          setActiveRobotName(repo);

          // Unified: publish full files map with primary USD path
          publishRobotFilesUpload({
            owner,
            name: repo,
            files: filesFromDtMap,
            primary: { type: "USD", path: "/" + usdFile.name },
          });

          onComplete();
          return;
        } else if (urdfFile) {
          // Handle URDF files by switching to URDF viewer and publishing to event bus
          console.log("URDF file detected");
          setActiveRobotType("URDF");
          const owner = (
            globalThis.crypto?.randomUUID
              ? globalThis.crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10)
          ) as string;
          const repo = (urdfFile?.name || "uploaded-urdf").replace(
            /\.[^/.]+$/,
            ""
          );
          setActiveRobotOwner(owner);
          setActiveRobotName(repo);

          // Unified: publish full files map with primary URDF path
          publishRobotFilesUpload({
            owner,
            name: repo,
            files: filesFromDtMap,
            primary: { type: "URDF", path: "/" + urdfFile.name },
          });

          onComplete();
          return;
        }

        // If no primary file is detected
        onComplete();
        console.warn("You dropped invalid file types.");
      } catch (error) {
        console.error("❌ Error in handleDrop:", error);
      }
    },
    [onComplete, setActiveRobotType, setActiveRobotOwner, setActiveRobotName]
  );

  // Set up event listeners on the container
  useEffect(() => {
    const container = internalContainerRef.current;
    if (!container) return;

    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("drop", handleDrop);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("drop", handleDrop);
    };
  }, [handleDrop, handleDragOver, handleDragEnter, handleDragLeave]); // Re-register when handlers change

  const provider = (
    <DragAndDropContext.Provider
      value={{
        isDragging,
        setIsDragging,
        handleDrop,
        onComplete,
      }}
    >
      {children}
    </DragAndDropContext.Provider>
  );

  // Otherwise, render a container that acts as the drop target
  return (
    <div
      ref={internalContainerRef}
      className="h-full w-full flex items-center justify-center"
    >
      {provider}
    </div>
  );
};
