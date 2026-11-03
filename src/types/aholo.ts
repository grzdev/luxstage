export type Lux3DVersion = 'G1-Turbo' | 'G1' | 'Pro';

export interface Lux3DTaskCreateRequest {
  version?: Lux3DVersion;
  face_count?: number;
  image_1?: string; // Image URL or Base64 data URL
  prompt?: string;
  enable_pbr?: boolean;
}

export interface Lux3DTaskCreateResponse {
  task_id: string;
  code?: number;
  message?: string;
  msg?: string;
}

export type Lux3DTaskStatus = 'pending' | 'processing' | 'running' | 'completed' | 'failed';

export interface Lux3DTaskStatusResponse {
  task_id: string;
  status: Lux3DTaskStatus;
  glb?: string;
  ply?: string;
  preview_image?: string;
  progress?: number;
  err_msg?: string;
  error?: string;
}

export interface StagedModel {
  id: string;
  name: string;
  source: 'aholo-lux3d' | 'local-preset' | 'upload';
  url: string;
  previewUrl?: string;
  prompt?: string;
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
