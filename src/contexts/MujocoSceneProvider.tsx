"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useRobot } from "@/hooks/useRobot";
import { useExampleRobots } from "@/hooks/useExampleRobots";
import { subscribeInlineXml, consumeLastInlineXml } from "@/lib/mujocoEvents";
import {
  subscribeRobotFilesUpload,
  consumeLastRobotFilesUpload,
} from "@/lib/robotFilesEvents";

type MujocoMessage =
  | { type: "LOAD_PUBLIC_SCENE"; path: string }
  | { type: "LOAD_XML_CONTENT"; fileName: string; content: string }
  | { type: "RESET_POSE" }
  | { type: "SET_TRANSPARENT_BACKGROUND" }
  | { type: "FIT_ISO" }
  | { type: "PAUSE_SIMULATION" }
  | { type: "RESUME_SIMULATION" }
  | {
      type: "SET_THEME";
      sceneBg?: string;
      floor?: string;
      ambient?: string;
      hemi?: string;
    };
// Extended messages handled by the iframe viewer implementation
type MujocoExtendedMessage =
  | MujocoMessage
  | {
      type: "LOAD_MJCF_FILES_MAP";
      entries: { path: string; buffer: ArrayBuffer }[];
    }
  | { type: "LOAD_MJCF_ROOT"; path: string };

type MujocoSceneContextType = {
  registerIframeWindow: (win: Window | null) => void;
  loadPublicScene: (path: string) => void;
  loadXmlContent: (fileName: string, content: string) => void;
  clearScene: () => void;
  resetPose: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
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
};

const MujocoSceneContext = createContext<MujocoSceneContextType | undefined>(
  undefined
);

export const MujocoSceneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeRobotType, activeRobotOwner, activeRobotName } = useRobot();
  const iframeWindowRef = useRef<Window | null>(null);
  const pendingSceneRef = useRef<string | null>(null);
  const pendingXmlRef = useRef<{ name: string; content: string } | null>(null);
  const [currentScenePath, setCurrentScenePath] = useState<string | null>(null);
  const { examples } = useExampleRobots();

  const post = useCallback((data: MujocoExtendedMessage) => {
    const target = iframeWindowRef.current;
    console.log("📤 Posting message:", data.type, {
      hasTarget: !!target,
      data,
    });
    if (!target) {
      console.warn("❌ No iframe window to post message to");
      return;
    }
    try {
      target.postMessage(data, "*");
      console.log("✅ Message posted successfully");
    } catch (e) {
      console.warn("❌ Failed to post message to iframe", e);
    }
  }, []);

  const registerIframeWindow = useCallback(
    (win: Window | null) => {
      console.log("🔄 Registering iframe window", {
        win: !!win,
        currentScenePath,
        pendingScene: pendingSceneRef.current,
        pendingXml: pendingXmlRef.current?.name,
      });
      iframeWindowRef.current = win ?? null;
      if (win) {
        if (pendingSceneRef.current) {
          console.log("📂 Loading pending scene:", pendingSceneRef.current);
          post({ type: "LOAD_PUBLIC_SCENE", path: pendingSceneRef.current });
          pendingSceneRef.current = null;
        }
        if (pendingXmlRef.current) {
          console.log("📄 Loading pending XML:", pendingXmlRef.current.name);
          post({
            type: "LOAD_XML_CONTENT",
            fileName: pendingXmlRef.current.name,
            content: pendingXmlRef.current.content,
          });
          pendingXmlRef.current = null;
        }
        // If we already have a current scene, re-post it for a fresh iframe
        if (currentScenePath) {
          console.log("🔄 Reloading current scene:", currentScenePath);
          post({ type: "LOAD_PUBLIC_SCENE", path: currentScenePath });
        } else {
          console.log("⚠️ No current scene to reload");
        }
      }
    },
    [post, currentScenePath]
  );

  const loadPublicScene = useCallback(
    (path: string) => {
      console.log("📂 Loading public scene:", path, {
        hasIframeWindow: !!iframeWindowRef.current,
      });
      if (!iframeWindowRef.current) {
        console.log("🔄 No iframe window, setting as pending");
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

  const pauseSimulation = useCallback(() => {
    post({ type: "PAUSE_SIMULATION" });
  }, [post]);

  const resumeSimulation = useCallback(() => {
    post({ type: "RESUME_SIMULATION" });
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

  // examples are provided by context

  // Handle inline XML uploads published via event bus
  useEffect(() => {
    const pending = consumeLastInlineXml();
    if (pending && activeRobotType === "MJCF") {
      loadXmlContent(pending.name, pending.content);
    }
    const unsubscribe = subscribeInlineXml(({ name, content }) => {
      if (activeRobotType === "MJCF") {
        loadXmlContent(name, content);
      }
    });
    return unsubscribe;
  }, [activeRobotType, loadXmlContent]);

  // Handle unified robot files for MJCF (send all files to iframe FS and load root)
  useEffect(() => {
    const maybeProcess = async (
      filesMap: Record<string, File>,
      xmlPath: string
    ) => {
      try {
        // Convert to transferable payload: [{ path, buffer }]
        const entries = await Promise.all(
          Object.entries(filesMap).map(async ([path, file]) => ({
            path,
            buffer: await file.arrayBuffer(),
          }))
        );
        // Write all files into the iframe FS
        post({ type: "LOAD_MJCF_FILES_MAP", entries });
        // Then ask it to load the XML root
        post({ type: "LOAD_MJCF_ROOT", path: xmlPath.replace(/^\/+/, "") });
      } catch (e) {
        console.warn(
          "[MujocoSceneProvider] Failed to process MJCF files map",
          e
        );
      }
    };
    const pending = consumeLastRobotFilesUpload?.();
    if (
      pending &&
      activeRobotType === "MJCF" &&
      pending.primary?.type === "MJCF"
    ) {
      maybeProcess(pending.files, pending.primary.path);
    }
    const unsubscribe = subscribeRobotFilesUpload?.((payload) => {
      if (activeRobotType === "MJCF" && payload.primary?.type === "MJCF") {
        maybeProcess(payload.files, payload.primary.path);
      }
    });
    return unsubscribe ?? (() => {});
  }, [activeRobotType, loadXmlContent]);

  // Resolve current MJCF example selection and load scene
  const selectedExample = useMemo(() => {
    console.log("🔍 Checking selected example:", {
      hasExamples: !!examples,
      activeRobotType,
      activeRobotOwner,
      activeRobotName,
    });
    if (!examples || activeRobotType !== "MJCF") {
      console.log("❌ No examples or robot type is not MJCF");
      return null;
    }
    const found = examples.find(
      (e) => e.owner === activeRobotOwner && e.repo_name === activeRobotName
    );
    console.log("🔍 Selected example:", found);
    return found;
  }, [examples, activeRobotType, activeRobotOwner, activeRobotName]);

  useEffect(() => {
    console.log("🔄 Selected example effect:", selectedExample);
    if (!selectedExample || !selectedExample.path) {
      console.log("❌ No selected example or path");
      return;
    }
    const rel = selectedExample.path.replace("/mjcf/", "");
    console.log("📂 Loading scene from selected example:", rel);
    loadPublicScene(rel);
  }, [selectedExample, loadPublicScene]);

  return (
    <MujocoSceneContext.Provider
      value={{
        registerIframeWindow,
        loadPublicScene,
        loadXmlContent,
        clearScene,
        resetPose,
        pauseSimulation,
        resumeSimulation,
        setTransparentBackground,
        fitIsometric,
        setTheme,
      }}
    >
      {children}
    </MujocoSceneContext.Provider>
  );
};

export function useMujocoScene() {
  const ctx = useContext(MujocoSceneContext);
  if (!ctx)
    throw new Error("useMujocoScene must be used within MujocoSceneProvider");
  return ctx;
}
