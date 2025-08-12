import { useContext } from "react";
import { MujocoSceneContext } from "@/contexts/MujocoSceneProvider";

export function useMujocoScene() {
  const ctx = useContext(MujocoSceneContext);
  if (!ctx)
    throw new Error("useMujocoScene must be used within MujocoSceneProvider");
  return ctx;
}
