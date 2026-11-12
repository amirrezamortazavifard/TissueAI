import React, { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport, Grid, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useSceneStore } from "@/stores/sceneStore";
import SceneObject from "./SceneObject";

function CameraPresetManager() {
  const { camera } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const presets: Record<string, { pos: [number, number, number] }> = {
        "1": { pos: [0, 0, 300] },
        "2": { pos: [0, 0, -300] },
        "3": { pos: [300, 0, 0] },
        "4": { pos: [-300, 0, 0] },
        "5": { pos: [0, 300, 0] },
        "6": { pos: [0, -300, 0] },
      };

      if (presets[e.key]) {
        const { pos } = presets[e.key];
        const startPos = camera.position.clone();
        const endPos = new THREE.Vector3(...pos);
        let t = 0;
        const animate = () => {
          t += 0.025;
          if (t >= 1) {
            camera.position.set(...pos);
            return;
          }
          const ease = t * t * (3 - 2 * t);
          camera.position.lerpVectors(startPos, endPos, ease);
          requestAnimationFrame(animate);
        };
        animate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [camera]);

  return <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} />;
}

function FpsTracker({ onFps }: { onFps: (fps: number) => void }) {
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      onFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, [onFps]);

  return null;
}

function SceneContent({ onFps }: { onFps: (fps: number) => void }) {
  const objects = useSceneStore((s) => s.objects);
  const selectObject = useSceneStore((s) => s.selectObject);
  const backgroundColor = useSceneStore((s) => s.backgroundColor);
  const showGrid = useSceneStore((s) => s.showGrid);
  const lightIntensity = useSceneStore((s) => s.lightIntensity);
  const ambientIntensity = useSceneStore((s) => s.ambientIntensity);

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <fog attach="fog" args={[backgroundColor, 400, 1200]} />

      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={[100, 200, 100]}
        intensity={lightIntensity}
        castShadow
      />
      <directionalLight position={[-50, 100, -50]} intensity={lightIntensity * 0.3} />
      <pointLight position={[0, 50, 0]} intensity={0.5} color="#5BA8F5" />

      {showGrid && (
        <Grid
          args={[2000, 2000]}
          position={[0, -0.5, 0]}
          cellSize={100}
          cellThickness={0.5}
          cellColor="rgba(91,168,245,0.15)"
          sectionSize={100}
          sectionThickness={1}
          sectionColor="rgba(91,168,245,0.25)"
          fadeDistance={800}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}

      <Stars radius={500} depth={50} count={1000} factor={2} saturation={0} fade speed={0.5} />

      <group
        onClick={(e) => {
          if (e.object === e.eventObject) selectObject(null);
        }}
      >
        {objects.map((obj) => (
          <SceneObject key={obj.id} obj={obj} />
        ))}
      </group>

      <FpsTracker onFps={onFps} />
      <CameraPresetManager />

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport
          axisColors={["#E57373", "#81C784", "#64B5F6"]}
          labelColor="white"
        />
      </GizmoHelper>
    </>
  );
}

interface SceneViewportProps {
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

class WebGLErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function CanvasFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1A0129",
        color: "rgba(255,255,255,0.5)",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ fontSize: "48px" }}>&#x1F4E6;</div>
      <div style={{ fontSize: "14px", fontWeight: 500 }}>WebGL unavailable</div>
      <div style={{ fontSize: "12px", opacity: 0.5 }}>3D rendering requires WebGL support</div>
    </div>
  );
}

export default function SceneViewport({ onKeyDown }: SceneViewportProps) {
  const [fps, setFps] = useState(0);
  const onFps = useCallback((v: number) => setFps(v), []);

  return (
    <div
      style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          background: "rgba(10,13,20,0.7)",
          backdropFilter: "blur(8px)",
          color: "rgba(255,255,255,0.6)",
          padding: "4px 10px",
          borderRadius: "8px",
          fontSize: "11px",
          fontFamily: "JetBrains Mono, monospace",
          border: "1px solid rgba(255,255,255,0.06)",
          zIndex: 10,
          userSelect: "none",
        }}
      >
        FPS: {fps}
      </div>
      <WebGLErrorBoundary fallback={<CanvasFallback />}>
        <Canvas
          camera={{ position: [0, 0, 300], fov: 60, near: 0.1, far: 5000 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#1A0129"));
          }}
        >
          <SceneContent onFps={onFps} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
