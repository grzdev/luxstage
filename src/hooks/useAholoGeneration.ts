import { useState, useCallback } from 'react';
import type { StagedModel, Lux3DTaskStatusResponse } from '../types/aholo';
import {
  createLux3DTask,
  pollLux3DTask,
  SHOWCASE_PRESETS,
  getStoredApiKey,
} from '../services/aholo';

export type GenerationPhase =
  | 'idle'
  | 'dispatching'
  | 'processing'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UseAholoGenerationReturn {
  phase: GenerationPhase;
  statusText: string;
  progressPercent: number;
  error: string | null;
  activeModel: StagedModel;
  recentModels: StagedModel[];
  generateFromAsset: (options: { prompt?: string; image?: string; faceCount?: number }) => Promise<StagedModel>;
  selectModel: (model: StagedModel) => void;
  loadLocalGlbFile: (file: File) => Promise<StagedModel>;
  clearError: () => void;
}

export function useAholoGeneration(): UseAholoGenerationReturn {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [statusText, setStatusText] = useState<string>('Ready');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const [activeModel, setActiveModel] = useState<StagedModel>(SHOWCASE_PRESETS[0]);
  const [recentModels, setRecentModels] = useState<StagedModel[]>(SHOWCASE_PRESETS);

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

  const loadLocalGlbFile = useCallback(async (file: File): Promise<StagedModel> => {
    setPhase('dispatching');
    setStatusText(`Loading ${file.name}...`);
    try {
      const blobUrl = URL.createObjectURL(file);
      const newModel: StagedModel = {
        id: `local-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        source: 'upload',
        url: blobUrl,
        createdAt: Date.now(),
      };
      setActiveModel(newModel);
      setRecentModels((prev) => [newModel, ...prev.filter((m) => m.id !== newModel.id)]);
      setPhase('ready');
      setStatusText(`Loaded local model: ${newModel.name}`);
      return newModel;
    } catch (err: any) {
      const msg = err.message || 'Failed to load local GLB file';
      setError(msg);
      setPhase('error');
      throw err;
    }
  }, []);

  const generateFromAsset = useCallback(
    async (options: { prompt?: string; image?: string; faceCount?: number }): Promise<StagedModel> => {
      setError(null);
      setPhase('dispatching');
      setStatusText('Connecting to Aholo Lux3D generative engine...');
      setProgressPercent(10);

      try {
        // Step 1: Create Generation Task
        const taskRes = await createLux3DTask({
          version: 'G1-Turbo',
          face_count: options.faceCount || 150000,
          image_1: options.image,
          prompt: options.prompt,
        });

        const taskId = taskRes.task_id;
        setPhase('processing');
        setStatusText(`Aholo Task Created (#${taskId.slice(-6)}). Synthesizing 3D geometry...`);
        setProgressPercent(25);

        // Step 2: Poll Task Status
        let stepCount = 0;
        const result = await pollLux3DTask(taskId, (progressData: Lux3DTaskStatusResponse) => {
          stepCount++;
          const dynamicProgress = Math.min(25 + stepCount * 8, 90);
          setProgressPercent(dynamicProgress);

          if (progressData.status === 'processing') {
            if (dynamicProgress > 60) {
              setStatusText('Generating PBR surface materials & textures...');
            } else {
              setStatusText('Refining mesh topology and normal maps...');
            }
          }
        });

        // Step 3: Handle Completed Task
        setPhase('downloading');
        setStatusText('Mounting generated 3D mesh into LuxStage darkroom...');
        setProgressPercent(98);

        const newModel: StagedModel = {
          id: `aholo-${taskId}`,
          name: options.prompt
            ? options.prompt.slice(0, 32) + (options.prompt.length > 32 ? '...' : '')
            : `Aholo Lux3D #${taskId.slice(-4)}`,
          source: 'aholo-lux3d',
          url: result.glb!,
          previewUrl: result.preview_image,
          prompt: options.prompt,
          createdAt: Date.now(),
        };

        setActiveModel(newModel);
        setRecentModels((prev) => [newModel, ...prev]);
        setPhase('ready');
        setStatusText('Model successfully generated and staged!');
        setProgressPercent(100);

        return newModel;
      } catch (err: any) {
        console.error('Aholo generation error:', err);
        const msg = err.message || 'Generation failed. Check your API key or input parameters.';
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
    loadLocalGlbFile,
    clearError,
  };
}
