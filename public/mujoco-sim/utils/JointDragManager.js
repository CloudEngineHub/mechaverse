import * as THREE from "three";

export class JointDragManager {
  constructor(scene, renderer, camera, container, controls, simulation) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.simulation = simulation;
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

    // Text indicator for joint info
    this.jointInfo = document.createElement("div");
    this.jointInfo.style.position = "absolute";
    this.jointInfo.style.top = "10px";
    this.jointInfo.style.right = "10px";
    this.jointInfo.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.jointInfo.style.color = "white";
    this.jointInfo.style.padding = "10px";
    this.jointInfo.style.borderRadius = "5px";
    this.jointInfo.style.fontFamily = "Arial, sans-serif";
    this.jointInfo.style.fontSize = "12px";
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

    // Event listeners
    container.addEventListener("pointerdown", this.onPointer.bind(this), true);
    document.addEventListener("pointermove", this.onPointer.bind(this), true);
    document.addEventListener("pointerup", this.onPointer.bind(this), true);
    document.addEventListener("pointerout", this.onPointer.bind(this), true);
    container.addEventListener("dblclick", this.onPointer.bind(this), false);
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

    // Log all detected body IDs
    console.log(
      "🔍 All detected body IDs:",
      allObjects.map((obj) => obj.bodyID)
    );

    // Log simulation model info
    if (this.simulation && this.simulation.model) {
      console.log("📊 Simulation model info:");
      console.log("  - nbody:", this.simulation.model.nbody);
      console.log(
        "  - body_jntadr length:",
        this.simulation.model.body_jntadr
          ? this.simulation.model.body_jntadr.length
          : "undefined"
      );
      console.log(
        "  - Valid body ID range: 0 to",
        this.simulation.model.nbody - 1
      );
    }

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

        console.log(`🎯 Started dragging joint on body ${obj.bodyID}`);
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
    if (!this.draggedJoint || !this.simulation) return;

    const bodyID = this.draggedJoint.bodyID;
    if (bodyID === undefined || bodyID < 0) return;

    // Get the current world position of the cursor
    const targetPosition = this.currentWorld.clone();

    // Convert to MuJoCo coordinates
    const mujocoTarget = this.toMujocoPos(targetPosition);

    // Directly set the body position to follow the cursor
    this.setBodyPosition(bodyID, mujocoTarget);
    // No simulation.forward() call here
  }

  setBodyPosition(bodyID, targetPosition) {
    if (!this.simulation || !this.simulation.xpos) {
      console.warn("Simulation or xpos not available");
      return;
    }
    // Assume bodyID is valid if it comes from the scene
    const posIndex = bodyID * 3;
    if (posIndex + 2 < this.simulation.xpos.length) {
      this.simulation.xpos[posIndex + 0] = targetPosition.x;
      this.simulation.xpos[posIndex + 1] = targetPosition.y;
      this.simulation.xpos[posIndex + 2] = targetPosition.z;
    } else {
      console.warn(`Position array too small for body ${bodyID}`);
    }
  }

  toMujocoPos(vector) {
    // Convert from Three.js coordinate system to MuJoCo
    return new THREE.Vector3(vector.x, -vector.z, vector.y);
  }

  showJointInfo(bodyID) {
    this.jointInfo.innerHTML = `Body: ${bodyID}<br><small>Drag to move body</small>`;
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

    console.log("🎯 Stopped dragging joint");
  }

  onPointer(evt) {
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
