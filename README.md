# Dotnet to React FE Migration Runbook

## Folder Contract
- `.codex/`: Stable Codex configuration and contracts.
- `.codex/agents/`: Agent definitions (`analyst`, `architect-normalizer`, `builder`, `validator`, `fixer`).
- `.codex/rules/`: Global migration and React project rules consumed by agents.
- `.codex/schemas/`: Stable JSON schemas (not agent outputs).
- `artefacts/`: Generated outputs only (manifests, scorecards, reports, screenshots).
- `.NET source`: Any imported .NET solution/project location in the workspace (analyst auto-discovers root; no fixed folder required).
- `react-app/`: Generated and normalized React implementation target.

## Manifest Modeling Contract
- One manifest represents one feature screen.
- A screen can include multiple modes/actions (for example list/create/edit/details/delete).
- Use `views[]` and `actions[]` inside one screen manifest to model those flows.
- Do not split by MVC action unless explicitly requested.

## Sequential Agent Prompts
Use these prompts in order in Codex. Agents resolve default input/output locations from their own contracts.

1. Analyst
```text
Run analyst.
```

2. Architect Normalizer
```text
Run architect_normalizer.
```

3. Builder
```text
Run builder.
```

4. Validator
```text
Run validator.
```

5. Fixer Loop
```text
Run fixer loop until threshold_pass (or maxCycles).
```

## Optional Subset Prompt
```text
Run builder only for these screenIds: <screen1>, <screen2>, <screen3>, preserving _execution-plan.json dependency order among the subset.
```

## Agent Contract Checklist
Use this checklist after each stage.

1. Analyst
- `artefacts/manifests/{screenId}.json` exists per grouped feature screen.
- `likeToLikeSpec` is present in each screen manifest and includes:
  - `layoutTree`, `componentSpecs`, `fieldMatrix`, `gridMatrix`
  - `validationMatrix`, `conditionalRules`, `styleMap`, `templateUsage`
  - `eventFlow`, `evidenceMap`
- `buildFoundation` is present in each screen manifest and includes:
  - `uiBlueprint`, `stateModel`, `dataFlowModel`, `routeModel`
  - `styleModel`, `componentContractModel`, `acceptanceOracle`
- Aggregate outputs exist:
  - `_summary.json`
  - `_api-catalog.json`
  - `_component-frequency.json`
  - `_business-rules-audit.json`
  - `_complexity-routing.json`
  - `_execution-plan.json`
  - `_manifest-validation-report.json`
- No action-per-file decomposition unless explicitly requested.

2. Architect Normalizer
- `react-app/` exists (bootstrapped if missing).
- `.codex/rules/react-project.md` exists and is updated.
- `react-app/conversion-config.json` exists and is valid.
- `_execution-plan.validation.json` exists with explicit validity/errors.

3. Builder
- Real pages generated under `react-app/src/pages/**`.
- Supporting artifacts generated under `react-app/src/**`.
- E2E specs generated under `react-app/e2e/**`.
- Conversion notes generated under `artefacts/conversion-notes/**`.
- No manifest-preview/debug UI as primary output.

4. Validator
- Per-screen composite scorecards exist in `artefacts/validation/scorecards/*-composite.json`.
- `_composite-summary.json` exists with critical-failure and threshold status.
- All required dimensions reported per screen.

5. Fixer Loop
- Iterative `validator -> fixer -> validator` runs are recorded.
- Per-attempt remediation notes exist:
  - `artefacts/conversion-notes/{screenId}-fix-{attempt}.md`
- Loop stops only on `strict_pass`, `threshold_pass`, or `maxCycles`.
