"use client";

import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ExampleRobot } from "@/types/robot";

export type ExampleRobotsContextType = {
  examples: ExampleRobot[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const ExampleRobotsContext = createContext<
  ExampleRobotsContextType | undefined
>(undefined);

export const ExampleRobotsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [examples, setExamples] = useState<ExampleRobot[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/example_robots.json", { cache: "no-store" });
      if (!res.ok)
        throw new Error(`Failed to fetch example robots: ${res.status}`);
      const data = (await res.json()) as ExampleRobot[];
      setExamples(data);
    } catch (e) {
      setError((e as Error)?.message || "Unknown error");
      setExamples([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch once on mount
    load();
  }, [load]);

  const value = useMemo(
    () => ({ examples, isLoading, error, refresh: load }),
    [examples, isLoading, error, load]
  );

  return (
    <ExampleRobotsContext.Provider value={value}>
      {children}
    </ExampleRobotsContext.Provider>
  );
};
