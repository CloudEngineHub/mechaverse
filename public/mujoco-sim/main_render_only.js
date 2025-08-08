import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  downloadExampleScenesFolder,
  loadSceneFromURL,
  getPosition,
  getQuaternion,
} from "./mujocoUtils_render_only.js";
import { JointDragManager } from "./utils/JointDragManager.js";
import load_mujoco from "./wasm/mujoco_wasm.js";

// Load the MuJoCo Module
const mujoco = await load_mujoco();

// Set up Emscripten's Virtual File System
var initialScene = "humanoid.xml";
mujoco.FS.mkdir("/working");
mujoco.FS.mount(mujoco.MEMFS, { root: "." }, "/working");
mujoco.FS.writeFile(
  "/working/" + initialScene,
  await (await fetch("./examples/" + initialScene)).text()
);

export class MuJoCoViewer {
  constructor() {
    this.mujoco = mujoco;
    // Load in the state from XML
    this.model = new mujoco.Model("/working/" + initialScene);
    this.state = new mujoco.State(this.model);
    this.simulation = new mujoco.Simulation(this.model, this.state);

    // Define parameters (simplified for render-only)
    this.params = {
      scene: initialScene,
      help: false,
      keyframeNumber: 0,
    };
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
    this.camera.position.set(2.0, 1.7, 1.7);
    this.scene.add(this.camera);

    this.scene.background = new THREE.Color(0xfef4da);
    this.scene.fog = new THREE.Fog(this.scene.background, 15, 25.5);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.ambientLight.name = "AmbientLight";
    this.scene.add(this.ambientLight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
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

    // Initialize joint drag manager (will be set up after simulation is created)
    this.jointDragManager = null;
  }

  async init() {
    try {
      // Download the examples to MuJoCo's virtual file system
      await downloadExampleScenesFolder(mujoco);
      await downloadMjcfExamplesFolder(mujoco);

      // Initialize the three.js Scene using the .xml Model in initialScene
      [this.model, this.state, this.simulation, this.bodies, this.lights] =
        await loadSceneFromURL(mujoco, initialScene, this);

      this.scene.background = new THREE.Color(0xfef4da);

      // Change the color and material properties of the mesh floor after loading the scene
      // Find the MuJoCo Root group
      const mujocoRoot = this.scene.getObjectByName("MuJoCo Root");

      if (mujocoRoot) {
        let meshCount = 0;
        let floorModified = false;

        mujocoRoot.traverse((obj) => {
          if (obj.isMesh) {
            meshCount++;

            // Check for Reflector (custom floor) or PlaneGeometry (fallback)
            if (
              obj.geometry?.type === "PlaneGeometry" ||
              obj.constructor.name === "Reflector"
            ) {
              if (obj.material && obj.material.color) {
                obj.material.color.set(0xdddddd); // Set to light gray
                obj.material.map = null; // Remove checkerboard texture
                obj.material.reflectivity = 0; // Matte
                obj.material.metalness = 0; // Matte
                obj.material.needsUpdate = true;
                floorModified = true;
              }
            }
          }
        });
      }

      // Initialize joint drag manager after simulation is set up
      this.jointDragManager = new JointDragManager(
        this.scene,
        this.renderer,
        this.camera,
        this.container,
        this.controls,
        this.simulation
      );
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

  render(timeMS) {
    this.controls.update();

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

let viewer = new MuJoCoViewer();
await viewer.init();
// Signal readiness to the parent so it can send initial scene messages safely
window.parent.postMessage({ type: "IFRAME_READY" }, "*");

// Set up message handling for parent-iframe communication
window.addEventListener("message", async (event) => {
  // Received message from parent

  try {
    switch (event.data.type) {
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

      case "LOAD_PUBLIC_SCENE":
        // Load MJCF from public/mjcf
        removeAllMujocoRoots(viewer);
        await ensureMjcfInVFS(mujoco, event.data.path);
        [
          viewer.model,
          viewer.state,
          viewer.simulation,
          viewer.bodies,
          viewer.lights,
        ] = await loadSceneFromURL(mujoco, event.data.path, viewer);

        if (viewer.jointDragManager) {
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

// Prefetch and mount files from public/mjcf into the VFS so relative asset paths work
async function downloadMjcfExamplesFolder(mujoco) {
  const files = [
    // humanoid
    "humanoid/humanoid.xml",
    // cassie
    "cassie/assets/achilles-rod.obj",
    "cassie/assets/cassie-texture.png",
    "cassie/assets/foot-crank.obj",
    "cassie/assets/foot.obj",
    "cassie/assets/heel-spring.obj",
    "cassie/assets/hip-pitch.obj",
    "cassie/assets/hip-roll.obj",
    "cassie/assets/hip-yaw.obj",
    "cassie/assets/knee-spring.obj",
    "cassie/assets/knee.obj",
    "cassie/assets/pelvis.obj",
    "cassie/assets/plantar-rod.obj",
    "cassie/assets/shin.obj",
    "cassie/assets/tarsus.obj",
    "cassie/cassie.xml",
    "cassie/scene.xml",
    // shadow hand
    "shadow_hand/assets/f_distal_pst.obj",
    "shadow_hand/assets/f_knuckle.obj",
    "shadow_hand/assets/f_middle.obj",
    "shadow_hand/assets/f_proximal.obj",
    "shadow_hand/assets/forearm_0.obj",
    "shadow_hand/assets/forearm_1.obj",
    "shadow_hand/assets/forearm_collision.obj",
    "shadow_hand/assets/lf_metacarpal.obj",
    "shadow_hand/assets/mounting_plate.obj",
    "shadow_hand/assets/palm.obj",
    "shadow_hand/assets/th_distal_pst.obj",
    "shadow_hand/assets/th_middle.obj",
    "shadow_hand/assets/th_proximal.obj",
    "shadow_hand/assets/wrist.obj",
    "shadow_hand/left_hand.xml",
    "shadow_hand/right_hand.xml",
    "shadow_hand/scene_left.xml",
    "shadow_hand/scene_right.xml",
  ];

  const requests = files.map((p) => fetch("../mjcf/" + p));
  const responses = await Promise.all(requests);
  for (let i = 0; i < responses.length; i++) {
    const path = files[i];
    const parts = path.split("/");
    let dir = "/working/";
    for (let j = 0; j < parts.length - 1; j++) {
      dir += parts[j];
      if (!mujoco.FS.analyzePath(dir).exists) mujoco.FS.mkdir(dir);
      dir += "/";
    }
    if (path.endsWith(".png") || path.endsWith(".obj")) {
      mujoco.FS.writeFile(
        "/working/" + path,
        new Uint8Array(await responses[i].arrayBuffer())
      );
    } else {
      mujoco.FS.writeFile("/working/" + path, await responses[i].text());
    }
  }
}

// Ensure a specific public MJCF path is present in VFS (idempotent)
async function ensureMjcfInVFS(mujoco, path) {
  const full = "/working/" + path;
  if (mujoco.FS.analyzePath(full).exists) return;
  // Download the whole folder for reliability
  await downloadMjcfExamplesFolder(mujoco);
}

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
