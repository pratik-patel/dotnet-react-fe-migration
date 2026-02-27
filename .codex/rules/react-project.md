# React Project Rules

1. Use TypeScript for all generated source files.
2. Use only approved shared components from `react-app/conversion-config.json`.
3. Use design tokens only; do not hardcode color, spacing, radius, or typography values.
4. Keep screen code deterministic and manifest-driven.
5. Treat one manifest as one feature screen with multiple modes/actions (`views[]`, `actions[]`).
6. Implement all `interactiveContracts`, `enableDisableRules`, and declared `uiStates`.
7. Keep behavior parity with source contracts and expected route/action outcomes.
8. Require `data-testid` on interactive elements that map to `interactiveContracts[].elementId`.
9. Consider a screen PASS only when visual, structural, functional, state coverage, accessibility baseline, and performance guardrail checks pass.
10. Keep fixes minimal and local; if root cause is manifest incompleteness, emit a manifest patch instead of guessing.
