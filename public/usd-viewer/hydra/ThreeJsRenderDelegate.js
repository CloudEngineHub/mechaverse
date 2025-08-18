import { TextureRegistry } from "./TextureRegistry.js";
import {
  HydraMesh,
  HydraCamera,
  HydraLight,
  HydraMaterial,
} from "./HydraPrimitives.js";

const DEBUG_PRIMS = false;

// Used by the driver to create the delegate
export class ThreeRenderDelegateInterface {
  /**
   * @param {import('../../usd-viewer').threeJsRenderDelegateConfig} config
   */
  constructor(config) {
    this.config = config;
    if (DEBUG_PRIMS) console.log("RenderDelegateInterface", config);
    this.registry = new TextureRegistry(config);
    this.materials = {};
    this.meshes = {};
  }

  /**
   * Render Prims. See webRenderDelegate.h and webRenderDelegate.cpp
   * @param {string} typeId // translated from TfToken
   * @param {string} id // SdfPath.GetAsString()
   * @param {*} instancerId
   * @returns
   */
  createRPrim(typeId, id, instancerId) {
    if (DEBUG_PRIMS) console.log("Creating RPrim:", typeId, id, instancerId);
    const mesh = new HydraMesh(id, this);
    // Record instancing information so downstream can distinguish prototypes vs instances
    mesh._isInstance = !!instancerId;
    mesh._instancerId = instancerId;
    this.meshes[id] = mesh;
    // Removed verbose RPrim creation logs
    return mesh;
  }

  createBPrim(typeId, id) {
    if (DEBUG_PRIMS) console.log("Creating BPrim:", typeId, id);
  }

  createSPrim(typeId, id) {
    if (DEBUG_PRIMS) console.log("Creating SPrim:", typeId, id);
    const t = String(typeId || "").toLowerCase();
    if (t === "material") {
      const material = new HydraMaterial(id, this);
      this.materials[id] = material;
      if (this?.config?.debugTransforms) {
        try {
          console.debug(`[USD] SPrim(material) created: id=${id}`);
        } catch {}
      }
      return material;
    }
    // Acknowledge camera and light sprims to prevent hydra warnings
    if (t === "camera") {
      if (this?.config?.debugTransforms) {
        try {
          console.debug(`[USD] SPrim(camera) created: id=${id}`);
        } catch {}
      }
      return new HydraCamera(id, this);
    }
    if (t.includes("light")) {
      if (this?.config?.debugTransforms) {
        try {
          console.debug(`[USD] SPrim(light) created: id=${id}`);
        } catch {}
      }
      return new HydraLight(id, this);
    }
  }

  CommitResources() {
    for (const id in this.meshes) {
      const hydraMesh = this.meshes[id];
      hydraMesh.commit();
    }
  }
}
