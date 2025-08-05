declare module "urdf-loader/src/urdf-manipulator-element.js" {
  class URDFManipulator extends HTMLElement {
    background?: string;
    setJointValue?: (jointName: string, value: number) => void;
  }

  export default URDFManipulator;
}
