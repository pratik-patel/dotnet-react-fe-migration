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
- `analyst` output: `artefacts/manifests/*.json`, `_summary.json`, `_complexity-routing.json`, `_execution-plan.json`, `_manifest-validation-report.json`.
- Stable input schemas: `.codex/schemas/screen-manifest.schema.json`, `.codex/schemas/execution-plan.schema.json`.
- `architect_normalizer` output: `react-app` foundation, `.codex/rules/react-project.md`, `conversion-config.json`, shared component contracts.
- `builder` output: `src/pages/**`, hooks/schemas/types, `e2e/{screenId}.spec.ts`, `artefacts/conversion-notes/{screenId}.md`.
- `validator` output: `artefacts/validation/scorecards/*`, composite summary, dashboard/report artifacts.
- `fixer` output: targeted code fixes and/or manifest patch proposals.

## Run Policy
- Agents support minimal invocation prompts (example: `Run analyst`) by resolving repository defaults.
- Do not start `builder` for a screen if manifest completeness fails.
- Builder executes full first-pass implementation for all routed screens, including layout and styling fidelity.
- Builder outputs user-facing, interactive React screens that implement manifest contracts/states as concrete UI behavior.
- Builder implements grouped screen actions/modes from one manifest (`views[]`, `actions[]`) unless a split is explicitly requested.
- Builder output must be real screen implementation, not manifest-preview/debug rendering.
- Any preview fallback (raw manifest JSON sections as main UI) is a contract violation and must be treated as FAIL.
- Guided-build screens still receive additional scrutiny, but are not deferred by default.
- Pass requires all dimensions: visual, structural, functional, state coverage, a11y baseline, perf guardrails.
- If fixer retries exceed budget, move screen to `checkpoint_exceptions` queue.

## Deterministic Execution Contract
- Use deterministic mode by default: same manifests + same configs must produce the same file set and structure.
- Process screens in stable order from `artefacts/manifests/_execution-plan.json` unless a subset is explicitly requested.
- `architect_normalizer` validates that `_execution-plan.json` covers all migratable screens exactly once and has no dependency cycles.
- Do not silently reduce scope (no partial-first-pass behavior unless explicitly requested).
- Do not replace missing requirements with ad-hoc alternatives; fail with explicit reason and required patch.
- Keep outputs strictly in declared paths and file names for each agent.
- Record assumptions and unresolved ambiguities in `artefacts/conversion-notes/` and/or audit manifests.

## Remediation Loop Policy
- Use iterative loop per batch: `validator -> fixer/builder -> validator`.
- Route failures to `fixer` for targeted code/config corrections.
- Route failures to `builder` only when missing/incorrect screen construction or manifest-driven regeneration is required.
- Stop loop on `strict_pass` when all screens are `PASS` and no `NEEDS_REVIEW` remain.
- Stop loop on `threshold_pass` when critical failures are zero and threshold criteria in `artefacts/validation/scorecards/_composite-summary.json` are satisfied.
- Enforce hard cap via `maxCycles` in agent policy/config.
- At max cycle breach, route unresolved screens to `checkpoint_exceptions`.

## Instruction-First Principle
Execution is agent-driven. `.codex/agents/*.toml` is the authoritative behavior contract.
Prefer agent instructions over repository automation scripts.
Apply repository rules in `.codex/rules/react-migration.md` and `.codex/rules/react-project.md` during all migration stages.
