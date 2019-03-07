import { paths } from "../paths";
import { Pose } from "../pose";
import { copySittingToStandingTransform } from "./copy-sitting-to-standing-transform";

const ONES = new THREE.Vector3(1, 1, 1);
const HAND_OFFSET = new THREE.Matrix4().compose(
  new THREE.Vector3(0, 0, 0.13),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(-40 * THREE.Math.DEG2RAD, 0, 0)),
  new THREE.Vector3(1, 1, 1)
);

export class ViveControllerDevice {
  constructor(gamepad) {
    // wake the gamepad api up. otherwise it does not report touch controllers.
    // in chrome it still won't unless you enter vr.
    navigator.getVRDisplays();
    this.gamepad = gamepad;

    this.buttonMap = [
      { name: "touchpad", buttonId: 0 },
      { name: "trigger", buttonId: 1 },
      { name: "grip", buttonId: 2 },
      { name: "top", buttonId: 3 }
    ];
    this.axisMap = [{ name: "joyX", axisId: 0 }, { name: "joyY", axisId: 1 }];

    this.pose = new Pose();
    this.rayObjectRotation = new THREE.Quaternion();
    this.path = paths.device.vive[gamepad.hand || "right"];
    if (!gamepad.hand) {
      console.warn("gamepad detected without hand specified");
    } else {
      this.selector = `[super-hands]#player-${gamepad.hand}-controller`;
    }
    this.sittingToStandingMatrix = new THREE.Matrix4().makeTranslation(0, 1.6, 0);
    copySittingToStandingTransform(this.sittingToStandingMatrix);

    this.matrix = new THREE.Matrix4();
    this.position = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();
  }

  write(frame) {
    if (!this.gamepad.connected) return;

    this.buttonMap.forEach(b => {
      const path = this.path.button(b.name);
      const button = this.gamepad.buttons[b.buttonId];
      frame.setValueType(path.pressed, !!button.pressed);
      frame.setValueType(path.touched, !!button.touched);
      frame.setValueType(path.value, button.value);
    });
    this.axisMap.forEach(axis => {
      frame.setValueType(this.path.axis(axis.name), this.gamepad.axes[axis.axisId]);
    });

    if (!this.selector) {
      if (this.gamepad.hand) {
        this.path = paths.device.vive[this.gamepad.hand];
        this.selector = `#player-${this.gamepad.hand}-controller`;
        console.warn("gamepad hand eventually specified");
      } else {
        return;
      }
    }
    const el = document.querySelector(this.selector);
    const rayObject = el.object3D;
    rayObject.updateMatrixWorld();
    this.rayObjectRotation.setFromRotationMatrix(rayObject.matrixWorld);
    this.pose.position.setFromMatrixPosition(rayObject.matrixWorld);
    this.pose.direction.set(0, 0, -1).applyQuaternion(this.rayObjectRotation);
    this.pose.fromOriginAndDirection(this.pose.position, this.pose.direction);
    frame.setPose(this.path.pose, this.pose);

    if (this.gamepad.pose.position && this.gamepad.pose.orientation) {
      frame.setMatrix4(
        this.path.matrix,
        this.matrix
          .compose(
            this.position.fromArray(this.gamepad.pose.position),
            this.orientation.fromArray(this.gamepad.pose.orientation),
            ONES
          )
          .premultiply(this.sittingToStandingMatrix)
          .multiply(HAND_OFFSET)
      );
    }
  }
}
