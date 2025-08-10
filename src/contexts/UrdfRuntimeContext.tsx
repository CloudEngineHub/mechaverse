"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  UrdfProcessor,
  processDroppedFiles,
  processSelectedFiles,
} from "@/lib/robotUploadSupport";

type UrdfRuntimeContextType = {
  registerUrdfProcessor: (processor: UrdfProcessor) => void;
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

  // Localize drag-and-drop inputs via a small event bus so we don't need
  // this provider at the page level.
  useEffect(() => {
    let mounted = true;
    import("@/lib/urdfEvents").then(
      ({
        subscribeUrdfDataTransfer,
        subscribeUrdfFileList,
        consumeLastUrdfDataTransfer,
        consumeLastUrdfFileList,
      }) => {
        if (!mounted) return;

        // Consume any pending payloads before subscription
        const pendingDT = consumeLastUrdfDataTransfer();
        if (pendingDT) {
          loadFirstModel((p) => processDroppedFiles(pendingDT, p));
        }
        const pendingFL = consumeLastUrdfFileList();
        if (pendingFL) {
          loadFirstModel((p) => processSelectedFiles(pendingFL, p));
        }

        const unsubDT = subscribeUrdfDataTransfer((dt) => {
          loadFirstModel((p) => processDroppedFiles(dt, p));
        });
        const unsubFL = subscribeUrdfFileList((fl) => {
          loadFirstModel((p) => processSelectedFiles(fl, p));
        });

        return () => {
          unsubDT();
          unsubFL();
        };
      }
    );

    return () => {
      mounted = false;
    };
  }, [loadFirstModel]);

  return (
    <UrdfRuntimeContext.Provider value={{ registerUrdfProcessor }}>
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
