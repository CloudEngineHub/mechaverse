"use client";

import React, {
  createContext,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { useRobot } from "@/hooks/useRobot";
import { useExampleRobots } from "@/hooks/useExampleRobots";

import {
  subscribeRobotFilesUpload,
  consumeLastRobotFilesUpload,
} from "@/lib/robotFilesEvents";

type UsdSceneContextType = {
  registerIframeWindow: (win: Window | null) => void;
  clearScene: () => void;
  isLoading: boolean;
};

export const UsdSceneContext = createContext<UsdSceneContextType | undefined>(
  undefined
);

export const UsdSceneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeRobotType, activeRobotOwner, activeRobotName } = useRobot();
  const { examples } = useExampleRobots();

  const iframeWindowRef = useRef<Window | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pendingUnifiedRef = useRef<{
    files: Record<string, File>;
    primaryPath?: string;
  } | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const registerIframeWindow = useCallback((win: Window | null) => {
    iframeWindowRef.current = win ?? null;
    if (win && pendingUnifiedRef.current) {
      // Flush any pending unified USD files upload once iframe is ready
      (async () => {
        try {
          const { files, primaryPath } = pendingUnifiedRef.current as {
            files: Record<string, File>;
            primaryPath?: string;
          };
          const entries = await Promise.all(
            Object.entries(files).map(async ([path, file]) => ({
              path,
              buffer: await file.arrayBuffer(),
            }))
          );
          try {
            win.postMessage(
              { type: "USD_LOAD_ENTRIES", entries, primaryPath },
              "*"
            );
          } catch (e) {
            console.warn("[USD] postMessage failed (flush)", e);
          }
        } catch (e) {
          console.warn("[USD] Failed to flush pending USD files", e);
        } finally {
          pendingUnifiedRef.current = null;
        }
      })();
    }
    if (win && pendingUrlRef.current) {
      try {
        win.postMessage(
          { type: "USD_LOAD_URL", url: pendingUrlRef.current },
          "*"
        );
      } catch (e) {
        console.warn("[USD] postMessage failed (flush url)", e);
      } finally {
        pendingUrlRef.current = null;
      }
    }
  }, []);

  const post = useCallback((data: { type: string; [k: string]: unknown }) => {
    const target = iframeWindowRef.current;
    if (!target) return;
    try {
      target.postMessage(data, "*");
    } catch (e) {
      console.warn("[USD] postMessage failed", e);
    }
  }, []);

  const clearScene = useCallback(() => {
    post({ type: "USD_CLEAR" });
    setIsLoading(false);
  }, [post]);

  const onFilesMap = useCallback(
    async (files: Record<string, File>, primaryPath?: string) => {
      if (!iframeWindowRef.current) {
        // Defer sending until iframe reports ready
        pendingUnifiedRef.current = { files, primaryPath };
        return;
      }
      const entries = await Promise.all(
        Object.entries(files).map(async ([path, file]) => ({
          path,
          buffer: await file.arrayBuffer(),
        }))
      );
      post({ type: "USD_LOAD_ENTRIES", entries, primaryPath });
    },
    [post]
  );

  // Listen for loading state messages from the iframe
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeWindowRef.current) return;
      const data = event.data as unknown;
      const t =
        data &&
        typeof data === "object" &&
        "type" in (data as Record<string, unknown>)
          ? (data as { type?: string }).type
          : undefined;
      if (t === "USD_LOADING_START") setIsLoading(true);
      else if (t === "USD_LOADED") setIsLoading(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Handle unified robot files uploads (preferred path)
  useEffect(() => {
    const unsubscribe = subscribeRobotFilesUpload?.((payload) => {
      if (activeRobotType === "USD" && payload.primary?.type === "USD") {
        onFilesMap(payload.files, payload.primary.path);
      }
    });
    return unsubscribe ?? (() => {});
  }, [activeRobotType, onFilesMap]);

  // Consume any upload published before this provider mounted (race from other viewers)
  useEffect(() => {
    if (activeRobotType !== "USD") return;
    const pendingUpload = consumeLastRobotFilesUpload?.();
    if (pendingUpload && pendingUpload.primary?.type === "USD") {
      setIsLoading(true);
      onFilesMap(pendingUpload.files, pendingUpload.primary.path);
    }
  }, [activeRobotType, onFilesMap]);

  // React to ViewerControls selection for USD examples
  useEffect(() => {
    if (activeRobotType !== "USD") {
      clearScene();
      setIsLoading(false);
      return;
    }

    if (!activeRobotOwner || !activeRobotName) {
      clearScene();
      return;
    }

    const match = (examples ?? []).find(
      (ex) =>
        ex.fileType === "USD" &&
        ex.owner === activeRobotOwner &&
        ex.repo_name === activeRobotName &&
        !!ex.path
    );

    if (match?.path) {
      setIsLoading(true);
      const win = iframeWindowRef.current;
      if (!win) {
        // Queue the URL until the iframe posts ready
        pendingUrlRef.current = match.path;
      } else {
        try {
          win.postMessage({ type: "USD_LOAD_URL", url: match.path }, "*");
        } catch (e) {
          console.warn("[USD] postMessage failed (url)", e);
          pendingUrlRef.current = match.path;
        }
      }
    }
  }, [
    activeRobotType,
    activeRobotOwner,
    activeRobotName,
    examples,
    post,
    clearScene,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      iframeWindowRef.current = null;
    };
  }, []);

  return (
    <UsdSceneContext.Provider
      value={{
        registerIframeWindow,
        clearScene,
        isLoading,
      }}
    >
      {children}
    </UsdSceneContext.Provider>
  );
};
