import { useContext } from "react";
import {
  ExampleRobotsContext,
  ExampleRobotsContextType,
} from "@/contexts/ExampleRobotsContext";

export function useExampleRobots(): ExampleRobotsContextType {
  const ctx = useContext(ExampleRobotsContext);
  if (!ctx) {
    throw new Error(
      "useExampleRobots must be used within an ExampleRobotsProvider"
    );
  }
  return ctx;
}
