/**
 * Audit log — append-only JSONL, now hash-chained (M9).
 *
 * Every decision (allow/block, auto or via HITL) is recorded. Each record carries `prevHash` (the
 * previous record's hash, or `GENESIS` for the first) and its own `hash` over a canonical encoding of
 * its content + prevHash. That makes the log tamper-EVIDENT: `verify()` recomputes the chain and
 * reports the FIRST edited / reordered / deleted / re-linked entry. It is NOT tamper-PROOF — the file
 * is locally editable and an attacker who can rewrite the whole file can rewrite the chain too; the
 * guarantee is only that silent modification is detectable. The paid tier adds retention + remote anchor.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import type { AuditEntry, AuditVerification } from '../contract/types.js';
import { validateAuditEntry } from './validate.js';

/** The `prevHash` of the first record — a fixed anchor so the chain has a trusted initial state. */
export const GENESIS = 'GENESIS';

/**
 * Deterministic canonical encoding: object keys sorted, `undefined` fields dropped, arrays in order.
 * Both the writer and the verifier use this, so a record's hash is reproducible across machines.
 */
function canonical(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'string') return JSON.stringify(value);
  if (t === 'undefined') return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
}

/** The record's own hash over its content (minus the hash field) + prevHash. */
export function computeHash(entry: AuditEntry): string {
  const { hash: _drop, ...rest } = entry;
  return `sha256:${createHash('sha256').update(canonical(rest)).digest('hex')}`;
}

export class AuditLog {
  private lastHash = GENESIS;

  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true });
    this.lastHash = this.readLastHash();
  }

  /** Resume the chain from an existing log's last hashed record (so appends stay linked). */
  private readLastHash(): string {
    if (!existsSync(this.file)) return GENESIS;
    const lines = readFileSync(this.file, 'utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line) continue;
      try {
        const e = JSON.parse(line) as AuditEntry;
        if (typeof e.hash === 'string' && e.hash) return e.hash;
      } catch {
        /* skip a torn/partial line */
      }
    }
    return GENESIS;
  }

  /**
   * Append one event. The log is the single source of truth (D22), so a malformed entry is REJECTED
   * (logged to stderr, not written) rather than corrupting the projection downstream. Returns whether
   * the entry was actually persisted, so callers can avoid broadcasting a dropped event. On success the
   * entry is mutated in place with its `prevHash` + `hash` so live consumers see the chained record.
   */
  record(entry: AuditEntry): boolean {
    const problems = validateAuditEntry(entry);
    if (problems.length > 0) {
      process.stderr.write(`Cerberus: dropping malformed audit entry [${String(entry?.event)}]: ${problems.join('; ')}\n`);
      return false;
    }
    try {
      entry.prevHash = this.lastHash;
      entry.hash = computeHash(entry);
      appendFileSync(this.file, JSON.stringify(entry) + '\n');
      this.lastHash = entry.hash;
      return true;
    } catch {
      // auditing must never break enforcement; surface but do not throw
      process.stderr.write(`Cerberus: failed to write audit entry\n`);
      return false;
    }
  }

  /**
   * Replay the whole log (the investigation history hydrates from here — D22/D25). Tolerant of a
   * torn final line (a crash mid-append) and of any non-JSON line, which is skipped rather than thrown.
   */
  read(): AuditEntry[] {
    if (!existsSync(this.file)) return [];
    const out: AuditEntry[] = [];
    for (const line of readFileSync(this.file, 'utf8').split('\n')) {
      if (!line) continue;
      try {
        out.push(JSON.parse(line) as AuditEntry);
      } catch {
        /* skip a torn/partial line */
      }
    }
    return out;
  }

  /**
   * Recompute the hash chain from GENESIS and report the FIRST invalid entry (M9). Never reports a
   * missing, empty-but-expected, or unchained log as valid without saying so explicitly.
   */
  verify(): AuditVerification {
    const base = { file: this.file, total: 0, checked: 0 };
    if (!existsSync(this.file)) {
      return { ...base, ok: false, reason: 'audit file not found — nothing to verify' };
    }
    const entries = this.read();
    let prev = GENESIS;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i] as AuditEntry;
      if (typeof e.hash !== 'string' || e.hash.length === 0 || typeof e.prevHash !== 'string' || e.prevHash.length === 0) {
        return { ...base, ok: false, total: entries.length, checked: i, firstInvalidIndex: i, firstInvalidTs: e.ts, reason: `entry ${i} is not hash-chained (missing prevHash/hash) — unverifiable` };
      }
      if (e.prevHash !== prev) {
        return { ...base, ok: false, total: entries.length, checked: i, firstInvalidIndex: i, firstInvalidTs: e.ts, reason: `entry ${i} prevHash does not link to the previous record (reordered, inserted, or deleted entry)` };
      }
      if (computeHash(e) !== e.hash) {
        return { ...base, ok: false, total: entries.length, checked: i, firstInvalidIndex: i, firstInvalidTs: e.ts, reason: `entry ${i} hash mismatch — record content was modified` };
      }
      prev = e.hash;
    }
    return { ...base, ok: true, total: entries.length, checked: entries.length, reason: entries.length === 0 ? 'audit log is empty (no records to verify)' : `all ${entries.length} records verified against the hash chain` };
  }
}
