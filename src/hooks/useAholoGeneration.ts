import { useState, useCallback } from 'react';
import type {
  StagedModel,
  Lux3DStyle,
  Lux3DVersion,
  Lux3DTaskDetail,
} from '../types/aholo';
import {
  createLux3DTask,
  pollLux3DTask,
  SHOWCASE_PRESETS,
  loadSavedGeneratedModels,
  saveGeneratedModelToStorage,
} from '../services/aholo';

export type GenerationPhase =
  | 'idle'
  | 'dispatching'
  | 'processing'
  | 'downloading'
  | 'ready'
  | 'error';

export interface GenerateOptions {
  prompt?: string;
  displayTitle?: string;
  image?: string;
  style?: Lux3DStyle;
  version?: Lux3DVersion;
  faceCount?: number;
  onMountModel?: (
    url: string,
    name: string,
    onProgress: (percent: number, stage: string) => void
  ) => Promise<void>;
}

const PROMPT_FILLER_WORDS = new Set([
  'a', 'an', 'the', 'single', 'with', 'and', 'or', 'of', 'on', 'in', 'for', 'to', 'by',
  'detailed', 'photorealistic', 'realistic', 'modern', 'minimalist', 'clean', 'sleek',
  'ergonomic', 'signature', 'sculpted', 'brushed', 'anodized', 'high', 'quality', 'ultra',
  '3d', 'model', 'object', 'asset', 'design', 'style', 'showing', 'featuring',
]);

export function formatCompactModelName(prompt?: string, explicitTitle?: string): string {
  const source = (explicitTitle || prompt || '').trim();
  if (!source) return 'Aholo Asset';

  if (explicitTitle && explicitTitle.trim().length <= 22) {
    return explicitTitle.trim();
  }

  const words = source
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const meaningful = words.filter((w) => !PROMPT_FILLER_WORDS.has(w.toLowerCase()));
  const chosen = (meaningful.length >= 2 ? meaningful : words).slice(0, 2);
  let title = chosen
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  if (title.length > 20) {
    title = `${title.slice(0, 19).trimEnd()}…`;
  }
  return title || 'Aholo Asset';
}

export interface UseAholoGenerationReturn {
  phase: GenerationPhase;
  statusText: string;
  progressPercent: number;
  error: string | null;
  activeModel: StagedModel;
  recentModels: StagedModel[];
  generateFromAsset: (options: GenerateOptions) => Promise<StagedModel>;
  selectModel: (model: StagedModel) => void;
  clearError: () => void;
}

export function useAholoGeneration(): UseAholoGenerationReturn {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [statusText, setStatusText] = useState<string>('Ready');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [recentModels, setRecentModels] = useState<StagedModel[]>(() => {
    const saved = loadSavedGeneratedModels().map((m) => ({
      ...m,
      name:
        m.prompt && /headphones/i.test(m.prompt)
          ? 'White Headphones'
          : m.name.length > 22
          ? formatCompactModelName(m.prompt || m.name)
          : m.name,
    }));
    const savedIds = new Set(saved.map((m) => m.id));
    return [...saved, ...SHOWCASE_PRESETS.filter((p) => !savedIds.has(p.id))];
  });
  const [activeModel, setActiveModel] = useState<StagedModel>(() => {
    return SHOWCASE_PRESETS[0];
  });

  const clearError = useCallback(() => {
    setError(null);
    setPhase('idle');
    setStatusText('Ready');
  }, []);

  const selectModel = useCallback((model: StagedModel) => {
    setActiveModel(model);
    setPhase('ready');
    setStatusText(`Loaded ${model.name}`);
  }, []);

  const generateFromAsset = useCallback(
    async (options: GenerateOptions): Promise<StagedModel> => {
      setError(null);
      setPhase('dispatching');
      setStatusText('Connecting to Aholo Lux3D studio engine…');
      setProgressPercent(8);

      try {
        // Step 1: Create Generation Task via real Aholo Lux3D API
        const taskId = await createLux3DTask({
          prompt: options.prompt,
          image: options.image,
          style: options.style || 'photorealistic',
          version: options.version || 'G1-Turbo',
          faceCount: options.faceCount || 150000,
          enablePbr: true,
        });

        setPhase('processing');
        setStatusText('Sculpting 3D geometry & surface topology…');
        setProgressPercent(20);

        // Step 2: Poll Task Status until status === 3 (LUX3D_STATUS_SUCCESS)
        const { glbUrl } = await pollLux3DTask(taskId, (detail: Lux3DTaskDetail, attempt: number) => {
          const dynamicProgress = Math.min(20 + attempt * 5, 82);
          setProgressPercent(dynamicProgress);

          if (detail.status === 0) {
            setStatusText('Initializing generation stage in cloud…');
          } else if (detail.status === 1) {
            if (dynamicProgress >= 55) {
              setStatusText('Baking PBR materials, lighting & surface textures…');
            } else {
              setStatusText('Sculpting 3D geometry & surface topology…');
            }
          }
        });

        // Step 3: Download & Mount Completed GLB into LuxStage BEFORE leaving busy state
        setPhase('downloading');
        setStatusText('Preparing & mounting 3D model into LuxStage…');
        setProgressPercent(88);

        const shortName = options.prompt || options.displayTitle
          ? formatCompactModelName(options.prompt, options.displayTitle)
          : `Aholo #${String(taskId).slice(-4)}`;

        const newModel: StagedModel = {
          id: `aholo-${taskId}`,
          name: shortName,
          source: 'aholo-lux3d',
          url: glbUrl,
          prompt: options.prompt,
          style: options.style,
          taskId,
          createdAt: Date.now(),
        };

        if (options.onMountModel) {
          await options.onMountModel(glbUrl, newModel.name, (pct, stage) => {
            const mapped = Math.min(99, Math.round(88 + (pct / 100) * 11));
            setProgressPercent(mapped);
            setStatusText(stage || 'Mounting 3D model into stage…');
          });
        }

        saveGeneratedModelToStorage(newModel);
        setActiveModel(newModel);
        setRecentModels((prev) => [newModel, ...prev.filter((m) => m.id !== newModel.id)]);
        setProgressPercent(100);
        setStatusText('Model staged!');
        setPhase('ready');

        return newModel;
      } catch (err: any) {
        console.error('Aholo generation error:', err);
        const msg = err.message || 'Generation failed. Check your API key or prompt.';
        setError(msg);
        setPhase('error');
        setStatusText('Generation failed');
        throw err;
      }
    },
    []
  );

  return {
    phase,
    statusText,
    progressPercent,
    error,
    activeModel,
    recentModels,
    generateFromAsset,
    selectModel,
    clearError,
  };
}
