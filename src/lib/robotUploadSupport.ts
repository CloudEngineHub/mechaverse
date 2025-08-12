import { getMimeType } from "@/lib/utils";

/**
 * Converts a DataTransfer structure into an object with all paths and files.
 * This supports folders dropped via the non-standard DirectoryEntry API
 * (webkitGetAsEntry / getAsEntry) as implemented by Chromium/WebKit.
 *
 * @param dataTransfer The DataTransfer object from the drop event
 * @returns A promise that resolves with the file structure object
 */
export function dataTransferToFiles(
  dataTransfer: DataTransfer
): Promise<Record<string, File>> {
  if (!(dataTransfer instanceof DataTransfer)) {
    throw new Error('Data must be of type "DataTransfer"');
  }

  const files: Record<string, File> = {};

  /**
   * Recursively processes a directory entry to extract all files
   * Using type 'unknown' and then type checking for safety with WebKit's non-standard API
   */
  function recurseDirectory(item: unknown): Promise<void> {
    // Type guard for file entries
    const isFileEntry = (
      entry: unknown
    ): entry is {
      isFile: boolean;
      fullPath: string;
      file: (callback: (file: File) => void) => void;
    } =>
      entry !== null &&
      typeof entry === "object" &&
      "isFile" in entry &&
      typeof (entry as Record<string, unknown>).file === "function" &&
      "fullPath" in entry;

    // Type guard for directory entries
    const isDirEntry = (
      entry: unknown
    ): entry is {
      isFile: boolean;
      createReader: () => {
        readEntries: (callback: (entries: unknown[]) => void) => void;
      };
    } =>
      entry !== null &&
      typeof entry === "object" &&
      "isFile" in entry &&
      typeof (entry as Record<string, unknown>).createReader === "function";

    if (isFileEntry(item) && item.isFile) {
      return new Promise((resolve) => {
        item.file((file: File) => {
          files[item.fullPath] = file;
          resolve();
        });
      });
    } else if (isDirEntry(item) && !item.isFile) {
      const reader = item.createReader();

      return new Promise((resolve) => {
        const promises: Promise<void>[] = [];

        // Exhaustively read all directory entries
        function readNextEntries() {
          reader.readEntries((entries: unknown[]) => {
            if (entries.length === 0) {
              Promise.all(promises).then(() => resolve());
            } else {
              entries.forEach((entry) => {
                promises.push(recurseDirectory(entry));
              });
              readNextEntries();
            }
          });
        }

        readNextEntries();
      });
    }

    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // Process dropped items
    const dtitems = dataTransfer.items && Array.from(dataTransfer.items);
    const dtfiles = Array.from(dataTransfer.files);

    if (dtitems && dtitems.length && "webkitGetAsEntry" in dtitems[0]) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < dtitems.length; i++) {
        const item = dtitems[i] as unknown as {
          webkitGetAsEntry: () => unknown;
        };

        if (typeof item.webkitGetAsEntry === "function") {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            promises.push(recurseDirectory(entry));
          }
        }
      }

      Promise.all(promises).then(() => resolve(files));
    } else {
      // Add a '/' prefix to match the file directory entry on webkit browsers
      dtfiles
        .filter((f) => f.size !== 0)
        .forEach((f) => (files["/" + f.name] = f));

      resolve(files);
    }
  });
}

/**
 * Cleans a file path by removing '..' and '.' tokens and normalizing slashes
 */
export function cleanFilePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split(/\//g)
    .reduce((acc, el) => {
      if (el === "..") acc.pop();
      else if (el !== ".") acc.push(el);
      return acc;
    }, [] as string[])
    .join("/");
}

/**
 * Interface representing the structure of an URDF processor
 */
export interface UrdfProcessor {
  loadUrdf: (path: string) => void;
  setUrlModifierFunc: (func: (url: string) => string) => void;
}

// Private helper function to create the URL resolver
function createUrlResolverForProcessor(
  filesMap: Record<string, File>,
  allFileKeys: string[],
  packagePathForResolution: string
): (url: string) => string {
  return (url: string) => {
    const cleanedUrlFromUrdf = cleanFilePath(url);
    let resolvedFilePathKey: string | undefined = undefined;

    const candidatePath1 = cleanFilePath(
      packagePathForResolution + cleanedUrlFromUrdf
    );
    if (filesMap[candidatePath1]) {
      resolvedFilePathKey = candidatePath1;
    }

    if (!resolvedFilePathKey && filesMap[cleanedUrlFromUrdf]) {
      resolvedFilePathKey = cleanedUrlFromUrdf;
    }

    if (!resolvedFilePathKey) {
      const urlFilenameOnly = cleanedUrlFromUrdf.split("/").pop() || "";
      if (urlFilenameOnly) {
        resolvedFilePathKey =
          allFileKeys.find((name) => name.endsWith("/" + urlFilenameOnly)) ||
          allFileKeys.find((name) => name.endsWith(urlFilenameOnly));
      }
    }

    if (resolvedFilePathKey && filesMap[resolvedFilePathKey]) {
      const file = filesMap[resolvedFilePathKey];
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
      const blob = new Blob([file], { type: getMimeType(fileExtension) });
      const blobUrl = URL.createObjectURL(blob) + `#.${fileExtension}`;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return blobUrl;
    }
    // console.warn(`[RobotDragAndDrop internal] createUrlResolver: No matching file for URL: '${url}'. Cleaned: '${cleanedUrlFromUrdf}', Package: '${packagePathForResolution}'.`);
    return url;
  };
}

/**
 * Core function to process URDF files from a files map
 */
async function processUrdfFilesCore(
  files: Record<string, File>,
  urdfProcessor: UrdfProcessor
): Promise<{
  files: Record<string, File>;
  availableModels: string[];
  blobUrls: Record<string, string>;
}> {
  // Get all file paths and clean them
  const fileNames = Object.keys(files).map((n) => cleanFilePath(n));

  // Filter all files ending in URDF
  const availableModels = fileNames.filter((n) => /urdf$/i.test(n));

  // Create blob URLs for URDF files
  const blobUrls: Record<string, string> = {};
  availableModels.forEach((path) => {
    if (files[path]) {
      blobUrls[path] = URL.createObjectURL(files[path]);
    }
  });

  // Extract the package base path from the first URDF model for reference
  let packageBasePath = "/";
  if (availableModels.length > 0) {
    const firstModelPath = availableModels[0];
    const lastSlashIdx = firstModelPath.lastIndexOf("/");
    if (lastSlashIdx > 0) {
      packageBasePath = firstModelPath.substring(0, lastSlashIdx + 1);
    } else if (lastSlashIdx === 0) {
      packageBasePath = "/";
    }
    if (!packageBasePath.endsWith("/")) {
      packageBasePath += "/";
    }
  }

  // Store the package path for future reference and set URL modifier
  urdfProcessor.setUrlModifierFunc(
    createUrlResolverForProcessor(files, fileNames, packageBasePath)
  );

  return { files, availableModels, blobUrls };
}

/**
 * Processes a generic files record and returns information about available URDF models
 */
export async function processFilesRecord(
  filesRecord: Record<string, File>,
  urdfProcessor: UrdfProcessor
): Promise<{
  files: Record<string, File>;
  availableModels: string[];
  blobUrls: Record<string, string>;
}> {
  // Clone and normalize keys
  const files: Record<string, File> = {};
  Object.entries(filesRecord).forEach(([k, f]) => {
    const normalized = cleanFilePath(k.startsWith("/") ? k : "/" + k);
    files[normalized] = f;
  });
  return processUrdfFilesCore(files, urdfProcessor);
}
