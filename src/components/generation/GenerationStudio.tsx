import { useState, useRef, useEffect, type ChangeEvent, type ReactNode } from 'react';
import type { StagedModel, Lux3DStyle, Lux3DVersion } from '../../types/aholo';
import type { GenerationPhase, GenerateOptions } from '../../hooks/useAholoGeneration';
import { hasConfiguredApiKey } from '../../services/aholo';
import { SmoothScrollArea } from '../SmoothScrollArea';

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
  onGenerate: (options: GenerateOptions) => Promise<StagedModel>;
  onSelectModel: (model: StagedModel) => void;
  onClearError: () => void;
}

interface VisualPreset {
  id: string;
  title: string;
  category: string;
  style: Lux3DStyle;
  prompt: string;
  icon: ReactNode;
}

const VISUAL_PRESETS: VisualPreset[] = [
  {
    id: 'couch-set',
    title: 'Designer Couch Set',
    category: 'Interior · Living',
    style: 'photorealistic',
    prompt:
      'Modern minimalist L-shaped boucle fabric couch set with plush throw pillows and a warm walnut coffee table',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
        <path d="M2 11h20v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6Z" />
        <path d="M4 19v2M20 19v2" />
      </svg>
    ),
  },
  {
    id: 'apple-workdesk',
    title: 'Apple Studio Workdesk',
    category: 'Workspace · Tech',
    style: 'photorealistic',
    prompt:
      'Clean minimalist creator workdesk with sleek aluminum Studio Display monitor, MacBook Pro, wireless keyboard and warm desk lamp',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    id: 'concept-sneaker',
    title: 'Sculpted Concept Sneaker',
    category: 'Wearable · Design',
    style: 'photorealistic',
    prompt:
      'Ergonomic signature athletic sneaker with sculpted translucent lattice midsole, breathable knit upper and suede accents',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 16.5v-3a2 2 0 0 1 2-2h2.5l3.5-4 2.5 2.5L17 12h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5Z" />
        <path d="M3 15h18" />
      </svg>
    ),
  },
  {
    id: 'studio-headphones',
    title: 'Studio Over-Ear Headphones',
    category: 'Audio · Lifestyle',
    style: 'photorealistic',
    prompt:
      'Brushed anodized aluminum wireless over-ear studio headphones with stitched memory-foam leather cushions and copper accents',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
      </svg>
    ),
  },
];

const LUX3D_STYLES: Array<{ id: Lux3DStyle; label: string }> = [
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'cyberpunk', label: 'Cyberpunk' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'anime', label: 'Anime' },
  { id: 'hand_painted', label: 'Hand Painted' },
  { id: 'glass', label: 'Glass' },
];

const PIPELINE_STEPS = [
  {
    id: 'dispatch',
    title: 'Connecting to Aholo Lux3D Cloud',
    subtitle: 'Authenticating & reserving GPU generation slot',
    threshold: 0,
  },
  {
    id: 'geometry',
    title: 'Sculpting 3D Mesh Geometry',
    subtitle: 'Synthesizing signed-distance field & surface topology',
    threshold: 18,
  },
  {
    id: 'textures',
    title: 'Baking PBR Materials & Lighting',
    subtitle: 'Generating metallic, roughness & normal textures',
    threshold: 55,
  },
  {
    id: 'staging',
    title: 'Mounting Asset into LuxStage',
    subtitle: 'Preparing GLB 2.0 container & fitting to 3D viewport',
    threshold: 86,
  },
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
  onClearError,
}: GenerationStudioProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'image' | 'presets'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [style, setStyle] = useState<Lux3DStyle>('photorealistic');
  const [version, setVersion] = useState<Lux3DVersion>('G1-Turbo');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number>(150000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy =
    isSubmitting ||
    phase === 'dispatching' ||
    phase === 'processing' ||
    phase === 'downloading';
  const keyReady = hasConfiguredApiKey();

  // Live elapsed timer during generation
  useEffect(() => {
    if (!isBusy) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [isBusy]);

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: VisualPreset) => {
    if (isBusy) return;
    setSelectedPresetId(preset.id);
    setPrompt(preset.prompt);
    setStyle(preset.style);
  };

  const handleSubmit = async () => {
    onClearError();
    if (activeTab === 'prompt' && !prompt.trim()) return;
    if (activeTab === 'image' && !selectedImage) return;

    setIsSubmitting(true);
    try {
      await onGenerate({
        prompt: activeTab === 'prompt' ? prompt.trim() : undefined,
        image: activeTab === 'image' ? selectedImage || undefined : undefined,
        style,
        version,
        faceCount,
      });
    } catch {
      // error is displayed in modal
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className={`lux-modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={() => {
        if (!isBusy) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="lux-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lux-modal-header">
          <div className="lux-modal-title-wrap">
            <div className="lux-modal-icon-badge">✦</div>
            <div>
              <div className="lux-modal-title">
                {isBusy ? 'Generating 3D Asset' : 'Generate 3D Model'}
                <span className="lux-badge-pill">Aholo Lux3D</span>
              </div>
              <div className="lux-modal-subtitle">
                {isBusy
                  ? 'Creating & staging your 3D model in the LuxStage darkroom'
                  : 'Transform text prompts or 2D sketches into interactive 3D assets'}
              </div>
            </div>
          </div>
          {!isBusy && (
            <button
              type="button"
              className="lux-modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          )}
        </div>

        {/* Dedicated Aesthetic Studio Progress Screen when generating (Zero form clutter, Zero blip) */}
        {isBusy ? (
          <div className="lux-generation-stage">
            <div className="lux-gen-hero">
              <div className="lux-gen-orb-wrap" aria-hidden="true">
                <div className="lux-gen-orb-ring" />
                <div className="lux-gen-orb-core">✦</div>
              </div>
              <div className="lux-gen-meta">
                <div className="lux-gen-status-row">
                  <span className="lux-gen-status-title">{statusText}</span>
                  <span className="lux-gen-timer">
                    {formatTimer(elapsedSec)} · <strong>{progressPercent}%</strong>
                  </span>
                </div>
                <div className="lux-progress-track">
                  <div
                    className="lux-progress-fill"
                    style={{ width: `${Math.max(6, progressPercent)}%` }}
                  />
                </div>
                {prompt && activeTab === 'prompt' && (
                  <div className="lux-gen-prompt-pill" title={prompt}>
                    “{prompt}”
                  </div>
                )}
              </div>
            </div>

            <div className="lux-pipeline-list">
              {PIPELINE_STEPS.map((step, index) => {
                const nextThreshold = PIPELINE_STEPS[index + 1]?.threshold ?? 100;
                const isDone = progressPercent >= nextThreshold;
                const isCurrent =
                  progressPercent >= step.threshold && progressPercent < nextThreshold;
                return (
                  <div
                    key={step.id}
                    className={`lux-pipeline-step ${
                      isDone ? 'done' : isCurrent ? 'active' : 'pending'
                    }`}
                  >
                    <div className="lux-pipeline-indicator">
                      {isDone ? '✓' : isCurrent ? '✦' : index + 1}
                    </div>
                    <div className="lux-pipeline-text">
                      <strong>{step.title}</strong>
                      <span>{step.subtitle}</span>
                    </div>
                    <span className="lux-pipeline-badge">
                      {isDone ? 'Complete' : isCurrent ? 'In Progress' : 'Waiting'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* API Key Notice (only if neither .env.local nor browser storage has a key) */}
            {!keyReady && (
              <div style={{ padding: '12px 24px 0' }}>
                <div className="lux-alert-box">
                  <span>No Aholo API key configured yet.</span>
                  <button
                    type="button"
                    className="lux-alert-btn"
                    onClick={onOpenSettings}
                  >
                    Enter API Key ↗
                  </button>
                </div>
              </div>
            )}

            {/* Sleek Segmented Pill Tabs */}
            <div className="lux-segmented-bar-wrap">
              <div className="lux-segmented-bar" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'prompt'}
                  className={`lux-segmented-tab ${activeTab === 'prompt' ? 'active' : ''}`}
                  onClick={() => setActiveTab('prompt')}
                >
                  <span>✦</span> Text to 3D
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'image'}
                  className={`lux-segmented-tab ${activeTab === 'image' ? 'active' : ''}`}
                  onClick={() => setActiveTab('image')}
                >
                  <span>🖼</span> Image to 3D
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'presets'}
                  className={`lux-segmented-tab ${activeTab === 'presets' ? 'active' : ''}`}
                  onClick={() => setActiveTab('presets')}
                >
                  <span>⬡</span> Staged Library ({recentModels.length})
                </button>
              </div>
            </div>

            {/* Consistent-Height Tab Stage */}
            <SmoothScrollArea className="lux-modal-body lux-tab-stage" key={activeTab}>
              {activeTab === 'prompt' && (
                <>
                  {/* Prompt Input */}
                  <div>
                    <label className="lux-section-label" style={{ marginBottom: 6 }}>
                      <span>Describe your 3D model</span>
                      {prompt && (
                        <button
                          type="button"
                          onClick={() => {
                            setPrompt('');
                            setSelectedPresetId(null);
                          }}
                          className="lux-clear-link"
                        >
                          Clear
                        </button>
                      )}
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => {
                        setPrompt(e.target.value);
                        setSelectedPresetId(null);
                      }}
                      placeholder="Describe an object, furniture piece, workspace setup, wearable, or robot…"
                      className="lux-prompt-textarea"
                      rows={2}
                    />
                  </div>

                  {/* 2x2 Visual Preset Cards */}
                  <div>
                    <div className="lux-section-label" style={{ marginBottom: 8 }}>
                      <span>Instant Preset Ideas</span>
                      <span className="lux-section-hint">Click to fill prompt & style</span>
                    </div>
                    <div className="lux-visual-preset-grid">
                      {VISUAL_PRESETS.map((preset) => {
                        const isSelected =
                          selectedPresetId === preset.id || prompt === preset.prompt;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            className={`lux-visual-preset-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleSelectPreset(preset)}
                          >
                            <div className="lux-preset-card-icon">{preset.icon}</div>
                            <div className="lux-preset-card-info">
                              <strong>{preset.title}</strong>
                              <span>{preset.category}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Compact Style + Engine Settings Card */}
                  <div className="lux-compact-controls">
                    <div className="lux-style-row">
                      <span className="lux-mini-label">Style:</span>
                      <div className="lux-style-pills">
                        {LUX3D_STYLES.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStyle(s.id)}
                            className={`lux-style-pill ${style === s.id ? 'active' : ''}`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="lux-engine-row">
                      <div className="lux-engine-toggle">
                        <span className="lux-mini-label">Engine:</span>
                        {(['G1-Turbo', 'G1'] as const).map((ver) => (
                          <button
                            key={ver}
                            type="button"
                            onClick={() => setVersion(ver)}
                            className={`lux-engine-pill ${version === ver ? 'active' : ''}`}
                          >
                            {ver === 'G1-Turbo' ? '⚡ G1-Turbo' : '💎 G1 HD'}
                          </button>
                        ))}
                      </div>

                      <div className="lux-poly-control">
                        <span className="lux-mini-label">
                          Mesh: <strong>{Math.round(faceCount / 1000)}k</strong> faces
                        </span>
                        <input
                          type="range"
                          min={50000}
                          max={300000}
                          step={25000}
                          value={faceCount}
                          onChange={(e) => setFaceCount(Number(e.target.value))}
                          className="lux-range-input"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'image' && (
                <>
                  <div>
                    <label className="lux-section-label" style={{ marginBottom: 8 }}>
                      <span>Upload a 2D Reference Image or Sketch</span>
                      {selectedImage && (
                        <button
                          type="button"
                          onClick={() => setSelectedImage(null)}
                          className="lux-clear-link"
                        >
                          Remove image
                        </button>
                      )}
                    </label>
                    <div
                      className="lux-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleImageFile}
                      />
                      {selectedImage ? (
                        <div>
                          <img
                            src={selectedImage}
                            alt="Reference preview"
                            style={{
                              maxHeight: 165,
                              maxWidth: '100%',
                              borderRadius: 10,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                              marginBottom: 8,
                            }}
                          />
                          <div className="lux-dropzone-desc">
                            Click to choose a different reference image
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="lux-dropzone-icon">🖼</div>
                          <div className="lux-dropzone-title">
                            Click to select a 2D photo, product render, or concept sketch
                          </div>
                          <div className="lux-dropzone-desc">
                            PNG, JPG, or WEBP · Reconstructed into a full 360° textured GLB via Aholo Lux3D
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="lux-compact-controls" style={{ marginTop: 'auto' }}>
                    <div className="lux-engine-row">
                      <div className="lux-engine-toggle">
                        <span className="lux-mini-label">Engine:</span>
                        {(['G1-Turbo', 'G1'] as const).map((ver) => (
                          <button
                            key={ver}
                            type="button"
                            onClick={() => setVersion(ver)}
                            className={`lux-engine-pill ${version === ver ? 'active' : ''}`}
                          >
                            {ver === 'G1-Turbo' ? '⚡ G1-Turbo' : '💎 G1 HD'}
                          </button>
                        ))}
                      </div>

                      <div className="lux-poly-control">
                        <span className="lux-mini-label">
                          Mesh: <strong>{Math.round(faceCount / 1000)}k</strong> faces
                        </span>
                        <input
                          type="range"
                          min={50000}
                          max={300000}
                          step={25000}
                          value={faceCount}
                          onChange={(e) => setFaceCount(Number(e.target.value))}
                          className="lux-range-input"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'presets' && (
                <div className="lux-library-container">
                  <div className="lux-section-label" style={{ marginBottom: 10 }}>
                    <span>Generated & Staged 3D Assets</span>
                    <span className="lux-section-hint">Click any model to load into playground</span>
                  </div>
                  <div className="lux-library-list">
                    {recentModels.map((item) => {
                      const isCurrent = activeModel.id === item.id;
                      const isAholo = item.source === 'aholo-lux3d';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`lux-library-row ${isCurrent ? 'active' : ''}`}
                          onClick={() => onSelectModel(item)}
                        >
                          <div className={`lux-library-icon ${isAholo ? 'aholo' : ''}`}>
                            {isAholo ? '✦' : '⬡'}
                          </div>
                          <div className="lux-library-info">
                            <div className="lux-library-title-row">
                              <strong>{item.name}</strong>
                              <span className={`lux-library-tag ${isAholo ? 'aholo' : ''}`}>
                                {isAholo ? '✦ Aholo Lux3D' : 'Starter Asset'}
                              </span>
                            </div>
                            {item.prompt && (
                              <p className="lux-library-prompt">“{item.prompt}”</p>
                            )}
                          </div>
                          <div className="lux-library-action">
                            {isCurrent ? 'Staged' : 'Load →'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="lux-error-banner">
                  <strong>Generation Error:</strong> {error}
                </div>
              )}

              {/* Primary CTA Button */}
              {(activeTab === 'prompt' || activeTab === 'image') && (
                <button
                  type="button"
                  className="lux-action-btn"
                  onClick={handleSubmit}
                  disabled={
                    (activeTab === 'prompt' && !prompt.trim()) ||
                    (activeTab === 'image' && !selectedImage)
                  }
                >
                  <span aria-hidden="true">✦</span>
                  <span>Generate 3D Model</span>
                </button>
              )}
            </SmoothScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
