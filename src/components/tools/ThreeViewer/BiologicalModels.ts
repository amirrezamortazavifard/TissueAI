import * as THREE from "three";
import { BiologicalModelType } from "@/stores/sceneStore";

function createErythrocyte(): THREE.BufferGeometry {
  const geometry = new THREE.TorusGeometry(2, 0.8, 32, 64);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const angle = Math.atan2(z, x);
    const dist = Math.sqrt(x * x + z * z);
    const squeeze = Math.cos(angle * 2) * 0.15;
    positions.setY(i, y + squeeze * (1 - dist / 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createNeuron(): THREE.Group {
  const group = new THREE.Group();

  const somaGeo = new THREE.SphereGeometry(1.2, 32, 32);
  const soma = new THREE.Mesh(somaGeo);
  group.add(soma);

  const axonGeo = new THREE.CylinderGeometry(0.15, 0.15, 8, 16);
  const axon = new THREE.Mesh(axonGeo);
  axon.position.set(0, -4, 0);
  group.add(axon);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const len = 1.5 + Math.random() * 2;
    const dendGeo = new THREE.CylinderGeometry(0.08, 0.12, len, 8);
    const dend = new THREE.Mesh(dendGeo);
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    dend.position.set(dirX * 1.5, 1 + len * 0.3, dirZ * 1.5);
    dend.rotation.z = -dirX * 0.6;
    dend.rotation.x = dirZ * 0.6;
    group.add(dend);

    for (let j = 0; j < 3; j++) {
      const subLen = 0.5 + Math.random() * 1;
      const subGeo = new THREE.CylinderGeometry(0.04, 0.06, subLen, 6);
      const sub = new THREE.Mesh(subGeo);
      const t = 0.4 + j * 0.25;
      sub.position.set(
        dirX * (1.5 + t * len * 0.5),
        1 + t * len * 0.6,
        dirZ * (1.5 + t * len * 0.5)
      );
      sub.rotation.z = -dirX * 0.8;
      sub.rotation.x = dirZ * 0.8;
      group.add(sub);
    }
  }

  return group;
}

function createMyocyte(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.8, 0.8, 6, 32, 1, false);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const wave = Math.sin(y * 3) * 0.08;
    const r = Math.sqrt(x * x + z * z);
    const newR = r + wave;
    const angle = Math.atan2(z, x);
    positions.setX(i, Math.cos(angle) * newR);
    positions.setZ(i, Math.sin(angle) * newR);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createPurkinjeCell(): THREE.Group {
  const group = new THREE.Group();

  const somaGeo = new THREE.SphereGeometry(1.5, 32, 32);
  const soma = new THREE.Mesh(somaGeo);
  group.add(soma);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const layer = Math.floor(i / 4);
    const spread = 1.5 + layer * 1.2;

    const branchGeo = new THREE.CylinderGeometry(0.06, 0.1, spread, 8);
    const branch = new THREE.Mesh(branchGeo);
    const dirX = Math.cos(angle) * (1 + layer * 0.3);
    const dirZ = Math.sin(angle) * (1 + layer * 0.3);
    branch.position.set(dirX * 2, 1.5 + layer * 1.5, dirZ * 2);
    branch.rotation.z = -dirX * 0.5;
    branch.rotation.x = dirZ * 0.5;
    group.add(branch);

    for (let j = 0; j < 4; j++) {
      const subAngle = angle + (j - 1.5) * 0.3;
      const subLen = 0.5 + Math.random() * 0.8;
      const subGeo = new THREE.CylinderGeometry(0.03, 0.05, subLen, 6);
      const sub = new THREE.Mesh(subGeo);
      sub.position.set(
        dirX * (2 + j * 0.4),
        1.5 + layer * 1.5 + j * 0.3,
        dirZ * (2 + j * 0.4)
      );
      sub.rotation.z = Math.cos(subAngle) * 0.7;
      sub.rotation.x = Math.sin(subAngle) * 0.7;
      group.add(sub);
    }
  }

  return group;
}

function createArtery(): THREE.Group {
  const group = new THREE.Group();

  const outerGeo = new THREE.CylinderGeometry(1.5, 1.5, 8, 32, 1, true);
  const outer = new THREE.Mesh(outerGeo);
  group.add(outer);

  const innerGeo = new THREE.CylinderGeometry(1.1, 1.1, 8, 32, 1, true);
  const inner = new THREE.Mesh(innerGeo);
  group.add(inner);

  const capFrontGeo = new THREE.RingGeometry(1.1, 1.5, 32);
  const capFront = new THREE.Mesh(capFrontGeo);
  capFront.position.y = 4;
  capFront.rotation.x = Math.PI / 2;
  group.add(capFront);

  const capBackGeo = new THREE.RingGeometry(1.1, 1.5, 32);
  const capBack = new THREE.Mesh(capBackGeo);
  capBack.position.y = -4;
  capBack.rotation.x = -Math.PI / 2;
  group.add(capBack);

  return group;
}

export function createBiologicalModel(
  type: BiologicalModelType
): THREE.Group | THREE.BufferGeometry {
  switch (type) {
    case "erythrocyte":
      return createErythrocyte();
    case "neuron":
      return createNeuron();
    case "myocyte":
      return createMyocyte();
    case "purkinje_cell":
      return createPurkinjeCell();
    case "artery":
      return createArtery();
    default:
      return new THREE.SphereGeometry(1, 32, 32);
  }
}

export function getModelDisplayName(type: BiologicalModelType): string {
  const names: Record<BiologicalModelType, string> = {
    erythrocyte: "Erythrocyte",
    neuron: "Neuron",
    myocyte: "Myocyte",
    purkinje_cell: "Purkinje Cell",
    artery: "Artery",
  };
  return names[type] || type;
}
