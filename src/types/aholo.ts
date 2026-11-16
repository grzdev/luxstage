export type Lux3DVersion = 'G1-Turbo' | 'G1';

export type Lux3DStyle =
  | 'photorealistic'
  | 'cyberpunk'
  | 'fantasy'
  | 'cartoon'
  | 'anime'
  | 'hand_painted'
  | 'glass';

export interface Lux3DGenerateRequest {
  prompt?: string;
  image?: string; // URL or Base64 Data URL
  style?: Lux3DStyle;
  version?: Lux3DVersion;
  faceCount?: number;
  enablePbr?: boolean;
}

export interface AholoApiEnvelope<T> {
  c: string;
  m?: string;
  d: T;
  f?: string | null;
}

/**
 * Official Aholo Lux3D status codes:
 * 0 = init / queued
 * 1 = running
 * 3 = success
 * 4 = failed
 * 6 = canceled
 */
export type Lux3DTaskNumericStatus = 0 | 1 | 3 | 4 | 6;

export interface Lux3DTaskOutputItem {
  content?: string;
}

export interface Lux3DTaskDetail {
  taskId?: number;
  bizId?: string;
  status?: Lux3DTaskNumericStatus | number;
  outputs?: Lux3DTaskOutputItem[];
}

export interface StagedModel {
  id: string;
  name: string;
  source: 'aholo-lux3d' | 'local-preset';
  url: string;
  previewUrl?: string;
  prompt?: string;
  style?: Lux3DStyle;
  taskId?: number;
  createdAt: number;
}

export interface HotspotNote {
  id: string;
  title: string;
  description: string;
  position: [number, number, number];
  normal?: [number, number, number];
  cameraTarget?: [number, number, number];
}
