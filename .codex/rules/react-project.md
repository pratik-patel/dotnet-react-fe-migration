# React Project Rules

1. Use TypeScript for all generated source files.
2. Treat `react-app/conversion-config.json` as the canonical project contract.
3. Use only approved shared components under `react-app/src/components/shared`.
4. Use design tokens only from `react-app/src/styles/tokens.css`; no hardcoded color/spacing/radius/typography values.
5. Treat one manifest as one feature screen with multiple modes/actions (`views[]`, `actions[]`).
6. Preserve route/action parity from `primaryRoute`, `routes[]`, `actions[]`, and `interactiveContracts`.
7. Preserve validation parity from DataAnnotations, ModelState branches, template rules, and service/EF error paths captured in manifests.
8. Preserve style/template parity from `likeToLikeSpec.styleMap` and `likeToLikeSpec.templateUsage`.
9. Require `data-testid` on interactive elements mapped from `interactiveContracts[].elementId` where applicable.
10. Do not implement screens when manifest completeness gates fail; emit explicit blocking notes instead.
11. Keep output deterministic: same manifest set and config must produce same file structure and behavior contract.
12. Keep backend API contracts unchanged unless explicitly approved.
