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
    hdrPath: "usd-viewer/environments/neutral.hdr",
    hostManagedDnd: false,
    hostManagedUrl: true,
  }
) {
  return new Promise((resolveInit) => {
    if (!options || !options.container) {
      throw new Error("init: options.container is required");
    }
    if (!options.hdrPath)
      options.hdrPath = "usd-viewer/environments/neutral.hdr";
    const onStatus =
      typeof options.onStatus === "function" ? options.onStatus : () => {};

    let handle = null;

    const run = () => {
      let scene; // retained for future extensions
      let defaultTexture; // retained for future extensions
      let USD;
      // Resolve when USD module is ready so drop-handling can await it
      let resolveUsdReady;
      const usdReady = new Promise((resolve) => {
        resolveUsdReady = resolve;
      });

      const debugFileHandling = false;

      let params = new URL(document.location).searchParams;

      let filename = params.get("file") || "";
      let currentDisplayFilename = "";

      if (filename) {
        // get filename from URL
        currentDisplayFilename = filename
          .split("/")
          .pop()
          .split("#")[0]
          .split("?")[0];
      }

      function updateUrl() {
        if (options.hostManagedUrl) return; // don't touch URL; host manages state
        // set quick look link (removed DOM dependency)
        let indexOfQuery = filename.indexOf("?");
        let url = filename;
        if (indexOfQuery >= 0) {
          url = url.substring(0, indexOfQuery);
        }

        const currentUrl = new URL(window.location.href);
        // set the file query parameter
        currentUrl.searchParams.set("file", filename);
        window.history.pushState({}, filename, currentUrl);
      }

      onStatus("Initializing...");
      const initPromise = setup();

      console.log("Loading USD Module...");
      onStatus("Loading USD Module – this can take a moment...");
      updateUrl();
      try {
        Promise.all([
          getUsdModule({
            mainScriptUrlOrBlob: "./emHdBindings.js",
            locateFile: (file) => {
              return "/usd-viewer/bindings/" + file;
            },
          }),
          initPromise,
        ]).then(async ([Usd]) => {
          USD = Usd;
          if (resolveUsdReady) resolveUsdReady(USD);
          onStatus("Loading done");
          animate();
          if (filename) {
            console.log("Loading File...");
            onStatus("Loading File " + filename);

            clearStage();
            const urlPath = new URL(document.location).searchParams
              .get("file")
              .split("?")[0];
            loadUsdFile(undefined, filename, urlPath, true);
          }
        });
      } catch (error) {
        if (error.toString().indexOf("SharedArrayBuffer") >= 0) {
          let err =
            "Your current browser doesn't support SharedArrayBuffer which is required for USD.";
          console.log(error, err);
          onStatus(err);
        } else {
          let err =
            "Your current browser doesn't support USD-for-web. Error during initialization: " +
            error;
          console.log(err);
          onStatus(err);
        }
      }

      var currentRootFileName = undefined;
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
        var allFilePaths = getAllLoadedFiles();
        console.log("Clearing stage.", allFilePaths);

        for (const file of allFilePaths) {
          USD.FS_unlink(file, true);
        }

        window.usdRoot.clear();
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
          paths: new Array(),
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
        onStatus("");

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
        console.log("Loading done. Scene: ", window.usdRoot);
        ready = true;

        try {
          console.log("Currently Exposed API", {
            Stage: Object.getPrototypeOf(stage),
            Layer: Object.getPrototypeOf(stage.GetRootLayer()),
            Prim: Object.getPrototypeOf(stage.GetPrimAtPath("/")),
          });
        } catch (e) {
          console.warn(
            "Couldn't log state root layer / root prim",
            e,
            stage,
            Object.getPrototypeOf(stage)
          );
        }

        const root = {};
        addPath(root, "/");
        console.log("File system", root, USD.FS_analyzePath("/"));
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

        camera.position.z = params.get("cameraZ") || 7;
        camera.position.y = params.get("cameraY") || 7;
        camera.position.x = params.get("cameraX") || 0;

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

        console.log("Fitting camera to selection", {
          size,
          center,
          maxSize,
          distance,
          near: camera.near,
          far: camera.far,
        });
      }

      async function setup() {
        const camera = (window.camera = new PerspectiveCamera(
          27,
          window.innerWidth / window.innerHeight,
          1,
          3500
        ));
        camera.position.z = params.get("cameraZ") || 7;
        camera.position.y = params.get("cameraY") || 7;
        camera.position.x = params.get("cameraX") || 0;

        const scene = (window.scene = new Scene());

        const usdRoot = (window.usdRoot = new Group());
        usdRoot.name = "USD Root";
        scene.add(usdRoot);

        const renderer = (window.renderer = new WebGLRenderer({
          antialias: true,
          alpha: true,
        }));
        renderer.setPixelRatio(window.devicePixelRatio);
        // Size the renderer to the container, not the window
        const containerRect = options.container.getBoundingClientRect();
        renderer.setSize(containerRect.width, containerRect.height);
        renderer.outputColorSpace = SRGBColorSpace;
        // renderer.toneMapping = AgXToneMapping;
        // renderer.toneMappingExposure = 1;
        renderer.toneMapping = NeutralToneMapping;
        console.log("tonemapping", renderer.toneMapping);
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
        // Observe container resize as well to keep canvas in sync
        const ro = new ResizeObserver(() => {
          const rect = options.container.getBoundingClientRect();
          camera.aspect = rect.width / rect.height;
          camera.updateProjectionMatrix();
          renderer.setSize(rect.width, rect.height);
        });
        ro.observe(options.container);
        window.__usdResizeObserver = ro;

        if (!options.hostManagedDnd) {
          renderer.domElement.addEventListener("drop", dropHandler);
          renderer.domElement.addEventListener("dragover", dragOverHandler);
        }

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
        const rect = options.container.getBoundingClientRect();
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        renderer.setSize(rect.width, rect.height);
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

      /**
       * @param {DragEvent} ev
       */
      function dropHandler(ev) {
        if (debugFileHandling)
          console.log(
            "File(s) dropped",
            ev.dataTransfer.items,
            ev.dataTransfer.files
          );

        // Prevent default behavior (Prevent file from being opened)
        ev.preventDefault();
        processDataTransfer(ev.dataTransfer);
      }

      function dragOverHandler(ev) {
        ev.preventDefault();
      }

      // Provide a minimal imperative API to the host (capturing the local scope)
      handle = {
        // Load a USD file from a URL
        loadFromURL: async (url) => {
          try {
            filename = url;
            onStatus("Loading File " + url + "...");
            updateUrl();
            if (!USD) await usdReady;
            clearStage();
            const parts = url.split("/");
            const fileNameOnly = parts[parts.length - 1];
            await loadUsdFile(undefined, fileNameOnly, url, true);
          } catch (e) {
            console.warn("loadFromURL error", e);
            onStatus("Error: " + e);
          }
        },
        // Load from a DataTransfer (e.g., from a drag/drop event)
        loadFromDataTransfer: async (dataTransfer) => {
          try {
            if (!USD) await usdReady;
            processDataTransfer(dataTransfer);
          } catch (e) {
            console.warn("loadFromDataTransfer error", e);
            onStatus("Error: " + e);
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
            onStatus("Error: " + e);
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
            onStatus("Loading local USD files...");
            // Load all non-root files first
            for (const [fullPath, file] of entries) {
              if (primaryPath && fullPath === primaryPath) continue;
              await loadFile(file, false, fullPath);
            }
            // Then load the primary/root if provided, else try to detect
            if (primaryPath && filesMap[primaryPath]) {
              onStatus("Loading root USD...");
              await loadFile(filesMap[primaryPath], true, primaryPath);
              onStatus("");
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
              onStatus("Loading root USD...");
              await loadFile(root[1], true, root[0]);
              onStatus("");
            }
          } catch (e) {
            console.warn("loadFromFilesMap error", e);
            onStatus("Error: " + e);
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
            try {
              window.__usdResizeObserver &&
                window.__usdResizeObserver.disconnect &&
                window.__usdResizeObserver.disconnect();
            } catch {}
            if (window.renderer && window.renderer.domElement) {
              window.renderer.domElement.removeEventListener(
                "drop",
                dropHandler
              );
              window.renderer.domElement.removeEventListener(
                "dragover",
                dragOverHandler
              );
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
            resolveInit && resolveInit(handle);
          } catch {}
        },
        { once: true }
      );
    } else {
      run();
      try {
        resolveInit && resolveInit(handle);
      } catch {}
    }
  });
}
