"use client";

import React, {
  createContext,
  useState,
  useCallback,
  ReactNode,
  useRef,
  useEffect,
} from "react";
import { UrdfProcessor, readUrdfFileContent } from "@/lib/robotUploadSupport";
import { UrdfData, RobotFileModel } from "@/types/robot";

// Define the result interface for URDF detection
interface RobotDetectionResult {
  hasRobot: boolean;
  modelName?: string;
  parsedData?: UrdfData | null;
}

// Define the context type
export type RobotContextType = {
  urdfProcessor: UrdfProcessor | null;
  registerUrdfProcessor: (processor: UrdfProcessor) => void;
  onRobotDetected: (
    callback: (result: RobotDetectionResult) => void
  ) => () => void;
  processRobotFiles: (
    files: Record<string, File>,
    availableModels: string[]
  ) => Promise<void>;
  robotBlobUrls: Record<string, string>;
  alternativeRobotModels: string[];
  isSelectionModalOpen: boolean;
  setIsSelectionModalOpen: (isOpen: boolean) => void;
  robotModelOptions: RobotFileModel[];
  selectRobotModel: (model: RobotFileModel) => void;

  // File map for mesh resolution by viewer
  modelFiles: Record<string, File> | null;
  setModelFiles: (files: Record<string, File> | null) => void;

  // Centralized robot data management
  robotContent: string | null;

  // Component visibility management
  visibleComponents: Record<string, boolean> | null;
  setVisibleComponents: (components: Record<string, boolean>) => void;

  // GitHub loading state management
  isLoadingGitHub: boolean;
  githubError: string | null;
  loadedGitHubUrl: string | null;
  setGitHubLoadingState: (
    loading: boolean,
    error?: string | null,
    url?: string | null
  ) => void;
  clearGitHubState: () => void;
};

// Create the context
export const RobotContext = createContext<RobotContextType | undefined>(
  undefined
);

export const RobotProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // State for URDF processor
  const [urdfProcessor, setUrdfProcessor] = useState<UrdfProcessor | null>(
    null
  );

  // NEW: State for the actual file map
  const [modelFiles, setModelFiles] = useState<Record<string, File> | null>(
    null
  );

  // State for blob URLs (replacing window.urdfBlobUrls)
  const [robotBlobUrls, setRobotBlobUrls] = useState<Record<string, string>>(
    {}
  );

  // State for alternative models (replacing window.alternativeRobotModels)
  const [alternativeRobotModels, setAlternativeRobotModels] = useState<
    string[]
  >([]);

  // State for the URDF selection modal
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [robotModelOptions, setRobotModelOptions] = useState<RobotFileModel[]>(
    []
  );

  const [robotContent, setRobotContent] = useState<string | null>(null);

  // State for component visibility
  const [visibleComponents, setVisibleComponents] = useState<Record<
    string,
    boolean
  > | null>(null);

  // GitHub loading state management
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [loadedGitHubUrl, setLoadedGitHubUrl] = useState<string | null>(null);

  // Function to manage GitHub loading state
  const setGitHubLoadingState = useCallback(
    (
      loading: boolean,
      error: string | null = null,
      url: string | null = null
    ) => {
      setIsLoadingGitHub(loading);
      setGithubError(error);
      if (url !== null) {
        setLoadedGitHubUrl(url);
      }
    },
    []
  );

  // Function to clear GitHub state
  const clearGitHubState = useCallback(() => {
    setIsLoadingGitHub(false);
    setGithubError(null);
    setLoadedGitHubUrl(null);
  }, []);

  // Reference for callbacks
  const robotCallbacksRef = useRef<((result: RobotDetectionResult) => void)[]>(
    []
  );

  // Register a callback for URDF detection
  const onRobotDetected = useCallback(
    (callback: (result: RobotDetectionResult) => void) => {
      robotCallbacksRef.current.push(callback);

      return () => {
        robotCallbacksRef.current = robotCallbacksRef.current.filter(
          (cb) => cb !== callback
        );
      };
    },
    []
  );

  // Register a URDF processor
  const registerUrdfProcessor = useCallback((processor: UrdfProcessor) => {
    setUrdfProcessor(processor);
  }, []);

  // Internal function to notify callbacks and update central state
  const notifyRobotCallbacks = useCallback((result: RobotDetectionResult) => {
    robotCallbacksRef.current.forEach((callback) => callback(result));
  }, []);

  // Helper function to process a single URDF file
  const handleSingleUrdfModelProcessing = useCallback(
    async (file: File, modelName: string) => {
      try {
        // Read the URDF content
        const urdfContent = await readUrdfFileContent(file);
        setRobotContent(urdfContent);
      } catch (error) {
        // Error case
        console.error("❌ Error processing URDF:", error);
        notifyRobotCallbacks({
          hasRobot: true,
          modelName,
        });
      }
    },
    [notifyRobotCallbacks]
  );

  // Helper function to process the selected URDF model
  const processSelectedRobot = useCallback(
    async (model: RobotFileModel) => {
      if (!urdfProcessor) return;

      // Find the file in our files record
      const files = Object.values(robotBlobUrls)
        .filter((url) => url === model.blobUrl)
        .map((url) => {
          const path = Object.keys(robotBlobUrls).find(
            (key) => robotBlobUrls[key] === url
          );
          return path ? { path, url } : null;
        })
        .filter((item) => item !== null);

      if (files.length === 0) {
        console.error("❌ Could not find file for selected URDF model");
        return;
      }

      try {
        // Get the file from our record
        const filePath = files[0]?.path;
        if (!filePath || !robotBlobUrls[filePath]) {
          throw new Error("File not found in records");
        }

        // Get the actual File object
        const response = await fetch(model.blobUrl);
        const blob = await response.blob();
        const file = new File(
          [blob],
          filePath.split("/").pop() || "model.urdf",
          {
            type: "application/xml",
          }
        );

        // Use our helper to process the file
        const modelDisplayName =
          model.name || model.path.split("/").pop() || "Unknown";
        await handleSingleUrdfModelProcessing(file, modelDisplayName);
      } catch (error) {
        console.error("❌ Error processing selected URDF:", error);
      }
    },
    [robotBlobUrls, urdfProcessor, handleSingleUrdfModelProcessing]
  );

  // Function to handle selecting a URDF model from the modal
  const selectRobotModel = useCallback(
    (model: RobotFileModel) => {
      if (!urdfProcessor) {
        console.error("❌ No URDF processor available");
        return;
      }

      // Close the modal
      setIsSelectionModalOpen(false);

      // Extract model name
      const modelName =
        model.name ||
        model.path
          .split("/")
          .pop()
          ?.replace(/\.urdf$/i, "") ||
        "Unknown";

      // Load the selected URDF model
      urdfProcessor.loadUrdf(model.blobUrl);

      // Notify callbacks about the selection before parsing
      notifyRobotCallbacks({
        hasRobot: true,
        modelName,
        parsedData: undefined, // Will use parseRobot later to get the data
      });

      // Try to parse the model - this will update the UI when complete
      processSelectedRobot(model);
    },
    [urdfProcessor, notifyRobotCallbacks, processSelectedRobot]
  );

  // Process URDF files - moved from DragAndDropContext
  const processRobotFiles = useCallback(
    async (files: Record<string, File>, availableModels: string[]) => {
      // Clear previous blob URLs to prevent memory leaks
      Object.values(robotBlobUrls).forEach(URL.revokeObjectURL);
      setRobotBlobUrls({});
      setAlternativeRobotModels([]);
      setRobotModelOptions([]);
      setModelFiles(files); // Store the raw files map

      try {
        // Check if we have any URDF files
        if (availableModels.length > 0 && urdfProcessor) {
          // Create blob URLs for all models
          const newRobotBlobUrls: Record<string, string> = {};
          availableModels.forEach((path) => {
            if (files[path]) {
              newRobotBlobUrls[path] = URL.createObjectURL(files[path]);
            }
          });
          setRobotBlobUrls(newRobotBlobUrls);

          // Save alternative models for reference
          setAlternativeRobotModels(availableModels);

          // Create model options for the selection modal
          const modelOptions: RobotFileModel[] = availableModels.map((path) => {
            const fileName = path.split("/").pop() || "";
            const modelName = fileName.replace(/\.urdf$/i, "");
            return {
              path,
              blobUrl: newRobotBlobUrls[path],
              name: modelName,
            };
          });

          setRobotModelOptions(modelOptions);

          // If there's only one model, use it directly
          if (availableModels.length === 1) {
            // Extract model name from the URDF file
            const fileName = availableModels[0].split("/").pop() || "";
            const modelName = fileName.replace(/\.urdf$/i, "");

            // Use the blob URL instead of the file path
            const blobUrl = newRobotBlobUrls[availableModels[0]];
            if (blobUrl) {
              urdfProcessor.loadUrdf(blobUrl);

              // Process the URDF file for parsing
              if (files[availableModels[0]]) {
                // Use our helper function to process the file
                await handleSingleUrdfModelProcessing(
                  files[availableModels[0]],
                  modelName
                );
              } else {
                console.error(
                  "❌ Could not find file for URDF model:",
                  availableModels[0]
                );

                // Still notify callbacks without parsed data
                notifyRobotCallbacks({
                  hasRobot: true,
                  modelName,
                });
              }
            } else {
              urdfProcessor.loadUrdf(availableModels[0]);

              // Notify callbacks
              notifyRobotCallbacks({
                hasRobot: true,
                modelName,
              });
            }
          } else {
            setIsSelectionModalOpen(true);

            // Notify that URDF files are available but selection is needed
            notifyRobotCallbacks({
              hasRobot: true,
              modelName: "Multiple models available",
            });
          }
        } else {
          console.warn(
            "❌ No URDF models found in dropped files or no processor available"
          );
          notifyRobotCallbacks({ hasRobot: false, parsedData: null });
          setModelFiles(null); // Clear model files if none found
        }
      } catch (error) {
        console.error("❌ Error processing URDF files:", error);
        setModelFiles(null); // Clear model files on error
      }
    },
    [
      notifyRobotCallbacks,
      robotBlobUrls,
      urdfProcessor,
      handleSingleUrdfModelProcessing,
    ]
  );

  // Listen for URDF updates from the WebSocket
  useEffect(() => {
    const handleUrdfUpdate = (event: CustomEvent) => {
      const { urdfContent, filePath } = event.detail;

      if (!modelFiles || !urdfContent || !filePath) {
        console.warn("❌ Cannot update URDF: missing data", {
          hasModelFiles: !!modelFiles,
          hasContent: !!urdfContent,
          hasPath: !!filePath,
        });
        return;
      }

      // Find the URDF file in our current model files
      const urdfKey = Object.keys(modelFiles).find(
        (key) =>
          key.toLowerCase().endsWith(".urdf") ||
          key.endsWith(filePath) ||
          key.includes(filePath.replace(/^\//, ""))
      );

      if (!urdfKey) {
        console.warn("❌ Could not find URDF file in model files to update", {
          filePath,
          availableFiles: Object.keys(modelFiles),
        });
        return;
      }

      // Create a new File object with the updated URDF content
      const originalFile = modelFiles[urdfKey];
      const updatedUrdfFile = new File([urdfContent], originalFile.name, {
        type: originalFile.type,
      });

      // Update the model files with the new URDF content
      const updatedModelFiles = {
        ...modelFiles,
        [urdfKey]: updatedUrdfFile,
      };

      setModelFiles(updatedModelFiles);

      // Also update the robot blob URLs for the URDF
      setRobotBlobUrls((prev) => {
        const newBlobUrl = URL.createObjectURL(updatedUrdfFile);
        const oldBlobUrl = prev[urdfKey];

        // Revoke old blob URL to prevent memory leaks
        if (oldBlobUrl && oldBlobUrl !== newBlobUrl) {
          // Delay revocation slightly to prevent race conditions
          setTimeout(() => {
            URL.revokeObjectURL(oldBlobUrl);
          }, 1000);
        }

        return {
          ...prev,
          [urdfKey]: newBlobUrl,
        };
      });

      // Update the robot content state as well
      setRobotContent(urdfContent);

      // Force reload the URDF in the processor if available
      if (urdfProcessor) {
        // Small delay to ensure blob URL is ready
        setTimeout(() => {
          const updatedBlobUrl = URL.createObjectURL(updatedUrdfFile);
          try {
            urdfProcessor.loadUrdf(updatedBlobUrl);
          } catch (error) {
            console.warn("⚠️ Error force reloading URDF:", error);
          }
        }, 100);
      }
    };

    // Add event listener for URDF updates
    window.addEventListener("urdf-updated", handleUrdfUpdate as EventListener);

    return () => {
      window.removeEventListener(
        "urdf-updated",
        handleUrdfUpdate as EventListener
      );
    };
  }, [modelFiles, robotBlobUrls, notifyRobotCallbacks, urdfProcessor]);

  // Clean up blob URLs when component unmounts
  React.useEffect(() => {
    return () => {
      Object.values(robotBlobUrls).forEach(URL.revokeObjectURL);
    };
  }, [robotBlobUrls]);

  // Create the context value
  const contextValue: RobotContextType = {
    urdfProcessor,
    registerUrdfProcessor,
    onRobotDetected,
    processRobotFiles,
    robotBlobUrls,
    alternativeRobotModels,
    isSelectionModalOpen,
    setIsSelectionModalOpen,
    robotModelOptions,
    selectRobotModel,
    modelFiles,
    setModelFiles,
    robotContent,
    visibleComponents,
    setVisibleComponents,
    isLoadingGitHub,
    githubError,
    loadedGitHubUrl,
    setGitHubLoadingState,
    clearGitHubState,
  };

  return (
    <RobotContext.Provider value={contextValue}>
      {children}
    </RobotContext.Provider>
  );
};
