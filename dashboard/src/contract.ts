/**
 * Cerberus data contract — COPIED VERBATIM from `src/contract/types.ts` in the engine.
 *
 * Single source of truth lives in the engine package; this copy keeps the dashboard
 * decoupled at the build level (no workspaces, no shared tsconfig) while preventing
 * drift. If you change the engine contract, copy it here.
 */

export type ToolCategory = 'READ' | 'WRITE' | 'EXECUTE' | 'EGRESS' | 'UNKNOWN';
export type PolicyAction = 'ALLOW' | 'BLOCK' | 'HITL';
export type FinalAction = 'ALLOW' | 'BLOCK';
export type SignalSource = 'policy' | 'behavioral' | 'content';
export type RiskBand = 'ALLOW' | 'AUDIT' | 'HITL' | 'BLOCK';

export interface RiskFactor {
  source: SignalSource;
  label: string;
  points: number;
  group: string;
}

export interface RiskAssessment {
  score: number;
  band: RiskBand;
  version: string;
  factors: RiskFactor[];
  hardFloor: boolean;
}

export interface MCPToolCall {
  tool: string;
  input: Record<string, unknown>;
  sessionId?: string;
  cwd?: string;
}

export interface SecurityViolation {
  id: string;
  toolCall: MCPToolCall;
  category: ToolCategory;
  ruleId: string | null;
  reason: string;
  createdAt: number;
  ttlMs: number;
  signal: SignalSource;
  risk?: RiskAssessment;
}

export type AuditEvent =
  | 'decision'
  | 'hitl-opened'
  | 'hitl-resolved'
  | 'session-started'
  | 'session-ended'
  | 'taint-loaded'
  | 'injection-detected'
  | 'tool-failed'
  | 'agent-paused'
  | 'agent-resumed'
  | 'agent-quarantined';

export type HitlResolution = 'approved' | 'rejected' | 'expired';

export type AgentStatus = 'active' | 'paused' | 'quarantined';

export interface AgentControl {
  sessionId: string;
  status: AgentStatus;
  reason?: string;
  updatedAt: number;
}

export interface AgentOverview {
  sessionId: string;
  status: AgentStatus;
  reason?: string;
  updatedAt?: number;
  governedCalls: number;
  lastTs?: number;
}

export interface AgentControlInput {
  sessionId: string;
  status: AgentStatus;
  reason?: string;
}

export interface AuditVerification {
  ok: boolean;
  file: string;
  total: number;
  checked: number;
  firstInvalidIndex?: number;
  firstInvalidTs?: number;
  reason: string;
}

export interface AuditEntry {
  event: AuditEvent;
  ts: number;
  reason: string;
  sessionId?: string;
  requestId?: string;
  tool?: string;
  input?: Record<string, unknown>;
  category?: ToolCategory;
  action?: FinalAction;
  ruleId?: string | null;
  viaHitl?: boolean;
  signal?: SignalSource;
  risk?: RiskAssessment;
  resolution?: HitlResolution;
  latencyMs?: number;
  secretTypes?: string[];
  injectionScore?: number;
  prevHash?: string;
  hash?: string;
}

export interface SessionSummary {
  sessionId: string;
  firstTs: number;
  lastTs: number;
  startedAt?: number;
  endedAt?: number;
  verdicts: number;
  allowed: number;
  blocked: number;
  held: number;
  taintLoaded: number;
  injections: number;
  toolFailures: number;
  peakRiskScore: number;
  peakBand: RiskBand;
  signals: SignalSource[];
  drivers: string[];
}

export interface TimelineItem {
  primary: AuditEntry;
  resolvedBy?: AuditEntry;
}

export interface SessionTimeline {
  sessionId: string;
  summary: SessionSummary;
  events: AuditEntry[];
  items: TimelineItem[];
}

export type ServerToDashboard =
  | { type: 'hello'; pending: SecurityViolation[]; recent?: AuditEntry[] }
  | { type: 'violation'; violation: SecurityViolation }
  | { type: 'resolved'; violationId: string; action: FinalAction }
  | { type: 'audit'; entry: AuditEntry };

export type DashboardToServer = {
  type: 'decision';
  violationId: string;
  action: FinalAction;
};
