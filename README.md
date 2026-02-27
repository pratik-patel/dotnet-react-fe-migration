# Dotnet to React FE Migration Runbook

## Folder Contract
- `.codex/`: Stable Codex configuration and contracts.
- `.codex/agents/`: Agent definitions (`analyst`, `architect-normalizer`, `builder`, `validator`, `fixer`).
- `.codex/rules/`: Global migration and React project rules consumed by agents.
- `.codex/schemas/`: Stable JSON schemas (not agent outputs).
- `scripts/`: Executable automation for deterministic validation/parity workflows.
- `artifacts/`: Generated outputs only (manifests, scorecards, reports, screenshots).
- `legacy-src/`: Imported .NET source project to analyze and migrate.

## Manifest Modeling Contract
- One manifest represents one feature screen.
- A screen can include multiple modes/actions (for example list/create/edit/details/delete).
- Use `views[]` and `actions[]` inside one screen manifest to model those flows.
- Do not split by MVC action unless explicitly requested.

## Sequential Agent Prompts
Use these prompts in order in Codex. Agents are expected to resolve default input/output locations from their own contracts.

1. Analyst
```text
Run analyst.
```

2. Architect Normalizer
```text
Run architect_normalizer.
```

3. Builder (full pass)
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
Run agent builder only for these screenIds: <screen1>, <screen2>, <screen3>, preserving _execution-plan.json dependency order among the subset.
```
