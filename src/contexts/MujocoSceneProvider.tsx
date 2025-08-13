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
  loadExampleScene: (path: string) => void;
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
  const pendingSceneRef = useRef<null | {
    xml?: { fileName: string; content: string };
    files?: { path: string; buffer: ArrayBuffer }[];
    root?: string;
  }>(null);
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

  const loadExampleScene = useCallback(
    (path: string) => {
      // Fetch the example XML and its dependencies on the parent side
      const run = async () => {
        try {
          const rel = path.replace(/^\/+/, "");
          const base = "/mjcf/";
          // Fetch root XML text
          const xmlRes = await fetch(base + rel, { cache: "no-store" });
          if (!xmlRes.ok) throw new Error(`Failed to fetch ${base + rel}`);
          const xmlText = await xmlRes.text();

          // Collect includes and assets recursively by parsing; reuse a DOMParser here
          const files: { path: string; buffer: ArrayBuffer }[] = [];
          const seen = new Set<string>();
          const parser = new DOMParser();

          async function fetchText(url: string) {
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) throw new Error(`Failed to fetch ${url}`);
            return r.text();
          }
          async function fetchBin(url: string) {
            const r = await fetch(url, { cache: "no-store" });
            if (!r.ok) throw new Error(`Failed to fetch ${url}`);
            return r.arrayBuffer();
          }

          const binaryExts = [
            ".png",
            ".jpg",
            ".jpeg",
            ".bmp",
            ".gif",
            ".tga",
            ".dds",
            ".ktx",
            ".ktx2",
            ".hdr",
            ".exr",
            ".obj",
            ".stl",
            ".ply",
            ".glb",
            ".gltf",
            ".skn",
            ".bin",
          ];

          function joinRelative(currentRelPath: string, relative: string) {
            if (
              relative.startsWith("/") ||
              relative.startsWith("./") ||
              relative.startsWith("../")
            ) {
              const baseParts = currentRelPath.split("/");
              baseParts.pop();
              const relParts = relative.split("/");
              const stack = baseParts;
              for (const part of relParts) {
                if (part === "." || part === "") continue;
                if (part === "..") stack.pop();
                else stack.push(part);
              }
              return stack.join("/");
            }
            const baseParts = currentRelPath.split("/");
            baseParts.pop();
            return [...baseParts, relative].join("/");
          }

          async function collect(relXmlPath: string, xmlTextIn?: string) {
            if (seen.has(relXmlPath)) return;
            seen.add(relXmlPath);
            const url = base + relXmlPath;
            const text = xmlTextIn ?? (await fetchText(url));
            // push the XML file
            const xmlBuf = new TextEncoder().encode(text).buffer as ArrayBuffer;
            files.push({ path: relXmlPath, buffer: xmlBuf });

            const doc = parser.parseFromString(text, "application/xml");
            const compilerEl = doc.querySelector("compiler");
            const meshdir = compilerEl?.getAttribute("meshdir") || "assets";
            const texturedir =
              compilerEl?.getAttribute("texturedir") || meshdir;
            const skindir = compilerEl?.getAttribute("skindir") || meshdir;
            const hfielddir =
              compilerEl?.getAttribute("hfielddir") || texturedir;
            const dirForTag = (tag: string) =>
              tag === "mesh"
                ? meshdir
                : tag === "texture"
                ? texturedir
                : tag === "skin"
                ? skindir
                : hfielddir;

            // includes
            const includes = Array.from(doc.querySelectorAll("include[file]"));
            for (const inc of includes) {
              const f = inc.getAttribute("file");
              if (!f) continue;
              const childRel = joinRelative(relXmlPath, f);
              await collect(childRel);
            }

            // assets
            const sels = [
              "mesh[file]",
              "texture[file]",
              "hfield[file]",
              "skin[file]",
            ];
            for (const sel of sels) {
              const nodes = Array.from(doc.querySelectorAll(sel));
              for (const n of nodes) {
                const f = n.getAttribute("file");
                if (!f) continue;
                const tag = n.tagName.toLowerCase();
                const baseDir = dirForTag(tag);
                const combined = baseDir ? `${baseDir}/${f}` : f;
                const assetRel = joinRelative(relXmlPath, combined);
                if (seen.has(assetRel)) continue;
                seen.add(assetRel);
                const isBin = binaryExts.some((ext) =>
                  assetRel.toLowerCase().endsWith(ext)
                );
                const buf = isBin
                  ? ((await fetchBin(base + assetRel)) as ArrayBuffer)
                  : (new TextEncoder().encode(await fetchText(base + assetRel))
                      .buffer as ArrayBuffer);
                files.push({ path: assetRel, buffer: buf });
              }
            }
          }

          await collect(rel, xmlText);

          const payload = { files, root: rel } as const;

          if (!iframeWindowRef.current) {
            pendingSceneRef.current = payload;
          }
          post({ type: "LOAD_SCENE", ...payload });
          setCurrentScenePath(rel);
        } catch (e) {
          console.warn("❌ Failed to load example scene content", e);
        }
      };

      run();
    },
    [post]
  );

  const registerIframeWindow = useCallback(
    (win: Window | null) => {
      iframeWindowRef.current = win ?? null;
      if (win) {
        if (pendingSceneRef.current) {
          post({ type: "LOAD_SCENE", ...pendingSceneRef.current });
          pendingSceneRef.current = null;
        }
        if (pendingXmlRef.current) {
          post({
            type: "LOAD_SCENE",
            xml: {
              fileName: pendingXmlRef.current.name,
              content: pendingXmlRef.current.content,
            },
          });
          pendingXmlRef.current = null;
        }
        // If we already have a current scene, re-post it by re-fetching and staging
        if (currentScenePathRef.current) {
          // Re-fetch and stage the last example scene
          (async () => {
            try {
              await new Promise((r) => setTimeout(r, 0));
              loadExampleScene(currentScenePathRef.current as string);
            } catch {}
          })();
        }
      }
    },
    [post, loadExampleScene]
  );

  const loadXmlContent = useCallback(
    (fileName: string, content: string) => {
      if (!iframeWindowRef.current) {
        pendingXmlRef.current = { name: fileName, content };
      }
      post({ type: "LOAD_SCENE", xml: { fileName, content } });
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
        // Handle XML files as text, others as binary
        const entries = await Promise.all(
          Object.entries(filesMap).map(async ([path, file]) => {
            const isXml = path.toLowerCase().endsWith(".xml");
            const buffer = isXml
              ? (new TextEncoder().encode(await file.text())
                  .buffer as ArrayBuffer)
              : ((await file.arrayBuffer()) as ArrayBuffer);
            return { path, buffer };
          })
        );
        // Unified upload and load
        post({
          type: "LOAD_SCENE",
          files: entries,
          root: xmlPath.replace(/^\/+/, ""),
        });
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
    // Only load example scenes if we have examples loaded and we're dealing with an example robot
    // Skip if this is an uploaded robot (owner/name are UUIDs or non-example values)
    if (!examples || activeRobotType !== "MJCF") {
      return;
    }

    // Check if this is actually an example robot (from our examples list)
    const isExampleRobot = examples.some(
      (e) =>
        e.owner === activeRobotOwner &&
        e.repo_name === activeRobotName &&
        e.fileType === "MJCF"
    );

    if (!isExampleRobot) {
      // This is an uploaded robot, not an example - skip example loading
      return;
    }

    if (!selectedExample || !selectedExample.path) {
      console.warn("❌ No selected example or path");
      return;
    }
    const rel = selectedExample.path.replace("/mjcf/", "");
    loadExampleScene(rel);
  }, [
    selectedExample,
    loadExampleScene,
    examples,
    activeRobotType,
    activeRobotOwner,
    activeRobotName,
  ]);

  return (
    <MujocoSceneContext.Provider
      value={{
        registerIframeWindow,
        loadExampleScene,
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
