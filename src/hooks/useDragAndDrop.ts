import { useContext } from "react";
import {
  DragAndDropContext,
  DragAndDropContextType,
} from "@/contexts/DragAndDropContext";

export const useDragAndDrop = (): DragAndDropContextType => {
  const context = useContext(DragAndDropContext);
  if (!context) {
    throw new Error("useDragAndDrop must be used within a DragAndDropProvider");
  }
  return context;
};
