import {
  Vector3,
  Box3,
  PerspectiveCamera,
  Scene,
  Group,
  WebGLRenderer,
  SRGBColorSpace,
  NeutralToneMapping,
  VSMShadowMap,
  PMREMGenerator,
  EquirectangularReflectionMapping,
} from "three";
import { ThreeRenderDelegateInterface } from "./hydra/ThreeJsRenderDelegate.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import "./bindings/emHdBindings.js";

const getUsdModule = globalThis["NEEDLE:USD:GET"];

export function init(
  options = {
    container,
    hdrPath,
  }
) {
  return new Promise((resolveInit) => {
    if (!options || !options.container) {
      throw new Error("init: options.container is required");
    }
    if (!options.hdrPath) {
      options.hdrPath = "/usd-viewer/environments/neutral.hdr";
    }

    let handle = null;

    const run = () => {
      let USD;
      // Resolve when USD module is ready so drop-handling can await it
      let resolveUsdReady;
      const usdReady = new Promise((resolve) => {
        resolveUsdReady = resolve;
      });

      const debugFileHandling = false;

      // Install a lightweight fetch rewrite so requests to "/host/..." are
      // mapped to the current asset base directory of the last loaded URL
      function installFetchRewrite() {
        if (window.__usdFetchRewritten) return;
        const origFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
          try {
            const url = typeof input === "string" ? input : input?.url;
            if (url && url.startsWith("/host/") && window.__usdAssetBase) {
              const mapped = window.__usdAssetBase + url.substring(6);
              return origFetch(mapped, init);
            }
          } catch {}
          return origFetch(input, init);
        };
        window.__usdFetchRewritten = true;
      }

      // Host manages URLs/state, so we don't need URL parameter handling
      let filename = "";
      let currentDisplayFilename = "";

      const initPromise = setup();

      console.log("Loading USD Module...");
      try {
        Promise.all([
          getUsdModule({
            mainScriptUrlOrBlob: "/usd-viewer/bindings/emHdBindings.js",
            locateFile: (file) => {
              return "/usd-viewer/bindings/" + file;
            },
            // Suppress noisy OpenUSD discovery warnings that don't affect functionality
            printErr: (text) => {
              try {
                const s = String(text || "");
                if (
                  s.includes("_FindAndInstantiateDiscoveryPlugins") ||
                  s.includes("/ndr/registry.cpp") ||
                  s.includes("Failed verification: ' pluginFactory '") ||
                  // Harmless when loading packaged USDZ read-only; USD attempts to save are blocked
                  s.includes("_WriteToFile") ||
                  s.includes("/sdf/layer.cpp") ||
                  s.includes(
                    "writing package usdz layer is not allowed through this API"
                  )
                ) {
                  return;
                }
              } catch {}
              // Fallback to standard error output for everything else
              try {
                console.error(text);
              } catch {}
            },
          }),
          initPromise,
        ]).then(async ([Usd]) => {
          USD = Usd;
          if (resolveUsdReady) resolveUsdReady(USD);
          animate();
          // Host manages file loading, so we don't auto-load from URL params
        });
      } catch (error) {
        if (error.toString().indexOf("SharedArrayBuffer") >= 0) {
          console.log(
            error,
            "Your current browser doesn't support SharedArrayBuffer which is required for USD."
          );
        } else {
          console.log(
            "Your current browser doesn't support USD-for-web. Error during initialization: " +
              error
          );
        }
      }

      var timeout = 40;
      var endTimeCode = 1;
      var ready = false;

      const usdzExportBtn = document.getElementById("export-usdz");
      if (usdzExportBtn)
        usdzExportBtn.addEventListener("click", () => {
          alert("usdz");
        });

      const gltfExportBtn = document.getElementById("export-gltf");
      if (gltfExportBtn)
        gltfExportBtn.addEventListener("click", (evt) => {
          const exporter = new GLTFExporter();
          console.log("EXPORTING GLTF", window.usdRoot);
          exporter.parse(
            window.usdRoot,
            function (gltf) {
              const blob = new Blob([gltf], {
                type: "application/octet-stream",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              let filename = currentDisplayFilename;
              // strip extension, strip path
              filename =
                filename.split("/").pop()?.split(".")[0].split("?")[0] ||
                "export";
              a.download = filename + ".glb";
              a.click();
              URL.revokeObjectURL(url);
            },
            function (error) {
              console.error(error);
            },
            {
              binary: true,
              // not possible right now since USD controls animation bindings,
              // it's not a three.js clip
              animations: [
                // window.usdRoot.animations[0]
              ],
            }
          );
          evt.preventDefault();
        });

      function getAllLoadedFiles() {
        const filePaths = [];

        getAllLoadedFilePaths("/", filePaths);

        return filePaths;
      }

      function getAllLoadedFilePaths(currentPath, paths) {
        const files = USD.FS_readdir(currentPath);
        for (const file of files) {
          // skip self and parent
          if (file === "." || file === "..") continue;
          const newPath = currentPath + file + "/";
          const data = USD.FS_analyzePath(currentPath + file + "/");
          if (data.object.node_ops.readdir) {
            // default directories we're not interested in
            if (
              newPath == "/dev/" ||
              newPath == "/proc/" ||
              newPath == "/home/" ||
              newPath == "/tmp/" ||
              newPath == "/usd/"
            )
              continue;
            getAllLoadedFilePaths(newPath, paths);
          } else {
            paths.push(data.path);
          }
        }
      }

      function clearStage() {
        if (!USD) {
          console.warn("USD not ready; skipping clearStage.");
          return;
        }
        // Try to dispose the driver/stage first to avoid any layer save attempts
        try {
          if (window.driver && typeof window.driver.Dispose === "function") {
            window.driver.Dispose();
          } else if (
            window.driver &&
            typeof window.driver.Destroy === "function"
          ) {
            window.driver.Destroy();
          }
        } catch {}
        // Clear the rendered scene graph before touching the virtual FS
        try {
          if (window.usdRoot && typeof window.usdRoot.clear === "function") {
            window.usdRoot.clear();
          }
        } catch {}

        // Then unlink files from the in-memory FS, but keep .usdz packages to
        // avoid triggering writes to packaged layers
        var allFilePaths = getAllLoadedFiles();
        for (const file of allFilePaths) {
          const lower = String(file).toLowerCase();
          if (lower.endsWith(".usdz")) {
            continue;
          }
          USD.FS_unlink(file, true);
        }
      }

      function addPath(root, path) {
        const files = USD.FS_readdir(path);
        for (const file of files) {
          // skip self and parent
          if (file === "." || file === "..") continue;
          const newPath = path + file + "/";
          const data = USD.FS_analyzePath(path + file + "/");
          if (data.object.node_ops.readdir) {
            // default directories we're not interested in
            if (
              newPath == "/dev/" ||
              newPath == "/proc/" ||
              newPath == "/home/" ||
              newPath == "/tmp/" ||
              newPath == "/usd/"
            )
              continue;
            root[file] = {};
            addPath(root[file], newPath);
          } else {
            root[file] = data;
          }
        }
      }

      async function loadUsdFile(directory, filename, path, isRootFile = true) {
        currentDisplayFilename = filename;
        if (debugFileHandling)
          console.warn("loading " + path, isRootFile, directory, filename);
        ready = false;

        // should be loaded last
        if (!isRootFile) return;

        let driver = null;
        const delegateConfig = {
          usdRoot: window.usdRoot,
          paths: [],
          driver: () => driver,
        };

        const renderInterface = (window.renderInterface =
          new ThreeRenderDelegateInterface(delegateConfig));
        driver = new USD.HdWebSyncDriver(renderInterface, path);
        if (driver instanceof Promise) {
          driver = await driver;
        }
        window.driver = driver;
        window.driver.Draw();

        let stage = window.driver.GetStage();
        if (stage instanceof Promise) {
          stage = await stage;
          stage = window.driver.GetStage();
        }
        window.usdStage = stage;
        if (stage.GetEndTimeCode) {
          endTimeCode = stage.GetEndTimeCode();
          timeout = 1000 / stage.GetTimeCodesPerSecond();
        }

        // if up axis is z, rotate, otherwise make sure rotation is 0, in case we rotated in the past and need to undo it
        window.usdRoot.rotation.x =
          String.fromCharCode(stage.GetUpAxis()) === "z" ? -Math.PI / 2 : 0;

        fitCameraToSelection(window.camera, window._controls, [window.usdRoot]);
        ready = true;

        const root = {};
        addPath(root, "/");
      }

      // from https://discourse.threejs.org/t/camera-zoom-to-fit-object/936/24
      function fitCameraToSelection(
        camera,
        controls,
        selection,
        fitOffset = 1.5
      ) {
        const size = new Vector3();
        const center = new Vector3();
        const box = new Box3();

        box.makeEmpty();
        for (const object of selection) {
          box.expandByObject(object);
        }

        box.getSize(size);
        box.getCenter(center);

        if (
          Number.isNaN(size.x) ||
          Number.isNaN(size.y) ||
          Number.isNaN(size.z) ||
          Number.isNaN(center.x) ||
          Number.isNaN(center.y) ||
          Number.isNaN(center.z)
        ) {
          console.warn(
            "Fit Camera failed: NaN values found, some objects may not have any mesh data.",
            selection,
            size
          );
          if (controls) controls.update();
          return;
        }

        if (!controls) {
          console.warn(
            "No camera controls object found, something went wrong."
          );
          return;
        }

        const maxSize = Math.max(size.x, size.y, size.z);
        const fitHeightDistance =
          maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance =
          fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

        if (distance == 0) {
          console.warn(
            "Fit Camera failed: distance is 0, some objects may not have any mesh data."
          );
          return;
        }

        camera.position.z = 7;
        camera.position.y = 7;
        camera.position.x = 0;

        const direction = controls.target
          .clone()
          .sub(camera.position)
          .normalize()
          .multiplyScalar(distance);

        controls.maxDistance = distance * 10;
        controls.target.copy(center);

        camera.near = distance / 100;
        camera.far = distance * 100;

        camera.updateProjectionMatrix();

        camera.position.copy(controls.target).sub(direction);
        controls.update();
      }

      async function setup() {
        const camera = (window.camera = new PerspectiveCamera(
          27,
          window.innerWidth / window.innerHeight,
          1,
          3500
        ));
        camera.position.z = 7;
        camera.position.y = 7;
        camera.position.x = 0;

        const scene = (window.scene = new Scene());

        const usdRoot = (window.usdRoot = new Group());
        usdRoot.name = "USD Root";
        scene.add(usdRoot);

        const renderer = (window.renderer = new WebGLRenderer({
          antialias: true,
          alpha: true,
        }));
        renderer.setPixelRatio(window.devicePixelRatio);
        // Size the renderer to the window like MuJoCo does
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputColorSpace = SRGBColorSpace;
        // renderer.toneMapping = AgXToneMapping;
        // renderer.toneMappingExposure = 1;
        renderer.toneMapping = NeutralToneMapping;
        renderer.shadowMap.enabled = false;
        renderer.shadowMap.type = VSMShadowMap;
        renderer.setClearColor(0x000000, 0); // the default

        const envMapPromise = new Promise((resolve) => {
          const pmremGenerator = new PMREMGenerator(renderer);
          pmremGenerator.compileCubemapShader();

          new RGBELoader().load(
            options.hdrPath,
            (texture) => {
              const hdrRenderTarget =
                pmremGenerator.fromEquirectangular(texture);

              texture.mapping = EquirectangularReflectionMapping;
              texture.needsUpdate = true;
              scene.environment = hdrRenderTarget.texture;
              resolve();
            },
            undefined,
            (err) => {
              console.error(
                "An error occurred loading the HDR environment map.",
                err
              );
              resolve();
            }
          );
        });

        options.container.appendChild(renderer.domElement);
        const controls = (window._controls = new OrbitControls(
          camera,
          renderer.domElement
        ));
        controls.enableDamping = true;
        controls.dampingFactor = 0.2;
        controls.update();

        window.addEventListener("resize", onWindowResize);

        // Host manages drag and drop, so we don't add event listeners here

        // React/host will call programmatic API to load files instead of DOM scanning.

        render();

        return envMapPromise;
      }

      // Optional: pause helper removed to avoid global DOM coupling

      async function animate() {
        window._controls.update();
        let secs = new Date().getTime() / 1000;
        await new Promise((resolve) => setTimeout(resolve, 10));
        const time = (secs * (1000 / timeout)) % endTimeCode;
        if (
          window.driver &&
          window.driver.SetTime &&
          window.driver.Draw &&
          ready
        ) {
          window.driver.SetTime(time);
          window.driver.Draw();
          render();
        }
        requestAnimationFrame(animate.bind(null, timeout, endTimeCode));
      }

      function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }

      function render() {
        // const time = Date.now() * 0.001;
        if (window.renderer.render && window.scene) {
          window.renderer.render(window.scene, window.camera);
        }
      }

      async function loadFile(
        fileOrHandle,
        isRootFile = true,
        fullPath = undefined
      ) {
        let file = undefined;
        try {
          if (fileOrHandle.getFile !== undefined) {
            file = await fileOrHandle.getFile();
          } else file = fileOrHandle;

          var reader = new FileReader();
          const loadingPromise = new Promise((resolve, reject) => {
            reader.onloadend = resolve;
            reader.onerror = reject;
          });
          reader.onload = async function (event) {
            // Ensure USD module is initialized before filesystem operations
            if (!USD) await usdReady;
            let fileName = file.name;
            let directory = "/";
            if (fullPath !== undefined) {
              fileName = fullPath.split("/").pop();
              directory = fullPath.substring(
                0,
                fullPath.length - fileName.length
              );
              if (debugFileHandling)
                console.warn("directory", directory, "fileName", fileName);
            }
            USD.FS_createPath("", directory, true, true);
            // Mount file as read-only to prevent USD from attempting write-backs to packages
            USD.FS_createDataFile(
              directory,
              fileName,
              new Uint8Array(event.target.result),
              true /* canRead */,
              false /* canWrite */,
              true /* canOwn */
            );

            loadUsdFile(directory, fileName, fullPath, isRootFile);
          };
          reader.readAsArrayBuffer(file);
          await loadingPromise;
        } catch (ex) {
          console.warn("Error loading file", fileOrHandle, ex);
        }
      }

      function testAndLoadFile(file) {
        let ext = file.name.split(".").pop();
        if (debugFileHandling)
          console.log(file.name + ", " + file.size + ", " + ext);
        if (ext == "usd" || ext == "usdz" || ext == "usda" || ext == "usdc") {
          clearStage();
          loadFile(file);
        }
      }

      /**
       * @param {FileSystemDirectoryEntry} directory
       */
      async function readDirectory(directory) {
        let entries = [];

        let getAllDirectoryEntries = async (dirReader) => {
          let entries = [];
          let readEntries = async () => {
            let result = await new Promise((resolve, reject) =>
              dirReader.readEntries(resolve, reject)
            );
            if (result.length === 0) return entries;
            else return entries.concat(result, await readEntries());
          };
          return await readEntries();
        };

        /**
         * @param {FileSystemDirectoryReader} dirReader
         * @param {FileSystemDirectoryEntry} directory
         * @returns {Promise<number>}
         */
        let getEntries = async (directory) => {
          let dirReader = directory.createReader();
          await new Promise(async (resolve) => {
            // Call the reader.readEntries() until no more results are returned.

            const results = await getAllDirectoryEntries(dirReader);

            if (results.length) {
              // entries = entries.concat(results);
              for (let entry of results) {
                if (entry.isDirectory) {
                  const foundFiles = await getEntries(entry);
                  if (foundFiles === 100)
                    console.warn(
                      "Found more than 100 files in directory",
                      entry
                    );
                } else {
                  entries.push(entry);
                }
              }
            }
            resolve(results.length);
          });
        };

        await getEntries(directory);
        return entries;
      }

      /**
       * @param {FileSystemEntry[]} entries
       */
      async function handleFilesystemEntries(entries) {
        /** @type {FileSystemEntry[]} */
        const allFiles = [];
        const fileIgnoreList = [".gitignore", "README.md", ".DS_Store"];
        const dirIgnoreList = [".git", "node_modules"];

        for (let entry of entries) {
          if (debugFileHandling) console.log("file entry", entry);
          if (entry.isFile) {
            if (debugFileHandling) console.log("single file", entry);
            if (fileIgnoreList.includes(entry.name)) {
              continue;
            }
            allFiles.push(entry);
          } else if (entry.isDirectory) {
            if (dirIgnoreList.includes(entry.name)) {
              continue;
            }
            const files = await readDirectory(entry);
            if (debugFileHandling) console.log("all files", files);
            for (const file of files) {
              if (fileIgnoreList.includes(file.name)) {
                continue;
              }
              allFiles.push(file);
            }
          }
        }

        // clear current set of files
        clearStage();

        // determine which of these is likely the root file
        let rootFileCandidates = [];
        let usdaCandidates = [];

        // sort so shorter paths come first
        allFiles.sort((a, b) => {
          const diff =
            a.fullPath.split("/").length - b.fullPath.split("/").length;
          if (diff !== 0) return diff;
          return a.fullPath.localeCompare(b.fullPath);
        });

        // console.log("path candidates", allFiles);

        for (const file of allFiles) {
          if (debugFileHandling) console.log(file);
          // fullPath should only contain one slash, and should contain a valid USD extension
          let ext = file.name.split(".").pop();
          if (ext == "usd" || ext == "usdz" || ext == "usda" || ext == "usdc") {
            rootFileCandidates.push(file);
          }
          if (ext == "usda") {
            usdaCandidates.push(file);
          }
        }

        let rootFile = undefined;

        // if there's multiple, use the first usda
        if (rootFileCandidates.length > 1) {
          if (usdaCandidates.length > 0) {
            rootFile = usdaCandidates[0];
          } else {
            rootFile = rootFileCandidates[0];
          }
        } else {
          // find the first usda file
          for (const file of allFiles) {
            let ext = file.name.split(".").pop();
            if (
              ext == "usda" ||
              ext == "usdc" ||
              ext == "usdz" ||
              ext == "usd"
            ) {
              rootFile = file;
              break;
            }
          }
        }

        if (!rootFile && allFiles.length > 0) {
          // use first file
          rootFile = allFiles[0];
        }

        // TODO if there are still multiple candidates we should ask the user which one to use
        console.log("Assuming this is the root file: " + rootFile?.name); // + ". Total: " + allFiles.length, allFiles.map(f => f.fullPath).join('\n'));

        // remove the root file from the list of all files, we load it last
        if (rootFile) {
          allFiles.splice(allFiles.indexOf(rootFile), 1);
        }

        async function getFile(fileEntry) {
          try {
            return new Promise((resolve, reject) =>
              fileEntry.file(resolve, reject)
            );
          } catch (err) {
            console.log(err);
          }
        }

        // Sort so that USD files come last and all references are already there.
        // As long as the root file is the last one this actually shouldn't matter
        allFiles.sort((a, b) => {
          let extA = a.name.split(".").pop();
          let extB = b.name.split(".").pop();
          if (
            extA == "usd" ||
            extA == "usdz" ||
            extA == "usda" ||
            extA == "usdc"
          )
            return 1;
          if (
            extB == "usd" ||
            extB == "usdz" ||
            extB == "usda" ||
            extB == "usdc"
          )
            return -1;
          return 0;
        });

        console.log("All files", allFiles);

        // load all files into memory
        for (const file of allFiles) {
          if (debugFileHandling) console.log("loading file ", file);
          await loadFile(await getFile(file), false, file.fullPath);
        }

        // THEN load the root file if it's a supported format

        if (rootFile) {
          const isSupportedFormat = ["usd", "usdz", "usda", "usdc"].includes(
            rootFile.name.split(".").pop()
          );
          if (!isSupportedFormat)
            console.error("Not a supported file format: ", rootFile.name);
          else loadFile(await getFile(rootFile), true, rootFile.fullPath);
        }
      }

      /**
       * @param {DataTransfer} dataTransfer
       */
      function processDataTransfer(dataTransfer) {
        if (debugFileHandling)
          console.log(
            "Processing DataTransfer",
            dataTransfer.items,
            dataTransfer.files
          );

        if (dataTransfer.items) {
          /** @type {FileSystemEntry[]} */
          const allEntries = [];

          let haveGetAsEntry = false;
          if (dataTransfer.items.length > 0)
            haveGetAsEntry =
              "getAsEntry" in dataTransfer.items[0] ||
              "webkitGetAsEntry" in dataTransfer.items[0];

          if (haveGetAsEntry) {
            for (var i = 0; i < dataTransfer.items.length; i++) {
              let item = dataTransfer.items[i];
              /** @type {FileSystemEntry} */
              let entry =
                "getAsEntry" in item
                  ? item.getAsEntry()
                  : item.webkitGetAsEntry();
              allEntries.push(entry);
            }
            handleFilesystemEntries(allEntries);
            return;
          }

          for (var i = 0; i < dataTransfer.items.length; i++) {
            let item = dataTransfer.items[i];

            // API when there's no "getAsEntry" support
            console.log(item.kind, item);
            if (item.kind === "file") {
              var file = item.getAsFile();
              testAndLoadFile(file);
            }
            // could also be a directory
            else if (item.kind === "directory") {
              var dirReader = item.createReader();
              dirReader.readEntries(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                  console.log(entries[i].name);
                  var entry = entries[i];
                  if (entry.isFile) {
                    entry.file(function (file) {
                      testAndLoadFile(file);
                    });
                  }
                }
              });
            }
          }
        } else {
          for (var i = 0; i < dataTransfer.files.length; i++) {
            let file = dataTransfer.files[i];
            testAndLoadFile(file);
          }
        }
      }

      // Provide a minimal imperative API to the host (capturing the local scope)
      handle = {
        // Load a USD file from a URL
        loadFromURL: async (url) => {
          try {
            filename = url;
            if (!USD) await usdReady;
            clearStage();
            const parts = url.split("/");
            const fileNameOnly = parts[parts.length - 1];
            const ext = (fileNameOnly.split(".").pop() || "").toLowerCase();
            // For packaged usdz, mount read-only to avoid write attempts
            if (ext === "usdz") {
              const res = await fetch(url, { cache: "no-store" });
              if (!res.ok) throw new Error("Failed to fetch " + url);
              const buffer = await res.arrayBuffer();
              const mountDir = "/host/";
              USD.FS_createPath("", mountDir, true, true);
              // If a previous package exists at the same path, remove it now that the stage is cleared
              try {
                const existing = USD.FS_analyzePath(mountDir + fileNameOnly);
                if (existing && existing.exists) {
                  USD.FS_unlink(mountDir + fileNameOnly);
                }
              } catch {}
              USD.FS_createDataFile(
                mountDir,
                fileNameOnly,
                new Uint8Array(buffer),
                true /* canRead */,
                false /* canWrite */,
                true /* canOwn */
              );
              await loadUsdFile(
                mountDir,
                fileNameOnly,
                mountDir + fileNameOnly,
                true
              );
            } else {
              // For usd/usda/usdc, keep URL so relative asset paths resolve via HTTP
              try {
                const base = new URL(url, window.location.origin);
                // ensure base URL ends with '/'
                const baseDir = base.href.substring(
                  0,
                  base.href.lastIndexOf("/") + 1
                );
                window.__usdAssetBase = baseDir;
                installFetchRewrite();
              } catch {}
              await loadUsdFile(undefined, fileNameOnly, url, true);
            }
          } catch (e) {
            console.warn("loadFromURL error", e);
          }
        },
        // Load from array buffer entries mounted into the in-memory FS
        loadFromEntries: async (entries, primaryPath) => {
          try {
            if (!USD) await usdReady;
            clearStage();
            // Mount all entries first
            const sorted = (entries || []).slice().sort((a, b) => {
              const aExt = (a.path.split(".").pop() || "").toLowerCase();
              const bExt = (b.path.split(".").pop() || "").toLowerCase();
              const aIsUsd = ["usd", "usdc", "usda", "usdz"].includes(aExt);
              const bIsUsd = ["usd", "usdc", "usda", "usdz"].includes(bExt);
              return aIsUsd === bIsUsd ? 0 : aIsUsd ? 1 : -1;
            });
            for (const { path, buffer } of sorted) {
              const fileName = path.split("/").pop();
              const dir =
                path.slice(0, path.length - (fileName?.length || 0)) || "/";
              USD.FS_createPath("", dir, true, true);
              USD.FS_createDataFile(
                dir,
                fileName,
                new Uint8Array(buffer),
                true /* canRead */,
                false /* canWrite */,
                true /* canOwn */
              );
            }
            // Determine root
            let root = primaryPath;
            if (!root) {
              for (const e of sorted) {
                const ext = (e.path.split(".").pop() || "").toLowerCase();
                if (["usda", "usdc", "usdz", "usd"].includes(ext)) {
                  root = e.path;
                  break;
                }
              }
            }
            if (root) {
              const fileNameOnly = root.split("/").pop();
              const dir =
                root.slice(0, root.length - (fileNameOnly?.length || 0)) || "/";
              await loadUsdFile(dir, fileNameOnly, root, true);
            }
          } catch (e) {
            console.warn("loadFromEntries error", e);
          }
        },
        // Load from a DataTransfer (e.g., from a drag/drop event)
        loadFromDataTransfer: async (dataTransfer) => {
          try {
            if (!USD) await usdReady;
            processDataTransfer(dataTransfer);
          } catch (e) {
            console.warn("loadFromDataTransfer error", e);
          }
        },
        // Load directly from a FileList or array of File
        loadFromFiles: async (files) => {
          try {
            if (!USD) await usdReady;
            clearStage();
            const fileArray = Array.from(files);
            for (const file of fileArray) testAndLoadFile(file);
          } catch (e) {
            console.warn("loadFromFiles error", e);
          }
        },
        // Load from a map of virtual paths -> File, with an optional primary root file path
        loadFromFilesMap: async (filesMap, primaryPath) => {
          try {
            if (!USD) await usdReady;
            clearStage();
            const entries = Object.entries(filesMap).filter(([p]) => {
              // Ignore OS junk files
              const base = p.split("/").pop() || p;
              return base !== ".DS_Store" && !base.startsWith("._");
            });
            // Load all non-root files first
            for (const [fullPath, file] of entries) {
              if (primaryPath && fullPath === primaryPath) continue;
              await loadFile(file, false, fullPath);
            }
            // Then load the primary/root if provided, else try to detect
            if (primaryPath && filesMap[primaryPath]) {
              await loadFile(filesMap[primaryPath], true, primaryPath);
              return;
            }
            // Detect a reasonable root (prefer .usda)
            const sorted = entries
              .map(([p, f]) => [p, f])
              .sort((a, b) => a[0].split("/").length - b[0].split("/").length);
            let root = undefined;
            for (const [p, f] of sorted) {
              const ext = p.split(".").pop();
              if (["usda", "usdc", "usdz", "usd"].includes(ext)) {
                root = [p, f];
                if (ext === "usda") break;
              }
            }
            if (root) {
              await loadFile(root[1], true, root[0]);
            }
          } catch (e) {
            console.warn("loadFromFilesMap error", e);
          }
        },
        // Clear the current stage
        clear: () => {
          try {
            clearStage();
          } catch (e) {
            console.warn("clear error", e);
          }
        },
        // Dispose the viewer and remove listeners/canvas
        dispose: () => {
          try {
            window.removeEventListener("resize", onWindowResize);
            if (window.renderer && window.renderer.domElement) {
              if (options.container.contains(window.renderer.domElement)) {
                options.container.removeChild(window.renderer.domElement);
              }
              if (window.renderer.dispose) window.renderer.dispose();
            }
          } catch (e) {
            console.warn("dispose error", e);
          }
        },
      };
    };

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          run();
          try {
            if (resolveInit) resolveInit(handle);
          } catch {}
        },
        { once: true }
      );
    } else {
      run();
      try {
        if (resolveInit) resolveInit(handle);
      } catch {}
    }
  });
}

// Auto-initialize when loaded as a module
let handle = null;

// Create container dynamically like MuJoCo does
const container = document.createElement("div");
document.body.appendChild(container);

function post(type, payload = {}) {
  try {
    parent.postMessage({ type, ...payload }, "*");
  } catch {}
}

async function bootstrap() {
  try {
    handle = await init({
      container,
      hdrPath: "/usd-viewer/environments/neutral.hdr",
    });
  } catch (e) {
    console.warn("[USD Iframe] init error", e);
  } finally {
    post("IFRAME_READY");
  }
}

// helper to load entries [{ path, buffer(ArrayBuffer) }, ...]
async function loadFromEntries(entries, primaryPath) {
  try {
    if (!handle) return;
    // Route through handle method if available
    if (handle.loadFromEntries) {
      await handle.loadFromEntries(entries, primaryPath);
      return;
    }
    // Fallback: emulate via DataFiles and then load root
    const USD = window.USD; // usd_index.js attaches the module to window indirectly when initialized
    if (!USD) return;
    // Mount all non-root entries
    if (entries && entries.length) {
      const sorted = entries.slice().sort((a, b) => {
        const aIsUsd = /\.(usd|usdc|usda|usdz)$/i.test(a.path);
        const bIsUsd = /\.(usd|usdc|usda|usdz)$/i.test(b.path);
        return aIsUsd === bIsUsd ? 0 : aIsUsd ? 1 : -1;
      });
      for (const { path, buffer } of sorted) {
        const fileName = path.split("/").pop();
        const dir = path.slice(0, path.length - (fileName?.length || 0)) || "/";
        USD.FS_createPath("", dir, true, true);
        USD.FS_createDataFile(
          dir,
          fileName,
          new Uint8Array(buffer),
          true,
          false,
          true
        );
      }
      // determine root
      let root = primaryPath;
      if (!root) {
        for (const { path } of sorted) {
          if (/\.(usdz|usda|usdc|usd)$/i.test(path)) {
            root = path;
            break;
          }
        }
      }
      if (root && handle.loadFromURL) {
        await handle.loadFromURL(root);
      }
    }
  } catch (e) {
    console.warn("[USD Iframe] loadFromEntries error", e);
  }
}

window.addEventListener("message", async (evt) => {
  const data = evt.data;
  if (!data || typeof data !== "object") return;
  try {
    switch (data.type) {
      case "USD_LOAD_URL":
        post("USD_LOADING_START");
        await handle?.loadFromURL?.(data.url);
        post("USD_LOADED");
        break;
      case "USD_CLEAR":
        await handle?.clear?.();
        break;
      case "USD_LOAD_ENTRIES":
        post("USD_LOADING_START");
        await loadFromEntries(data.entries || [], data.primaryPath);
        post("USD_LOADED");
        break;
      default:
        break;
    }
  } catch (e) {
    console.warn("[USD Iframe] message error", e);
  }
});

bootstrap();
