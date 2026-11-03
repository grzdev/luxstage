import {
  Suspense,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import {
  Vector3,
  SpotLight,
  Group,
  MathUtils,
  type Mesh,
} from 'three';
import { SelectableModel, SpatialProvider, type SurfaceHit } from '../../spatialkit';
import type { HotspotNote } from '../../types/aholo';

export type StageMode = 'spotlight' | 'turntable' | 'gimbal' | 'tour';

interface StageCanvasProps {
  modelUrl: string;
  stageMode: StageMode;
  spotlightAngle: number; // 0 - 360 deg
  spotlightIntensity: number; // 0 - 100 %
  turntableSpeed: number;
  gimbalValue: { x: number; y: number };
  hotspots: HotspotNote[];
  isPinningHotspot: boolean;
  onSurfaceClick: (hit: SurfaceHit) => void;
  activeHotspotIndex: number | null;
  onSelectHotspot: (index: number) => void;
}

/**
 * Dynamic lighting rig that reconfigures based on the active stage mode.
 */
function DynamicLighting({
  stageMode,
  spotlightAngle,
  spotlightIntensity,
}: {
  stageMode: StageMode;
  spotlightAngle: number;
  spotlightIntensity: number;
}) {
  const spotRef = useRef<SpotLight>(null);
  const rad = MathUtils.degToRad(spotlightAngle);
  const distance = 4.5;
  const height = 3.5;

  // Calculate spotlight position in circular orbit
  const spotX = Math.sin(rad) * distance;
  const spotZ = Math.cos(rad) * distance;
  const intensityFactor = (spotlightIntensity / 100) * 14;

  if (stageMode === 'spotlight') {
    return (
      <>
        {/* Darkroom low ambient */}
        <ambientLight intensity={0.15} color="#38bdf8" />
        {/* Focused Orbiting Spotlight */}
        <spotLight
          ref={spotRef}
          position={[spotX, height, spotZ]}
          target-position={[0, 0.6, 0]}
          intensity={intensityFactor}
          angle={Math.PI / 6}
          penumbra={0.6}
          color="#fef08a"
          castShadow
          shadow-bias={-0.0001}
        />
        {/* Subtle rim light for edge definition */}
        <pointLight
          position={[-spotX * 0.7, height * 0.6, -spotZ * 0.7]}
          intensity={0.4}
          color="#38bdf8"
        />
      </>
    );
  }

  // Turntable & Tour & Gimbal: Balanced studio showroom lighting
  return (
    <>
      <ambientLight intensity={0.7} color="#f8fafc" />
      <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
      <directionalLight position={[-5, 4, -4]} intensity={1.2} color="#93c5fd" />
      <pointLight position={[0, 4, 3]} intensity={1.5} color="#ffffff" />
    </>
  );
}

/**
 * Camera controller managing Gimbal turret motion or Tour interpolation.
 */
function CameraRigController({
  stageMode,
  gimbalValue,
  activeHotspot,
}: {
  stageMode: StageMode;
  gimbalValue: { x: number; y: number };
  activeHotspot: HotspotNote | null;
}) {
  const { camera } = useThree();
  const currentPos = useRef(new Vector3(0, 1.5, 4.2));
  const currentLookAt = useRef(new Vector3(0, 0.7, 0));

  useFrame((_, delta) => {
    if (stageMode === 'gimbal') {
      // Steer camera orientation with joystick
      const targetYaw = -gimbalValue.x * 0.75;
      const targetPitch = gimbalValue.y * 0.45;
      camera.rotation.y = MathUtils.damp(camera.rotation.y, targetYaw, 8, delta);
      camera.rotation.x = MathUtils.damp(camera.rotation.x, targetPitch, 8, delta);
    } else if (stageMode === 'tour' && activeHotspot) {
      // Smoothly fly camera to framed hotspot vantage point
      const hp = new Vector3(...activeHotspot.position);
      const targetCameraPos = hp.clone().add(new Vector3(0.8, 0.5, 1.2));
      camera.position.lerp(targetCameraPos, delta * 3.5);
      camera.lookAt(hp);
    }
  });

  return null;
}

/**
 * Turntable spinning stage wrapper.
 */
function TurntableGroup({
  stageMode,
  speed,
  children,
}: {
  stageMode: StageMode;
  speed: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    if (stageMode === 'turntable' && groupRef.current) {
      groupRef.current.rotation.y += delta * speed * 0.8;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

export function StageCanvas({
  modelUrl,
  stageMode,
  spotlightAngle,
  spotlightIntensity,
  turntableSpeed,
  gimbalValue,
  hotspots,
  isPinningHotspot,
  onSurfaceClick,
  activeHotspotIndex,
  onSelectHotspot,
}: StageCanvasProps) {
  const activeHotspot =
    activeHotspotIndex !== null && hotspots[activeHotspotIndex]
      ? hotspots[activeHotspotIndex]
      : null;

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden select-none">
      {/* Viewport Overlay HUD / Crosshairs when in Gimbal mode */}
      {stageMode === 'gimbal' && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="w-48 h-48 border border-emerald-500/40 rounded-full flex items-center justify-center relative">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
            <div className="absolute top-0 w-[1px] h-4 bg-emerald-400/70" />
            <div className="absolute bottom-0 w-[1px] h-4 bg-emerald-400/70" />
            <div className="absolute left-0 w-4 h-[1px] bg-emerald-400/70" />
            <div className="absolute right-0 w-4 h-[1px] bg-emerald-400/70" />
          </div>
          <div className="absolute bottom-6 left-6 font-mono text-xs text-emerald-400 bg-slate-950/80 px-3 py-1.5 rounded border border-emerald-500/30">
            SEEKER GIMBAL LOCK ACTIVE [TRACKING]
          </div>
        </div>
      )}

      {/* Pinning Notification Banner */}
      {isPinningHotspot && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-sky-500/90 text-white font-mono text-xs px-4 py-2 rounded-full shadow-lg border border-sky-300 backdrop-blur pointer-events-none animate-pulse">
          Click anywhere on the 3D surface to pin a new feature hotspot
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 1.4, 3.8], fov: 45 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color
          attach="background"
          args={[stageMode === 'spotlight' ? '#040711' : '#090d16']}
        />

        <DynamicLighting
          stageMode={stageMode}
          spotlightAngle={spotlightAngle}
          spotlightIntensity={spotlightIntensity}
        />

        <CameraRigController
          stageMode={stageMode}
          gimbalValue={gimbalValue}
          activeHotspot={activeHotspot}
        />

        {stageMode !== 'gimbal' && stageMode !== 'tour' && (
          <OrbitControls
            makeDefault
            minDistance={1.2}
            maxDistance={12}
            target={[0, 0.6, 0]}
            dampingFactor={0.05}
          />
        )}

        <Suspense fallback={null}>
          <SpatialProvider>
            <TurntableGroup stageMode={stageMode} speed={turntableSpeed}>
              <SelectableModel
                src={modelUrl}
                modelId="luxstage-active-asset"
                fit={2.2}
                onSurfaceClick={onSurfaceClick}
              />

              {/* 3D Hotspot Markers */}
              {hotspots.map((note, idx) => {
                const isActive = activeHotspotIndex === idx;
                return (
                  <group key={note.id} position={note.position}>
                    <Html distanceFactor={8} position={[0, 0.08, 0]} center>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectHotspot(idx);
                        }}
                        className={`group relative cursor-pointer select-none transition-all ${
                          isActive ? 'scale-125 z-30' : 'hover:scale-110 z-20'
                        }`}
                      >
                        {/* Pin Dot */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold shadow-lg transition-colors ${
                            isActive
                              ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/30'
                              : 'bg-sky-500 text-white border border-sky-300'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Annotation Hover Card */}
                        <div
                          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-lg bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur transition-all pointer-events-auto ${
                            isActive ? 'block opacity-100' : 'hidden group-hover:block opacity-100'
                          }`}
                        >
                          <div className="font-sans text-xs font-semibold text-slate-100">
                            {note.title}
                          </div>
                          {note.description && (
                            <div className="font-sans text-[11px] text-slate-400 mt-1 leading-snug">
                              {note.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </Html>
                  </group>
                );
              })}
            </TurntableGroup>
          </SpatialProvider>

          {/* Contact Shadows on Floor */}
          <ContactShadows
            position={[0, -0.01, 0]}
            opacity={0.7}
            scale={8}
            blur={2.4}
            far={4}
            color="#000000"
          />

          {/* Studio Floor Grid */}
          <gridHelper
            args={[18, 36, '#1e293b', '#0f172a']}
            position={[0, -0.015, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
