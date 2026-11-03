import type {
  Lux3DTaskCreateRequest,
  Lux3DTaskCreateResponse,
  Lux3DTaskStatusResponse,
  StagedModel,
} from '../types/aholo';

const STORAGE_KEY_API_KEY = 'luxstage_aholo_api_key';
const STORAGE_KEY_ENDPOINT = 'luxstage_aholo_endpoint';

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
  return localStorage.getItem(STORAGE_KEY_ENDPOINT) || '/api/aholo';
}

export function setStoredEndpoint(endpoint: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_ENDPOINT, endpoint.trim());
}

/**
 * Creates headers for Aholo API calls.
 * If user stored an API key in localStorage, attach it.
 * Otherwise, the Vite dev proxy will inject the server AHOLO_API_KEY from .env.local.
 */
function getHeaders(customKey?: string): HeadersInit {
  const key = customKey || getStoredApiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

/**
 * Dispatches an Image/Prompt-to-3D generation task to Aholo Lux3D.
 */
export async function createLux3DTask(
  request: Lux3DTaskCreateRequest,
  customKey?: string
): Promise<Lux3DTaskCreateResponse> {
  const base = getStoredEndpoint();
  const url = `${base}/lux3d/v1/generate/img-to-3d/task/create`;

  const payload: Record<string, any> = {
    version: request.version || 'G1-Turbo',
    face_count: request.face_count || 150000,
    enable_pbr: request.enable_pbr ?? true,
  };

  if (request.image_1) {
    payload.image_1 = request.image_1;
  }
  if (request.prompt) {
    payload.prompt = request.prompt;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(customKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errDetail = `${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errDetail = errJson.message || errJson.msg || errJson.error || errDetail;
    } catch {
      // ignore json parse error
    }
    throw new Error(`Aholo Lux3D task creation failed: ${errDetail}`);
  }

  const data: Lux3DTaskCreateResponse = await response.json();
  if (!data.task_id) {
    throw new Error(data.message || data.msg || 'No task_id returned from Aholo API');
  }

  return data;
}

/**
 * Polls task status until completion or failure.
 */
export async function pollLux3DTask(
  taskId: string,
  onProgress?: (status: Lux3DTaskStatusResponse) => void,
  options: { intervalMs?: number; maxAttempts?: number; customKey?: string } = {}
): Promise<Lux3DTaskStatusResponse> {
  const { intervalMs = 4000, maxAttempts = 120, customKey } = options;
  const base = getStoredEndpoint();
  const url = `${base}/lux3d/v1/generate/img-to-3d/task/get?task_id=${encodeURIComponent(taskId)}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(customKey),
    });

    if (!response.ok) {
      throw new Error(`Failed to poll Aholo Lux3D task: ${response.statusText}`);
    }

    const data: Lux3DTaskStatusResponse = await response.json();
    if (onProgress) {
      onProgress(data);
    }

    if (data.status === 'completed') {
      if (!data.glb) {
        throw new Error('Aholo reported task completed but did not provide a GLB download URL.');
      }
      return data;
    }

    if (data.status === 'failed') {
      throw new Error(data.err_msg || data.error || 'Aholo 3D model generation failed.');
    }

    // Sleep before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Aholo generation timed out after ${(intervalMs * maxAttempts) / 1000} seconds.`);
}

/**
 * Curated presets ready for instant showcase.
 */
export const SHOWCASE_PRESETS: StagedModel[] = [
  {
    id: 'preset-helmet',
    name: 'Tactical Sci-Fi Helmet',
    source: 'local-preset',
    url: '/models/DamagedHelmet.glb',
    prompt: 'Battle-hardened tactical sci-fi pilot helmet, PBR copper and oxidized polymer',
    createdAt: Date.now(),
  },
  {
    id: 'preset-pump',
    name: 'Industrial Valve Mechanism',
    source: 'local-preset',
    url: '/models/pump.glb',
    prompt: 'Industrial high-pressure mechanical pump assembly, cast iron with steel linkages',
    createdAt: Date.now(),
  },
];
