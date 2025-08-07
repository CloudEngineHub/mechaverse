import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper function to determine MIME type
export function getMimeType(extension: string): string {
  const mapping: Record<string, string> = {
    urdf: "application/xml",
    xml: "application/xml",
    dae: "model/vnd.collada+xml",
    stl: "model/stl",
    obj: "model/obj",
    mtl: "model/mtl",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    gltf: "model/gltf+json",
    glb: "model/gltf+json",
    xacro: "application/xml",
    json: "application/json",
  };

  return mapping[extension.toLowerCase()] || "application/octet-stream";
}
