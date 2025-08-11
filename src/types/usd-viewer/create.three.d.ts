import type { Object3D } from "three";
import type { HdWebSyncDriver, USD } from "./bindings";

export type HydraFile = File & { path: string };

export type createThreeHydraConfig = {
  debug?: boolean;
  USD: USD;
  buffer?: ArrayBuffer;
  url?: string;
  /** The scene to be loaded as the root of the USD stage. */
  scene: Object3D;
  /** Files to be loaded into the virtual file system. */
  files: Array<HydraFile>;
};

export type NeedleThreeHydraHandle = {
  /** The hydra driver */
  driver: HdWebSyncDriver;
  /** Call update periodically to update the usd scene. */
  update: (dt: number) => void;
  /** Dispose the hydra handle and unlink loaded files. */
  dispose: () => void;
};

export class USDLoadingManager {
  static setURLModifier(callback: (url: string) => string): void;
  static urlModifier: (url: string) => string;
}

export function createThreeHydra(
  config: createThreeHydraConfig
): Promise<NeedleThreeHydraHandle>;
