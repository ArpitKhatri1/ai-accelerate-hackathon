const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_API_BASE_URL ||
  process.env.NEXT_PUBLIC_AGENT_BASE_URL ||
  'http://localhost:8001';

const withBaseUrl = (path: string) => {
  try {
    return new URL(path, DEFAULT_BASE_URL).toString();
  } catch (error) {
    console.warn('[analytics-api] Failed to construct URL', error);
    return `${DEFAULT_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  }
};

type FetchInput = {
  path: string;
  signal?: AbortSignal;
};

async function fetchJson<T>({ path, signal }: FetchInput): Promise<T> {
  const response = await fetch(withBaseUrl(path), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request to ${path} failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export interface DashboardKpisResponse {
  average_contract_cycle_days: number;
  average_contract_cycle_hours: number;
  agreements_completed_last_30_days: number;
  pending_envelopes_last_90_days: number;
}

export interface CycleTimeItem {
  type: string;
  avgHours: number;
}

export interface CycleTimeResponse {
  items: CycleTimeItem[];
}

export interface DailySentCompletedItem {
  date: string;
  sent: number;
  completed: number;
}

export interface DailySentCompletedResponse {
  items: DailySentCompletedItem[];
}

export interface StatusDistributionItem {
  status: string;
  count: number;
}

export interface StatusDistributionResponse {
  items: StatusDistributionItem[];
}

export interface EnvelopesTableItem {
  envelopeId: string;
  name: string;
  recipients: string;
  sentDate: string | null;
  completedDate: string | null;
  status: string; // lowercase from backend
}

export interface EnvelopesTableResponse {
  items: EnvelopesTableItem[];
  page: number;
  limit: number;
  total: number;
}

export const analyticsApi = {
  baseUrl: DEFAULT_BASE_URL,
  async getKpis(signal?: AbortSignal) {
    return fetchJson<DashboardKpisResponse>({ path: '/analytics/kpis', signal });
  },
  async getCycleTimeByDocument(signal?: AbortSignal) {
    return fetchJson<CycleTimeResponse>({ path: '/analytics/envelopes/cycle-time-by-document', signal });
  },
  async getDailySentVsCompleted(days = 10, signal?: AbortSignal) {
    const path = `/analytics/envelopes/daily-sent-vs-completed?days=${encodeURIComponent(days)}`;
    return fetchJson<DailySentCompletedResponse>({ path, signal });
  },
  async getStatusDistribution(signal?: AbortSignal) {
    return fetchJson<StatusDistributionResponse>({ path: '/analytics/envelopes/status-distribution', signal });
  },
  async getEnvelopesTable({ limit = 12, page = 1, q, status, signal }: { limit?: number; page?: number; q?: string; status?: string | string[]; signal?: AbortSignal }) {
    const search = new URLSearchParams();
    search.set('limit', String(limit));
    search.set('page', String(page));
    if (q) search.set('q', q);
    if (status) {
      // backend accepts comma-separated values; normalize arrays
      const s = Array.isArray(status) ? status.join(',') : status;
      if (s.trim().length > 0) search.set('status', s);
    }
    const path = `/analytics/envelopes/table?${search.toString()}`;
    return fetchJson<EnvelopesTableResponse>({ path, signal });
  },
};
