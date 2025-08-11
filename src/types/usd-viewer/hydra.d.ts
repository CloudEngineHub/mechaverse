import type { Object3D, Texture } from "three";
import type { HdWebSyncDriver } from "./bindings";

export class hydraDelegate {}

export type threeJsRenderDelegateConfig = {
  driver: () => HdWebSyncDriver;
  usdRoot: Object3D;
  /** Paths for resolving textures */
  paths?: string[];
  /** @deprecated */
  envMap?: Texture;
};

export class threeJsRenderDelegate extends hydraDelegate {
  constructor(path: string, config: threeJsRenderDelegateConfig);
}
