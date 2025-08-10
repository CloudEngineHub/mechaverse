"use client";

import React, { createContext, useCallback, useContext, useRef } from "react";
import {
  UrdfProcessor,
  processDroppedFiles,
  processSelectedFiles,
} from "@/lib/robotUploadSupport";

type UrdfRuntimeContextType = {
  registerUrdfProcessor: (processor: UrdfProcessor) => void;
  processDataTransfer: (dataTransfer: DataTransfer) => Promise<void>;
  processFileList: (fileList: FileList) => Promise<void>;
};

const UrdfRuntimeContext = createContext<UrdfRuntimeContextType | undefined>(
  undefined
);

export const UrdfRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const processorRef = useRef<UrdfProcessor | null>(null);

  const registerUrdfProcessor = useCallback((processor: UrdfProcessor) => {
    processorRef.current = processor;
  }, []);

  const loadFirstModel = useCallback(
    async (
      run: (processor: UrdfProcessor) => Promise<{
        files: Record<string, File>;
        availableModels: string[];
        blobUrls: Record<string, string>;
      }>
    ) => {
      const processor = processorRef.current;
      if (!processor) {
        console.warn("[UrdfRuntime] No URDF processor registered yet");
        return;
      }
      const { availableModels, blobUrls } = await run(processor);
      if (availableModels.length === 0) return;
      const first = availableModels[0];
      const blobUrl = blobUrls[first];
      if (blobUrl) {
        processor.loadUrdf(blobUrl);
      }
    },
    []
  );

  const processDataTransfer = useCallback(
    async (dataTransfer: DataTransfer) => {
      await loadFirstModel((p) => processDroppedFiles(dataTransfer, p));
    },
    [loadFirstModel]
  );

  const processFileList = useCallback(
    async (fileList: FileList) => {
      await loadFirstModel((p) => processSelectedFiles(fileList, p));
    },
    [loadFirstModel]
  );

  return (
    <UrdfRuntimeContext.Provider
      value={{ registerUrdfProcessor, processDataTransfer, processFileList }}
    >
      {children}
    </UrdfRuntimeContext.Provider>
  );
};

export function useUrdfRuntime(): UrdfRuntimeContextType {
  const ctx = useContext(UrdfRuntimeContext);
  if (!ctx)
    throw new Error("useUrdfRuntime must be used within UrdfRuntimeProvider");
  return ctx;
}
