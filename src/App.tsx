import { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Lightbulb,
  RotateCw,
  Crosshair,
  MapPin,
  Settings,
  Code2,
  Play,
  Square,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { StageCanvas, type StageMode } from './components/canvas/StageCanvas';
import {
  TactileDial,
  PullLever,
  TactileJoystick,
} from './components/rigs/TactileRigs';
import { GenerationStudio } from './components/generation/GenerationStudio';
import { CodeExportModal } from './components/export/CodeExportModal';
import { SettingsModal } from './components/SettingsModal';
import { useAholoGeneration } from './hooks/useAholoGeneration';
import type { HotspotNote } from './types/aholo';
import type { SurfaceHit } from './spatialkit';

const INITIAL_HOTSPOTS: HotspotNote[] = [
  {
    id: 'hp-1',
    title: 'Visor Optics Array',
    description: 'Polarized holographic HUD sensor cluster with anti-glare nano-coating.',
    position: [0.15, 0.72, 0.78],
  },
  {
    id: 'hp-2',
    title: 'Pneumatic Seal Collar',
    description: 'Hermetic pressure seal rated for high-g orbital re-entry and toxic environments.',
    position: [-0.35, 0.28, -0.2],
  },
];

export function App() {
  const {
    phase,
    statusText,
    progressPercent,
    error,
    activeModel,
    recentModels,
    generateFromAsset,
    selectModel,
    loadLocalGlbFile,
    clearError,
  } = useAholoGeneration();

  // Rig Controls State
  const [stageMode, setStageMode] = useState<StageMode>('spotlight');
  const [spotlightAngle, setSpotlightAngle] = useState<number>(45);
  const [spotlightIntensity, setSpotlightIntensity] = useState<number>(85);
  const [turntableSpeed, setTurntableSpeed] = useState<number>(1.2);
  const [gimbalValue, setGimbalValue] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Hotspots & Tour State
  const [hotspots, setHotspots] = useState<HotspotNote[]>(INITIAL_HOTSPOTS);
  const [isPinningHotspot, setIsPinningHotspot] = useState<boolean>(false);
  const [activeHotspotIndex, setActiveHotspotIndex] = useState<number | null>(0);
  const [isTourPlaying, setIsTourPlaying] = useState<boolean>(false);

  // Modals & Panels
  const [isStudioOpen, setIsStudioOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Surface click handler for pinning hotspots
  const handleSurfaceClick = useCallback(
    (hit: SurfaceHit) => {
      if (!isPinningHotspot) return;

      const newPoint: [number, number, number] = hit.worldPoint || hit.point;
      const newHotspot: HotspotNote = {
        id: `hp-${Date.now()}`,
        title: `Feature ${hotspots.length + 1}: ${hit.part.name || 'Component'}`,
        description: 'Custom annotated inspect point on the generated 3D surface mesh.',
        position: newPoint,
      };

      setHotspots((prev) => [...prev, newHotspot]);
      setActiveHotspotIndex(hotspots.length);
      setIsPinningHotspot(false);
    },
    [isPinningHotspot, hotspots.length]
  );

  // Tour Player Timer
  useEffect(() => {
    if (!isTourPlaying || hotspots.length === 0) return;
    const timer = setInterval(() => {
      setActiveHotspotIndex((prev) => {
        if (prev === null) return 0;
        return (prev + 1) % hotspots.length;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [isTourPlaying, hotspots.length]);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between z-30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-emerald-400 p-[1px] flex items-center justify-center shadow-lg shadow-sky-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <span className="font-bold text-sky-400 text-sm">✦</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-tight text-slate-100">LuxStage</h1>
              <span className="text-[10px] font-mono uppercase bg-slate-800 text-sky-400 border border-slate-700 px-1.5 py-0.2 rounded font-semibold">
                3D AI Staging
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-xs sm:max-w-md">
              Active: <span className="text-slate-300 font-medium">{activeModel.name}</span>
            </p>
          </div>
        </div>

        {/* Center Stage Mode Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setStageMode('spotlight')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              stageMode === 'spotlight'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" /> Darkroom Spotlight
          </button>
          <button
            onClick={() => setStageMode('turntable')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              stageMode === 'turntable'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" /> 360° Turntable
          </button>
          <button
            onClick={() => setStageMode('gimbal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              stageMode === 'gimbal'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" /> Flight Gimbal
          </button>
          <button
            onClick={() => setStageMode('tour')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              stageMode === 'tour'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> Hotspot Tour
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 hover:brightness-110 shadow-lg shadow-sky-500/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" /> Generative Studio
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
            title="Export R3F Component"
          >
            <Code2 className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Export Code</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="API Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main 3D Canvas Viewport */}
      <main className="flex-1 relative overflow-hidden">
        <StageCanvas
          modelUrl={activeModel.url}
          stageMode={stageMode}
          spotlightAngle={spotlightAngle}
          spotlightIntensity={spotlightIntensity}
          turntableSpeed={turntableSpeed}
          gimbalValue={gimbalValue}
          hotspots={hotspots}
          isPinningHotspot={isPinningHotspot}
          onSurfaceClick={handleSurfaceClick}
          activeHotspotIndex={activeHotspotIndex}
          onSelectHotspot={(idx) => {
            setActiveHotspotIndex(idx);
            setStageMode('tour');
          }}
        />

        {/* Bottom Tactile Cockpit Panel */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl p-3 flex items-center gap-6">
          {/* Spotlight Mode Cockpit */}
          {stageMode === 'spotlight' && (
            <div className="flex items-center gap-8 px-2 animate-in fade-in duration-200">
              <TactileDial
                value={spotlightAngle}
                onChange={setSpotlightAngle}
                min={0}
                max={360}
                label="Spotlight Orbit"
                unit="°"
              />
              <div className="w-[1px] h-28 bg-slate-800" />
              <PullLever
                value={spotlightIntensity}
                onChange={setSpotlightIntensity}
                min={0}
                max={100}
                label="Beam Intensity"
                unit="%"
              />
            </div>
          )}

          {/* Turntable Mode Cockpit */}
          {stageMode === 'turntable' && (
            <div className="flex flex-col items-center gap-3 px-4 py-2 animate-in fade-in duration-200 min-w-[240px]">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
                Turntable Rotation Speed
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={turntableSpeed}
                onChange={(e) => setTurntableSpeed(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
              <div className="flex justify-between w-full text-[11px] font-mono text-slate-400">
                <button
                  onClick={() => setTurntableSpeed(0)}
                  className="hover:text-sky-300 underline"
                >
                  Pause
                </button>
                <span className="text-sky-400 font-semibold">{turntableSpeed.toFixed(1)}x speed</span>
                <button
                  onClick={() => setTurntableSpeed(1.2)}
                  className="hover:text-sky-300 underline"
                >
                  Reset (1.2x)
                </button>
              </div>
            </div>
          )}

          {/* Gimbal Mode Cockpit */}
          {stageMode === 'gimbal' && (
            <div className="flex items-center gap-4 px-2 animate-in fade-in duration-200">
              <TactileJoystick
                value={gimbalValue}
                onChange={setGimbalValue}
                label="2-Axis Seeker Turret"
              />
            </div>
          )}

          {/* Hotspot Tour Mode Cockpit */}
          {stageMode === 'tour' && (
            <div className="flex flex-col gap-2.5 px-3 py-1 animate-in fade-in duration-200 min-w-[280px]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
                  Hotspot Tour ({hotspots.length} Points)
                </div>
                <button
                  onClick={() => setIsPinningHotspot(!isPinningHotspot)}
                  className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium transition ${
                    isPinningHotspot
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Plus className="w-3 h-3" /> Pin Hotspot
                </button>
              </div>

              {/* Waypoint selector chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-sm py-1">
                {hotspots.map((h, i) => (
                  <button
                    key={h.id}
                    onClick={() => setActiveHotspotIndex(i)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition flex-shrink-0 ${
                      activeHotspotIndex === i
                        ? 'bg-sky-400 text-slate-950 font-bold'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    #{i + 1}
                  </button>
                ))}
              </div>

              {/* Play / Pause / Nav buttons */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setActiveHotspotIndex((prev) =>
                        prev === null || prev === 0 ? hotspots.length - 1 : prev - 1
                      )
                    }
                    disabled={hotspots.length === 0}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveHotspotIndex((prev) =>
                        prev === null ? 0 : (prev + 1) % hotspots.length
                      )
                    }
                    disabled={hotspots.length === 0}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setIsTourPlaying(!isTourPlaying)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    isTourPlaying
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}
                >
                  {isTourPlaying ? (
                    <>
                      <Square className="w-3 h-3 fill-current" /> Stop Tour
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" /> Auto Tour
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Slide-out Generative 3D Studio */}
      <GenerationStudio
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        onOpenSettings={() => {
          setIsStudioOpen(false);
          setIsSettingsOpen(true);
        }}
        phase={phase}
        statusText={statusText}
        progressPercent={progressPercent}
        error={error}
        activeModel={activeModel}
        recentModels={recentModels}
        onGenerate={generateFromAsset}
        onSelectModel={selectModel}
        onUploadLocalGlb={loadLocalGlbFile}
        onClearError={clearError}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Code Export Modal */}
      <CodeExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        activeModel={activeModel}
        stageMode={stageMode}
        spotlightAngle={spotlightAngle}
        spotlightIntensity={spotlightIntensity}
        hotspots={hotspots}
      />
    </div>
  );
}
export default App;
