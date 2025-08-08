"use client";

import React from "react";
import { DragAndDropProvider } from "@/contexts/DragAndDropContext";

interface FullScreenDragDropProps {
  onClose: () => void;
  onSwitchToMjcf?: () => void;
}

export default function FullScreenDragDrop({
  onClose,
  onSwitchToMjcf,
}: FullScreenDragDropProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <DragAndDropProvider
        onFilesProcessed={onClose}
        onSwitchToMjcf={onSwitchToMjcf}
      >
        <div className="w-full h-full flex items-center justify-center p-8">
          {/* Card container for drag and drop */}
          <div className="w-full max-w-2xl bg-[#fef4da] rounded-xl shadow-lg overflow-hidden">
            {/* Card content */}
            <button
              onClick={onClose}
              className="m-2 p-2 transition-colors self-end cursor-pointer"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="#968612"
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
            <div className="p-8 w-full flex flex-col items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-gray-400"
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
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Drop your robot files here
                </h3>
                <p className="text-gray-600 max-w-md mb-6 leading-relaxed">
                  Drag and drop your URDF, MJCF, SDF, or USD files along with
                  any associated mesh files. We&apos;ll automatically detect and
                  load your robot model.
                </p>
                <div className="flex flex-wrap justify-center gap-2 text-sm text-gray-500">
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    URDF
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    MJCF
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    SDF
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    USD
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    OBJ
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full">
                    STL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DragAndDropProvider>
    </div>
  );
}
