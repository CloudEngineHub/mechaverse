"use client";

export type UsdDataTransferPayload = {
  dataTransfer: DataTransfer;
  owner: string;
  name: string;
};

type UsdDataTransferHandler = (payload: UsdDataTransferPayload) => void;

const usdDataTransferSubscribers = new Set<UsdDataTransferHandler>();
let lastUsdDataTransferPayload: UsdDataTransferPayload | null = null;

export function subscribeUsdDataTransfer(
  handler: UsdDataTransferHandler
): () => void {
  usdDataTransferSubscribers.add(handler);
  return () => usdDataTransferSubscribers.delete(handler);
}

export function publishUsdDataTransfer(payload: UsdDataTransferPayload): void {
  lastUsdDataTransferPayload = payload;
  usdDataTransferSubscribers.forEach((handler) => {
    try {
      handler(payload);
    } catch (e) {
      // Best-effort: isolate subscriber errors
      console.warn("UsdDataTransfer subscriber error", e);
    }
  });
}

export function consumeLastUsdDataTransfer(): UsdDataTransferPayload | null {
  const p = lastUsdDataTransferPayload;
  lastUsdDataTransferPayload = null;
  return p;
}
