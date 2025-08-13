// "use client";
// import { useEffect, useRef, useState } from "react";
// import UrdfViewer from "@/components/viewer/UrdfViewer";
// import { URDFViewerElement } from "@/components/viewer/urdfViewerHelpers";
// import { RobotProvider } from "@/contexts/RobotContext";
// import { useRobot } from "@/hooks/useRobot";

// function Inner() {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const { setActiveRobotOwner, setActiveRobotName } = useRobot();
//   const [expectedPath, setExpectedPath] = useState<string | null>(null);

//   useEffect(() => {
//     // Read query on client only
//     const params = new URLSearchParams(window.location.search);
//     const r = params.get("robot");
//     setActiveRobotOwner("placeholder");
//     setActiveRobotName(r);
//     const map: Record<string, string> = {
//       cassie: "/urdf/cassie/cassie.urdf",
//       "SO-100": "/urdf/so-100/so_100.urdf",
//       "Anymal B": "/urdf/anymal-b/anymal.urdf",
//     };
//     setExpectedPath(map[r!]);
//   }, [setActiveRobotOwner, setActiveRobotName]);

//   useEffect(() => {
//     // Wait for the correct robot to finish processing, then capture
//     let cleanup: (() => void) | null = null;
//     const interval = setInterval(() => {
//       const el = containerRef.current?.querySelector(
//         "urdf-viewer"
//       ) as URDFViewerElement | null;
//       if (!el) return;
//       const onProcessed = () => {
//         try {
//           const currentPath = el.getAttribute("urdf");
//           if (!expectedPath || currentPath !== expectedPath) return; // not the target yet
//           const canvas = (el?.shadowRoot?.querySelector("canvas") ||
//             (el?.renderer &&
//               el.renderer.domElement)) as HTMLCanvasElement | null;
//           if (!canvas) return;
//           const png = canvas.toDataURL("image/png");
//           window.parent.postMessage({ type: "CAPTURE_PNG", png }, "*");
//         } catch {}
//         el.removeEventListener("urdf-processed", onProcessed);
//       };
//       el.addEventListener("urdf-processed", onProcessed);
//       cleanup = () => el.removeEventListener("urdf-processed", onProcessed);
//       clearInterval(interval);
//     }, 50);
//     return () => {
//       clearInterval(interval);
//       if (cleanup) cleanup();
//     };
//   }, [expectedPath]);

//   return (
//     <div
//       ref={containerRef}
//       style={{ width: "100vw", height: "100vh", background: "transparent" }}
//     >
//       <UrdfViewer />
//     </div>
//   );
// }

// export default function CaptureURDF() {
//   return (
//     <RobotProvider>
//       <Inner />
//     </RobotProvider>
//   );
// }
