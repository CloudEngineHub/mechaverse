// "use client";
// import { useEffect, useRef, useState } from "react";

// export default function CaptureMJCF() {
//   const iframeRef = useRef<HTMLIFrameElement>(null);
//   const [ready, setReady] = useState(false);

//   useEffect(() => {
//     const iframe = iframeRef.current;
//     if (!iframe) return;

//     const onMessage = (event: MessageEvent) => {
//       if (event.source !== iframe.contentWindow) return;
//       if (event.data?.type === "IFRAME_READY") {
//         setReady(true);
//       }
//     };
//     window.addEventListener("message", onMessage);
//     return () => window.removeEventListener("message", onMessage);
//   }, []);

//   useEffect(() => {
//     if (!ready || !iframeRef.current) return;
//     const params = new URLSearchParams(window.location.search);
//     const scene = params.get("scene") || "humanoid/humanoid.xml";

//     // Load scene, make transparent, fit iso
//     iframeRef.current.contentWindow?.postMessage(
//       { type: "LOAD_EXAMPLE_SCENE", path: scene },
//       "*"
//     );

//     const onMessage2 = (event: MessageEvent) => {
//       if (event.source !== iframeRef.current?.contentWindow) return;
//       if (event.data?.type === "SCENE_LOADED") {
//         // Capture PNG and send back via postMessage to parent Puppeteer capturer
//         try {
//           const canvas =
//             iframeRef.current?.contentWindow?.document.querySelector(
//               "canvas"
//             ) as HTMLCanvasElement | null;
//           if (!canvas) return;
//           const png = canvas.toDataURL("image/png");
//           // bubble up to Puppeteer script via console.log or postMessage outward
//           window.parent.postMessage({ type: "CAPTURE_PNG", png }, "*");
//         } catch {}
//       }
//     };
//     window.addEventListener("message", onMessage2);
//     return () => window.removeEventListener("message", onMessage2);
//   }, [ready]);

//   return (
//     <div style={{ width: "100vw", height: "100vh", background: "transparent" }}>
//       <iframe
//         ref={iframeRef}
//         src="/mujoco/mujoco-viewer.html"
//         style={{
//           width: "100%",
//           height: "100%",
//           border: "none",
//           background: "transparent",
//         }}
//         sandbox="allow-scripts allow-same-origin"
//       />
//     </div>
//   );
// }
