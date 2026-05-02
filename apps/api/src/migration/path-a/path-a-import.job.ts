import type { PathAPlatformCode } from './types';

export const PATH_A_IMPORT_QUEUE = 'path-a-import';

export interface PathAImportJobPayload {
  runId: string;
  brandId: string;
  marketCode: string;
  platformCode: PathAPlatformCode;
  shopIds: string[];
}

export type PathAImportJobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface PathAImportJobProgress {
  jobId: string;
  runId: string;
  status: PathAImportJobStatus;
  progress: number;
  total?: number;
  imported?: number;
  failed?: number;
  failures?: Array<{ sku: string; reason: string }>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
