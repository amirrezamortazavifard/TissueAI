import { useRef, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useSceneStore, SceneObject as SceneObjectType } from "@/stores/sceneStore";
import { createBiologicalModel } from "./BiologicalModels";

interface SceneObjectProps {
  obj: SceneObjectType;
}

export default function SceneObject({ obj }: SceneObjectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const selectedId = useSceneStore((s) => s.selectedId);
  const selectObject = useSceneStore((s) => s.selectObject);
  const showLabels = useSceneStore((s) => s.showLabels);
  const isSelected = selectedId === obj.id;

  const geometry = useMemo(() => {
    if (obj.modelType === "custom" && obj.modelPath) return null;
    return createBiologicalModel(obj.modelType as BiologicalModelType);
  }, [obj.modelType, obj.modelPath]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectObject(obj.id);
  };

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = obj.position;
    const rot = obj.rotation;
    const scl = obj.scale;
    groupRef.current.position.set(pos[0], pos[1], pos[2]);
    groupRef.current.rotation.set(rot[0], rot[1], rot[2]);
    groupRef.current.scale.set(scl[0], scl[1], scl[2]);
  });

  if (!obj.visible) return null;

  const isGroup = geometry instanceof THREE.Group;
  const color = isSelected ? "#FFD700" : obj.color;

  const getBBoxSize = (): [number, number, number] => {
    if (isGroup) return [6, 6, 6];
    if (geometry) {
      const b = new THREE.Box3().setFromObject(
        new THREE.Mesh(geometry as THREE.BufferGeometry)
      );
      const s = b.getSize(new THREE.Vector3());
      return [s.x + 1, s.y + 1, s.z + 1];
    }
    return [3, 3, 3];
  };

  return (
    <group
      ref={groupRef}
      position={obj.position}
      rotation={obj.rotation}
      scale={obj.scale}
      onClick={handleClick}
    >
      {isGroup
        ? (geometry as THREE.Group).children.map((child, i) => {
            const mesh = child as THREE.Mesh;
            return (
              <mesh
                key={i}
                geometry={mesh.geometry}
                position={[mesh.position.x, mesh.position.y, mesh.position.z]}
                rotation={[mesh.rotation.x, mesh.rotation.y, mesh.rotation.z]}
              >
                <meshStandardMaterial
                  color={color}
                  wireframe={obj.wireframe}
                  transparent
                  opacity={0.9}
                />
              </mesh>
            );
          })
        : geometry && (
            <mesh geometry={geometry as THREE.BufferGeometry}>
              <meshStandardMaterial
                color={color}
                wireframe={obj.wireframe}
                transparent
                opacity={0.9}
              />
            </mesh>
          )}

      {isSelected && (
        <mesh>
          <boxGeometry args={getBBoxSize()} />
          <meshBasicMaterial
            color="#0096FF"
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {showLabels && (
        <Html
          position={[0, isGroup ? 5 : 3, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: "none" }}
        >
          <div
            style={{
              background: "rgba(10,13,20,0.75)",
              backdropFilter: "blur(8px)",
              color: "rgba(255,255,255,0.85)",
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "Inter, sans-serif",
              whiteSpace: "nowrap",
              border: "1px solid rgba(255,255,255,0.08)",
              userSelect: "none",
            }}
          >
            {obj.name}
          </div>
        </Html>
      )}
    </group>
  );
}

type BiologicalModelType = "erythrocyte" | "neuron" | "myocyte" | "purkinje_cell" | "artery";
