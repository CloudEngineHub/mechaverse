export type MujocoMessage =
  | {
      type: "LOAD_SCENE";
      xml?: { fileName: string; content: string };
      files?: {
        path: string;
        buffer: ArrayBuffer | Uint8Array | Blob | string;
      }[];
      root?: string;
    }
  | { type: "RESET_POSE" }
  | { type: "PAUSE_SIMULATION" }
  | { type: "RESUME_SIMULATION" };
