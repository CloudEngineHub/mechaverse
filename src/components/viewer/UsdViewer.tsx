"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRobot } from "@/hooks/useRobot";
import { useExampleRobots } from "@/hooks/useExampleRobots";
import {
  subscribeUsdDataTransfer,
  consumeLastUsdDataTransfer,
} from "@/lib/usdEvents";
import {
  subscribeRobotFilesUpload,
  consumeLastRobotFilesUpload,
} from "@/lib/robotFilesEvents";

type UsdViewerHandle = {
  loadFromURL?: (url: string) => Promise<void> | void;
  loadFromDataTransfer?: (dataTransfer: DataTransfer) => Promise<void> | void;
  loadFromFiles?: (files: FileList | File[]) => Promise<void> | void;
  clear?: () => void;
  dispose?: () => void;
};

type UsdInitOptions = {
  container: HTMLDivElement;
  hdrPath: string;
  hostManagedDnd: boolean;
  onStatus: (message: string) => void;
};

declare global {
  interface Window {
    __usdInit?: (opts: UsdInitOptions) => Promise<UsdViewerHandle>;
  }
}

export default function UsdViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<UsdViewerHandle | null>(null);
  const pendingUnifiedRef = useRef<{
    files: Record<string, File>;
    primaryPath?: string;
  } | null>(null);
  const [status, setStatus] = useState(
    "Waiting for initialization to start..."
  );
  // isDragging is now provided by context; local state only for status
  const { examples } = useExampleRobots();
  const { activeRobotType, activeRobotOwner, activeRobotName } = useRobot();

  useEffect(() => {
    let active = true;
    const initFromWindow = async () => {
      try {
        if (!window.__usdInit || !containerRef.current) return;
        const handle = await window.__usdInit({
          container: containerRef.current,
          hdrPath: "/usd-viewer/environments/neutral.hdr",
          hostManagedDnd: true,
          onStatus: (msg: string) => setStatus(msg || ""),
        });
        if (!active) {
          handle?.dispose?.();
          return;
        }
        handleRef.current = handle;
        // If a unified payload arrived before init, process it now
        if (pendingUnifiedRef.current) {
          const { files, primaryPath } = pendingUnifiedRef.current;
          pendingUnifiedRef.current = null;
          const anyHandle = handle as unknown as {
            loadFromFilesMap?: (
              files: Record<string, File>,
              primaryPath?: string
            ) => Promise<void> | void;
          };
          if (anyHandle.loadFromFilesMap) {
            await anyHandle.loadFromFilesMap(files, primaryPath);
          } else if (handle.loadFromFiles) {
            await handle.loadFromFiles(Object.values(files) as any);
          }
          setStatus("");
        } else {
          // Consume any pending last payload now that handle is ready
          const pending = consumeLastRobotFilesUpload?.();
          if (pending && pending.primary?.type === "USD") {
            const anyHandle = handle as unknown as {
              loadFromFilesMap?: (
                files: Record<string, File>,
                primaryPath?: string
              ) => Promise<void> | void;
            };
            if (anyHandle.loadFromFilesMap) {
              await anyHandle.loadFromFilesMap(
                pending.files,
                pending.primary.path
              );
            } else if (handle.loadFromFiles) {
              await handle.loadFromFiles(Object.values(pending.files) as any);
            }
            setStatus("");
          }
        }
      } catch (e) {
        console.error(e);
        setStatus("Initialization failed");
      }
    };

    // try immediate init if script already ran
    initFromWindow();
    // otherwise wait for a custom event fired by the module bridge
    const onReady = () => initFromWindow();
    window.addEventListener("usd-init-ready", onReady as EventListener);
    return () => {
      active = false;
      try {
        handleRef.current?.dispose?.();
      } catch {}
      handleRef.current = null;
      window.removeEventListener("usd-init-ready", onReady as EventListener);
    };
  }, []);

  const onDataTransfer = useCallback(async (dt: DataTransfer) => {
    if (handleRef.current?.loadFromDataTransfer) {
      await handleRef.current.loadFromDataTransfer(dt);
    } else if (handleRef.current?.loadFromFiles) {
      await handleRef.current.loadFromFiles(dt.files);
    }
  }, []);

  const onFilesMap = useCallback(
    async (files: Record<string, File>, primaryPath?: string) => {
      const handle = handleRef.current;
      if (!handle) return;
      // If viewer exposes a direct API for files map, use it; else fallback to File[]
      const maybeAny = handle as unknown as {
        loadFromFilesMap?: (
          files: Record<string, File>,
          primaryPath?: string
        ) => Promise<void> | void;
      };
      if (maybeAny.loadFromFilesMap) {
        await maybeAny.loadFromFilesMap(files, primaryPath);
        return;
      }
      if (handle.loadFromFiles) {
        // Fallback: best effort — flatten to array
        const arr = Object.values(files);
        await handle.loadFromFiles(arr as unknown as FileList);
      }
    },
    []
  );

  // examples provided by context

  // Handle USD file uploads via event bus
  useEffect(() => {
    const pending = consumeLastUsdDataTransfer();
    if (pending && activeRobotType === "USD") {
      onDataTransfer(pending.dataTransfer);
    }
    const unsubscribe = subscribeUsdDataTransfer(({ dataTransfer }) => {
      if (activeRobotType === "USD") {
        onDataTransfer(dataTransfer);
      }
    });
    return unsubscribe;
  }, [activeRobotType, onDataTransfer]);

  // Handle unified robot files uploads (preferred path)
  useEffect(() => {
    const unsubscribe = subscribeRobotFilesUpload?.((payload) => {
      if (activeRobotType === "USD" && payload.primary?.type === "USD") {
        if (!handleRef.current) {
          pendingUnifiedRef.current = {
            files: payload.files,
            primaryPath: payload.primary?.path,
          };
        } else {
          onFilesMap(payload.files, payload.primary.path);
        }
      }
    });
    return unsubscribe ?? (() => {});
  }, [activeRobotType, onFilesMap]);

  // React to ViewerControls selection for USD examples
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    if (activeRobotType !== "USD") {
      handle.clear?.();
      return;
    }

    if (!activeRobotOwner || !activeRobotName) {
      handle.clear?.();
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
      handle.loadFromURL?.(match.path);
      setStatus(`Loading ${match.display_name}...`);
    }
  }, [activeRobotType, activeRobotOwner, activeRobotName, examples]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full relative">
        <p className="pointer-events-none absolute left-2 bottom-2 m-0 px-2 py-1 rounded bg-[#FFFBF1] text-[#968612] text-[0.75em] opacity-70">
          {status}
        </p>
      </div>

      <Script id="usd-importmap" type="importmap" strategy="afterInteractive">
        {JSON.stringify({
          imports: {
            three: "https://unpkg.com/three@0.163.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.163.0/examples/jsm/",
          },
        })}
      </Script>
      <Script id="usd-init-bridge" type="module" strategy="afterInteractive">
        {
          "import { init as usdInit } from '/usd-viewer/usd_index.js'; window.__usdInit = usdInit; window.dispatchEvent(new CustomEvent('usd-init-ready'));"
        }
      </Script>
    </>
  );
}
