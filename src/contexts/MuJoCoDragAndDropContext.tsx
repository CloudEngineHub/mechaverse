"use client";
import React, { createContext, useState, ReactNode, useCallback } from "react";

export type MuJoCoDragAndDropContextType = {
  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
  handleDrop: (e: DragEvent) => Promise<void>;
};

export const MuJoCoDragAndDropContext = createContext<
  MuJoCoDragAndDropContextType | undefined
>(undefined);

interface MuJoCoDragAndDropProviderProps {
  children: ReactNode;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export const MuJoCoDragAndDropProvider: React.FC<
  MuJoCoDragAndDropProviderProps
> = ({ children, iframeRef }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processDroppedFiles = async (dataTransfer: DataTransfer) => {
    const files = Array.from(dataTransfer.files);
    const xmlFiles = files.filter(
      (file) =>
        file.name.toLowerCase().endsWith(".xml") ||
        file.type === "application/xml" ||
        file.type === "text/xml"
    );

    if (xmlFiles.length === 0) {
      console.warn("⚠️ No XML files found in dropped files");
      return;
    }

    // For now, we'll handle the first XML file
    const xmlFile = xmlFiles[0];
    console.log("📄 Processing XML file:", xmlFile.name);

    try {
      // Read the file content
      const fileContent = await xmlFile.text();

      // Send the file content to the iframe
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: "LOAD_XML_CONTENT",
            fileName: xmlFile.name,
            content: fileContent,
          },
          "*"
        );
        console.log("📤 Sent XML content to iframe:", xmlFile.name);
      }
    } catch (error) {
      console.error("❌ Error processing XML file:", error);
    }
  };

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log("🔄 MuJoCo DragAndDropContext: Drop event detected");

    if (!e.dataTransfer) {
      console.error("❌ No dataTransfer available");
      return;
    }

    try {
      await processDroppedFiles(e.dataTransfer);
    } catch (error) {
      console.error("❌ Error in handleDrop:", error);
    }
  }, []);

  return (
    <MuJoCoDragAndDropContext.Provider
      value={{
        isDragging,
        setIsDragging,
        handleDrop,
      }}
    >
      {children}
    </MuJoCoDragAndDropContext.Provider>
  );
};
