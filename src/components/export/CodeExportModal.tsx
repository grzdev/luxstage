import { useState } from 'react';
import { X, Copy, Check, Download, Code2 } from 'lucide-react';
import type { StagedModel, HotspotNote } from '../../types/aholo';
import type { StageMode } from '../canvas/StageCanvas';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: StagedModel;
  stageMode: StageMode;
  spotlightAngle: number;
  spotlightIntensity: number;
  hotspots: HotspotNote[];
}

export function CodeExportModal({
  isOpen,
  onClose,
  activeModel,
  stageMode,
  spotlightAngle,
  spotlightIntensity,
  hotspots,
}: CodeExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const componentCode = `import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// Model asset generated/staged via LuxStage
const MODEL_URL = '${activeModel.url}';

// Hotspots configured in LuxStage
const HOTSPOTS = ${JSON.stringify(
    hotspots.map((h) => ({
      title: h.title,
      description: h.description,
      position: h.position,
    })),
    null,
    2
  )};

function Model() {
  const { scene } = useGLTF(MODEL_URL);
  return <primitive object={scene} />;
}

export function StagedModelViewer() {
  return (
    <div style={{ width: '100%', height: '500px', position: 'relative', background: '#070b14' }}>
      <Canvas shadows camera={{ position: [0, 1.4, 3.8], fov: 45 }}>
        {/* LuxStage Lighting Rig */}
        ${
          stageMode === 'spotlight'
            ? `<ambientLight intensity={0.15} color="#38bdf8" />
        <spotLight
          position={[${(Math.sin((spotlightAngle * Math.PI) / 180) * 4.5).toFixed(2)}, 3.5, ${(
                Math.cos((spotlightAngle * Math.PI) / 180) * 4.5
              ).toFixed(2)}]}
          target-position={[0, 0.6, 0]}
          intensity={${((spotlightIntensity / 100) * 14).toFixed(2)}}
          angle={Math.PI / 6}
          penumbra={0.6}
          color="#fef08a"
          castShadow
        />`
            : `<ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
        <directionalLight position={[-5, 4, -4]} intensity={1.2} color="#93c5fd" />`
        }

        <OrbitControls makeDefault minDistance={1.2} maxDistance={10} target={[0, 0.6, 0]} />

        <Suspense fallback={null}>
          <group position={[0, 0, 0]}>
            <Model />

            {/* Hotspots */}
            {HOTSPOTS.map((note, index) => (
              <group key={index} position={note.position as [number, number, number]}>
                <Html distanceFactor={8} position={[0, 0.08, 0]} center>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#38bdf8',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
                    cursor: 'pointer'
                  }}>
                    {index + 1}
                  </div>
                </Html>
              </group>
            ))}
          </group>

          <ContactShadows opacity={0.7} scale={8} blur={2.4} far={4} />
        </Suspense>
      </Canvas>
    </div>
  );
}
`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(componentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([componentCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'StagedModelViewer.tsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans font-bold text-sm text-slate-100">
                Export React Three Fiber Component
              </h3>
              <p className="text-[11px] text-slate-400">
                Drop this ready-to-run component directly into any Next.js, Vite, or React application.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Code Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950 font-mono text-xs text-sky-200/90 leading-relaxed border-b border-slate-800">
          <pre>{componentCode}</pre>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {hotspots.length} hotspot{hotspots.length === 1 ? '' : 's'} included
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download .tsx
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 transition flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
