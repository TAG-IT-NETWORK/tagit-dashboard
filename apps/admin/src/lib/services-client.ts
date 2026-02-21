// Thin fetch wrapper for tagit-services REST API
// Works with mock data fallback when API is unavailable

const BASE =
  process.env.NEXT_PUBLIC_SERVICES_URL ?? "http://localhost:3456";

// ── Response types ──────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export type Result<T> =
  | { success: true; data: T; pagination?: Pagination }
  | { success: false; error: string };

// ── Domain types ────────────────────────────────────────────────

export type AgentCategory =
  | "e-commerce"
  | "supply-chain"
  | "defi-rwa"
  | "luxury-fashion"
  | "insurance"
  | "other";

export type OutreachStage =
  | "queued"
  | "pitched"
  | "awaiting_response"
  | "demo_scheduled"
  | "demo_completed"
  | "onboarded"
  | "declined"
  | "no_response"
  | "error"
  | "cooldown";

export type ContentType =
  | "weekly_report"
  | "milestone"
  | "partnership"
  | "case_study"
  | "tutorial"
  | "reply";

export type ContentStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "killed";

export type Channel = "x" | "moltbook" | "farcaster" | "github";

// ── Data shapes ─────────────────────────────────────────────────

export interface QualificationRecord {
  id: number;
  crawledAgentId: number;
  onChainId: string;
  score: number;
  capabilityFit: number;
  reputationScore: number;
  activityLevel: number;
  categoryMatch: number;
  category: AgentCategory;
  reasoning: string;
  promptVersion: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  humanReviewRequired: boolean;
  humanApproved: boolean | null;
  inOutreachQueue: boolean;
  createdAt: string;
}

export interface OutreachRecord {
  id: number;
  crawledAgentId: number;
  qualificationScoreId: number;
  campaignId: number;
  stage: OutreachStage;
  mode: "dry-run" | "demo" | "live";
  pitchSentAt: string | null;
  responseReceivedAt: string | null;
  responseType: "accepted" | "declined" | "no_response" | "error" | null;
  declineReason: string | null;
  demoCompletedAt: string | null;
  onboardedAt: string | null;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined from crawled_agents for display
  agentName?: string;
  agentUrl?: string;
  agentCategory?: AgentCategory;
  qualificationScore?: number;
}

export interface OutreachMetrics {
  mode: "dry-run" | "demo" | "live";
  totalCampaigns: number;
  totalPitched: number;
  totalResponses: number;
  totalDemos: number;
  totalOnboarded: number;
  acceptRate: number;
  demoPassRate: number;
}

export interface QualificationMetrics {
  totalScored: number;
  totalQueued: number;
  totalPendingReview: number;
  averageScore: number;
  medianScore: number;
  perCategory: Array<{ category: string; count: number; avgScore: number }>;
  perVariant: Array<{
    variant: string;
    count: number;
    avgScore: number;
    queueRate: number;
  }>;
}

export interface ContentItem {
  id: number;
  contentType: ContentType;
  status: ContentStatus;
  title: string;
  body: string;
  metricsSnapshot: Record<string, unknown>;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  validationPassed: boolean;
  validationDetails: Record<string, unknown> | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  killedAt: string | null;
  killedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfluencerMetrics {
  totalGenerated: number;
  totalApproved: number;
  totalRejected: number;
  totalScheduled: number;
  totalPublished: number;
  totalKilled: number;
  pendingReview: number;
  perContentType: Array<{
    contentType: ContentType;
    count: number;
    approvedCount: number;
  }>;
  killSwitchActive: boolean;
}

export interface KillSwitchStatus {
  active: boolean;
  activatedBy?: string;
  activatedAt?: string;
  deactivatedBy?: string;
  deactivatedAt?: string;
  reason?: string;
  createdAt?: string;
}

export interface EngagementData {
  impressions: number;
  clicks: number;
  replies: number;
  likes: number;
  reposts: number;
  rawMetrics: Record<string, unknown>;
}

export interface ChannelStatus {
  connected: boolean;
  rateLimitRemaining?: number;
  rateLimitReset?: string;
  lastError?: string;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
}

// ── Fetch wrapper ───────────────────────────────────────────────

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<Result<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) {
      return { success: false, error: json.error ?? `HTTP ${res.status}` };
    }
    return {
      success: true,
      data: json.data as T,
      pagination: json.pagination,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── API methods ─────────────────────────────────────────────────

export const servicesApi = {
  // Health
  health: () => request<HealthResponse>("/health"),

  // Qualification
  getQualificationMetrics: () =>
    request<QualificationMetrics>("/api/v1/qualification/metrics"),

  getQualificationScores: (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    return request<QualificationRecord[]>(
      `/api/v1/qualification/scores?${q.toString()}`
    );
  },

  approveScore: (id: number) =>
    request<{ message: string }>(
      `/api/v1/qualification/scores/${id}/approve`,
      { method: "POST" }
    ),

  rejectScore: (id: number) =>
    request<{ message: string }>(
      `/api/v1/qualification/scores/${id}/reject`,
      { method: "POST" }
    ),

  // AdAgent
  getAdagentMetrics: () =>
    request<OutreachMetrics[]>("/api/v1/adagent/metrics"),

  getAdagentRecords: (params?: {
    page?: number;
    limit?: number;
    stage?: OutreachStage;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.stage) q.set("stage", params.stage);
    return request<OutreachRecord[]>(
      `/api/v1/adagent/records?${q.toString()}`
    );
  },

  runPipeline: (limit?: number) =>
    request<{
      campaignId: number;
      mode: string;
      pitched: number;
      accepted: number;
      demosRun: number;
      onboarded: number;
    }>("/api/v1/adagent/run", {
      method: "POST",
      body: JSON.stringify(limit ? { limit } : {}),
    }),

  getAdagentStatus: () =>
    request<{
      mode: string;
      dailyLimit: number | null;
      used: number;
      remaining: number | null;
    }>("/api/v1/adagent/status"),

  // Influencer
  getInfluencerMetrics: () =>
    request<InfluencerMetrics>("/api/v1/influencer/metrics"),

  getContent: (params?: {
    page?: number;
    limit?: number;
    status?: ContentStatus;
    contentType?: ContentType;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    if (params?.contentType) q.set("contentType", params.contentType);
    return request<ContentItem[]>(
      `/api/v1/influencer/content?${q.toString()}`
    );
  },

  generateContent: (contentType: ContentType) =>
    request<{ content: ContentItem }>(
      "/api/v1/influencer/content/generate",
      {
        method: "POST",
        body: JSON.stringify({ contentType }),
      }
    ),

  approveContent: (id: number) =>
    request<{ message: string }>(
      `/api/v1/influencer/content/${id}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ reviewerId: "admin" }),
      }
    ),

  rejectContent: (id: number, reason: string) =>
    request<{ message: string }>(
      `/api/v1/influencer/content/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reviewerId: "admin", reason }),
      }
    ),

  // Kill Switch
  getKillSwitchStatus: () =>
    request<KillSwitchStatus>("/api/v1/influencer/kill-switch/status"),

  activateKillSwitch: (reason: string) =>
    request<{ message: string }>("/api/v1/influencer/kill-switch", {
      method: "POST",
      body: JSON.stringify({ activatedBy: "admin", reason }),
    }),

  deactivateKillSwitch: () =>
    request<{ message: string }>(
      "/api/v1/influencer/kill-switch/deactivate",
      {
        method: "POST",
        body: JSON.stringify({ deactivatedBy: "admin" }),
      }
    ),

  // Channels
  getChannelStatus: () =>
    request<Record<Channel, ChannelStatus>>(
      "/api/v1/influencer/channels/status"
    ),

  getEngagement: (id: number) =>
    request<EngagementData[]>(
      `/api/v1/influencer/content/${id}/engagement`
    ),
};
