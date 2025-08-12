export type MujocoMessage =
  | { type: "LOAD_PUBLIC_SCENE"; path: string }
  | { type: "LOAD_XML_CONTENT"; fileName: string; content: string }
  | { type: "RESET_POSE" }
  | { type: "PAUSE_SIMULATION" }
  | { type: "RESUME_SIMULATION" }
  | {
      type: "LOAD_MJCF_FILES_MAP";
      entries: { path: string; buffer: ArrayBuffer }[];
    }
  | { type: "LOAD_MJCF_ROOT"; path: string };
