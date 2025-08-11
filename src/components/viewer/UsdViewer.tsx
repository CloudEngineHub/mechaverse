"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DragAndDropProvider,
  useDragAndDrop,
} from "@/contexts/DragAndDropContext";
import { useRobot } from "@/hooks/useRobot";
import type { ExampleRobot } from "@/types/robot";

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
  const [status, setStatus] = useState(
    "Waiting for initialization to start..."
  );
  // isDragging is now provided by context; local state only for status
  const [examples, setExamples] = useState<ExampleRobot[] | null>(null);
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
          hostManagedUrl: true,
          onStatus: (msg: string) => setStatus(msg || ""),
        });
        if (!active) {
          handle?.dispose?.();
          return;
        }
        handleRef.current = handle;
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

  // Load USD examples list for resolving selection to URL
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/example_robots.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ExampleRobot[];
        if (mounted) setExamples(data);
      } catch {
        // ignore fetch errors
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

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

  function DndOverlay() {
    const { isDragging } = useDragAndDrop();
    if (!isDragging) return null;
    return (
      <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-amber-400 bg-amber-50/40 flex items-center justify-center text-amber-700 text-sm">
        Drop USD/USDZ/USDA files to load
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="w-full h-full relative">
        <DragAndDropProvider
          targetRef={containerRef}
          onDataTransfer={onDataTransfer}
        >
          <DndOverlay />
        </DragAndDropProvider>
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
