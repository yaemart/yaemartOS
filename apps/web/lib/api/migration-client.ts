const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AvailableShop {
  lingxingShopId: string;
  shopName: string;
  platformName: string;
  marketName: string;
}

export type PathAPlatformCode = 'amazon' | 'walmart';
export type PathAImportJobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface PathAImportJobSummary {
  jobId: string;
  runId: string;
  brandId: string;
  platformCode: PathAPlatformCode;
  status: PathAImportJobStatus;
  progress: number;
  createdAt: string;
}

export interface PathAImportJobDetail extends PathAImportJobSummary {
  total?: number;
  imported?: number;
  failed?: number;
  failures?: Array<{ sku: string; reason: string }>;
  error?: string;
  updatedAt: string;
}

export interface TriggerPathAImportPayload {
  brandId: string;
  marketCode: string;
  platformCode: PathAPlatformCode;
  shopIds: string[];
}

export interface TriggerPathAImportResult {
  jobId: string;
  runId: string;
  status: string;
  message: string;
}

export interface JobListResponse {
  waiting: PathAImportJobSummary[];
  active: PathAImportJobSummary[];
  completed: PathAImportJobSummary[];
  failed: PathAImportJobSummary[];
}

export async function triggerPathAImport(
  payload: TriggerPathAImportPayload,
  token: string,
): Promise<TriggerPathAImportResult> {
  const res = await fetch(`${API_BASE}/migration/path-a/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger import: ${res.status}`);
  }
  return res.json() as Promise<TriggerPathAImportResult>;
}

export async function getPathAImportJob(
  jobId: string,
  token: string,
): Promise<PathAImportJobDetail> {
  const res = await fetch(`${API_BASE}/migration/path-a/jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to get job: ${res.status}`);
  }
  return res.json() as Promise<PathAImportJobDetail>;
}

export async function listPathAImportJobs(token: string): Promise<JobListResponse> {
  const res = await fetch(`${API_BASE}/migration/path-a/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list jobs: ${res.status}`);
  }
  return res.json() as Promise<JobListResponse>;
}

export async function listAvailableShops(
  token: string,
  brandId: string,
  platformCode: PathAPlatformCode,
  signal?: AbortSignal,
): Promise<AvailableShop[]> {
  const params = new URLSearchParams({ platformCode });
  const res = await fetch(`${API_BASE}/migration/path-a/shops?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-yaemart-brand': brandId,
    },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load available shops: ${res.status}`);
  }
  return res.json() as Promise<AvailableShop[]>;
}
