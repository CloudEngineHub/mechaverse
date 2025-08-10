import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { DragStateManager } from "./utils/DragStateManager.js";
import {
  setupGUI,
  loadSceneFromURL,
  getPosition,
  getQuaternion,
  toMujocoPos,
  standardNormal,
  ensureMjcfPathWithDependencies,
} from "./mujocoUtils.js";
import load_mujoco from "./wasm/mujoco_wasm.js";

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System (no prefetch)
mujoco.FS.mkdir("/working");
mujoco.FS.mount(mujoco.MEMFS, { root: "." }, "/working");

export class MujocoSimulator {
  constructor() {
    this.mujoco = mujoco;
    this.model = null;
    this.state = null;
    this.simulation = null;

    this.params = {
      scene: null,
      paused: false,
      help: false,
      ctrlnoiserate: 0.0,
      ctrlnoisestd: 0.0,
      keyframeNumber: 0,
    };
    this.mujoco_time = 0.0;
    this.bodies = {};
    this.lights = [];
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
    this.camera.position.set(2.0, 1.7, 1.7);
    this.scene.add(this.camera);

    this.scene.background = new THREE.Color(0xeeeeee);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.ambientLight.name = "AmbientLight";
    this.scene.add(this.ambientLight);

    // Uniform hemisphere fill light
    this.hemiLight = new THREE.HemisphereLight(0xe8f0ff, 0xf2e8d0, 0.3);
    this.hemiLight.position.set(0, 1, 0);
    this.hemiLight.name = "HemisphereLight";
    this.scene.add(this.hemiLight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    // Cap device pixel ratio for performance on high-DPI displays
    const MAX_PIXEL_RATIO = 1.5;
    this.renderer.setPixelRatio(
      Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio)
    );
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setAnimationLoop(this.render.bind(this));
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.7, 0);
    this.controls.panSpeed = 2;
    this.controls.zoomSpeed = 1;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.screenSpacePanning = true;
    this.controls.update();

    window.addEventListener("resize", this.onWindowResize.bind(this));

    this.dragStateManager = new DragStateManager(
      this.scene,
      this.renderer,
      this.camera,
      this.container.parentElement,
      this.controls
    );
  }

  async init() {
    try {
      // Defer loading; parent will request a scene

      this.scene.background = new THREE.Color(0xeeeeee);

      const mujocoRoot = this.scene.getObjectByName("MuJoCo Root");
      if (mujocoRoot) {
        mujocoRoot.traverse((obj) => {
          if (obj.isMesh) {
            if (
              obj.geometry?.type === "PlaneGeometry" ||
              obj.constructor.name === "Reflector"
            ) {
              if (obj.material && obj.material.color) {
                obj.material.color.set(0xdddddd);
                obj.material.map = null;
                obj.material.reflectivity = 0;
                obj.material.metalness = 0;
                obj.material.needsUpdate = true;
              }
            }
          }
        });
      }

      // Defer GUI creation until a scene is loaded
    } catch (error) {
      console.error("❌ Error in init() method:", error);
      console.error("Stack trace:", error.stack);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const MAX_PIXEL_RATIO = 1.5;
    this.renderer.setPixelRatio(
      Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio)
    );
  }

  render(timeMS) {
    if (!this.model || !this.simulation) {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.controls.update();

    if (!this.params["paused"]) {
      let timestep = this.model.getOptions().timestep;
      if (timeMS - this.mujoco_time > 35.0) {
        this.mujoco_time = timeMS;
      }
      while (this.mujoco_time < timeMS) {
        if (this.params["ctrlnoisestd"] > 0.0) {
          let rate = Math.exp(
            -timestep / Math.max(1e-10, this.params["ctrlnoiserate"])
          );
          let scale = this.params["ctrlnoisestd"] * Math.sqrt(1 - rate * rate);
          let currentCtrl = this.simulation.ctrl;
          for (let i = 0; i < currentCtrl.length; i++) {
            currentCtrl[i] = rate * currentCtrl[i] + scale * standardNormal();
            this.params["Actuator " + i] = currentCtrl[i];
          }
        }

        for (let i = 0; i < this.simulation.qfrc_applied.length; i++) {
          this.simulation.qfrc_applied[i] = 0.0;
        }
        let dragged = this.dragStateManager.physicsObject;
        if (dragged && dragged.bodyID) {
          for (let b = 0; b < this.model.nbody; b++) {
            if (this.bodies[b]) {
              getPosition(this.simulation.xpos, b, this.bodies[b].position);
              getQuaternion(
                this.simulation.xquat,
                b,
                this.bodies[b].quaternion
              );
              this.bodies[b].updateWorldMatrix();
            }
          }
          let bodyID = dragged.bodyID;
          this.dragStateManager.update();
          let force = toMujocoPos(
            this.dragStateManager.currentWorld
              .clone()
              .sub(this.dragStateManager.worldHit)
              .multiplyScalar(this.model.body_mass[bodyID] * 250)
          );
          let point = toMujocoPos(this.dragStateManager.worldHit.clone());
          this.simulation.applyForce(
            force.x,
            force.y,
            force.z,
            0,
            0,
            0,
            point.x,
            point.y,
            point.z,
            bodyID
          );
        }

        this.simulation.step();
        this.mujoco_time += timestep * 1000.0;
      }
    } else if (this.params["paused"]) {
      this.dragStateManager.update();
      let dragged = this.dragStateManager.physicsObject;
      if (dragged && dragged.bodyID) {
        let b = dragged.bodyID;
        getPosition(this.simulation.xpos, b, this.tmpVec, false);
        getQuaternion(this.simulation.xquat, b, this.tmpQuat, false);

        let offset = toMujocoPos(
          this.dragStateManager.currentWorld
            .clone()
            .sub(this.dragStateManager.worldHit)
            .multiplyScalar(0.3)
        );
        if (this.model.body_mocapid[b] >= 0) {
          let addr = this.model.body_mocapid[b] * 3;
          let pos = this.simulation.mocap_pos;
          pos[addr + 0] += offset.x;
          pos[addr + 1] += offset.y;
          pos[addr + 2] += offset.z;
        } else {
          let root = this.model.body_rootid[b];
          let addr = this.model.jnt_qposadr[this.model.body_jntadr[root]];
          let pos = this.simulation.qpos;
          pos[addr + 0] += offset.x;
          pos[addr + 1] += offset.y;
          pos[addr + 2] += offset.z;
        }
      }

      this.simulation.forward();
    }

    for (let b = 0; b < this.model.nbody; b++) {
      if (this.bodies[b]) {
        getPosition(this.simulation.xpos, b, this.bodies[b].position);
        getQuaternion(this.simulation.xquat, b, this.bodies[b].quaternion);
        this.bodies[b].updateWorldMatrix();
      }
    }

    for (let l = 0; l < this.model.nlight; l++) {
      if (this.lights[l]) {
        getPosition(this.simulation.light_xpos, l, this.lights[l].position);
        getPosition(this.simulation.light_xdir, l, this.tmpVec);
        this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

let demo = new MujocoSimulator();
await demo.init();

// Notify parent when ready (to match render_only)
window.parent.postMessage({ type: "IFRAME_READY" }, "*");

// Handle messages similar to main_viewer.js with load public scene and reset
window.addEventListener("message", async (event) => {
  // Received message from parent (sim)
  try {
    switch (event.data.type) {
      case "RESET_POSE":
        if (demo?.simulation) {
          demo.simulation.resetData();
          demo.simulation.forward();
        }
        break;
      case "LOAD_PUBLIC_SCENE":
        // Load MJCF from public/mjcf on demand with dependencies
        await ensureMjcfPathWithDependencies(mujoco, event.data.path);
        [demo.model, demo.state, demo.simulation, demo.bodies, demo.lights] =
          await loadSceneFromURL(mujoco, event.data.path, demo);
        // Create GUI now that we have a simulation
        if (!demo.gui) {
          demo.gui = new GUI();
          setupGUI(demo);
        }
        demo.simulation.resetData();
        demo.simulation.forward();
        window.parent.postMessage(
          { type: "SCENE_LOADED", sceneName: event.data.path },
          "*"
        );
        break;
      case "LOAD_XML_CONTENT":
        mujoco.FS.writeFile(
          "/working/" + event.data.fileName,
          event.data.content
        );
        [demo.model, demo.state, demo.simulation, demo.bodies, demo.lights] =
          await loadSceneFromURL(mujoco, event.data.fileName, demo);
        demo.simulation.resetData();
        demo.simulation.forward();
        window.parent.postMessage(
          { type: "SCENE_LOADED", sceneName: event.data.fileName },
          "*"
        );
        break;
      default:
      // Unknown message type
    }
  } catch (error) {
    console.error("❌ Error handling message:", error);
    window.parent.postMessage({ type: "ERROR", error: error.message }, "*");
  }
});
