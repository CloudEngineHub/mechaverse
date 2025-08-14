import * as THREE from "three";

export class JointDragManager {
  constructor(scene, renderer, camera, container, controls, simulation) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.simulation = simulation;
    this.model = null; // Will be set when model is loaded
    this.mousePos = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.1;
    this.grabDistance = 0.0;
    this.active = false;
    this.draggedJoint = null;
    this.controls = controls;

    // Visual indicator for joint dragging
    this.jointIndicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8,
      })
    );
    this.jointIndicator.visible = false;
    this.scene.add(this.jointIndicator);

    // Text indicator for joint info (styled to match overlay style)
    this.jointInfo = document.createElement("div");
    this.jointInfo.style.position = "absolute";
    this.jointInfo.style.bottom = "16px";
    this.jointInfo.style.right = "16px";
    this.jointInfo.style.background = "rgba(0,0,0,0.7)";
    this.jointInfo.style.color = "#fff";
    this.jointInfo.style.padding = "8px 12px";
    this.jointInfo.style.borderRadius = "8px";
    this.jointInfo.style.fontFamily =
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    this.jointInfo.style.fontSize = "13px";
    this.jointInfo.style.fontWeight = "500";
    this.jointInfo.style.display = "none";
    this.jointInfo.style.zIndex = "1000";
    document.body.appendChild(this.jointInfo);

    // Arrow to show drag direction
    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      15,
      0x666666
    );
    this.arrow.setLength(15, 3, 1);
    this.scene.add(this.arrow);
    this.arrow.line.material.transparent = true;
    this.arrow.cone.material.transparent = true;
    this.arrow.line.material.opacity = 0.5;
    this.arrow.cone.material.opacity = 0.5;
    this.arrow.visible = false;

    this.previouslySelected = null;
    this.highlightColor = 0xff0000;

    this.localHit = new THREE.Vector3();
    this.worldHit = new THREE.Vector3();
    this.currentWorld = new THREE.Vector3();
    this.originalJointPos = new THREE.Vector3();

    // Event listeners - initially disabled until enabled
    this.enabled = false;
    this.container = container;
    this.boundOnPointer = this.onPointer.bind(this);
  }

  enable() {
    if (!this.enabled) {
      this.enabled = true;
      this.container.addEventListener("pointerdown", this.boundOnPointer, true);
      document.addEventListener("pointermove", this.boundOnPointer, true);
      document.addEventListener("pointerup", this.boundOnPointer, true);
      document.addEventListener("pointerout", this.boundOnPointer, true);
      this.container.addEventListener("dblclick", this.boundOnPointer, false);
    }
  }

  disable() {
    if (this.enabled) {
      this.enabled = false;
      this.container.removeEventListener("pointerdown", this.boundOnPointer, true);
      document.removeEventListener("pointermove", this.boundOnPointer, true);
      document.removeEventListener("pointerup", this.boundOnPointer, true);
      document.removeEventListener("pointerout", this.boundOnPointer, true);
      this.container.removeEventListener("dblclick", this.boundOnPointer, false);
      
      // End any active dragging
      if (this.active) {
        this.end();
      }
    }
  }

  updateRaycaster(x, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mousePos.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.mousePos.y = -((y - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePos, this.camera);
  }

  start(x, y) {
    this.draggedJoint = null;
    this.updateRaycaster(x, y);

    // Find all objects in the scene
    const allObjects = [];
    this.scene.traverse((obj) => {
      if (obj.isMesh && obj.bodyID !== undefined) {
        allObjects.push(obj);
      }
    });

    // Optional debug: detected body IDs and simulation info (removed for production)

    const intersects = this.raycaster.intersectObjects(allObjects);

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;
      if (obj.bodyID !== undefined && obj.bodyID > 0) {
        this.draggedJoint = obj;
        this.grabDistance = intersects[0].distance;

        const hit = this.raycaster.ray.origin.clone();
        hit.addScaledVector(this.raycaster.ray.direction, this.grabDistance);

        this.arrow.position.copy(hit);
        this.jointIndicator.position.copy(hit);

        this.active = true;
        this.controls.enabled = false;

        this.localHit = obj.worldToLocal(hit.clone());
        this.worldHit.copy(hit);
        this.currentWorld.copy(hit);
        this.originalJointPos.copy(hit);

        this.arrow.visible = true;
        this.jointIndicator.visible = true;

        // Show joint info
        this.showJointInfo(obj.bodyID);

        // Optional debug info for development
        // console.log("Started joint drag for bodyID:", obj.bodyID);

        // Dragging joint started
        break;
      }
    }
  }

  move(x, y) {
    if (this.active && this.draggedJoint) {
      this.updateRaycaster(x, y);
      const hit = this.raycaster.ray.origin.clone();
      hit.addScaledVector(this.raycaster.ray.direction, this.grabDistance);
      this.currentWorld.copy(hit);

      this.update();
      this.updateJointPosition();
      
      // Update the reference point for next frame's delta calculation
      this.worldHit.copy(this.currentWorld);
    }
  }

  update() {
    if (
      this.worldHit &&
      this.localHit &&
      this.currentWorld &&
      this.arrow &&
      this.draggedJoint
    ) {
      this.worldHit.copy(this.localHit);
      this.draggedJoint.localToWorld(this.worldHit);
      this.arrow.position.copy(this.worldHit);
      this.arrow.setDirection(
        this.currentWorld.clone().sub(this.worldHit).normalize()
      );
      this.arrow.setLength(
        this.currentWorld.clone().sub(this.worldHit).length()
      );
      this.jointIndicator.position.copy(this.currentWorld);
    }
  }

  updateJointPosition() {
    if (!this.draggedJoint || !this.simulation || !this.model)
      return;

    const bodyID = this.draggedJoint.bodyID;
    if (bodyID === undefined || bodyID < 0) return;

    try {
      // Find the joint that affects this body
      const jointInfo = this.findBodyJoint(bodyID);
      if (!jointInfo) {
        return;
      }

      // Calculate joint angle change based on mouse movement (much simpler approach)
      const angleChange = this.calculateSimpleAngleChange(jointInfo);
      
      // Apply the incremental change
      this.applyJointAngleChange(jointInfo, angleChange);
      
      // Forward the simulation to apply changes
      this.simulation.forward();
      
    } catch (e) {
      console.warn("Failed to update joint position:", e);
    }
  }

  findBodyJoint(bodyID) {
    const model = this.model;
    
    // Look for joints that directly affect this body
    for (let jntId = 0; jntId < model.njnt; jntId++) {
      // Check if this joint's body matches our target body
      if (model.jnt_bodyid && model.jnt_bodyid[jntId] === bodyID) {
        return {
          jointId: jntId,
          bodyId: bodyID,
          qposAddr: model.jnt_qposadr[jntId],
          jointType: model.jnt_type[jntId], // 0=free, 1=ball, 2=slide, 3=hinge
          axis: model.jnt_axis ? [
            model.jnt_axis[jntId * 3 + 0],
            model.jnt_axis[jntId * 3 + 1], 
            model.jnt_axis[jntId * 3 + 2]
          ] : [0, 0, 1]
        };
      }
    }
    
    // If no direct joint found, look for parent body joints
    let parentBodyId = bodyID;
    while (parentBodyId > 0) {
      parentBodyId = model.body_parentid[parentBodyId];
      for (let jntId = 0; jntId < model.njnt; jntId++) {
        if (model.jnt_bodyid && model.jnt_bodyid[jntId] === parentBodyId) {
          return {
            jointId: jntId,
            bodyId: parentBodyId,
            qposAddr: model.jnt_qposadr[jntId],
            jointType: model.jnt_type[jntId],
            axis: model.jnt_axis ? [
              model.jnt_axis[jntId * 3 + 0],
              model.jnt_axis[jntId * 3 + 1], 
              model.jnt_axis[jntId * 3 + 2]
            ] : [0, 0, 1]
          };
        }
      }
    }
    
    return null;
  }

  calculateSimpleAngleChange(jointInfo) {
    // Calculate how much the mouse has moved since last frame
    const deltaX = this.currentWorld.x - this.worldHit.x;
    const deltaY = this.currentWorld.y - this.worldHit.y;
    
    // For most joints, use horizontal mouse movement to control rotation
    // Scale down the movement for reasonable joint speed
    let angleChange = 0;
    
    // Reduced sensitivity for more stable control
    const sensitivity = 0.03; // Slightly more responsive
    
    if (jointInfo.jointType === 3) { // Hinge joint
      // Use the component of mouse movement that makes most sense for the joint
      angleChange = deltaX * sensitivity;
    } else if (jointInfo.jointType === 2) { // Slide joint  
      // For slide joints, use the mouse movement along the most relevant axis
      angleChange = (deltaX + deltaY) * sensitivity;
    } else if (jointInfo.jointType === 1) { // Ball joint
      // For ball joints, use X movement (simplified)
      angleChange = deltaX * sensitivity;
    }
    
    // Clamp the change to prevent extreme movements
    angleChange = Math.max(-0.05, Math.min(0.05, angleChange));
    
    return angleChange;
  }

  applyJointAngleChange(jointInfo, angleChange) {
    const qpos = this.simulation.qpos;
    const addr = jointInfo.qposAddr;
    
    if (addr >= 0 && addr < qpos.length) {
      // Apply the incremental change
      qpos[addr] += angleChange;
      
      // Apply joint limits
      this.applyJointLimits(jointInfo, addr);
    }
  }

  applyJointLimits(jointInfo, addr) {
    const qpos = this.simulation.qpos;
    const model = this.model;
    
    // Check if joint limits are defined in the model
    if (model.jnt_limited && model.jnt_range && model.jnt_limited[jointInfo.jointId]) {
      const rangeStart = jointInfo.jointId * 2;
      const lowerLimit = model.jnt_range[rangeStart];
      const upperLimit = model.jnt_range[rangeStart + 1];
      
      qpos[addr] = Math.max(lowerLimit, Math.min(upperLimit, qpos[addr]));
    } else {
      // Default safety limits
      if (jointInfo.jointType === 3) { // Hinge joint - angle limits
        qpos[addr] = Math.max(-Math.PI, Math.min(Math.PI, qpos[addr]));
      } else if (jointInfo.jointType === 2) { // Slide joint - position limits
        qpos[addr] = Math.max(-2, Math.min(2, qpos[addr]));
      }
    }
  }

  setBodyPosition(bodyID, targetPosition) {
    // This method is now a fallback and shouldn't be needed with proper joint manipulation
    console.warn("Fallback to direct body position manipulation for bodyID:", bodyID);
  }



  showJointInfo(bodyID) {
    this.jointInfo.innerHTML = `Component ID: ${bodyID}`;
    this.jointInfo.style.display = "block";
  }

  end(evt) {
    this.draggedJoint = null;
    this.active = false;
    this.controls.enabled = true;
    this.arrow.visible = false;
    this.jointIndicator.visible = false;
    this.jointInfo.style.display = "none";
    this.mouseDown = false;

    // Dragging joint stopped
  }

  onPointer(evt) {
    if (!this.enabled) return;

    if (evt.type === "pointerdown") {
      this.start(evt.clientX, evt.clientY);
      this.mouseDown = true;
    } else if (evt.type === "pointermove" && this.mouseDown) {
      if (this.active) {
        this.move(evt.clientX, evt.clientY);
      }
    } else if (evt.type === "pointerup") {
      this.end(evt);
    }

    if (evt.type === "dblclick") {
      this.start(evt.clientX, evt.clientY);
      this.doubleClick = true;

      if (this.draggedJoint) {
        if (this.draggedJoint === this.previouslySelected) {
          this.draggedJoint.material.emissive.setHex(0x000000);
          this.previouslySelected = null;
        } else {
          if (this.previouslySelected) {
            this.previouslySelected.material.emissive.setHex(0x000000);
          }
          this.draggedJoint.material.emissive.setHex(this.highlightColor);
          this.previouslySelected = this.draggedJoint;
        }
      } else {
        if (this.previouslySelected) {
          this.previouslySelected.material.emissive.setHex(0x000000);
          this.previouslySelected = null;
        }
      }
    }
  }
}
