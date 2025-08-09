import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  loadSceneFromURL,
  getPosition,
  getQuaternion,
  ensureMjcfPathWithDependencies,
} from "./mujocoUtils.js";
import { JointDragManager } from "./utils/JointDragManager.js";
import load_mujoco from "./wasm/mujoco_wasm.js";

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System (no prefetch)
mujoco.FS.mkdir("/working");
mujoco.FS.mount(mujoco.MEMFS, { root: "." }, "/working");

export class MujocoViewer {
  constructor() {
    this.mujoco = mujoco;
    // Defer model/state/simulation until a scene is provided
    this.model = null;
    this.state = null;
    this.simulation = null;

    // Define parameters (simplified for render-only)
    this.params = { scene: null, help: false, keyframeNumber: 0 };
    this.bodies = {};
    this.lights = {};
    this.tmpVec = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.updateGUICallbacks = [];

    this.container = document.createElement("div");
    document.body.appendChild(this.container);

    this.scene = new THREE.Scene();
    this.scene.name = "scene";

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.001,
      100
    );
    this.camera.name = "PerspectiveCamera";
    this.scene.add(this.camera);

    // Theme defaults; can be overridden by parent messages
    this.theme = {
      sceneBg: "#fef4da",
      floor: "#fcf4dc",
      ambient: "#fcf4dc",
      hemi: "#fcf4dc",
    };
    this.scene.background = new THREE.Color(this.theme.sceneBg);

    // Centralized fill lights
    this._createFillLights();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setAnimationLoop(this.render.bind(this));

    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.panSpeed = 2;
    this.controls.zoomSpeed = 1;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;
    this.setDefaultCamera();

    window.addEventListener("resize", this.onWindowResize.bind(this));

    // Initialize joint drag manager (will be set up after simulation is created)
    this.jointDragManager = null;
  }

  _createFillLights() {
    if (this.ambientLight) this.scene.remove(this.ambientLight);
    if (this.hemiLight) this.scene.remove(this.hemiLight);

    this.ambientLight = new THREE.AmbientLight(
      new THREE.Color(this.theme.ambient),
      0.2
    );
    this.ambientLight.name = "AmbientLight";
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(
      new THREE.Color(this.theme.hemi),
      new THREE.Color(this.theme.hemi),
      0.1
    );
    this.hemiLight.position.set(0, 1, 0);
    this.hemiLight.name = "HemisphereLight";
    this.scene.add(this.hemiLight);
  }

  setDefaultCamera() {
    this.camera.position.set(2.0, 1.7, 1.7);
    this.controls.target.set(0, 0.7, 0);
    this.controls.update();
  }

  _applyFloorTheme() {
    const mujocoRoot = this.scene.getObjectByName("MuJoCo Root");
    if (mujocoRoot) {
      mujocoRoot.traverse((obj) => {
        if (
          obj.isMesh &&
          obj.userData &&
          obj.userData.isFloor &&
          obj.material &&
          obj.material.color
        ) {
          obj.material.color.set(this.theme.floor);
          obj.material.map = null;
          obj.material.reflectivity = 0;
          obj.material.metalness = 0;
          obj.material.needsUpdate = true;
        }
      });
    }
  }

  applyTheme({ sceneBg, floor, ambient, hemi }) {
    this.theme = {
      sceneBg: sceneBg || this.theme.sceneBg,
      floor: floor || this.theme.floor,
      ambient: ambient || this.theme.ambient,
      hemi: hemi || this.theme.hemi,
    };
    this.scene.background = new THREE.Color(this.theme.sceneBg);
    this._createFillLights();
    this._applyFloorTheme();
  }

  async init() {
    try {
      // No-op here; initial scene will be provided by parent via message

      this.scene.background = new THREE.Color(this.theme.sceneBg);

      // Change the color and material properties of the mesh floor after loading the scene
      // Find the MuJoCo Root group
      const mujocoRoot = this.scene.getObjectByName("MuJoCo Root");
      if (mujocoRoot) {
        mujocoRoot.traverse((obj) => {
          if (
            obj.isMesh &&
            obj.userData &&
            obj.userData.isFloor &&
            obj.material &&
            obj.material.color
          ) {
            obj.material.color.set(this.theme.floor);
            obj.material.map = null;
            obj.material.reflectivity = 0;
            obj.material.metalness = 0;
            obj.material.needsUpdate = true;
          }
        });
      }

      // Joint drag manager will be initialized once simulation is created
      this.jointDragManager = null;
    } catch (error) {
      console.error("❌ Error in init() method:", error);
      console.error("Stack trace:", error.stack);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.controls.update();

    if (!this.model || !this.simulation) {
      // Nothing loaded yet; still render background/empty scene
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Update body transforms from current simulation state
    for (let b = 0; b < this.model.nbody; b++) {
      if (this.bodies[b]) {
        getPosition(this.simulation.xpos, b, this.bodies[b].position);
        getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
        this.bodies[b].updateWorldMatrix();
      }
    }

    // Update light transforms.
    for (let l = 0; l < this.model.nlight; l++) {
      if (this.lights[l]) {
        getPosition(this.simulation.light_xpos, l, this.lights[l].position);
        getPosition(this.simulation.light_xdir, l, this.tmpVec);
        this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
      }
    }

    // Update tendon transforms.
    let numWraps = 0;
    if (this.mujocoRoot && this.mujocoRoot.cylinders) {
      let mat = new THREE.Matrix4();
      for (let t = 0; t < this.model.ntendon; t++) {
        let startW = this.simulation.ten_wrapadr[t];
        let r = this.model.tendon_width[t];
        for (
          let w = startW;
          w < startW + this.simulation.ten_wrapnum[t] - 1;
          w++
        ) {
          let tendonStart = getPosition(
            this.simulation.wrap_xpos,
            w,
            new THREE.Vector3()
          );
          let tendonEnd = getPosition(
            this.simulation.wrap_xpos,
            w + 1,
            new THREE.Vector3()
          );
          let tendonAvg = new THREE.Vector3()
            .addVectors(tendonStart, tendonEnd)
            .multiplyScalar(0.5);

          let validStart = tendonStart.length() > 0.01;
          let validEnd = tendonEnd.length() > 0.01;

          if (validStart) {
            this.mujocoRoot.spheres.setMatrixAt(
              numWraps,
              mat.compose(
                tendonStart,
                new THREE.Quaternion(),
                new THREE.Vector3(r, r, r)
              )
            );
          }
          if (validEnd) {
            this.mujocoRoot.spheres.setMatrixAt(
              numWraps + 1,
              mat.compose(
                tendonEnd,
                new THREE.Quaternion(),
                new THREE.Vector3(r, r, r)
              )
            );
          }
          if (validStart && validEnd) {
            mat.compose(
              tendonAvg,
              new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                tendonEnd.clone().sub(tendonStart).normalize()
              ),
              new THREE.Vector3(r, tendonStart.distanceTo(tendonEnd), r)
            );
            this.mujocoRoot.cylinders.setMatrixAt(numWraps, mat);
            numWraps++;
          }
        }
      }
      this.mujocoRoot.cylinders.count = numWraps;
      this.mujocoRoot.spheres.count = numWraps > 0 ? numWraps + 1 : 0;
      this.mujocoRoot.cylinders.instanceMatrix.needsUpdate = true;
      this.mujocoRoot.spheres.instanceMatrix.needsUpdate = true;
    }

    // Render!
    this.renderer.render(this.scene, this.camera);
  }
}

let viewer = new MujocoViewer();
await viewer.init();
// Signal readiness to the parent so it can send initial scene messages safely
window.parent.postMessage({ type: "IFRAME_READY" }, "*");

// Set up message handling for parent-iframe communication
window.addEventListener("message", async (event) => {
  // Received message from parent

  try {
    switch (event.data.type) {
      case "SET_THEME": {
        const { sceneBg, floor, ambient, hemi } = event.data || {};
        if (viewer) {
          viewer.theme = {
            sceneBg: sceneBg || viewer.theme.sceneBg,
            floor: floor || viewer.theme.floor,
            ambient: ambient || viewer.theme.ambient,
            hemi: hemi || viewer.theme.hemi,
          };
          // Apply immediately to scene and lights
          if (viewer.scene) {
            viewer.scene.background = new THREE.Color(viewer.theme.sceneBg);
          }
          if (viewer.ambientLight) {
            viewer.ambientLight.color = new THREE.Color(viewer.theme.ambient);
          }
          if (viewer.hemiLight) {
            viewer.hemiLight.color = new THREE.Color(viewer.theme.hemi);
            viewer.hemiLight.groundColor = new THREE.Color(viewer.theme.hemi);
          }
          const mujocoRoot = viewer.scene.getObjectByName("MuJoCo Root");
          if (mujocoRoot) {
            mujocoRoot.traverse((obj) => {
              if (
                obj.isMesh &&
                obj.userData &&
                obj.userData.isFloor &&
                obj.material &&
                obj.material.color
              ) {
                obj.material.color.set(viewer.theme.floor);
                obj.material.needsUpdate = true;
              }
            });
          }
        }
        break;
      }
      case "RESET_POSE":
        if (viewer?.simulation) {
          viewer.simulation.resetData();
          viewer.simulation.forward();
        }
        break;
      case "LOAD_SCENE":
        // Load requested scene

        // Clear the existing scene
        removeAllMujocoRoots(viewer);

        // Reload the scene with the new XML file
        [
          viewer.model,
          viewer.state,
          viewer.simulation,
          viewer.bodies,
          viewer.lights,
        ] = await loadSceneFromURL(mujoco, event.data.sceneName, viewer);

        // Update joint drag manager with new simulation
        if (viewer.jointDragManager) {
          viewer.jointDragManager.simulation = viewer.simulation;
        }
        // Reliability reset: mimic reset button after load
        viewer.simulation.resetData();
        viewer.simulation.forward();

        // Notify parent that scene was loaded
        window.parent.postMessage(
          {
            type: "SCENE_LOADED",
            sceneName: event.data.sceneName,
          },
          "*"
        );
        break;

      case "LOAD_PUBLIC_SCENE": {
        // Load MJCF from public/mjcf on demand with dependencies
        removeAllMujocoRoots(viewer);
        await ensureMjcfPathWithDependencies(mujoco, event.data.path);
        [
          viewer.model,
          viewer.state,
          viewer.simulation,
          viewer.bodies,
          viewer.lights,
        ] = await loadSceneFromURL(mujoco, event.data.path, viewer);

        if (!viewer.jointDragManager && viewer.simulation) {
          viewer.jointDragManager = new JointDragManager(
            viewer.scene,
            viewer.renderer,
            viewer.camera,
            viewer.container,
            viewer.controls,
            viewer.simulation
          );
        } else if (viewer.jointDragManager) {
          viewer.jointDragManager.simulation = viewer.simulation;
        }
        viewer.simulation.resetData();
        viewer.simulation.forward();

        window.parent.postMessage(
          {
            type: "SCENE_LOADED",
            sceneName: event.data.path,
          },
          "*"
        );
        break;
      }

      case "SET_TRANSPARENT_BACKGROUND": {
        try {
          // Ensure transparent canvas
          viewer.scene.background = null;
          if (viewer.renderer) {
            viewer.renderer.setClearAlpha(0);
            viewer.renderer.setClearColor(0x000000, 0);
            const gl = viewer.renderer.getContext();
            if (gl && gl.canvas && gl.canvas.style) {
              gl.canvas.style.background = "transparent";
            }
          }
          window.parent.postMessage({ type: "BACKGROUND_SET" }, "*");
        } catch (e) {
          window.parent.postMessage({ type: "ERROR", error: String(e) }, "*");
        }
        break;
      }

      case "FIT_ISO": {
        try {
          const root = viewer.scene.getObjectByName("MuJoCo Root");
          if (root) {
            const box = new THREE.Box3().setFromObject(root);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const radius = maxDim * 0.5;

            // Place camera along isometric direction
            const dir = new THREE.Vector3(1, 1, 1).normalize();
            const distance = radius * 2.6; // tuned factor for padding
            const position = center.clone().add(dir.multiplyScalar(distance));

            viewer.camera.position.copy(position);
            if (viewer.controls) {
              viewer.controls.target.copy(center);
              viewer.controls.update();
            } else {
              viewer.camera.lookAt(center);
            }

            // Optional: disable fog for crisp capture
            viewer.scene.fog = null;

            // Render a frame
            viewer.renderer.render(viewer.scene, viewer.camera);
          }
          window.parent.postMessage({ type: "FITTED_ISO" }, "*");
        } catch (e) {
          window.parent.postMessage({ type: "ERROR", error: String(e) }, "*");
        }
        break;
      }

      case "LOAD_XML_CONTENT":
        // Load XML content payload

        // Clear the existing scene
        removeAllMujocoRoots(viewer);

        // Write the XML content to MuJoCo's virtual file system
        mujoco.FS.writeFile(
          "/working/" + event.data.fileName,
          event.data.content
        );

        // Load the scene with the new XML content
        [
          viewer.model,
          viewer.state,
          viewer.simulation,
          viewer.bodies,
          viewer.lights,
        ] = await loadSceneFromURL(mujoco, event.data.fileName, viewer);

        // Update joint drag manager with new simulation
        if (viewer.jointDragManager) {
          viewer.jointDragManager.simulation = viewer.simulation;
        }
        viewer.simulation.resetData();
        viewer.simulation.forward();

        // Notify parent that scene was loaded
        window.parent.postMessage(
          {
            type: "SCENE_LOADED",
            sceneName: event.data.fileName,
          },
          "*"
        );
        break;

      default:
      // Unknown message type
    }
  } catch (error) {
    console.error("❌ Error handling message:", error);

    // Notify parent of error
    window.parent.postMessage(
      {
        type: "ERROR",
        error: error.message,
      },
      "*"
    );
  }
});

// Remove prefetch helpers; we rely on ensureMjcfPathWithDependencies from utils

function removeAllMujocoRoots(viewer) {
  try {
    let root;
    while ((root = viewer.scene.getObjectByName("MuJoCo Root"))) {
      viewer.scene.remove(root);
    }
  } catch (e) {
    console.warn("Failed to clear MuJoCo roots", e);
  }
}
