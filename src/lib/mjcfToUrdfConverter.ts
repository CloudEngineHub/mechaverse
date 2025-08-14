export interface MjcfAsset {
  name: string;
  file: string;
  scale?: string;
  class?: string;
}

export interface MjcfTexture {
  name: string;
  file: string;
  type?: string;
}

export interface MjcfBody {
  name: string;
  pos?: string | undefined;
  quat?: string | undefined;
  xyaxes?: string | undefined;
  euler?: string | undefined;
  childclass?: string | undefined;
  children: MjcfBody[];
  geoms: MjcfGeom[];
  joints: MjcfJoint[];
  inertial?: MjcfInertial;
}

export interface MjcfGeom {
  type?: string;
  mesh?: string;
  size?: string;
  fromto?: string;
  pos?: string;
  euler?: string;
  material?: string;
  class?: string;
}

export interface MjcfJoint {
  name: string;
  type: string;
  range?: string;
  ref?: string;
  axis?: string;
  damping?: string;
  stiffness?: string;
  armature?: string;
}

export interface MjcfInertial {
  pos?: string | undefined;
  mass?: string | undefined;
  fullinertia?: string | undefined;
}

export interface MjcfConnect {
  body1: string;
  body2: string;
  anchor: string;
}

export interface MjcfModel {
  name: string;
  meshdir: string;
  texturedir: string;
  assets: Record<string, MjcfAsset>;
  textures: Record<string, MjcfTexture>;
  materials: Record<string, any>;
  worldbody: MjcfBody;
  angleUnit: 'degree' | 'radian';
  equalityConstraints: MjcfConnect[];
}

/**
 * Converts MJCF (MuJoCo XML) files to URDF format for use with the URDF viewer
 */
export class MjcfToUrdfConverter {
  private parser: DOMParser;
  private meshAssets: Record<string, MjcfAsset> = {};
  private textureAssets: Record<string, MjcfTexture> = {};
  private materials: Record<string, any> = {};
  private meshdir: string = "";
  private texturedir: string = "";
  private basePath: string = "";
  private currentModel?: MjcfModel;
  private defaultClasses: Record<string, any> = {};

  constructor() {
    this.parser = new DOMParser();
  }

  /**
   * Convert an MJCF file to URDF format
   */
  async convertFile(mjcfPath: string): Promise<string> {
    const mjcfContent = await fetch(mjcfPath).then(r => r.text());
    this.basePath = mjcfPath.substring(0, mjcfPath.lastIndexOf('/'));
    return this.convert(mjcfContent);
  }

  /**
   * Convert MJCF XML content to URDF XML
   */
  convert(mjcfXml: string): string {
        // Note: MJCF equality constraints (connect elements) create closed kinematic loops
    // which are not directly supported in URDF's tree structure
    
    const doc = this.parser.parseFromString(mjcfXml, 'text/xml');
    
    // Check for XML parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error('❌ XML Parser Error:', parserError.textContent);
    }
    
    const mjcfElement = doc.querySelector('mujoco');
    
    if (!mjcfElement) {
      throw new Error('Invalid MJCF file: no mujoco root element found');
    }

    // Parse the MJCF structure
    const model = this.parseMjcfModel(mjcfElement);
    
    // Convert to URDF
    const urdfContent = this.generateUrdf(model);
    return urdfContent;
  }

  /**
   * Parse the MJCF model structure
   */
  private parseMjcfModel(mjcfElement: Element): MjcfModel {
    const modelName = mjcfElement.getAttribute('model') || 'robot';
    
    // Parse compiler settings
    const compiler = mjcfElement.querySelector('compiler');
    this.meshdir = compiler?.getAttribute('meshdir') || 'meshes';
    this.texturedir = compiler?.getAttribute('texturedir') || 'textures';
    const texturedir = this.texturedir;
    
    // Parse angle unit (radian or degree)
    const angleUnit = compiler?.getAttribute('angle') === 'radian' ? 'radian' : 'degree';

    // Parse assets
    this.parseAssets(mjcfElement);

    // Parse materials
    this.parseMaterials(mjcfElement);

    // Parse equality constraints (currently disabled - see note below)
    const equalityConstraints = this.parseEqualityConstraints(mjcfElement);

    // Parse worldbody
    const worldbody = mjcfElement.querySelector('worldbody');
    if (!worldbody) {
      throw new Error('Invalid MJCF file: no worldbody element found');
    }

    const rootBody = this.parseBody(worldbody);

    return {
      name: modelName,
      meshdir: this.meshdir,
      texturedir,
      assets: this.meshAssets,
      textures: this.textureAssets,
      materials: this.materials,
      worldbody: rootBody,
      angleUnit,
      equalityConstraints
    };
  }

  /**
   * Parse mesh and texture assets and handle default classes
   */
  private parseAssets(mjcfElement: Element): void {
    const assetElement = mjcfElement.querySelector('asset');
    if (!assetElement) return;

    // First, parse default classes to get class-based properties
    this.defaultClasses = this.parseDefaultClasses(mjcfElement);

    // Parse texture assets
    const textureElements = assetElement.querySelectorAll('texture');
    textureElements.forEach(textureEl => {
      const name = textureEl.getAttribute('name');
      const file = textureEl.getAttribute('file');
      const type = textureEl.getAttribute('type') || undefined;
      
      if (name && file) {
        this.textureAssets[name] = { name, file, type };
      }
    });

    // Parse mesh assets
    const meshElements = assetElement.querySelectorAll('mesh');
    
    meshElements.forEach(meshEl => {
      let name = meshEl.getAttribute('name');
      const file = meshEl.getAttribute('file');
      let scale = meshEl.getAttribute('scale') || undefined;
      const className = meshEl.getAttribute('class') || undefined;
      
      // If no name attribute, derive it from the filename (without extension)
      if (!name && file) {
        name = file.replace(/\.[^/.]+$/, ""); // Remove file extension
      }
      
      // If no explicit scale but has class, try to get scale from default class
      if (!scale && className && this.defaultClasses[className]) {
        scale = this.defaultClasses[className].scale;
      }
      
      if (name && file) {
        this.meshAssets[name] = { name, file, scale, class: className };
      }
    });
  }

  /**
   * Parse default classes to extract properties like mesh scaling
   */
  private parseDefaultClasses(mjcfElement: Element): Record<string, any> {
    const classes: Record<string, any> = {};
    
    const defaultElements = mjcfElement.querySelectorAll('default');
    defaultElements.forEach(defaultEl => {
      const className = defaultEl.getAttribute('class');
      if (className) {
        const classData: any = {};
        
        // Parse mesh properties
        const meshEl = defaultEl.querySelector('mesh');
        if (meshEl) {
          const scale = meshEl.getAttribute('scale');
          if (scale) {
            classData.scale = scale;
          }
        }
        
        // Parse joint properties
        const jointEl = defaultEl.querySelector('joint');
        if (jointEl) {
          const range = jointEl.getAttribute('range');
          const axis = jointEl.getAttribute('axis');
          const damping = jointEl.getAttribute('damping');
          
          if (range || axis || damping) {
            classData.joint = {};
            if (range) classData.joint.range = range;
            if (axis) classData.joint.axis = axis;
            if (damping) classData.joint.damping = damping;
          }
        }
        
        if (Object.keys(classData).length > 0) {
          classes[className] = classData;
        }
      }
    });
    
    return classes;
  }

  /**
   * Parse material definitions
   */
  private parseMaterials(mjcfElement: Element): void {
    const assetElement = mjcfElement.querySelector('asset');
    if (!assetElement) return;

    const materialElements = assetElement.querySelectorAll('material');
    materialElements.forEach(matEl => {
      const name = matEl.getAttribute('name');
      if (name) {
        const textureName = matEl.getAttribute('texture');
        let textureAsset: MjcfTexture | undefined;
        
        // Resolve texture reference to actual texture asset
        if (textureName && this.textureAssets[textureName]) {
          textureAsset = this.textureAssets[textureName];
        }
        
        this.materials[name] = {
          name,
          texture: textureName,
          textureAsset,
          rgba: matEl.getAttribute('rgba')
        };
      }
    });
  }

  /**
   * Parse equality constraints (connect elements)
   */
  private parseEqualityConstraints(mjcfElement: Element): MjcfConnect[] {
    const constraints: MjcfConnect[] = [];
    
    // Find equality element that is a direct child of mujoco root (not inside default)
    let equalityElement: Element | null = null;
    for (const child of mjcfElement.children) {
      if (child.tagName === 'equality' && child.children.length > 0) {
        equalityElement = child;
        break;
      }
    }
    
    if (equalityElement) {
      const connectElements = equalityElement.querySelectorAll('connect');
      connectElements.forEach(connectEl => {
        const body1 = connectEl.getAttribute('body1');
        const body2 = connectEl.getAttribute('body2');
        const anchor = connectEl.getAttribute('anchor');
        
        if (body1 && body2 && anchor) {
          constraints.push({ body1, body2, anchor });
        }
      });
    }
    
    return constraints;
  }

  /**
   * Parse a body element and its children recursively
   */
  private parseBody(bodyElement: Element, isRoot: boolean = true): MjcfBody {
    const name = bodyElement.getAttribute('name') || (isRoot ? 'root' : 'unnamed_body');
    const pos = bodyElement.getAttribute('pos') || undefined;
    const quat = bodyElement.getAttribute('quat') || undefined;
    const xyaxes = bodyElement.getAttribute('xyaxes') || undefined;
    const euler = bodyElement.getAttribute('euler') || undefined;
    const childclass = bodyElement.getAttribute('childclass') || undefined;

    // Parse inertial properties
    let inertial: MjcfInertial | undefined;
    const inertialEl = bodyElement.querySelector(':scope > inertial');
    if (inertialEl) {
      inertial = {
        pos: inertialEl.getAttribute('pos') || undefined,
        mass: inertialEl.getAttribute('mass') || undefined,
        fullinertia: inertialEl.getAttribute('fullinertia') || undefined
      };
    }

    // Parse geoms
    const geoms: MjcfGeom[] = [];
    const geomElements = bodyElement.querySelectorAll(':scope > geom');
    
    geomElements.forEach(geomEl => {
      const geom: MjcfGeom = {
        type: geomEl.getAttribute('type') || undefined,
        mesh: geomEl.getAttribute('mesh') || undefined,
        size: geomEl.getAttribute('size') || undefined,
        fromto: geomEl.getAttribute('fromto') || undefined,
        pos: geomEl.getAttribute('pos') || undefined,
        euler: geomEl.getAttribute('euler') || undefined,
        material: geomEl.getAttribute('material') || undefined,
        class: geomEl.getAttribute('class') || undefined
      };
      
      geoms.push(geom);
    });

    // Parse joints
    const joints: MjcfJoint[] = [];
    const jointElements = bodyElement.querySelectorAll(':scope > joint');
    jointElements.forEach(jointEl => {
      const className = jointEl.getAttribute('class');
      
      // Get base properties from the element
      const joint: MjcfJoint = {
        name: jointEl.getAttribute('name') || 'unnamed_joint',
        type: jointEl.getAttribute('type') || 'hinge',
        range: jointEl.getAttribute('range') || undefined,
        ref: jointEl.getAttribute('ref') || undefined,
        axis: jointEl.getAttribute('axis') || undefined,
        damping: jointEl.getAttribute('damping') || undefined,
        stiffness: jointEl.getAttribute('stiffness') || undefined,
        armature: jointEl.getAttribute('armature') || undefined
      };
      
      // Apply class-based defaults if available and not explicitly set
      if (className && this.defaultClasses[className] && this.defaultClasses[className].joint) {
        const classJoint = this.defaultClasses[className].joint;
        
        if (!joint.range && classJoint.range) {
          joint.range = classJoint.range;
        }
        if (!joint.axis && classJoint.axis) {
          joint.axis = classJoint.axis;
        }
        if (!joint.damping && classJoint.damping) {
          joint.damping = classJoint.damping;
        }
      }
      
      joints.push(joint);
    });

    // Parse child bodies recursively
    const children: MjcfBody[] = [];
    const childBodyElements = bodyElement.querySelectorAll(':scope > body');
    childBodyElements.forEach(childEl => {
      children.push(this.parseBody(childEl, false));
    });

    return {
      name,
      pos,
      quat,
      xyaxes,
      euler,
      childclass,
      children,
      geoms,
      joints,
      inertial
    };
  }

  /**
   * Generate URDF XML from the parsed MJCF model
   */
  private generateUrdf(model: MjcfModel): string {
    const urdfLines: string[] = [];
    
    // Store model for use in conversion functions
    this.currentModel = model;
    
    urdfLines.push('<?xml version="1.0"?>');
    urdfLines.push(`<robot name="${model.name}">`);
    
    // In MJCF, worldbody contains the root bodies
    // We need to handle this differently than regular bodies
    if (model.worldbody.children.length > 0) {
      // Generate links for all bodies in the tree
      model.worldbody.children.forEach(rootBody => {
        this.generateLinksRecursive(rootBody, urdfLines);
      });
      
      // Generate joints for all bodies in the tree
      model.worldbody.children.forEach(rootBody => {
        this.generateJointsRecursive(rootBody, urdfLines, null);
      });
    } else {
      // Fallback: treat worldbody as a single root body
      this.generateLinksRecursive(model.worldbody, urdfLines);
      this.generateJointsRecursive(model.worldbody, urdfLines, null);
    }
    
    // Generate documentation for equality constraints
    // NOTE: MJCF equality constraints create closed kinematic loops (e.g. achilles-rod <-> heel-spring)
    // URDF's tree structure cannot represent these constraints without breaking parent-child relationships
    // The constraints are documented as comments for reference
    this.generateConstraintJoints(model, urdfLines);
    
    urdfLines.push('</robot>');
    
    return urdfLines.join('\n');
  }

  /**
   * Generate URDF links recursively
   */
  private generateLinksRecursive(body: MjcfBody, urdfLines: string[]): void {
    // Generate link for this body
    urdfLines.push(`  <link name="${body.name}">`);
    
    // Add inertial properties if available
    if (body.inertial) {
      urdfLines.push('    <inertial>');
      if (body.inertial.pos) {
        const pos = body.inertial.pos.split(' ').map(parseFloat);
        urdfLines.push(`      <origin xyz="${pos.join(' ')}" rpy="0 0 0"/>`);
      }
      if (body.inertial.mass) {
        urdfLines.push(`      <mass value="${body.inertial.mass}"/>`);
      }
      if (body.inertial.fullinertia) {
        const inertia = body.inertial.fullinertia.split(' ').map(parseFloat);
        urdfLines.push(`      <inertia ixx="${inertia[0]}" ixy="${inertia[3]}" ixz="${inertia[4]}" iyy="${inertia[1]}" iyz="${inertia[5]}" izz="${inertia[2]}"/>`);
      }
      urdfLines.push('    </inertial>');
    }
    
    // Add visual geometry from geoms - include any geom with a mesh attribute
    body.geoms.forEach((geom, index) => {
      if (geom.mesh) {
        const asset = this.meshAssets[geom.mesh];
        if (asset) {
          urdfLines.push('    <visual>');
          
          // Handle geometry position and rotation
          let xyz = '0 0 0';
          let rpy = '0 0 0';
          
          if (geom.pos) {
            const pos = geom.pos.split(' ').map(parseFloat);
            xyz = pos.join(' ');
          }
          
          if (geom.euler) {
            const euler = geom.euler.split(' ').map(parseFloat);
            // Convert to radians if needed
            const conversionFactor = this.currentModel?.angleUnit === 'radian' ? 1 : Math.PI / 180;
            // MJCF uses ZYX order, URDF uses XYZ order
            const rpyVals = [
              euler[2] * conversionFactor, // Roll (X rotation) - was Z in MJCF
              euler[1] * conversionFactor, // Pitch (Y rotation) 
              euler[0] * conversionFactor  // Yaw (Z rotation) - was X in MJCF
            ];
            rpy = rpyVals.join(' ');
          }
          
          urdfLines.push(`      <origin xyz="${xyz}" rpy="${rpy}"/>`);
          urdfLines.push('      <geometry>');
          
          // Create mesh path
          const meshPath = `package://mjcf/${this.getPackageName()}/${this.meshdir}/${asset.file}`;
          
          // Use mesh scale from asset definition
          let scale = '1 1 1';
          if (asset.scale) {
            scale = asset.scale;
          }
          
          urdfLines.push(`        <mesh filename="${meshPath}" scale="${scale}"/>`);
          urdfLines.push('      </geometry>');
          
          // Add material if specified
          if (geom.material && this.materials[geom.material]) {
            const material = this.materials[geom.material];
            urdfLines.push('      <material name="' + geom.material + '">');
            
            // For URDF, only use color - textures are handled through MTL files for OBJ meshes
            if (material.rgba) {
              urdfLines.push(`        <color rgba="${material.rgba}"/>`);
            } else {
              // Default color if no color specified but material exists
              urdfLines.push(`        <color rgba="0.8 0.8 0.8 1.0"/>`);
            }
            
            urdfLines.push('      </material>');
          }
          
          urdfLines.push('    </visual>');
        }
      }
    });
    
    urdfLines.push('  </link>');
    
    // Recursively generate links for children
    body.children.forEach(child => {
      this.generateLinksRecursive(child, urdfLines);
    });
  }

  /**
   * Find xyaxes from parent bodies when current body has none
   */
  private findParentXyaxes(targetBody: MjcfBody, rootBody: MjcfBody): string | undefined {
    // Recursively search for the target body and track parent xyaxes
    const findInTree = (body: MjcfBody, parentXyaxes?: string): string | undefined => {
      if (body.name === targetBody.name) {
        return parentXyaxes;
      }
      
      const currentXyaxes = body.xyaxes || parentXyaxes;
      
      for (const child of body.children) {
        const result = findInTree(child, currentXyaxes);
        if (result) return result;
      }
      
      return undefined;
    };
    
    return findInTree(rootBody);
  }

  /**
   * Generate URDF joints recursively
   */
  private generateJointsRecursive(body: MjcfBody, urdfLines: string[], parentName: string | null): void {
    // Generate joints for child bodies
    body.children.forEach(child => {
      if (child.joints.length > 0) {
        child.joints.forEach(joint => {
          urdfLines.push(`  <joint name="${joint.name}" type="${this.convertJointType(joint.type)}">`);
          urdfLines.push(`    <parent link="${body.name}"/>`);
          urdfLines.push(`    <child link="${child.name}"/>`);
          
          // Handle joint origin with proper coordinate conversion
          const transform = this.computeTransform(child);
          
          urdfLines.push(`    <origin xyz="${transform.xyz}" rpy="${transform.rpy}"/>`);
          
          // Add joint axis - extract from xyaxes or use default
          const axis = this.extractJointAxis(child, joint);
          // console.log(`🔧 Joint ${joint.name}: type=${joint.type}, explicit_axis="${joint.axis}", body_xyaxes="${child.xyaxes}", final_axis="${axis}"`);
          urdfLines.push(`    <axis xyz="${axis}"/>`);
          
          // Add joint limits if available
          if (joint.range && joint.type !== 'ball') {
            const range = joint.range.split(' ').map(parseFloat);
            // Convert to radians if needed
            const conversionFactor = this.currentModel?.angleUnit === 'radian' ? 1 : Math.PI / 180;
            
            // Account for reference position if specified
            let lower = range[0] * conversionFactor;
            let upper = range[1] * conversionFactor;
            
            if (joint.ref) {
              const refPos = parseFloat(joint.ref) * conversionFactor;
              // MJCF ranges are typically relative to the reference position
              // For URDF, we need to adjust them to be relative to zero
              lower = lower - refPos;
              upper = upper - refPos;
              console.log(`🔧 Range ${joint.name}: raw="${joint.range}", ref="${joint.ref}" (${refPos} rad), adjusted final=[${lower}, ${upper}]`);
            } else {
              console.log(`🔧 Range ${joint.name}: raw="${joint.range}", no ref, final=[${lower}, ${upper}]`);
            }
            
            urdfLines.push(`    <limit lower="${lower}" upper="${upper}" effort="100" velocity="10"/>`);
          } else {
            console.log(`🔧 Range ${joint.name}: NO RANGE (range="${joint.range}", type="${joint.type}")`);
          }
          
          // Add dynamics if available
          if (joint.damping) {
            urdfLines.push(`    <dynamics damping="${joint.damping}"/>`);
          }
          
          urdfLines.push('  </joint>');
        });
      } else if (parentName !== null) {
        // Create a fixed joint for bodies without explicit joints (but not for root bodies)
        urdfLines.push(`  <joint name="${child.name}_fixed" type="fixed">`);
        urdfLines.push(`    <parent link="${body.name}"/>`);
        urdfLines.push(`    <child link="${child.name}"/>`);
        
        const transform = this.computeTransform(child);
        urdfLines.push(`    <origin xyz="${transform.xyz}" rpy="${transform.rpy}"/>`);
        urdfLines.push('  </joint>');
      }
      
      // Recursively generate joints for children
      this.generateJointsRecursive(child, urdfLines, child.name);
    });
  }

  /**
   * Generate joints for equality constraints
   */
  private generateConstraintJoints(model: MjcfModel, urdfLines: string[]): void {
    if (model.equalityConstraints.length > 0) {
      urdfLines.push(`  <!-- MJCF Equality Constraints (not converted to preserve URDF tree structure) -->`);
      
      model.equalityConstraints.forEach((constraint, index) => {
        const anchor = constraint.anchor.split(' ').map(parseFloat);
        const anchorXyz = anchor.length >= 3 ? `${anchor[0]} ${anchor[1]} ${anchor[2]}` : "0 0 0";
        
        urdfLines.push(`  <!-- Constraint ${index + 1}: ${constraint.body1} <-> ${constraint.body2} at anchor="${anchorXyz}" -->`);
        urdfLines.push(`  <!--   Original MJCF: <connect body1="${constraint.body1}" body2="${constraint.body2}" anchor="${constraint.anchor}"/> -->`);
        
        console.log(`🔗 Documented constraint: ${constraint.body1} <-> ${constraint.body2} (preserved as comment)`);
      });
      
      urdfLines.push(`  <!-- Note: These constraints create closed kinematic loops that cannot be represented in URDF's tree structure -->`);
    }
  }

  /**
   * Convert MJCF joint type to URDF joint type
   */
  private convertJointType(mjcfType: string): string {
    const typeMap: Record<string, string> = {
      'hinge': 'revolute',
      'slide': 'prismatic',
      'ball': 'continuous', // Ball joints don't have direct URDF equivalent
      'free': 'floating',
      'fixed': 'fixed'
    };
    
    return typeMap[mjcfType] || 'fixed';
  }

  /**
   * Extract package name from base path
   */
  private getPackageName(): string {
    // Extract package name from path like "/mjcf/cassie" -> "cassie"
    const pathParts = this.basePath.split('/');
    return pathParts[pathParts.length - 1] || 'robot';
  }

  /**
   * Compute transform (position and rotation) for a body
   */
  private computeTransform(body: MjcfBody): { xyz: string; rpy: string } {
    let xyz = '0 0 0';
    let rpy = '0 0 0';
    
    // Handle position - MJCF and URDF both use right-handed coordinates but may differ in axis conventions
    if (body.pos) {
      const pos = body.pos.split(' ').map(parseFloat);
      // For most robots, coordinate systems are similar, but we might need to swap axes
      xyz = pos.join(' ');
    }
    
    // Handle rotation - priority: xyaxes > euler > quat
    if (body.xyaxes) {
      // MJCF xyaxes defines a coordinate frame with X and Y axes
      // Convert this to URDF RPY convention
      const axes = body.xyaxes.split(' ').map(parseFloat);
      if (axes.length >= 6) {
        const xaxis = [axes[0], axes[1], axes[2]];
        const yaxis = [axes[3], axes[4], axes[5]];
        
        // Compute z-axis as cross product of x and y
        const zaxis = [
          xaxis[1] * yaxis[2] - xaxis[2] * yaxis[1],
          xaxis[2] * yaxis[0] - xaxis[0] * yaxis[2],
          xaxis[0] * yaxis[1] - xaxis[1] * yaxis[0]
        ];
        
        // Convert rotation matrix to Euler angles
        const rpyVals = this.rotationMatrixToRPY(xaxis, yaxis, zaxis);
        rpy = rpyVals.join(' ');
      }
          } else if (body.euler) {
        // MJCF euler angles use intrinsic ZYX rotation order
        // URDF RPY uses extrinsic XYZ rotation order
        const euler = body.euler.split(' ').map(parseFloat);
        
        // Convert to radians if needed
        const conversionFactor = this.currentModel?.angleUnit === 'radian' ? 1 : Math.PI / 180;
        
        // Convert from MJCF's intrinsic ZYX to URDF's extrinsic XYZ
        // For small angles, this is approximately: RPY = [Z, Y, X] from MJCF
        const rpyVals = [
          euler[2] * conversionFactor, // Roll (X rotation) 
          euler[1] * conversionFactor, // Pitch (Y rotation) 
          euler[0] * conversionFactor  // Yaw (Z rotation)
        ];
        rpy = rpyVals.join(' ');
      } else if (body.quat) {
      // Convert quaternion to RPY
      const quat = body.quat.split(' ').map(parseFloat);
      if (quat.length >= 4) {
        // MJCF quaternion order is [w, x, y, z]
        const rpyVals = this.quaternionToRPY(quat[0], quat[1], quat[2], quat[3]);
        rpy = rpyVals.join(' ');
      }
    }
    
    return { xyz, rpy };
  }

  /**
   * Extract joint axis from body orientation or joint definition
   */
  private extractJointAxis(body: MjcfBody, joint: MjcfJoint): string {
    // If joint has explicit axis, use it
    if (joint.axis) {
      return joint.axis;
    }
    
    // For hinge joints, try to extract rotation axis from body orientation
    if (joint.type === 'hinge') {
      // First try the body's own xyaxes
      let xyaxes = body.xyaxes;
      
      // If this body has no xyaxes, try to find a parent body with xyaxes
      if (!xyaxes && this.currentModel) {
        xyaxes = this.findParentXyaxes(body, this.currentModel.worldbody);
      }
      
      if (xyaxes) {
        const axes = xyaxes.split(' ').map(parseFloat);
        if (axes.length >= 6) {
          const xaxis = [axes[0], axes[1], axes[2]];
          const yaxis = [axes[3], axes[4], axes[5]];
          
       
            const zaxis = [
              xaxis[1] * yaxis[2] - xaxis[2] * yaxis[1],
              xaxis[2] * yaxis[0] - xaxis[0] * yaxis[2],
              xaxis[0] * yaxis[1] - xaxis[1] * yaxis[0]
            ];
            // Try both X-axis and Z-axis, choose based on which is more aligned with a primary axis
          // This heuristic: if Z-axis is close to a primary axis (X, Y, or Z), use it; otherwise use X-axis
            const xAxisAlignment = Math.max(Math.abs(xaxis[0]), Math.abs(xaxis[1]), Math.abs(xaxis[2]));
            const zAxisAlignment = Math.max(Math.abs(zaxis[0]), Math.abs(zaxis[1]), Math.abs(zaxis[2]));
            
            let rotationAxis = zAxisAlignment > xAxisAlignment ? zaxis : xaxis;
          
          
          // Normalize the rotation axis
          const length = Math.sqrt(rotationAxis[0]*rotationAxis[0] + rotationAxis[1]*rotationAxis[1] + rotationAxis[2]*rotationAxis[2]);
          if (length > 0.001) {
            return `${rotationAxis[0]/length} ${rotationAxis[1]/length} ${rotationAxis[2]/length}`;
          }
        }
      }
    }
    
    // Default axes based on joint type (MJCF convention)
    const defaultAxes: Record<string, string> = {
      'hinge': '1 0 0',    // X-axis rotation (MJCF default)
      'slide': '1 0 0',    // X-axis translation
      'ball': '0 0 1',     // Default to Z-axis
      'free': '0 0 1',     // Default to Z-axis
    };
    
    return defaultAxes[joint.type] || '0 0 1';
  }

  /**
   * Convert rotation matrix to Roll-Pitch-Yaw angles
   */
  private rotationMatrixToRPY(xaxis: number[], yaxis: number[], zaxis: number[]): number[] {
    // Rotation matrix is [xaxis, yaxis, zaxis] as columns
    const R11 = xaxis[0], R12 = yaxis[0], R13 = zaxis[0];
    const R21 = xaxis[1], R22 = yaxis[1], R23 = zaxis[1];
    const R31 = xaxis[2], R32 = yaxis[2], R33 = zaxis[2];
    
    // Extract Euler angles (ZYX convention) from rotation matrix
    let roll, pitch, yaw;
    
    // Check for gimbal lock
    if (Math.abs(R31) >= 0.998) {
      // Gimbal lock case
      yaw = Math.atan2(-R12, R22);
      pitch = R31 < 0 ? Math.PI/2 : -Math.PI/2;
      roll = 0;
    } else {
      yaw = Math.atan2(R21, R11);
      pitch = Math.asin(-R31);
      roll = Math.atan2(R32, R33);
    }
    
    return [roll, pitch, yaw];
  }

  /**
   * Convert quaternion to Roll-Pitch-Yaw angles
   */
  private quaternionToRPY(w: number, x: number, y: number, z: number): number[] {
    // Normalize quaternion first to handle cases like [1, -1, 1, -1]
    const length = Math.sqrt(w*w + x*x + y*y + z*z);
    if (length > 0.001) {
      w /= length;
      x /= length;
      y /= length;
      z /= length;
    }
    
    // Convert quaternion to RPY
    const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    
    return [roll, pitch, yaw];
  }

  /**
   * Create URL modifier function for MJCF mesh and texture resolution
   */
  createUrlModifier(): (url: string) => string {
    const basePath = this.basePath;
    const meshdir = this.meshdir;
    const texturedir = this.texturedir;
    const materials = this.materials;
    const textureAssets = this.textureAssets;
    
    return (url: string) => {
      // Handle package:// URLs for MJCF meshes and textures
      if (url.startsWith('package://mjcf/')) {
        // Extract the relative path after package://mjcf/packagename/
        const parts = url.replace('package://mjcf/', '').split('/');
        
        if (parts.length >= 2) {
          const packageName = parts[0];
          const relativePath = parts.slice(1).join('/');
          
          // For converted MJCF files, map to the original MJCF location
          return `${basePath}/${relativePath}`;
        }
        
        // Fallback: Convert package://mjcf/cassie/assets/pelvis.obj -> /mjcf/cassie/assets/pelvis.obj
        return url.replace('package://', '/');
      }
      
      return url;
    };
  }

  /**
   * Get texture information for material-based texture mapping
   */
  getTextureMapping(): Record<string, string> {
    const textureMap: Record<string, string> = {};
    
    // Create mapping from material names to texture file paths
    for (const materialName in this.materials) {
      const material = this.materials[materialName];
      if (material.textureAsset) {
        const texturePath = `${this.basePath}/${this.texturedir}/${material.textureAsset.file}`;
        textureMap[materialName] = texturePath;
        console.log(`🎨 Texture mapping: ${materialName} -> ${texturePath}`);
      }
    }
    
    console.log(`🎨 Total texture mappings: ${Object.keys(textureMap).length}`);
    return textureMap;
  }
} 