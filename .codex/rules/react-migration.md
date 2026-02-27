# React Migration Rules

1. Build screens only from manifest contracts. Do not infer missing render details.
2. Require stable selectors for parity tests: interactive elements must expose `data-testid` equal to `interactiveContracts[].elementId`.
3. Use only approved shared components from `react-app/conversion-config.json`.
4. Use design tokens only; do not hardcode color, spacing, radius, typography values.
5. Keep API contract parity with .NET endpoints and payload shapes.
6. Every interactive contract must have at least one E2E assertion.
7. If a contract cannot be implemented due to missing manifest detail, emit a manifest patch instead of guessing.
