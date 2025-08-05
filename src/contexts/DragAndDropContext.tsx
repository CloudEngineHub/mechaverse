"use client";
import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";

import { processDroppedFiles } from "@/lib/robotUploadSupport";
import { useRobot } from "@/hooks/useRobot";

export type DragAndDropContextType = {
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
};

export const DragAndDropContext = createContext<
  DragAndDropContextType | undefined
>(undefined);

interface DragAndDropProviderProps {
  children: ReactNode;
}

export const DragAndDropProvider: React.FC<DragAndDropProviderProps> = ({
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get the URDF context
  const { urdfProcessor, processRobotFiles } = useRobot();

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

      console.log("🔄 DragAndDropContext: Drop event detected");

      if (!e.dataTransfer || !urdfProcessor) {
        console.error("❌ No dataTransfer or urdfProcessor available");
        return;
      }

      try {
        console.log("🔍 Processing dropped files with urdfProcessor");

        // Process files first
        const { availableModels, files } = await processDroppedFiles(
          e.dataTransfer,
          urdfProcessor
        );

        // Delegate further processing to UrdfContext
        await processRobotFiles(files, availableModels);
      } catch (error) {
        console.error("❌ Error in handleDrop:", error);
      }
    },
    [urdfProcessor, processRobotFiles]
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
        }}
      >
        {children}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 pointer-events-none z-50 flex items-center justify-center">
            <div className="bg-background p-8 rounded-lg shadow-lg text-center">
              <div className="text-3xl font-bold mb-4">
                Drop URDF Files Here
              </div>
              <p className="text-muted-foreground">
                Release to upload your robot model
              </p>
            </div>
          </div>
        )}
      </DragAndDropContext.Provider>
    </div>
  );
};
