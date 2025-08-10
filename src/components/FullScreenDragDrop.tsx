"use client";

import React from "react";
import clsx from "clsx";
import {
  DragAndDropProvider,
  useDragAndDrop,
} from "@/contexts/DragAndDropContext";

interface FullScreenDragDropProps {
  onClose: () => void;
}

function DropModalCard({ onClose }: { onClose: () => void }) {
  const { isDragging } = useDragAndDrop();

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      {/* Card container for drag and drop */}
      <div
        className={clsx(
          "w-full rounded-xl overflow-hidden transition-all duration-300",
          "bg-background shadow-lg",
          isDragging
            ? "max-w-3xl scale-[1.02] md:scale-[1.03] drop-shadow-[0_0_24px_rgba(250,230,82,0.35)] filter brightness-110"
            : "max-w-2xl"
        )}
      >
        {/* Card content */}
        <button
          onClick={onClose}
          className={clsx(
            "m-2 p-2 transition-colors self-end cursor-pointer",
            isDragging ? "text-brand" : "text-brand/80 hover:text-brand"
          )}
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div className="p-8 w-full flex flex-col items-center justify-center min-h-[420px]">
          <div className="text-center">
            <div
              className={clsx(
                "w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center transition-all duration-300",
                "bg-card",
                isDragging
                  ? "ring-4 ring-brand/40 shadow-[0_0_30px_rgba(150,136,21,0.35)]"
                  : "ring-0"
              )}
            >
              <svg
                className="w-10 h-10 text-brand"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-brand mb-4">
              Drop your robot files here
            </h3>
            <p className="text-brand max-w-md mb-6 leading-relaxed">
              Drag and drop your URDF, MJCF, SDF, or USD files along with any
              associated mesh files. We&apos;ll automatically detect and load
              your robot model.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-sm text-brand">
              <span className="px-3 py-1 bg-card text-brand rounded-full">
                URDF
              </span>
              <span className="px-3 py-1 bg-card text-brand rounded-full">
                MJCF
              </span>
              <span className="px-3 py-1 bg-card text-brand rounded-full">
                SDF
              </span>
              <span className="px-3 py-1 bg-card text-brand rounded-full">
                USD
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FullScreenDragDrop({
  onClose,
}: FullScreenDragDropProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <DragAndDropProvider onFilesProcessed={onClose}>
        <DropModalCard onClose={onClose} />
      </DragAndDropProvider>
    </div>
  );
}
