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
import { useUrdfRuntime } from "@/contexts/UrdfRuntimeContext";
import { useMujocoIframe } from "@/contexts/MujocoIframeContext";

export type DragAndDropContextType = {
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
  onFilesProcessed?: () => void;
};

export const DragAndDropContext = createContext<
  DragAndDropContextType | undefined
>(undefined);

interface DragAndDropProviderProps {
  children: ReactNode;
  onFilesProcessed?: () => void;
  onSwitchToMjcf?: () => void;
}

export const DragAndDropProvider: React.FC<DragAndDropProviderProps> = ({
  children,
  onFilesProcessed,
  onSwitchToMjcf,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get contexts
  const { setActiveType, selectUploadedRobot } = useRobot();
  const { processDataTransfer } = useUrdfRuntime();
  const { loadXmlContent } = useMujocoIframe();

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set isDragging to false if we're leaving the container
    // This checks if the related target is outside our container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      // Drop event detected

      if (!e.dataTransfer) return;

      try {
        const files = Array.from(e.dataTransfer.files);
        const xmlFile = files.find((f) =>
          f.name.toLowerCase().endsWith(".xml")
        );
        const urdfExists = files.some((f) =>
          f.name.toLowerCase().endsWith(".urdf")
        );

        if (xmlFile) {
          const xml = await xmlFile.text();
          loadXmlContent(xmlFile.name, xml);
          setActiveType("MJCF");
          // Allow parent to switch UI to MJCF if currently in URDF view
          onSwitchToMjcf?.();
          onFilesProcessed?.();
          return;
        }

        if (urdfExists) {
          await processDataTransfer(e.dataTransfer);
          // Pick a best-effort name for the uploaded set
          const primary = files.find((f) =>
            f.name.toLowerCase().endsWith(".urdf")
          );
          const owner = (
            globalThis.crypto?.randomUUID
              ? globalThis.crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10)
          ) as string;
          const repo = (primary?.name || "uploaded-robot").replace(
            /\.[^/.]+$/,
            ""
          );
          selectUploadedRobot(owner, repo);
          setActiveType("URDF");
          onFilesProcessed?.();
          return;
        }

        // Fallback: try URDF pipeline if processor available
        {
          await processDataTransfer(e.dataTransfer);
          const primary = files.find((f) =>
            f.name.toLowerCase().endsWith(".urdf")
          );
          const owner = (
            globalThis.crypto?.randomUUID
              ? globalThis.crypto.randomUUID()
              : Math.random().toString(36).slice(2, 10)
          ) as string;
          const repo = (primary?.name || "uploaded-robot").replace(
            /\.[^/.]+$/,
            ""
          );
          selectUploadedRobot(owner, repo);
          setActiveType("URDF");
          onFilesProcessed?.();
        }
      } catch (error) {
        console.error("❌ Error in handleDrop:", error);
      }
    },
    [
      loadXmlContent,
      processDataTransfer,
      onFilesProcessed,
      onSwitchToMjcf,
      selectUploadedRobot,
      setActiveType,
    ]
  );

  // Set up event listeners on the container
  useEffect(() => {
    const container = containerRef.current;
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
  }, [handleDrop]); // Re-register when handleDrop changes

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex items-center justify-center"
    >
      <DragAndDropContext.Provider
        value={{
          isDragging,
          setIsDragging,
          handleDrop,
          onFilesProcessed,
        }}
      >
        {children}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-sm pointer-events-none z-50 flex items-center justify-center">
            <div className="bg-white p-8 rounded-xl shadow-lg text-center border-2 border-blue-500">
              <div className="text-3xl font-bold mb-4 text-blue-600">
                Drop Robot Files Here
              </div>
              <p className="text-gray-600">
                Release to upload your robot model
              </p>
            </div>
          </div>
        )}
      </DragAndDropContext.Provider>
    </div>
  );
};
