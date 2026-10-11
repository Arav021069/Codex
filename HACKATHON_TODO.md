# Warden Hackathon Build Plan

Warden is a hackathon presentation and extension of the existing Cerberus local agent security gateway. The gateway already provides tool-call interception, policy decisions, human approval, an audit stream, and session timelines/replay. Keep upstream attribution and license notices with the code; focus hackathon time on a reliable demo, a clear differentiator, and evidence for every security claim.

## Current foundation

- [x] Local policy engine with allow, audit, human-review, and block outcomes.
- [x] Agent adapters and command-line setup flow inherited from the base project.
- [x] Live dashboard connection, pending approvals, streamed audit events, and session history/replay.
- [x] Warden visual identity and responsive live operations view.
- [x] Live decision summary derived from the actual audit stream.
- [x] Build, rules validation, policy tests, adapter tests, audit tests, and a local API smoke check passed before the dashboard redesign.
- [x] Re-run the dashboard and engine builds plus policy, adapter, and audit checks after the UI changes.

## P0 — Make the jury demo dependable

- [ ] **One-command startup:** add a Windows-friendly start script that checks Node, dependencies, and port 9000, then starts the gateway and dashboard with clear terminal labels.
  - Done when a clean setup can reach the dashboard using only the README steps and the process prints the local URL.
- [ ] **Demo reset and seed:** provide a safe reset command and a deterministic demo fixture that generates one allowed read, one policy-blocked risky action, and one human-review request.
  - Done when the same three cases are available on every run, no real destructive command executes, and the dashboard explains the result.
- [ ] **Visible decision rationale:** show the matched rule, decision reason, risk signal, and policy outcome together for each pending and completed tool call.
  - Done when a judge can answer “why was this allowed or stopped?” from the screen without reading source code.
- [ ] **Approval lifecycle:** verify approve and block buttons resolve the real pending request and immediately update the audit trail; show expiration clearly.
  - Done when both paths can be demonstrated live, including the resulting agent response.
- [ ] **First-run reliability:** validate the documented setup on a fresh clone and fix stale URLs, missing prerequisites, port conflicts, and unclear error messages.
  - Done when the demo can be started from a fresh shell without undocumented steps.
- [ ] **Responsive and legible UI:** inspect the live and sessions views at projector/laptop size and a narrow viewport; check keyboard focus and reduced-motion behavior.
  - Done when controls remain usable, event details do not clip, and the live/connected state is easy to spot.

## P1 — Make Warden memorable and judgeable

- [ ] **One memorable end-to-end story:** present an agent task that begins with a safe read, encounters a suspicious action, gets paused for review, then resumes or is denied.
  - Done when the session timeline tells the story in order and each action links to its policy evidence.
- [ ] **Threat-to-control map:** add a concise in-app explanation of the threats covered (unsafe tools, policy violations, anomalous behavior, sensitive-data egress) and the corresponding control.
  - Done when the claims map to implemented rules/signals and label any heuristic or prototype behavior honestly.
- [ ] **Evidence in session replay:** display the decision, tool and input summary, rule ID, signal/risk explanation, timestamp, and human reviewer outcome in the event detail.
  - Done when a past run can be audited without reproducing it.
- [ ] **Comparison view:** add a small “agent intent → gateway decision → execution result” trace to demonstrate the gateway’s position in the tool path.
  - Done when the interception point and the difference between block, review, audit, and allow are obvious.
- [ ] **Clear product framing:** add a concise Warden about panel with architecture, local-data handling, current supported integrations, and honest limitations.
  - Done when the jury can distinguish implemented functionality from planned integrations.

## P2 — Improve trust and readiness after the event

- [ ] **Policy authoring and validation:** explain rule priority and provide a safe way to validate local rules before loading them.
- [ ] **Audit integrity and export:** document current audit storage guarantees, offer a sanitized export, and test handling of secrets in event payloads.
- [ ] **Security boundary review:** review adapter coverage, fail-open/fail-closed behavior, bypass paths, process permissions, and local API exposure; document findings and fixes.
- [ ] **Automated regression coverage:** add cases for allow/audit/review/block, expired approval, malformed requests, session replay, and secret redaction.
- [ ] **Operational polish:** add structured engine health details, graceful shutdown, log rotation guidance, and useful recovery messages.
- [ ] **Project provenance:** retain upstream notices, identify Warden-specific changes in the README, and state what is inherited versus newly built.

## Recommended order for the remaining hackathon

1. Run the post-UI build and core smoke checks.
2. Make the demo repeatable with deterministic, non-destructive scenarios.
3. Improve the decision rationale shown in the pending queue and replay.
4. Rehearse the five-minute walkthrough using the guide in `JURY_DEMO_GUIDE.md`.
5. Spend remaining time on one differentiator the team can demonstrate completely; avoid adding broad features that cannot be explained or verified.

## Submission-ready checklist

- [ ] Fresh start works from the README.
- [ ] Demo has a clean reset path and reliable scenario order.
- [ ] No real destructive action is run during presentation.
- [ ] Each security claim has a visible demo or a precise limitation.
- [ ] Jury walkthrough fits the allocated time and includes a short backup recording/screenshots.
- [ ] Repository has upstream attribution and no accidental secrets, local config, or unrelated files.
- [ ] Final build and test results are written down with any failures clearly stated.
