import { useState, useRef, type ChangeEvent } from 'react';
import {
  Wand2,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  History,
  X,
} from 'lucide-react';
import type { StagedModel } from '../../types/aholo';
import type { GenerationPhase } from '../../hooks/useAholoGeneration';
import { getStoredApiKey } from '../../services/aholo';

interface GenerationStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  phase: GenerationPhase;
  statusText: string;
  progressPercent: number;
  error: string | null;
  activeModel: StagedModel;
  recentModels: StagedModel[];
  onGenerate: (options: { prompt?: string; image?: string; faceCount?: number }) => Promise<StagedModel>;
  onSelectModel: (model: StagedModel) => void;
  onUploadLocalGlb: (file: File) => Promise<StagedModel>;
  onClearError: () => void;
}

const PROMPT_SUGGESTIONS = [
  'Futuristic tactical drone with quad-rotors, carbon fiber body and PBR camera sensor',
  'Ancient ornate bronze astrolabe with celestial engraved gears and patina finish',
  'Heavy industrial cybernetic robotic arm with hydraulic cylinders and hazard stripes',
  'Retro sci-fi laser blaster with vacuum tubes, heat sink fins and worn paint',
  'Ergonomic athletic sneaker with organic lattice sole and translucent mesh',
];

export function GenerationStudio({
  isOpen,
  onClose,
  onOpenSettings,
  phase,
  statusText,
  progressPercent,
  error,
  activeModel,
  recentModels,
  onGenerate,
  onSelectModel,
  onUploadLocalGlb,
  onClearError,
}: GenerationStudioProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'image' | 'upload'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number>(150000);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);

  const isBusy = phase === 'dispatching' || phase === 'processing' || phase === 'downloading';
  const apiKey = getStoredApiKey();

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGlbUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onUploadLocalGlb(file);
      onClose();
    } catch {
      // handled in hook
    }
  };

  const handleSubmit = async () => {
    onClearError();
    if (activeTab === 'prompt' && !prompt.trim()) return;
    if (activeTab === 'image' && !selectedImage) return;

    try {
      await onGenerate({
        prompt: activeTab === 'prompt' ? prompt.trim() : undefined,
        image: activeTab === 'image' ? selectedImage || undefined : undefined,
        faceCount,
      });
    } catch {
      // handled in hook
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-slate-900/95 border-l border-slate-800 backdrop-blur-xl z-50 flex flex-col shadow-2xl transition-transform animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-sm text-slate-100 flex items-center gap-1.5">
              Generative 3D Studio
              <span className="font-mono text-[10px] text-sky-400 bg-sky-950 px-1.5 py-0.5 rounded border border-sky-800 font-normal">
                Lux3D Engine
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Synthesize & stage textured 3D assets on demand</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* API Key Alert if not detected */}
      {!apiKey && (
        <div className="mx-4 mt-3 p-3 bg-amber-950/40 border border-amber-500/30 rounded-lg flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-200">
            <span className="font-semibold">Aholo API key needed:</span> Paste your key to generate new 3D assets via the cloud.
            <button
              onClick={onOpenSettings}
              className="ml-1 text-sky-400 underline font-medium hover:text-sky-300"
            >
              Enter API Key
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'prompt'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" /> Text Prompt
        </button>
        <button
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'image'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" /> 2D Image / Sketch
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-1.5 pb-2.5 px-2 text-xs font-medium border-b-2 transition ${
            activeTab === 'upload'
              ? 'border-sky-400 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Direct GLB
        </button>
      </div>

      {/* Main Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'prompt' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Describe the 3D model you want to generate:
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                disabled={isBusy}
                placeholder="e.g. Cyberpunk hover vehicle with neon underglow and titanium plating..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
              />
            </div>

            {/* Prompt presets */}
            <div>
              <div className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Suggested Prompts
              </div>
              <div className="flex flex-col gap-1.5">
                {PROMPT_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setPrompt(item)}
                    className="text-left text-[11px] text-slate-400 hover:text-sky-300 p-2 rounded bg-slate-950/60 border border-slate-800/80 hover:border-sky-500/40 transition truncate"
                  >
                    "{item}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'image' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              Upload a 2D concept image or sketch:
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 bg-slate-950/60 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageFile}
              />
              {selectedImage ? (
                <div className="relative group">
                  <img
                    src={selectedImage}
                    alt="Upload preview"
                    className="w-32 h-32 object-contain rounded-lg border border-slate-700 shadow-md"
                  />
                  <div className="text-[10px] text-slate-400 mt-2 text-center">Click to replace image</div>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-200">Click or drop image file here</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, or WEBP up to 10MB</div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              Drop an existing .glb model file:
            </label>
            <div
              onClick={() => glbInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 bg-slate-950/60 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition"
            >
              <input
                ref={glbInputRef}
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={handleGlbUpload}
              />
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-xs font-medium text-slate-200">Load local .GLB / .GLTF file</div>
              <div className="text-[10px] text-slate-500 mt-0.5">100% client-side instant preview</div>
            </div>
          </div>
        )}

        {/* Quality Controls */}
        {activeTab !== 'upload' && (
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Model Resolution</span>
              <span className="text-xs font-mono text-sky-400">{faceCount.toLocaleString()} faces</span>
            </div>
            <input
              type="range"
              min={50000}
              max={300000}
              step={25000}
              value={faceCount}
              onChange={(e) => setFaceCount(Number(e.target.value))}
              disabled={isBusy}
              className="w-full accent-sky-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Fast (50k)</span>
              <span>Balanced (150k)</span>
              <span>Ultra (300k)</span>
            </div>
          </div>
        )}

        {/* Progress or Error Display */}
        {isBusy && (
          <div className="p-3.5 bg-sky-950/40 border border-sky-500/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-sky-300 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {statusText}
              </span>
              <span className="font-mono text-sky-400 font-semibold">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-200">
              <span className="font-semibold">Error:</span> {error}
            </div>
          </div>
        )}

        {/* Generate Action Button */}
        {activeTab !== 'upload' && (
          <button
            onClick={handleSubmit}
            disabled={isBusy || (activeTab === 'prompt' && !prompt.trim()) || (activeTab === 'image' && !selectedImage)}
            className="w-full py-2.5 rounded-lg font-sans font-semibold text-xs text-slate-950 bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing with Aholo Lux3D...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" /> Synthesize 3D Model with Lux3D
              </>
            )}
          </button>
        )}

        {/* Staged & Recent Models */}
        <div className="pt-2 border-t border-slate-800">
          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-slate-400" /> Staged Model Library
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {recentModels.map((item) => {
              const isSelected = activeModel.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectModel(item)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                    isSelected
                      ? 'bg-sky-950/60 border-sky-400 text-sky-200'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-sky-400 shadow-[0_0_6px_#38bdf8]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60">
                    {item.source === 'aholo-lux3d' ? 'Lux3D' : item.source === 'upload' ? 'Upload' : 'Preset'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
