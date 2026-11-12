import { dot, normalize, positionViewDirection, normalView, pow, oneMinus } from "three/tsl";

export const medicalRimNode = pow(
  oneMinus(dot(normalize(normalView), normalize(positionViewDirection))),
  2.4,
);
