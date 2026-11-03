import { useState, useRef, type ChangeEvent } from 'react';
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
  const [activeTab, setActiveTab] = useState<'prompt' | 'image' | 'upload' | 'presets'>('prompt');
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
    <div
      className={`lux-modal-backdrop ${isOpen ? 'open' : ''}`}
      onClick={onClose}
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
                Synthesize 3D Model
                <span className="lux-badge-pill">Aholo Lux3D</span>
              </div>
              <div className="lux-modal-subtitle">
                Synthesize production-ready 3D assets on demand for staging
              </div>
            </div>
          </div>
          <button
            type="button"
            className="lux-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* API Key Notice */}
        {!apiKey && (
          <div style={{ padding: '12px 24px 0' }}>
            <div className="lux-alert-box">
              <span>Aholo API key not detected in browser storage.</span>
              <button
                type="button"
                className="lux-alert-btn"
                onClick={onOpenSettings}
              >
                Configure Key ↗
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="lux-modal-tabs">
          <button
            type="button"
            className={`lux-modal-tab ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            ✦ Text Prompt
          </button>
          <button
            type="button"
            className={`lux-modal-tab ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
          >
            🖼 2D Sketch / Image
          </button>
          <button
            type="button"
            className={`lux-modal-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            📁 Upload GLB
          </button>
          <button
            type="button"
            className={`lux-modal-tab ${activeTab === 'presets' ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            ⬡ Showcase Presets
          </button>
        </div>

        {/* Body */}
        <div className="lux-modal-body">
          {activeTab === 'prompt' && (
            <>
              <div>
                <label className="lux-section-label" style={{ marginBottom: 6 }}>
                  <span>Describe the 3D model you want to generate:</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isBusy}
                  placeholder="e.g. Tactical futuristic drone with carbon fiber body and PBR camera sensor..."
                  className="lux-prompt-textarea"
                />
              </div>

              <div>
                <div className="lux-section-label" style={{ marginBottom: 8 }}>
                  <span>Suggested Prompts (1-Click Fill)</span>
                </div>
                <div className="lux-chip-grid">
                  {PROMPT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={isBusy}
                      onClick={() => setPrompt(item)}
                      className="lux-chip-btn"
                    >
                      "{item}"
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'image' && (
            <div>
              <label className="lux-section-label" style={{ marginBottom: 8 }}>
                <span>Upload a 2D Concept Image or Sketch:</span>
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
                      alt="Upload preview"
                      style={{
                        maxHeight: 140,
                        maxWidth: '100%',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        marginBottom: 8,
                      }}
                    />
                    <div className="lux-dropzone-desc">Click to choose a different image</div>
                  </div>
                ) : (
                  <>
                    <div className="lux-dropzone-icon">🖼</div>
                    <div className="lux-dropzone-title">Click to upload 2D reference sketch / image</div>
                    <div className="lux-dropzone-desc">PNG, JPG, or WEBP up to 10MB</div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <label className="lux-section-label" style={{ marginBottom: 8 }}>
                <span>Load existing .GLB / .GLTF 3D model:</span>
              </label>
              <div
                className="lux-dropzone"
                onClick={() => glbInputRef.current?.click()}
              >
                <input
                  ref={glbInputRef}
                  type="file"
                  accept=".glb,.gltf"
                  style={{ display: 'none' }}
                  onChange={handleGlbUpload}
                />
                <div className="lux-dropzone-icon">📁</div>
                <div className="lux-dropzone-title">Choose local .GLB / .GLTF file</div>
                <div className="lux-dropzone-desc">100% client-side instant preview (up to 500MB)</div>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div>
              <div className="lux-section-label" style={{ marginBottom: 8 }}>
                <span>Select a Staged Model Preset:</span>
              </div>
              <div className="lux-preset-grid">
                {recentModels.map((item) => (
                  <div
                    key={item.id}
                    className="lux-preset-card"
                    onClick={() => {
                      onSelectModel(item);
                      onClose();
                    }}
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {item.source === 'aholo-lux3d'
                        ? '✦ Lux3D Generated'
                        : item.source === 'upload'
                        ? 'Local Upload'
                        : 'Curated Asset'}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model Resolution Slider (for prompt & image) */}
          {(activeTab === 'prompt' || activeTab === 'image') && (
            <div className="lux-slider-card">
              <div className="lux-slider-header">
                <strong>Model Mesh Resolution:</strong>
                <span>{faceCount.toLocaleString()} faces</span>
              </div>
              <input
                type="range"
                min={50000}
                max={300000}
                step={25000}
                value={faceCount}
                onChange={(e) => setFaceCount(Number(e.target.value))}
                disabled={isBusy}
                className="lux-range-input"
              />
              <div className="lux-slider-ticks">
                <span>Fast (50k)</span>
                <span>Balanced (150k)</span>
                <span>Ultra (300k)</span>
              </div>
            </div>
          )}

          {/* Progress Box */}
          {isBusy && (
            <div className="lux-progress-card">
              <div className="lux-progress-header">
                <span>✦ {statusText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="lux-progress-track">
                <div
                  className="lux-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#fca5a5',
                fontSize: 12,
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Action Button */}
          {(activeTab === 'prompt' || activeTab === 'image') && (
            <button
              type="button"
              className="lux-action-btn"
              onClick={handleSubmit}
              disabled={
                isBusy ||
                (activeTab === 'prompt' && !prompt.trim()) ||
                (activeTab === 'image' && !selectedImage)
              }
            >
              {isBusy ? 'Synthesizing with Aholo Lux3D…' : '✦ Synthesize 3D Model with Lux3D'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
