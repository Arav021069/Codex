# Warden Jury Presentation Guide

## The one-line pitch

**Warden is a local control layer for AI agents: it checks tool actions against policy before execution, then allows, records, pauses for a person, or blocks the action.**

Keep the pitch accurate: this hackathon build is based on the open-source Cerberus agent firewall. Name that foundation, preserve its license/notice files, and explain which dashboard and presentation work is Warden-specific. Do not claim complete protection against every agent attack or every integration unless you have verified that scope.

## Before the room

### Prepare the machine

1. Use the project README for installation and startup. The gateway listens on `127.0.0.1:9000`; confirm it is healthy before opening the dashboard.
2. Start the dashboard using the documented command in `dashboard/` and keep both terminal windows visible or minimized, not closed.
3. Open the Warden dashboard, check that the gateway state is online, and make sure the audit stream is visible.
4. Clear or reset demo data using the project’s safe reset procedure if available. If you have not implemented a deterministic seed/reset yet, stage the three scenarios ahead of time and do not promise a one-command reset.
5. Disable notifications, close unrelated tabs, set browser zoom so the live queue and stream are readable, and keep the Sessions tab ready.
6. Rehearse the complete flow once. Keep a short screen recording or screenshots as a backup for Wi-Fi, terminal, or projector problems.

### Safety and credibility

- Use harmless demo inputs. For a blocked command, show the policy decision only; do not run the destructive operation.
- Do not put real credentials or private data in the demo. Use synthetic values.
- Separate observed facts from roadmap items. The dashboard’s counters reflect the currently loaded audit stream; an empty stream is not evidence of zero risk.
- Say “local gateway” and explain the current network boundary accurately. Do not overstate data privacy or tamper-proof audit guarantees.
- Use the real UI and engine response. Avoid preloaded screenshots presented as live behavior.

## Five-minute walkthrough

### 0:00–0:35 — Problem and promise

**Say:** “Agents can read files, run commands, and send data through tools. The user often sees the result after the action. Warden puts a policy checkpoint in that path so an unsafe or uncertain action can be stopped or reviewed before it reaches the tool.”

**Show:** the Warden Live Operations screen. Point to the connected state, then the three outcome counters and explain they are derived from the live audit events.

### 0:35–1:15 — How it fits together

**Say:** “The agent issues a tool call through an adapter. The local gateway evaluates the request using policy and available risk signals. A decision is returned before the tool runs: allow, audit, hold for human review, or block. The dashboard shows the decision and the audit event.”

**Show:** the action center and live stream. Trace one event from tool name to outcome and rule/reason. Name only the adapters and signals confirmed in this checkout.

### 1:15–2:00 — Safe action: allow and record

**Do:** trigger a harmless read-only action using the prepared demo scenario.

**Say:** “This action fits the policy, so it is allowed. It is still recorded, which gives us a reviewable history instead of a black box.”

**Show:** the allow event appearing in the audit stream. If the stream does not update, move on and state that the live connection is not responding; do not pretend the event occurred.

### 2:00–2:50 — Unsafe action: block before execution

**Do:** submit the preselected risky tool request that the local policy blocks. Do not execute its payload.

**Say:** “The policy matched this request before execution. The agent receives the block decision, and the audit record explains the outcome. That is the key control point: the dashboard reflects an enforcement decision in the tool path.”

**Show:** blocked outcome and reason. If the current rules block only a specific pattern, describe that exact pattern rather than implying broad command understanding.

### 2:50–3:45 — Human review

**Do:** trigger a scenario that enters the pending approval queue. Explain the request before choosing. Click **Block action** for the conservative demo; if the prepared scenario is designed to continue safely, approve it and narrate that choice.

**Say:** “Some actions may be legitimate but deserve a person’s decision. Warden pauses them and exposes the requested action, category, reason, and time remaining. The person can approve or block, and the result is written to the same audit trail.”

**Show:** the pending card, make one decision, then point to the resolved event in the stream. Do not leave an approval pending at the end.

### 3:45–4:25 — Investigate a run

**Do:** open **Sessions**, select the demo run, and move through its timeline/replay.

**Say:** “The live view handles the moment of decision; session history helps explain what happened across the run. We can reconstruct the sequence and inspect earlier decisions.”

**Show:** a session’s events in order. Keep the explanation anchored to fields the current UI actually displays.

### 4:25–5:00 — Close with scope and next step

**Say:** “Today we demonstrated the enforcement loop: inspect, decide, and preserve an audit trail locally. The next work is repeatable demo setup, richer decision evidence, and deeper boundary testing. We built Warden on the Cerberus open-source foundation and are clear about what is inherited and what we added.”

**Show:** return to Live Operations. Finish on the connected state and the completed audit trace.

## Short version for a three-minute slot

1. Pitch the policy checkpoint (20 seconds).
2. Trigger one allowed action and point to its audit event (35 seconds).
3. Trigger one blocked request without executing it (45 seconds).
4. Resolve one human-review request and show the audit outcome (55 seconds).
5. Show the session timeline, state limitations, and close (25 seconds).

## Likely jury questions

### “How is this different from an agent’s built-in confirmation prompt?”

Explain the tested integration path and where the gateway intercepts the tool call. Demonstrate the adapter and policy decision. Do not claim coverage for agents or tools that are not integrated and verified.

### “Does this use an external model or send data to a service?”

The inherited project describes a local-first engine. Explain the actual local configuration and network behavior used in this build, and distinguish that from any optional external service. Do not make a blanket claim until you have checked the running configuration and all enabled integrations.

### “Can the agent bypass it?”

Say that gateway enforcement depends on using a configured adapter and the controlled tool path. A user or process able to invoke an alternate path may bypass coverage. Describe what has been tested, then name bypass testing as ongoing work.

### “What happens if the gateway goes down?”

Answer from the adapter’s verified failure behavior in this checkout. If you have not tested it, say so and put fail-open/fail-closed verification on the roadmap. Never guess in front of the jury.

### “How do you prevent false positives or blocked legitimate work?”

Explain the policy outcomes and human-review option. Show how a person resolves an uncertain request. Be clear that current policies and risk signals need tuning against real workflows.

### “What is your own contribution?”

Give a precise split: the existing Cerberus engine/adapters provide the base capabilities; Warden adds the hackathon-specific product framing, dashboard presentation, and any verified extensions in this branch. Point to concrete changed files or commits if asked.

### “What is production-ready?”

State only what has been built and tested. Call out the remaining priorities: fresh-install rehearsal, deterministic scenarios, broader bypass/failure testing, and audit/secret-handling review.

## Presenter checklist

- [ ] Gateway and dashboard start from documented instructions.
- [ ] Dashboard shows connected before the pitch.
- [ ] The safe read-only scenario is ready.
- [ ] The blocked scenario is known and its payload will not be executed.
- [ ] The human-review scenario is ready and will be resolved during the demo.
- [ ] A session exists for the walkthrough, or the fallback plan is ready.
- [ ] No real secrets, unrelated notifications, or personal tabs are visible.
- [ ] The team can explain the upstream foundation, license, tested scope, and limitations.
- [ ] Backup screenshots or a short recording are ready.

## If something fails on stage

- **Gateway offline:** stop scenario triggers, show the architecture and prepared backup, and say the live engine is disconnected. Do not present a stale audit stream as live.
- **No event arrives:** verify the connection once; then switch to the backup and explain which step failed.
- **Review card expires:** show the recorded timeout behavior only if it has been verified. Otherwise restart with the prepared scenario.
- **Session list empty:** continue with live outcomes and explain that the session view depends on events persisted by the engine.
- **Time is running short:** show the block and human-review outcomes first, then the session view if time permits.
