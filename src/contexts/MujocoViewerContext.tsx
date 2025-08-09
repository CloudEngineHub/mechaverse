"use client";

import React, { createContext, useCallback, useContext, useRef } from "react";

type MujocoMessage =
  | { type: "LOAD_PUBLIC_SCENE"; path: string }
  | { type: "LOAD_XML_CONTENT"; fileName: string; content: string }
  | { type: "RESET_POSE" }
  | { type: "SET_TRANSPARENT_BACKGROUND" }
  | { type: "FIT_ISO" }
  | {
      type: "SET_THEME";
      sceneBg?: string;
      floor?: string;
      ambient?: string;
      hemi?: string;
    };

type MujocoViewerContextType = {
  registerIframeWindow: (win: Window | null) => void;
  loadPublicScene: (path: string) => void;
  loadXmlContent: (fileName: string, content: string) => void;
  clearScene: () => void;
  resetPose: () => void;
  setTransparentBackground: () => void;
  fitIsometric: () => void;
  setTheme: (
    theme: Partial<{
      sceneBg: string;
      floor: string;
      ambient: string;
      hemi: string;
    }>
  ) => void;
  currentScenePath?: string | null;
};

const MujocoViewerContext = createContext<MujocoViewerContextType | undefined>(
  undefined
);

export const MujocoViewerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const iframeWindowRef = useRef<Window | null>(null);
  const pendingSceneRef = useRef<string | null>(null);
  const pendingXmlRef = useRef<{ name: string; content: string } | null>(null);
  const [currentScenePath, setCurrentScenePath] = React.useState<string | null>(
    null
  );

  const post = useCallback((data: MujocoMessage) => {
    const target = iframeWindowRef.current;
    if (!target) return;
    try {
      target.postMessage(data, "*");
    } catch (e) {
      console.warn("Failed to post message to iframe", e);
    }
  }, []);

  const registerIframeWindow = useCallback(
    (win: Window | null) => {
      iframeWindowRef.current = win ?? null;
      if (win) {
        if (pendingSceneRef.current) {
          post({ type: "LOAD_PUBLIC_SCENE", path: pendingSceneRef.current });
          pendingSceneRef.current = null;
        }
        if (pendingXmlRef.current) {
          post({
            type: "LOAD_XML_CONTENT",
            fileName: pendingXmlRef.current.name,
            content: pendingXmlRef.current.content,
          });
          pendingXmlRef.current = null;
        }
        // If we already have a current scene, re-post it for a fresh iframe
        if (currentScenePath) {
          post({ type: "LOAD_PUBLIC_SCENE", path: currentScenePath });
        }
      }
    },
    [post, currentScenePath]
  );

  const loadPublicScene = useCallback(
    (path: string) => {
      if (!iframeWindowRef.current) {
        pendingSceneRef.current = path;
      }
      post({ type: "LOAD_PUBLIC_SCENE", path });
      setCurrentScenePath(path);
    },
    [post]
  );

  const loadXmlContent = useCallback(
    (fileName: string, content: string) => {
      if (!iframeWindowRef.current) {
        pendingXmlRef.current = { name: fileName, content };
      }
      post({ type: "LOAD_XML_CONTENT", fileName, content });
      setCurrentScenePath(fileName);
    },
    [post]
  );

  const clearScene = useCallback(() => {
    setCurrentScenePath(null);
    // Optionally notify iframe to clear scene if it supports it in the future
    // post({ type: "CLEAR_SCENE" });
  }, []);

  const resetPose = useCallback(() => {
    post({ type: "RESET_POSE" });
  }, [post]);

  const setTransparentBackground = useCallback(() => {
    post({ type: "SET_TRANSPARENT_BACKGROUND" });
  }, [post]);

  const fitIsometric = useCallback(() => {
    post({ type: "FIT_ISO" });
  }, [post]);

  const setTheme = useCallback(
    (
      theme: Partial<{
        sceneBg: string;
        floor: string;
        ambient: string;
        hemi: string;
      }>
    ) => {
      post({ type: "SET_THEME", ...theme });
    },
    [post]
  );

  return (
    <MujocoViewerContext.Provider
      value={{
        registerIframeWindow,
        loadPublicScene,
        loadXmlContent,
        clearScene,
        resetPose,
        setTransparentBackground,
        fitIsometric,
        setTheme,
        currentScenePath,
      }}
    >
      {children}
    </MujocoViewerContext.Provider>
  );
};

export function useMujocoViewer() {
  const ctx = useContext(MujocoViewerContext);
  if (!ctx)
    throw new Error("useMujocoViewer must be used within MujocoViewerProvider");
  return ctx;
}
