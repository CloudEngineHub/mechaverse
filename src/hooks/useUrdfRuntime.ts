import { useContext } from "react";
import {
  UrdfRuntimeContext,
  UrdfRuntimeContextType,
} from "@/contexts/UrdfRuntimeContext";

export function useUrdfRuntime(): UrdfRuntimeContextType {
  const ctx = useContext(UrdfRuntimeContext);
  if (!ctx)
    throw new Error("useUrdfRuntime must be used within UrdfRuntimeProvider");
  return ctx;
}
