"use client";

export type InlineXmlPayload = {
  name: string;
  content: string;
};

type InlineXmlHandler = (payload: InlineXmlPayload) => void;

const inlineXmlSubscribers = new Set<InlineXmlHandler>();
let lastInlineXmlPayload: InlineXmlPayload | null = null;

export function subscribeInlineXml(handler: InlineXmlHandler): () => void {
  inlineXmlSubscribers.add(handler);
  return () => inlineXmlSubscribers.delete(handler);
}

export function publishInlineXml(payload: InlineXmlPayload): void {
  lastInlineXmlPayload = payload;
  inlineXmlSubscribers.forEach((handler) => {
    try {
      handler(payload);
    } catch (e) {
      // Best-effort: isolate subscriber errors
      console.warn("InlineXml subscriber error", e);
    }
  });
}

export function consumeLastInlineXml(): InlineXmlPayload | null {
  const p = lastInlineXmlPayload;
  lastInlineXmlPayload = null;
  return p;
}
