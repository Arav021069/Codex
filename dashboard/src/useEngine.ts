import { useCallback, useEffect, useState } from 'react';
import type {
  AuditEntry,
  FinalAction,
  SecurityViolation,
  ServerToDashboard,
} from './contract';
import { decideViolation, fetchPending } from './api';

// When the dashboard is served BY the engine (production), derive the WS URL from the page origin so
// it works on whatever host/port the engine runs. For standalone `vite dev`, set VITE_AG_WS (the dev
// server runs on a different port than the engine).
function defaultWsUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${window.location.host}/ws`;
  }
  return 'ws://127.0.0.1:9000/ws';
}

const WS_URL = import.meta.env.VITE_AG_WS ?? defaultWsUrl();

export interface EngineState {
  connected: boolean;
  /** Calls currently held for human review — the live approval inbox. */
  pending: SecurityViolation[];
  audit: AuditEntry[];
  /** Submit a verdict through the engine's REST approval endpoint; resolves on success, throws on failure. */
  decide: (violationId: string, action: FinalAction) => Promise<void>;
}

/** Subscribes to the engine over WebSocket and exposes live pending + audit state. */
export function useEngine(): EngineState {
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState<SecurityViolation[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let stopped = false;
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;

    const connect = (): void => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) retry = setTimeout(connect, 1000); // auto-reconnect
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e: MessageEvent<string>) => {
        const msg = JSON.parse(e.data) as ServerToDashboard;
        switch (msg.type) {
          case 'hello':
            setPending(msg.pending);
            if (msg.recent && msg.recent.length > 0) setAudit(msg.recent.slice(0, 200));
            break;
          case 'violation':
            setPending((p) => [msg.violation, ...p.filter((v) => v.id !== msg.violation.id)]);
            break;
          case 'resolved':
            setPending((p) => p.filter((v) => v.id !== msg.violationId));
            break;
          case 'audit':
            setAudit((a) => [msg.entry, ...a].slice(0, 200));
            break;
        }
      };
    };

    connect();
    // Reconcile the inbox from the REST snapshot too, so a slow WS handshake never hides held calls.
    fetchPending()
      .then((p) => { if (!stopped) setPending(p); })
      .catch(() => { /* the WS hello carries the same snapshot; a failed reconcile is non-fatal */ });
    return () => {
      stopped = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const decide = useCallback(async (violationId: string, action: FinalAction) => {
    await decideViolation(violationId, action);
    // Only clear the card once the engine has accepted the verdict; the server also broadcasts 'resolved'.
    setPending((p) => p.filter((v) => v.id !== violationId));
  }, []);

  return { connected, pending, audit, decide };
}
