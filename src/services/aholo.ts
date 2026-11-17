import type {
  AholoApiEnvelope,
  Lux3DGenerateRequest,
  Lux3DTaskDetail,
  StagedModel,
} from '../types/aholo';

declare const __HAS_SERVER_AHOLO_KEY__: boolean | undefined;

const STORAGE_KEY_API_KEY = 'luxstage_aholo_api_key';
const STORAGE_KEY_ENDPOINT = 'luxstage_aholo_endpoint';
const STORAGE_KEY_GENERATED_MODELS = 'luxstage_generated_models_v1';
const STORAGE_KEY_LIBRARY_MIGRATION = 'luxstage_library_cleaned_v1';

let runtimeServerKeyDetected = false;
if (typeof window !== 'undefined') {
  fetch('/api/aholo/key-status')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.configured) {
        runtimeServerKeyDetected = true;
      }
    })
    .catch(() => {});
}

export function hasConfiguredApiKey(): boolean {
  const clientKey = getStoredApiKey();
  const serverKey = typeof __HAS_SERVER_AHOLO_KEY__ !== 'undefined' ? Boolean(__HAS_SERVER_AHOLO_KEY__) : false;
  const envKey = Boolean((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AHOLO_API_KEY);
  return Boolean(clientKey || serverKey || envKey || runtimeServerKeyDetected);
}

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key) {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
  }
}

export function getStoredEndpoint(): string {
  if (typeof window === 'undefined') return '/api/aholo';
  const stored = localStorage.getItem(STORAGE_KEY_ENDPOINT);
  // Migrate any legacy api.aholo3d.com value to /api/aholo
  if (!stored || stored.includes('aholo3d.com')) {
    return '/api/aholo';
  }
  return stored;
}

export function setStoredEndpoint(endpoint: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_ENDPOINT, endpoint.trim());
}

/**
 * Returns the Lux3D v1 path prefix routed through /api/aholo so browser CORS never blocks
 * either International ('/api/aholo/global/lux3d/v1') or China ('/api/aholo/lux3d/v1').
 */
function getLux3dPrefix(base: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  if (cleanBase.includes('aholo3d.cn') || cleanBase === 'cn') {
    return '/api/aholo/lux3d/v1';
  }
  return '/api/aholo/global/lux3d/v1';
}

/**
 * Creates headers for Aholo API calls.
 * Aholo OpenAPI uses the raw API key in the Authorization header (no "Bearer " prefix).
 */
function getHeaders(customKey?: string): HeadersInit {
  const key = (customKey || getStoredApiKey()).replace(/^Bearer\s+/i, '').trim();
  const storedEndpoint = getStoredEndpoint();
  const isChinaRegion = storedEndpoint.includes('aholo3d.cn') || storedEndpoint === 'cn';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Aholo-Region': isChinaRegion ? 'cn' : 'intl',
  };
  if (key) {
    headers['Authorization'] = key;
    headers['X-Aholo-Key'] = key;
  }
  return headers;
}

/**
 * Unwraps Aholo's { c: "0", m: "", d: ... } response envelope.
 */
async function parseAholoEnvelope<T>(response: Response, contextLabel: string): Promise<T> {
  if (!response.ok) {
    let errText = `${response.status} ${response.statusText}`;
    try {
      const errBody = await response.json();
      errText = errBody.m || errBody.message || errBody.msg || errText;
    } catch {
      // ignore
    }
    throw new Error(`${contextLabel} failed (${errText})`);
  }

  const envelope: AholoApiEnvelope<T> = await response.json();
  if (envelope.c !== '0') {
    throw new Error(envelope.m || `${contextLabel} returned error code ${envelope.c}`);
  }
  return envelope.d;
}

/**
 * Creates a Text-to-3D or Image-to-3D generation task in Aholo Lux3D.
 * Returns the numeric taskId.
 */
export async function createLux3DTask(
  request: Lux3DGenerateRequest,
  customKey?: string
): Promise<number> {
  const prefix = getLux3dPrefix(getStoredEndpoint());
  const isImageTask = Boolean(request.image && !request.prompt);

  if (isImageTask) {
    const url = `${prefix}/generate/img-to-3d/task/create`;
    const payload = {
      img: request.image!,
      version: request.version || 'G1-Turbo',
      faceCount: request.faceCount || 150000,
      outputFormat: ['glb'],
      enablePbr: request.enablePbr ?? true,
      aiPredictSize: true,
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(customKey),
      body: JSON.stringify(payload),
    });
    return parseAholoEnvelope<number>(response, 'Aholo Image-to-3D task creation');
  }

  // Text-to-3D (also supports optional reference img alongside prompt!)
  const url = `${prefix}/generate/text-to-3d/task/create`;
  const payload: Record<string, unknown> = {
    prompt: request.prompt || 'Detailed 3D object',
    style: request.style || 'photorealistic',
    version: request.version || 'G1-Turbo',
    faceCount: request.faceCount || 150000,
    outputFormat: ['glb'],
    enablePbr: request.enablePbr ?? true,
    aiPredictSize: true,
  };
  if (request.image) {
    payload.img = request.image;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(customKey),
    body: JSON.stringify(payload),
  });
  return parseAholoEnvelope<number>(response, 'Aholo Text-to-3D task creation');
}

/**
 * Creates an AI Part-Split task on an existing GLB URL (splits single mesh into semantic sub-parts).
 */
export async function createPartSplitTask(glbUrl: string, customKey?: string): Promise<number> {
  const prefix = getLux3dPrefix(getStoredEndpoint());
  const url = `${prefix}/part-split/task/create`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(customKey),
    body: JSON.stringify({ glbUrl }),
  });
  return parseAholoEnvelope<number>(response, 'Aholo Part Split task creation');
}

/**
 * Creates an AI Articulation Animation task on an existing GLB URL.
 */
export async function createArticulationTask(
  glbUrl: string,
  prompt: string,
  customKey?: string
): Promise<number> {
  const prefix = getLux3dPrefix(getStoredEndpoint());
  const url = `${prefix}/articulation-animation/task/create`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(customKey),
    body: JSON.stringify({ glbUrl, prompt }),
  });
  return parseAholoEnvelope<number>(response, 'Aholo Articulation Animation task creation');
}

/**
 * Polls an Aholo Lux3D task (`GET /generate/task/get?taskid=...`) until status === 3 (success).
 * Returns the resolved GLB URL and task detail.
 */
export async function pollLux3DTask(
  taskId: number,
  onProgress?: (detail: Lux3DTaskDetail, attempt: number) => void,
  options: { intervalMs?: number; maxAttempts?: number; customKey?: string } = {}
): Promise<{ glbUrl: string; detail: Lux3DTaskDetail }> {
  const { intervalMs = 3500, maxAttempts = 120, customKey } = options;
  const prefix = getLux3dPrefix(getStoredEndpoint());
  const url = `${prefix}/generate/task/get?taskid=${encodeURIComponent(String(taskId))}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(customKey),
    });

    const detail = await parseAholoEnvelope<Lux3DTaskDetail>(response, 'Aholo task status check');
    onProgress?.(detail, attempt);

    if (detail.status === 3) {
      const outputs = detail.outputs || [];
      const glbItem =
        outputs.find((o) => o.content && /\.glb(\?|$)/i.test(o.content)) ||
        outputs.find((o) => Boolean(o.content));
      if (!glbItem?.content) {
        throw new Error('Aholo completed the task but did not return a GLB model URL.');
      }
      return { glbUrl: glbItem.content, detail };
    }

    if (detail.status === 4) {
      throw new Error('Aholo 3D generation failed on the cloud worker. Try refining your prompt.');
    }

    if (detail.status === 6) {
      throw new Error('Aholo 3D generation task was canceled.');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Aholo generation timed out after ${Math.round((intervalMs * maxAttempts) / 1000)} seconds.`);
}

function isRemovedLegacyModel(model: StagedModel): boolean {
  const haystack = `${model.id || ''} ${model.name || ''} ${model.prompt || ''}`;
  return (
    /workdesk|studio\s+display/i.test(haystack) ||
    /macbook|notched\s+apple|\bmac\b.*(?:laptop|notch)|laptop.*hello/i.test(haystack) ||
    /preset-pump|px-?04|hydraulic\s+pump/i.test(haystack)
  );
}

/**
 * Persists and retrieves user-generated Aholo models in localStorage so tokens are never wasted.
 */
export function loadSavedGeneratedModels(): StagedModel[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GENERATED_MODELS);
    const parsed: StagedModel[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];

    if (!localStorage.getItem(STORAGE_KEY_LIBRARY_MIGRATION)) {
      const sorted = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      let seenBlender = false;
      const cleaned = sorted.filter((m) => {
        if (isRemovedLegacyModel(m)) return false;
        const text = `${m.name || ''} ${m.prompt || ''}`;
        if (/kitchen\s+blender/i.test(text)) {
          if (seenBlender) return false;
          seenBlender = true;
        }
        return true;
      });
      try {
        localStorage.setItem(STORAGE_KEY_GENERATED_MODELS, JSON.stringify(cleaned));
        localStorage.setItem(STORAGE_KEY_LIBRARY_MIGRATION, '1');
      } catch {
        // ignore storage quota errors
      }
      return cleaned;
    }

    return list;
  } catch {
    return [];
  }
}

export function saveGeneratedModelToStorage(model: StagedModel): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadSavedGeneratedModels();
    const updated = [model, ...existing.filter((m) => m.id !== model.id)].slice(0, 24);
    localStorage.setItem(STORAGE_KEY_GENERATED_MODELS, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
}

export function removeGeneratedModelFromStorage(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadSavedGeneratedModels();
    const updated = existing.filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY_GENERATED_MODELS, JSON.stringify(updated));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Curated presets ready for instant staging without spending tokens.
 */
export const SHOWCASE_PRESETS: StagedModel[] = [
  {
    id: 'preset-robot-dog',
    name: 'Quadruped Robotic Dog',
    source: 'aholo-lux3d',
    url: '/robot-dog.glb',
    prompt: 'Quadruped robotic inspection dog with articulated titanium legs and LiDAR sensor head',
    style: 'photorealistic',
    taskId: 8021187,
    createdAt: Date.now(),
  },
  {
    id: 'preset-helmet',
    name: 'Tactical Sci-Fi Helmet',
    source: 'local-preset',
    url: '/models/DamagedHelmet.glb',
    prompt: 'Battle-hardened tactical sci-fi pilot helmet, PBR copper and oxidized polymer',
    createdAt: Date.now() - 60000,
  },
];
