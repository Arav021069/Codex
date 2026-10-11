/**
 * REST helpers for the investigation history (D25). When the dashboard is served BY the engine the
 * base is the page origin; for standalone `vite dev` set VITE_AG_API to the engine's URL.
 */
import type { AgentOverview, AgentStatus, AuditVerification, SessionSummary, SessionTimeline } from './contract';

function apiBase(): string {
  if (import.meta.env.VITE_AG_API) return String(import.meta.env.VITE_AG_API).replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return window.location.origin;
  }
  return 'http://127.0.0.1:9000';
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${apiBase()}/sessions`);
  if (!res.ok) throw new Error(`/sessions ${res.status}`);
  const data = (await res.json()) as { sessions: SessionSummary[] };
  return data.sessions ?? [];
}

export async function fetchTimeline(sessionId: string): Promise<SessionTimeline> {
  const res = await fetch(`${apiBase()}/sessions/${encodeURIComponent(sessionId)}/timeline`);
  if (!res.ok) throw new Error(`/sessions/${sessionId}/timeline ${res.status}`);
  return (await res.json()) as SessionTimeline;
}

export async function fetchAuditVerify(): Promise<AuditVerification> {
  const res = await fetch(`${apiBase()}/audit/verify`);
  if (!res.ok) throw new Error(`/audit/verify ${res.status}`);
  return (await res.json()) as AuditVerification;
}

export async function fetchAgents(): Promise<AgentOverview[]> {
  const res = await fetch(`${apiBase()}/agents`);
  if (!res.ok) throw new Error(`/agents ${res.status}`);
  const data = (await res.json()) as { agents: AgentOverview[] };
  return data.agents ?? [];
}

export async function setAgentStatus(sessionId: string, status: AgentStatus, reason?: string): Promise<void> {
  const res = await fetch(`${apiBase()}/agents/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, status, reason }),
  });
  if (!res.ok) throw new Error(`/agents/status ${res.status}`);
}
