import {
  LoadingManager,
  MeshPhongMaterial,
  Mesh,
  Color,
  Object3D,
  Group,
  TextureLoader,
  Texture,
} from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

/**
 * Loads mesh files of different formats
 * @param path The path to the mesh file
 * @param manager The THREE.js loading manager
 * @param done Callback function when loading is complete
 * @param textureMapping Optional mapping from material names to texture paths
 */
export const loadMeshFile = (
  path: string,
  manager: LoadingManager,
  done: (result: Object3D | Group | Mesh | null, err?: Error) => void,
  textureMapping?: Record<string, string>
) => {
  // First try to get extension from the original path
  let ext = path.split(/\./g).pop()?.toLowerCase();

  // If the URL is a blob URL with a fragment containing the extension, use that
  if (path.startsWith("blob:") && path.includes("#.")) {
    const fragmentExt = path.split("#.").pop();
    if (fragmentExt) {
      ext = fragmentExt.toLowerCase();
    }
  }

  // If we can't determine extension, try to check Content-Type
  if (!ext) {
    console.error(`Could not determine file extension for: ${path}`);
    done(null, new Error(`Unsupported file format: ${path}`));
    return;
  }

  // Handle texture/image files - let the URDF viewer handle these natively
  const textureExtensions = [
    "jpg",
    "jpeg",
    "png",
    "bmp",
    "tga",
    "tiff",
    "webp",
  ];
  if (textureExtensions.includes(ext)) {
    // Return null to indicate this file should be handled by the URDF viewer's default texture loading
    done(null);
    return;
  }

  switch (ext) {
    case "gltf":
    case "glb":
      new GLTFLoader(manager).load(
        path,
        (result) => done(result.scene),
        undefined,
        (err) => done(null, err as Error)
      );
      break;
    case "obj":
      new OBJLoader(manager).load(
        path,
        (result) => {
          // Apply textures if available
          if (textureMapping && Object.keys(textureMapping).length > 0) {
            applyTexturesToObject(result, textureMapping, manager);
          }
          done(result);
        },
        undefined,
        (err) => done(null, err as Error)
      );
      break;
    case "dae":
      // Suppress the Z-UP coordinate system warning for COLLADA files
      const originalWarn = console.warn;
      console.warn = (...args) => {
        const message = args[0];
        if (
          typeof message === "string" &&
          message.includes("Z-UP coordinate system")
        ) {
          // This warning is expected for COLLADA files - the loader automatically handles coordinate conversion
          return; // Suppress this specific warning
        }
        originalWarn.apply(console, args);
      };

      new ColladaLoader(manager).load(
        path,
        (result) => {
          console.warn = originalWarn; // Restore original warn function
          done(result.scene);
        },
        undefined,
        (err) => {
          console.warn = originalWarn; // Restore original warn function
          done(null, err as Error);
        }
      );
      break;
    case "stl":
      new STLLoader(manager).load(
        path,
        (result) => {
          const material = new MeshPhongMaterial();
          const mesh = new Mesh(result, material);
          done(mesh);
        },
        undefined,
        (err) => done(null, err as Error)
      );
      break;
    default:
      done(null, new Error(`Unsupported file format: ${ext}`));
  }
};

/**
 * Apply textures to all meshes in an object
 * @param object The loaded 3D object
 * @param textureMapping Mapping from material names to texture paths
 * @param manager The loading manager
 */
const applyTexturesToObject = (
  object: Object3D | Group,
  textureMapping: Record<string, string>,
  manager: LoadingManager
): void => {
  // Get the first available texture path
  const textureFiles = Object.values(textureMapping);
  if (textureFiles.length === 0) {
    console.log('🎨 No textures available to apply');
    return;
  }
  
  const texturePath = textureFiles[0]; // Use the first available texture
  console.log(`🎨 Applying texture: ${texturePath}`);
  
  // Load the texture
  const textureLoader = new TextureLoader(manager);
  
  textureLoader.load(
    texturePath,
    (texture) => {
      console.log(`🎨 Texture loaded successfully: ${texturePath}`);
      let meshCount = 0;
      
      // Apply texture to all meshes in the object
      object.traverse((child) => {
        if (child instanceof Mesh) {
          // Create a new material with the texture
          const material = new MeshPhongMaterial({
            map: texture,
            transparent: true,
          });
          child.material = material;
          meshCount++;
        }
      });
      
      console.log(`🎨 Applied texture to ${meshCount} meshes`);
    },
    undefined,
    (err) => {
      console.warn(`Failed to load texture ${texturePath}:`, err);
    }
  );
};

/**
 * Creates a color in THREE.js format from a CSS color string
 * @param color The CSS color string
 * @returns A THREE.js Color
 */
export const createColor = (color: string): Color => {
  return new Color(color);
};
