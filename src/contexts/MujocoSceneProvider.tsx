"use client";

import React, {
  createContext,
  useCallback,
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
import { MujocoMessage } from "@/types/mujoco";

type MujocoSceneContextType = {
  registerIframeWindow: (win: Window | null) => void;
  loadPublicScene: (path: string) => void;
  loadXmlContent: (fileName: string, content: string) => void;
  clearScene: () => void;
  resetPose: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
};

export const MujocoSceneContext = createContext<
  MujocoSceneContextType | undefined
>(undefined);

export const MujocoSceneProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { activeRobotType, activeRobotOwner, activeRobotName } = useRobot();
  const iframeWindowRef = useRef<Window | null>(null);
  const pendingSceneRef = useRef<string | null>(null);
  const pendingXmlRef = useRef<{ name: string; content: string } | null>(null);
  const [currentScenePath, setCurrentScenePath] = useState<string | null>(null);
  const currentScenePathRef = useRef<string | null>(null);
  const { examples } = useExampleRobots();

  const post = useCallback((data: MujocoMessage) => {
    const target = iframeWindowRef.current;
    if (!target) {
      console.warn("❌ No iframe window to post message to");
      return;
    }
    try {
      target.postMessage(data, "*");
    } catch (e) {
      console.warn("❌ Failed to post message to iframe", e);
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
        // If we already have a current scene, re-post it for a fresh iframe (e.g., when switching viewer/simulator)
        if (currentScenePathRef.current) {
          post({
            type: "LOAD_PUBLIC_SCENE",
            path: currentScenePathRef.current,
          });
        }
      }
    },
    [post]
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

  // Keep a stable ref of the current scene
  useEffect(() => {
    currentScenePathRef.current = currentScenePath;
  }, [currentScenePath]);

  // Theme control removed; defaults are used in the iframe

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
  }, [activeRobotType, loadXmlContent, post]);

  // Resolve current MJCF example selection and load scene
  const selectedExample = useMemo(() => {
    if (!examples || activeRobotType !== "MJCF") {
      console.warn("❌ No examples or robot type is not MJCF");
      return null;
    }
    const found = examples.find(
      (e) => e.owner === activeRobotOwner && e.repo_name === activeRobotName
    );
    return found;
  }, [examples, activeRobotType, activeRobotOwner, activeRobotName]);

  useEffect(() => {
    if (!selectedExample || !selectedExample.path) {
      console.warn("❌ No selected example or path");
      return;
    }
    const rel = selectedExample.path.replace("/mjcf/", "");
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
        // no theme setter exposed
      }}
    >
      {children}
    </MujocoSceneContext.Provider>
  );
};
