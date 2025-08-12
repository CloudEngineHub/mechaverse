"use client";
import { RobotFilesPayload } from "@/types/robot";

type RobotFilesHandler = (payload: RobotFilesPayload) => void;

const robotFilesSubscribers = new Set<RobotFilesHandler>();
let lastRobotFilesPayload: RobotFilesPayload | null = null;

export function subscribeRobotFilesUpload(
  handler: RobotFilesHandler
): () => void {
  robotFilesSubscribers.add(handler);
  return () => robotFilesSubscribers.delete(handler);
}

export function publishRobotFilesUpload(payload: RobotFilesPayload): void {
  lastRobotFilesPayload = payload;
  robotFilesSubscribers.forEach((handler) => {
    try {
      handler(payload);
    } catch (e) {
      console.warn("RobotFilesUpload subscriber error", e);
    }
  });
}

export function consumeLastRobotFilesUpload(): RobotFilesPayload | null {
  const p = lastRobotFilesPayload;
  lastRobotFilesPayload = null;
  return p;
}
