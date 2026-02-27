# AGENTS.md

## Objective
Autonomously deliver like-for-like migration of .NET screens to React with deterministic validation and minimal manual intervention.

Screen modeling policy:
- A screen is a business feature surface and may include multiple actions/modes.
- Default contract is screen-level grouping (single manifest with `views[]` + `actions[]`), not action-per-file decomposition.

## Agent Topology
Use a coordinator plus five specialist agents:
1. `analyst` - Extract render-complete screen manifests from .NET source.
2. `architect_normalizer` - Build React foundation, normalize manifests, enforce tokens/conventions.
3. `builder` - Generate screen implementation from manifest with no render inference.
4. `validator` - Run visual, structural, functional, a11y, and perf parity checks.
5. `fixer` - Apply targeted remediations or produce manifest patches.

## Checkpoints (Not Agents)
1. `checkpoint_architecture` (after architect): approve `.codex/rules/react-project.md`, `conversion-config.json`, token strategy, and complexity routing.
2. `checkpoint_exceptions` (after retry budget): review remaining fails after fixer retries.

## Required Inputs/Outputs
- `analyst` output: `artifacts/manifests/*.json`, `_summary.json`, `_complexity-routing.json`, `_execution-plan.json`, `_manifest-validation-report.json`.
- Stable input schemas: `.codex/schemas/screen-manifest.schema.json`, `.codex/schemas/execution-plan.schema.json`.
- `architect_normalizer` output: `react-app` foundation, `.codex/rules/react-project.md`, `conversion-config.json`, shared component contracts.
- `builder` output: `src/pages/**`, hooks/schemas/types, `e2e/{screenId}.spec.ts`, `artifacts/conversion-notes/{screenId}.md`.
- `validator` output: `artifacts/validation/scorecards/*`, composite summary, dashboard.
- `fixer` output: targeted code fixes and/or manifest patch proposals.

## Run Policy
- Agents must support minimal invocation prompts (e.g., `Run analyst`) by resolving default repository paths from their contracts.
- Do not start `builder` for a screen if manifest completeness fails.
- Builder must execute full first-pass implementation for all routed screens, including layout fidelity and styling fidelity.
- Builder must produce user-facing, interactive React screens that implement manifest contracts/states as concrete UI behavior.
- Builder must implement grouped screen actions/modes from one manifest (`views[]`, `actions[]`) unless a split is explicitly requested.
- Builder output must be real screen implementation, not manifest-preview/debug rendering.
- Any preview fallback (raw manifest JSON sections as main UI) is a contract violation and must be treated as FAIL.
- Guided-build screens still receive additional scrutiny, but are not deferred by default.
- Pass requires all dimensions: visual, structural, functional, state coverage, a11y baseline, perf guardrails.
- If fixer retries exceed budget, move screen to `checkpoint_exceptions` queue.

## Deterministic Execution Contract
- Use deterministic mode by default: same manifests + same configs must produce the same file set and structure.
- Process screens in stable order from `artifacts/manifests/_execution-plan.json` unless a specific subset is explicitly requested.
- `architect_normalizer` must validate that `_execution-plan.json` covers all migratable screens exactly once and has no dependency cycles.
- Do not silently reduce scope (no partial-first-pass behavior unless explicitly requested).
- Do not replace missing requirements with ad-hoc alternatives; fail with explicit reason and required patch.
- Keep outputs strictly in declared paths and file names for each agent.
- Record all assumptions and unresolved ambiguities in `artifacts/conversion-notes/` and/or audit manifests.

## Remediation Loop Policy
- Use iterative loop per batch: `validator -> fixer/builder -> validator`.
- Route failures to `fixer` for targeted code/config corrections.
- Route failures to `builder` only when missing/incorrect screen construction or manifest-driven regeneration is required.
- Stop loop on `strict_pass` when all screens are `PASS` and no `NEEDS_REVIEW` remain.
- Stop loop on `threshold_pass` when critical failures are zero and thresholds in `scripts/workflow.config.json` are satisfied.
- Enforce hard cap via `maxCycles` from `scripts/workflow.config.json`.
- At max cycle breach, route unresolved screens to `checkpoint_exceptions`.

## Instruction-First Principle
Prefer agent instructions over adding custom automation code when feasible. Add scripts only for deterministic repeatability (capture, diff, scorecard, orchestration).
Apply repository rules in `.codex/rules/react-migration.md` and `.codex/rules/react-project.md` during all migration stages.
