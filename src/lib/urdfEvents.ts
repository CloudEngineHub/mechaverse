"use client";

export type DataTransferPayload = DataTransfer;
export type FileListPayload = FileList;

type DTHandler = (payload: DataTransferPayload) => void;
type FLHandler = (payload: FileListPayload) => void;

const dtSubscribers = new Set<DTHandler>();
const flSubscribers = new Set<FLHandler>();

let lastDT: DataTransferPayload | null = null;
let lastFL: FileListPayload | null = null;

export function subscribeUrdfDataTransfer(handler: DTHandler): () => void {
  dtSubscribers.add(handler);
  return () => dtSubscribers.delete(handler);
}

export function subscribeUrdfFileList(handler: FLHandler): () => void {
  flSubscribers.add(handler);
  return () => flSubscribers.delete(handler);
}

export function publishUrdfDataTransfer(payload: DataTransferPayload): void {
  lastDT = payload;
  dtSubscribers.forEach((h) => {
    try {
      h(payload);
    } catch (e) {
      console.warn("URDF DT subscriber error", e);
    }
  });
}

export function publishUrdfFileList(payload: FileListPayload): void {
  lastFL = payload;
  flSubscribers.forEach((h) => {
    try {
      h(payload);
    } catch (e) {
      console.warn("URDF FL subscriber error", e);
    }
  });
}

export function consumeLastUrdfDataTransfer(): DataTransferPayload | null {
  const p = lastDT;
  lastDT = null;
  return p;
}

export function consumeLastUrdfFileList(): FileListPayload | null {
  const p = lastFL;
  lastFL = null;
  return p;
}
