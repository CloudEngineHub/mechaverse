"use client";

import React, { createContext, useCallback, useEffect, useRef } from "react";
import { UrdfProcessor, processFilesRecord } from "@/lib/robotUploadSupport";
import {
  subscribeRobotFilesUpload,
  consumeLastRobotFilesUpload,
} from "@/lib/robotFilesEvents";

export type UrdfRuntimeContextType = {
  registerUrdfProcessor: (processor: UrdfProcessor) => void;
};

export const UrdfRuntimeContext = createContext<
  UrdfRuntimeContextType | undefined
>(undefined);

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

  // Handle unified robot files uploads
  useEffect(() => {
    let mounted = true;

    // Consume any pending payloads before subscription
    const pending = consumeLastRobotFilesUpload?.();
    if (pending && pending.primary?.type === "URDF") {
      loadFirstModel((p) => processFilesRecord(pending.files, p));
    }

    const unsubscribe = subscribeRobotFilesUpload?.((payload) => {
      if (!mounted) return;
      if (payload.primary?.type === "URDF") {
        loadFirstModel((p) => processFilesRecord(payload.files, p));
      }
    });

    return () => {
      mounted = false;
      unsubscribe && unsubscribe();
    };
  }, [loadFirstModel]);

  return (
    <UrdfRuntimeContext.Provider value={{ registerUrdfProcessor }}>
      {children}
    </UrdfRuntimeContext.Provider>
  );
};
