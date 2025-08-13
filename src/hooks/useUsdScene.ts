import { useContext } from "react";
import { UsdSceneContext } from "@/contexts/UsdSceneProvider";

export function useUsdScene() {
  const ctx = useContext(UsdSceneContext);
  if (!ctx) throw new Error("useUsdScene must be used within UsdSceneProvider");
  return ctx;
}
