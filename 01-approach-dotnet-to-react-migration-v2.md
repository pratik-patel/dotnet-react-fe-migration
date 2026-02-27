# Autonomous .NET to React Migration — Approach (v2)

> **Changelog v2:** Added functional parity gate (E2E behavioral validation), baseline determinism requirements, formal PASS/FAIL scorecard definition, complexity-based routing, interactive contract capture in manifests, design token enforcement, and orchestrator dashboard.

---

## Executive Summary

This document outlines a fully autonomous, multi-agent approach for migrating .NET applications to React. Instead of manual screen-by-screen conversion, we construct an agent pipeline — a factory — where specialized AI agents analyze, architect, build, validate, and fix the converted screens with minimal human intervention. This version includes a render-complete UI AST (Render Model) so React screens can be generated deterministically without Builder inference.

The approach leverages Claude Code for code analysis and generation, GitHub Copilot for inline assistance, and Playwright for automated visual AND functional verification. Human involvement is limited to two quality gates: reviewing the architectural foundation and handling the small percentage of screens that exceed the autonomous agents' capabilities.

**Key Outcomes:**
- 40–60 screen applications converted in 2–3 weeks vs. 3–6 months traditional
- 80–90% of screens converted fully autonomously
- Visual fidelity verified through three-layer pixel, structural, and semantic comparison
- Functional parity verified through E2E behavioral assertions per screen state
- Human review limited to complex screens that fail automated validation

---

## Pipeline Overview

The migration is structured as a linear pipeline of five specialized agents plus a validation system that covers both visual and functional parity. The agents operate sequentially through analysis and architecture phases, then shift to parallel execution during conversion, with automated validation and remediation completing the loop.

| Agent | Role | Input | Output | Tool |
|-------|------|-------|--------|------|
| Agent 1 | Analyst | .NET codebase (Razor, CSHTML, ViewModels, Controllers) | Render-complete manifests (Semantic Contract + Render Model) | Claude Code |
| Agent 2 | Architect/Normalizer | All manifests from Agent 1 | React foundation, shared components, conversion config, manifest normalization + completeness report | Claude Code |
| Agent 3 | Builder (×N) | Individual manifest + foundation + config | React screens rendered strictly from Render Model, hooks, tests | Claude Code (parallel) |
| Agent 4 | Validator | Converted screens + baseline screenshots + baseline behavior | Scorecard per screen (pass/review/fail) | Playwright + Claude Vision |
| Agent 5 | Fixer | Failed screens + validation details | Corrected screens and/or manifest patches (up to 3 retries) | Claude Code |

### Pipeline Flow

```
.NET Codebase
      │
      ▼
┌──────────────────────────────────────┐
│  Agent 1: Analyst (Claude Code)      │  ───▶ /manifests/*.json
│  Crawls entire codebase              │        (includes render model + contracts)
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Agent 2: Architect/Normalizer       │  ───▶ React foundation
│  Frequency analysis + foundation     │        + conversion-config.json
│  + design token enforcement          │        + CLAUDE.md
│  + manifest validation report        │        + manifest patches
└──────────────────┬───────────────────┘
                   │
            ▌ HUMAN GATE 1 ▌  (review architecture)
                   │
                   ▼
        ┌─────────────────────────────┐
        │ Manifest Completeness Gate  │
        │ (fail fast on gaps)         │
        └───────────┬─────────────────┘
                    │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
   ┌─────────────┐  ┌─────────────┐
   │ Standard    │  │ Guided      │
   │ Screens     │  │ (top 10%    │
   │ (Agent 3    │  │  complexity │
   │  parallel)  │  │  + human    │
   │             │  │  input)     │
   └──────┬──────┘  └──────┬──────┘
          │                │
          └────────┬───────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Agent 4: Validator                  │
│  Visual (3-layer) + Functional (E2E) │
│  + Accessibility + Performance       │
└──────────────────┬───────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     PASS      REVIEW      FAIL
    (done)    (human)   (Agent 5 ─▶ retry ×3)
```

---

## Phase 0: Golden Baseline Capture

Before any conversion begins, capture the complete visual, structural, AND behavioral baseline of the running .NET application. This baseline serves as the source of truth against which every converted React screen will be validated.

### Baseline Determinism (Critical)

> **Before capturing any screenshots or behavior, the environment must be deterministic.** Without this, dynamic content generates noise that inflates pixel diffs and overwhelms the "needs review" band, making the entire validation layer a bottleneck instead of a filter.

**Required stabilization steps:**

| Source of Non-Determinism | Stabilization Method |
|--------------------------|---------------------|
| Database content | Seed with fixed test data; reset before each capture run |
| Timestamps and dates | Freeze system time or mock `DateTime.Now` to a fixed value |
| "Relative time" labels ("3 minutes ago") | Mock to fixed values or replace with absolute timestamps during capture |
| Font loading | Pre-load all fonts; wait for `document.fonts.ready` before capture |
| CSS animations/transitions | Inject `* { animation: none !important; transition: none !important; }` |
| Cursor blink / focus rings | Remove focus before capture; hide cursor |
| Loading spinners | Wait for `networkidle` + verify no spinners visible |
| Randomized content (avatars, ads) | Mock to static content or exclude from diff regions |
| Scroll position | Reset to top before each capture |
| Toast notifications / ephemeral UI | Wait for dismissal or suppress during capture |

**Implementation:** Create a `stabilize-page.ts` utility that runs before every screenshot:

```typescript
async function stabilizePage(page: Page) {
  // Disable animations
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'
  });
  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);
  // Wait for network
  await page.waitForLoadState('networkidle');
  // Wait for any remaining spinners
  await page.waitForFunction(() => !document.querySelector('.spinner, .loading, [aria-busy="true"]'));
  // Remove focus
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  // Settle
  await page.waitForTimeout(300);
}
```

### Screenshot Capture Strategy

Using Playwright, automate a comprehensive screenshot capture of every screen at multiple viewport widths (1920px, 1440px, 1024px, 768px). Beyond the default render, capture every distinct UI state: empty states, populated states, validation errors, read-only modes, loading states, modal dialogs, and tab-switched views.

> **Critical Insight:** Most migration fidelity failures occur in secondary states, not the default render. A form that looks perfect on load but breaks during validation error display is a missed state. Agent 1 must identify all states during analysis; the capture script exercises each one.

### Behavioral Baseline Capture

Alongside visual capture, record the behavioral contract of each screen — what happens when the user interacts with it. For each interactive element identified in the manifest:

- **Navigation assertions:** Which route does clicking this link/button navigate to?
- **Network assertions:** Which API endpoint is called, with what payload shape?
- **Form behavior assertions:** When do validations trigger? What fields become disabled/required based on state?
- **State transitions:** What changes in the UI when a user completes an action?

This behavioral baseline is captured as Playwright test scripts that can be replayed against the React app to verify functional parity (not just visual parity).

### DOM & Layout Metric Extraction

Alongside screenshots, extract machine-readable layout metrics from every screen — bounding boxes, computed font sizes, colors, spacing, and display properties for every DOM element. This structured data enables Agent 4 to perform precise, actionable comparisons rather than relying solely on pixel diffs.

### State Capture Methods

| Method | How It Works | When to Use |
|--------|-------------|-------------|
| Scripted Navigation | Agent 1 analyzes .NET code and produces Playwright scripts that programmatically trigger each UI state | Regression runs after initial baseline is captured; fully autonomous |
| Session Recording | Human or browser agent walks through screens while Playwright codegen records interactions | Initial baseline capture; one-time human effort that creates replayable scripts |
| **Hybrid (Recommended)** | Session recording for initial baseline, scripted navigation for all subsequent regression runs | Balances speed of setup with full automation for ongoing validation |

---

## Agent 1: Analyst (Screen Decomposition)

### Purpose

Agent 1 crawls the entire .NET codebase and produces a structured JSON manifest for every screen. This manifest becomes the single source of truth that drives all downstream agents. It operates in a single sweep — not screen by screen.

### Input

- The complete .NET solution (.sln) or project root
- Razor/CSHTML view files, ViewModels, Controllers, associated CSS/SCSS
- Routing configuration (RouteConfig, attribute routing)
- API client code or service layer interfaces

### Output: Screen Manifest (JSON per screen)

Each manifest captures the complete contract for one screen. The manifest has two layers.

Layer 1: Semantic Contract, used for validation and confidence auditing.
Layer 2: Render Model (UI AST), used for deterministic JSX generation without Builder inference.

```json
{
  "screenId": "loan-applications-detail",
  "route": "/LoanApplications/Detail/{id}",
  "pageTitle": "Loan Application Detail",
  "complexity": "high",
  "complexityFactors": [
    "multi-tab layout",
    "form with 15+ fields",
    "conditional validation rules",
    "role-based visibility",
    "3 modal dialogs"
  ],
  "sourceFiles": {
    "view": "path/to/View.cshtml",
    "controller": "path/to/Controller.cs",
    "viewModel": "path/to/ViewModel.cs",
    "css": ["path/to/styles.css"]
  },
  "dataSources": [
    {
      "id": "applicationById",
      "endpoint": "GET /api/applications/{id}",
      "method": "GET",
      "routeParams": ["id"],
      "queryParams": [],
      "requestShape": null,
      "responseShape": {
        "id": "string",
        "borrower": { "firstName": "string", "lastName": "string" },
        "loanType": "string (enum: conventional|fha|va)",
        "loanAmount": "number",
        "status": "string (enum: draft|pending|approved|rejected)"
      },
      "usedBy": ["ApplicationForm", "PageHeader"],
      "confidence": "high"
    }
  ],
  "interactiveContracts": [
    {
      "contractId": "saveApplication",
      "elementId": "SaveButton",
      "trigger": "click",
      "preconditions": ["form.valid == true", "permissions.canEdit == true"],
      "action": {
        "type": "api",
        "endpoint": "POST /api/applications/{id}",
        "payloadBinding": "formValues"
      },
      "onSuccess": [
        { "type": "toast", "variant": "success", "message": "Saved" },
        { "type": "navigate", "to": "/LoanApplications/List" }
      ],
      "onError": [
        { "type": "inlineValidation", "mapping": "api.validationErrors" }
      ],
      "confidence": "high"
    }
  ],
  "businessLogic": [
    {
      "ruleId": "showApprovalSection",
      "type": "conditional-visibility",
      "expression": "model.status == 'pending'",
      "affectedComponentIds": ["ApprovalSection"],
      "confidence": "high"
    }
  ],
  "enableDisableRules": [
    {
      "ruleId": "approvalNotesDisabled",
      "targetId": "ApprovalNotesField",
      "enabledWhen": "model.status == 'PendingReview'",
      "disabledWhen": "model.status in ['Approved','Rejected']",
      "confidence": "high"
    }
  ],
  "uiStates": [
    {
      "name": "default-loaded",
      "trigger": "load with valid id",
      "visualChanges": ["fields populated", "status badge visible"]
    },
    {
      "name": "validation-errors",
      "trigger": "submit invalid form",
      "visualChanges": ["field errors visible", "scroll to first error"]
    }
  ],
  "renderModel": {
    "layout": {
      "type": "sidebar-detail",
      "breakpoints": ["768px", "1024px", "1440px"],
      "zones": [
        {
          "name": "sidebar",
          "width": "280px",
          "position": "left",
          "children": ["NavigationMenu", "QuickFilters"]
        },
        {
          "name": "main",
          "children": ["PageHeader", "TabNavigation"]
        }
      ]
    },
    "components": {
      "TabNavigation": {
        "id": "TabNavigation",
        "type": "tabs",
        "defaultTab": "overview",
        "tabs": [
          { "id": "overview", "label": "Overview", "children": ["ApplicationForm", "RiskSummaryCard"] },
          { "id": "documents", "label": "Documents", "children": ["DocumentUploadBar", "DocumentGrid"] }
        ]
      },
      "ApplicationForm": {
        "id": "ApplicationForm",
        "type": "form",
        "dataSourceRef": "applicationById",
        "submitContractRef": "saveApplication",
        "validationTiming": "onSubmit",
        "sections": [
          {
            "id": "borrowerInfo",
            "label": "Borrower Information",
            "layout": "two-column",
            "collapsible": false,
            "fields": [
              {
                "id": "firstName",
                "name": "firstName",
                "label": "First Name",
                "inputType": "text",
                "required": true,
                "maxLength": 50,
                "binding": "model.borrower.firstName",
                "gridColumn": 1
              },
              {
                "id": "loanType",
                "name": "loanType",
                "label": "Loan Type",
                "inputType": "select",
                "required": true,
                "binding": "model.loanType",
                "gridColumn": 2,
                "options": [
                  { "value": "conventional", "label": "Conventional" },
                  { "value": "fha", "label": "FHA" },
                  { "value": "va", "label": "VA" }
                ]
              }
            ]
          }
        ]
      },
      "DocumentGrid": {
        "id": "DocumentGrid",
        "type": "data-grid",
        "dataSource": "GET /api/documents?appId={id}",
        "emptyStateMessage": "No documents uploaded yet",
        "pagination": { "type": "client-side", "pageSize": 10 },
        "columns": [
          {
            "key": "name",
            "header": "Document Name",
            "width": "40%",
            "sortable": true,
            "render": "link",
            "linkTo": "/Documents/View/{row.id}"
          },
          {
            "key": "uploadedDate",
            "header": "Uploaded",
            "width": "20%",
            "sortable": true,
            "render": "date",
            "format": "MM/dd/yyyy"
          },
          {
            "key": "status",
            "header": "Status",
            "width": "15%",
            "render": "badge",
            "badgeMap": {
              "approved": { "label": "Approved", "variant": "success" },
              "pending": { "label": "Pending", "variant": "warning" },
              "rejected": { "label": "Rejected", "variant": "danger" }
            }
          },
          {
            "key": "actions",
            "header": "",
            "width": "10%",
            "render": "actions",
            "actions": [
              { "label": "Download", "icon": "download", "onClickContractRef": "downloadDocument" },
              { "label": "Delete", "icon": "trash", "onClickContractRef": "deleteDocument", "visibleWhen": "permissions.isAdmin == true" }
            ]
          }
        ]
      },
      "RiskSummaryCard": {
        "id": "RiskSummaryCard",
        "type": "display-card",
        "styling": {
          "variant": "elevated",
          "tokenRefs": ["card.elevation.sm", "radius.md", "spacing.lg"]
        }
      }
    }
  },
  "cssAnalysis": {
    "designTokens": {
      "colors": ["#2563eb", "#dc2626", "#16a34a", "#6b7280"],
      "fonts": ["Segoe UI", "Arial"],
      "spacing": ["8px", "16px", "24px", "32px"],
      "radii": ["4px", "8px"],
      "shadows": ["sm", "md"]
    }
  }
}
```

### Key Manifest Additions and Requirements

**`renderModel` (new):** Render-complete UI AST that specifies layout zones, component trees, tab mappings, and field and column-level specs. This eliminates Builder guessing and makes JSX generation deterministic.

**`dataSources.responseShape` (required):** No `{}` placeholders. Response and request shapes must be explicit so types and bindings are deterministic.

**`interactiveContracts` (explicit):** Captures what happens when users interact with each element — click outcomes, onChange behaviors, form submission flows, navigation triggers. These are separated from display-only business logic because they need E2E behavioral assertions, not just visual checks.

**`enableDisableRules` (explicit):** Separated from generic businessLogic because enable or disable state is a common silent loss area that needs explicit field-level validation.

**`complexityFactors` (explicit):** Not just a complexity rating but the reasons why. This drives the complexity routing decision.

### Confidence Tiers

- **HIGH:** Directly extracted from code (explicit validation attributes, routing config)
- **MEDIUM:** Inferred from patterns (conditional rendering, computed properties)
- **LOW:** Ambiguous or requires human clarification (complex state machines, implicit rules)

Agent 5 and human reviewers prioritize LOW confidence items for verification.

### Render Model (UI AST) Requirements

The Render Model must be render-complete. No placeholders like `fields: ["..."]` or `columns: ["..."]` are allowed. Each screen must include:
- Layout zones and ordering
- Tab mappings and children
- Form sections and fields with ordering, input types, bindings, and options
- Grid columns with render type, width, and actions
- Component-level styling hints with token references when needed

If any of these are missing, the manifest fails completeness and cannot enter the Builder phase.

---

## Agent 2: Architect/Normalizer (Foundation & Shared Components)

### Purpose

Agent 2 ingests all manifests from Agent 1 and performs cross-screen frequency analysis to determine which components, patterns, and data models are shared vs. screen-specific. It then generates the complete React project foundation that all Builder agents will use, and validates and normalizes manifests for completeness and stable IDs.

### Frequency Analysis

The Architect agent scans all manifests to identify recurring patterns. Components that appear in 3 or more screens become shared components. Data shapes that appear across multiple endpoints become shared TypeScript interfaces. UI patterns like "form with validation" or "sortable data grid" become standardized implementations.

> **Design Principle — Extract, Don't Predict:** Shared components are derived from actual usage patterns across manifests, not predicted upfront. This ensures every shared abstraction has concrete, proven use cases — avoiding premature generalization.

### Output Artifacts

- **Project Scaffolding:** Vite + React + TypeScript, pre-wired routing mirroring .NET app structure
- **Shared Components:** Stubs with prop interfaces derived from actual manifest usage (DataGrid, FormField, PageLayout, StatusBadge, Modal, etc.)
- **API Client Layer:** Typed React Query hooks for every endpoint discovered across all manifests
- **TypeScript Interfaces:** DTOs and response shapes matching every data source in manifests
- **Design Tokens (enforced):** Colors, typography, spacing extracted from .NET app's CSS as TypeScript constants AND CSS custom properties. Agent 2 also generates an ESLint rule that flags hardcoded color/spacing values not from the token set.
- **conversion-config.json:** Master configuration file telling Agent 3 what shared resources are available and how to use them
- **manifest validation report:** Fail-fast completeness checks and ID normalization output
- **manifest patches:** Patch files to fill missing shapes where derivable

### Design Token Enforcement

Design tokens are not just extracted — they're enforced:

1. Agent 2 extracts tokens from cssAnalysis across all manifests into `/src/styles/tokens.ts` and `/src/styles/tokens.css`
2. Agent 2 generates an ESLint plugin rule (`no-hardcoded-styles`) that flags any inline color hex values, pixel spacing values, or font declarations that don't reference the token set
3. CLAUDE.md explicitly prohibits hardcoded style values
4. Agent 4 validates that the React app's computed styles match the baseline's computed styles (via DOM metrics comparison), catching token misuse that produces visible drift

### CLAUDE.md: The Consistency Contract

The Architect agent generates a CLAUDE.md file that every subsequent Claude Code session reads. This file encodes architectural decisions, naming conventions, component usage patterns, and file organization rules.

```markdown
# CLAUDE.md - Conversion Standards

## Shared Components (use these, do not recreate)
- DataGrid: <DataGrid columns={[...]} data={[...]} sortable filterable />
- FormField: <FormField name="x" label="X" rules={zodSchema} />
- PageLayout: <PageLayout header={...} tabs={[...]}>{children}</PageLayout>

## API Conventions
- All data fetching via React Query hooks in /hooks/api/
- Hook naming: use{Entity}{Action} (useApplicationGet, useLoansSearch)
- Error handling: useErrorBoundary pattern

## Business Logic Rules
- All validations use Zod schemas in /schemas/
- Conditional visibility via useVisibility(rules) hook
- Computed fields via useMemo with explicit dependency arrays

## Design Token Rules (ENFORCED)
- NEVER use hardcoded hex colors — import from @/styles/tokens
- NEVER use hardcoded pixel spacing — use token scale (spacing.xs through spacing.3xl)
- NEVER specify font families inline — use token typography
- ESLint will flag violations; Agent 4 will catch visual drift from token misuse

## File Naming
- Screens: /pages/{Module}/{ScreenName}/index.tsx
- Tests: colocated as {ScreenName}.test.tsx
- E2E tests: /e2e/{screenId}.spec.ts
- Hooks: /hooks/{domain}/use{Name}.ts

## Conversion Protocol
1. Read the manifest JSON for this screen
2. Validate manifest completeness (renderModel + dataSources)
3. Identify which shared components apply
4. Render the component tree strictly from renderModel
5. Wire up API hooks for all data sources
6. Implement ALL interactive contracts from the manifest
7. Implement ALL business logic rules from the manifest
8. Implement ALL enable/disable rules from the manifest
9. Handle ALL UI states listed in the manifest
10. Generate unit tests covering every business rule
11. Generate E2E test spec covering every interactive contract
12. Write conversion-notes.md with confidence flags
```

### Complexity-Based Routing

Agent 2 also reads `/manifests/_summary.json` and generates a routing plan:

```json
{
  "standardBuild": ["screen-a", "screen-b", "screen-c", "..."],
  "guidedBuild": ["complex-screen-x", "complex-screen-y"],
  "guidedBuildCriteria": "complexity == high AND (complexityFactors includes 'multi-tab' OR interactiveContracts.length > 10 OR LOW confidence rules > 3)"
}
```

**Standard screens** go through the parallel Agent 3 factory.
**Guided screens** (top ~10% by complexity) still go through Agent 3 but with additional human input upfront: a human reviews the manifest, annotates ambiguous interactive contracts, and provides clarifying notes before the Builder runs. This prevents these screens from churning through the Agent 5 retry loop.

### Manifest Completeness Gate (Fail Fast)

Before Agent 3 runs, every manifest must pass a completeness check. Failures block the pipeline and return to Agent 1 or Agent 2 for patching.

Fail conditions include:
- `fields: ["..."]` or missing `sections[].fields[]`
- `columns: ["..."]` or missing `columns[].render` or `columns[].width`
- Missing `renderModel.layout.zones[]`
- Tabs present without `tabs[].children[]`
- `responseShape: {}` or missing responseShape
- Interactive contracts referencing elementIds not present in `renderModel.components`
- Missing bindings for displayed fields or payloads

Output artifacts:
- `/manifests/_manifest-validation-report.json`
- `/manifests/_render-model-catalog.json`

### ▌ HUMAN GATE 1: Architecture Review

Before the Builder factory starts, a human reviews the Architect output. This is a 1–2 hour review. Wrong architectural decisions here multiply across every screen. Review: shared component interfaces, routing structure, API conventions, CLAUDE.md, design token set, complexity routing plan.

---

## Agent 3: Builder (Parallel Screen Conversion)

### Purpose

The Builder agent is the workhorse of the pipeline. It takes a single screen manifest and the React foundation from Agent 2, and renders the React screen strictly from the Render Model with no inference. Multiple Builder instances run in parallel to convert the entire application simultaneously.

### Parallel Execution Model

For a 50-screen application, run 5–10 concurrent Claude Code sessions, each processing a batch of screens. Because Agent 2 established all shared contracts and conventions, these parallel sessions produce compatible code without conflicts.

| App Size | Parallel Sessions | Screens/Session | Est. Duration |
|----------|-------------------|-----------------|---------------|
| Small (10–20 screens) | 2–3 | 5–7 | 4–8 hours |
| Medium (30–60 screens) | 5–10 | 5–8 | 2–3 days |
| Large (80–150 screens) | 10–15 | 8–12 | 4–7 days |

### Per-Screen Output

- **React Component(s):** Complete implementation rendered strictly from renderModel using shared components from Agent 2
- **Screen-Specific Hooks:** Custom hooks for any logic unique to this screen
- **Unit Test File:** Tests covering every business rule identified in the manifest
- **E2E Test Spec (new in v2):** Playwright tests covering every interactive contract — navigation assertions, network assertions, form behavior assertions
- **conversion-notes.md:** Flags for every business logic decision, confidence levels, and assumptions made

### Builder Agent Prompt Template

```
Given:
- Screen manifest: /manifests/{screenId}.json
- React foundation: /src/ (shared components, hooks, types)
- CLAUDE.md: Conversion standards and conventions
- conversion-config.json: Available shared resources

Generate:
1. React component(s) rendered strictly from renderModel
2. TypeScript interfaces for any screen-specific data models
3. React Query hook(s) for all data sources in the manifest
4. Zod validation schemas for all business rules
5. Implementation for ALL interactive contracts
6. Implementation for ALL enable/disable rules
7. Unit tests covering every business rule and UI state
8. E2E test spec (/e2e/{screenId}.spec.ts) covering:
   - Every interactive contract (click → expected outcome)
   - Navigation assertions (link clicks → correct routes)
   - Network assertions (form submit → correct endpoint + payload)
   - Form behavior (validation timing, field enable/disable)
   - Every UI state transition
9. conversion-notes.md flagging:
   - LOW confidence business rules needing verification
   - LOW confidence interactive contracts needing verification
   - Assumptions made about ambiguous behavior
   - Shared components used vs. screen-specific implementations

Constraints:
- Use ONLY shared components from conversion-config.json
- Use ONLY design tokens for colors, spacing, fonts (no hardcoded values)
- Follow ALL conventions in CLAUDE.md
- Implement ALL UI states listed in the manifest
- Do NOT introduce new patterns not in CLAUDE.md
- Do NOT infer missing render details. If renderModel is incomplete, fail the manifest and request a patch.
```

---

## Agent 4: Validator (Visual + Functional + Quality)

### Purpose

Agent 4 is the comprehensive quality gate. **v2 expands validation beyond visual fidelity to include functional parity, accessibility baseline, and performance guardrails.** A screen must pass ALL dimensions to receive a PASS classification.

### Formal Scorecard Definition

> A screen receives **PASS** only when ALL of the following are true:

| Dimension | PASS Criteria | Measurement |
|-----------|--------------|-------------|
| Visual Fidelity | Pixel diff < 2% across all viewports and all states | pixelmatch |
| Structural Parity | Zero critical DOM metric deltas (missing elements, major size differences) | DOM comparison |
| Functional Parity | All E2E tests pass (navigation, network, form behavior, interactive contracts) | Playwright E2E |
| UI State Coverage | All states listed in manifest have been captured and validated | State checklist |
| Accessibility Baseline | All form fields have labels, focus order is logical, keyboard navigation works for primary flows | Playwright + axe-core |
| Performance Guardrail | Page load < 3s on throttled connection, no single JS bundle > 250KB | Lighthouse lite |

A failure in ANY dimension means the screen does not pass, regardless of how good the other dimensions are. This prevents "it looks fine" from masking behavioral or accessibility regressions.

### Layer 1: DOM & CSS Structural Comparison

The cheapest and most actionable layer. For both the .NET and React versions, extract machine-readable layout metrics — bounding boxes, computed styles, font properties, and spacing — from every DOM element. Agent 4 then compares these JSON structures to produce precise, actionable deltas.

This layer catches structural issues: wrong element positions, missing components, incorrect font sizes, mismatched colors, and broken spacing. The output is specific enough for Agent 5 to autonomously fix (e.g., "sidebar width is 300px, should be 250px").

### Layer 2: Pixel-Level Comparison

Using pixelmatch or reg-suit, perform pixel-by-pixel comparison between baseline and converted screenshots at every viewport width and every UI state.

| Diff Threshold | Classification | Action |
|----------------|---------------|--------|
| < 2% | **PASS** (visual) | Auto-approved. Minor rendering differences expected. |
| 2% – 10% | **NEEDS REVIEW** | Escalated to Layer 3 (Claude Vision) for semantic analysis. |
| > 10% | **FAIL** | Sent to Agent 5 with Layer 1's structural delta as guidance. |

### Layer 3: Claude Vision Semantic Comparison

The intelligent tiebreaker layer. Claude's vision capability compares baseline and converted screenshots with semantic understanding — it can distinguish between acceptable differences (font rendering, scrollbar styling) and meaningful failures (missing columns, wrong data, broken layout).

Runs selectively on screens in the "needs review" band (2–10% pixel diff) and on screens with complex multi-state interactions.

### Layer 4: Functional Parity (E2E Behavioral Assertions) — NEW in v2

This is the layer that catches "button does nothing" and "wrong API call" — failures invisible to visual comparison. Agent 3 generates E2E test specs for every interactive contract in the manifest. Agent 4 runs these against the React app:

**What E2E tests verify:**
- **Navigation:** Clicking a link/button navigates to the correct route
- **Network:** Form submissions call the correct API endpoint with the correct payload shape
- **Form behavior:** Validations fire at the correct timing (onBlur vs. onSubmit), error messages appear in the correct location, fields enable/disable based on state
- **Interactive contracts:** Every click/change/submit outcome matches the manifest's interactiveContracts specification
- **State transitions:** UI updates correctly after each user action

**How it works with the baseline:**
The behavioral baseline (Playwright scripts captured in Phase 0) runs against the .NET app to establish expected behavior. The same flows run against the React app. Agent 4 compares:
- Did the same route changes occur?
- Were the same API endpoints called with the same payload shapes?
- Did the same validation messages appear?
- Did the same UI state transitions happen?

### Layer 5: Accessibility & Performance Baseline — NEW in v2

Lightweight checks that prevent regressions:

**Accessibility (axe-core via Playwright):**
- All form inputs have associated labels
- Focus order follows visual order
- Keyboard navigation works for primary flows (tab through form, submit with Enter)
- No critical axe-core violations

**Performance (Lighthouse-lite checks):**
- Page load time < 3 seconds on throttled 3G
- No individual JS chunk > 250KB
- No blocking resources preventing first paint

These aren't comprehensive audits — they're guardrails preventing the conversion from introducing regressions the .NET app didn't have.

### UI State Verification Matrix

Each screen is validated across all states identified in the manifest. A screen only receives a PASS classification when all of its states pass across ALL layers:

| UI State | Visual Check | Functional Check | Common Failure Mode |
|----------|-------------|-----------------|-------------------|
| Default Loaded | Layout, data display, navigation | API call made, data rendered correctly | Missing components, wrong grid column order |
| Empty/New State | Placeholder text, default values | No API errors, form in editable state | Missing empty state handling, wrong defaults |
| Validation Errors | Error messages, field highlighting | Errors appear at correct timing, correct fields flagged | Different error placement, wrong validation timing |
| Read-Only Mode | Disabled fields, hidden buttons | Fields truly non-editable, buttons truly hidden | Fields still editable via keyboard, buttons clickable |
| Modal/Dialog States | Modal position, overlay, content | Open/close behavior, confirm/cancel actions work | Wrong modal sizing, confirm calls wrong endpoint |
| Responsive Viewports | Layout reflow, element stacking | All interactions still work at each width | Broken grid at tablet, overflow hides buttons |

---

## Agent 5: Fixer (Autonomous Remediation)

### Purpose

Agent 5 receives failed screens from Agent 4 along with the specific validation details — structural deltas, pixel diff percentages, Claude Vision assessments, AND E2E test failure reports. It autonomously corrects the issues and resubmits to Agent 4 for re-validation, looping up to 3 times. If the failure traces back to missing or incorrect manifest data, Agent 5 can emit a manifest patch rather than only code changes.

### Remediation Strategy

- **Structural Fixes (from Layer 1):** Precise CSS/layout corrections driven by exact delta values.
- **Visual Fixes (from Layer 2):** Diff images highlight exactly where pixels diverge.
- **Semantic Fixes (from Layer 3):** Claude Vision identifies missing elements, misplaced components.
- **Functional Fixes (from Layer 4):** E2E test failure logs identify which interactive contract failed, what was expected vs. actual. These are often wiring issues (wrong endpoint URL, missing onClick handler, incorrect form validation timing).
- **Accessibility Fixes (from Layer 5):** axe-core violations with specific element references and fix recommendations.
- **Manifest Patches (new):** If the root cause is incomplete renderModel or missing shapes, emit a manifest patch and re-run Agent 2 normalization.

### Retry Loop & Escalation

```
for each failed_screen:
  retry_count = 0
  while retry_count < 3:
    fixes = Agent5.analyze(all_validation_details)
    Agent5.apply(fixes)
    result = Agent4.validate(screen)  // runs ALL layers
    if result == PASS:
      break
    retry_count += 1
  
  if retry_count >= 3:
    escalate_to_human_review_queue(screen, all_validation_details)
```

### ▌ HUMAN GATE 2: Review Queue

Screens that fail after 3 fix cycles land in the human review queue. For a 50-screen app, expect 5–8 screens here — typically those with:
- Complex business logic the Analyst couldn't fully capture
- Heavily custom UI with no pattern match to shared components
- Deep client-side state orchestration across multiple components
- Interactive contracts with LOW confidence that Agent 5 couldn't resolve

---

## Tool Mapping & Technology Stack

| Agent | Primary Tool | Supporting Tools | Why This Tool |
|-------|-------------|-----------------|---------------|
| Agent 1 (Analyst) | Claude Code | AST parsers, Regex patterns | Deep code understanding, cross-file analysis |
| Agent 2 (Architect/Normalizer) | Claude Code | Vite CLI, npm/yarn, ESLint plugin generator | Architectural reasoning, pattern analysis, token enforcement, manifest normalization |
| Agent 3 (Builder) | Claude Code (parallel) | GitHub Copilot (inline polish) | Screen rendering from renderModel; Copilot for inline completion |
| Agent 4 (Validator) | Playwright + Claude Vision | pixelmatch, axe-core, Lighthouse | Multi-layer validation: visual, functional, accessibility, performance |
| Agent 5 (Fixer) | Claude Code | ESLint, TypeScript compiler | Targeted code fixes from structured validation feedback |
| Orchestrator | Shell script / Custom CLI | GitHub Actions | Chains stages, manages parallel sessions, generates dashboard |

### React Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Build Tool | Vite + React 18+ + TypeScript | Fast builds, strong typing for generated code |
| Server State | React Query (TanStack Query) | Matches API-driven patterns from .NET; caching, error handling built-in |
| Form Management | React Hook Form + Zod | Validation schemas map directly to .NET validation attributes |
| Routing | React Router v6+ | Route structure mirrors .NET routing config |
| Styling | CSS Modules or Tailwind (via design tokens) | Tokens from .NET app CSS; scoped styles prevent conflicts |
| Unit Testing | Vitest + React Testing Library | Colocated tests generated per screen by Agent 3 |
| E2E Testing | Playwright | Screenshot capture, E2E behavioral assertions, accessibility |
| Visual Testing | pixelmatch | Pixel-level comparison against .NET baseline |
| Accessibility | axe-core (via @axe-core/playwright) | Automated a11y checking during validation |
| Linting | ESLint + custom token enforcement rule | Prevents hardcoded styles that cause visual drift |

---

## Shared Component Strategy

Shared components are not designed upfront. They emerge from Agent 2's frequency analysis of all screen manifests. This ensures every shared abstraction is backed by concrete, proven usage patterns rather than predictions.

### Component Emergence Process

1. Agent 1 catalogs every UI element across all screens with its props, behavior, and context.
2. Agent 2 performs frequency analysis: any component pattern appearing 3+ times becomes a shared component candidate.
3. Agent 2 derives the minimal prop interface from actual usage (not maximal "maybe we'll need this").
4. Shared components are generated as stubs with typed interfaces; Agent 3 populates them during conversion.
5. Post-conversion, a refactoring pass consolidates any screen-specific components that Agent 3 created which overlap with shared ones.

### Design Principles

- **Compound Components over Configuration Props:** Instead of `<Card variant="metric" showIcon header="..."/>` with many props, prefer composable pieces: `<Card><Card.Header><Icon/>{title}</Card.Header><Card.Body>...</Card.Body></Card>`
- **Interface Segregation:** Define the minimal prop interface the component needs. Widening later is easy; narrowing is painful.
- **Colocation Then Promotion:** Components start near their first usage, then get promoted to `/shared/` when reuse emerges.
- **Design Tokens From Source (enforced):** Colors, fonts, spacing are extracted from the .NET application's CSS. ESLint rules prevent hardcoded alternatives.

---

## Orchestrator Dashboard — NEW in v2

The orchestrator generates a single-page HTML dashboard showing real-time pipeline status:

### Dashboard Metrics

| Metric | Description |
|--------|-------------|
| **Coverage: Baseline Captured** | % of screens with complete screenshot + behavioral baseline |
| **Coverage: Built** | % of screens that have been through Agent 3 |
| **Coverage: Passing** | % of screens with PASS across all validation layers |
| **Coverage: In Fix Loop** | % of screens currently in Agent 5 retry cycle |
| **Coverage: Human Queue** | % of screens escalated to human review |
| **Top Failure Reasons** | Ranked list of most common validation failures (e.g., "font mismatch: 12 screens", "missing empty state handler: 8 screens", "wrong grid column order: 5 screens") |
| **Per-Screen Status** | Table of every screen with status, worst diff %, E2E pass rate, and link to scorecard |
| **Agent 5 Effectiveness** | % of failures resolved per retry attempt (indicates whether fix prompts need tuning) |

This dashboard is the single source of truth for project status. It answers "how's the migration going?" without anyone needing to dig through individual scorecards.

---

## Realistic Timeline & Effort

Assumes a medium-sized .NET application with 40–60 screens:

| Phase | Activity | Duration | Human Effort | Autonomous |
|-------|----------|----------|-------------|------------|
| Phase 0 | Baseline capture (screenshots + DOM metrics + behavioral scripts) | 1–2 days | 3–5 hours setup + determinism config | Mostly |
| Agent 1 | Codebase analysis + manifest generation (including interactive contracts) | 1–2 days | Spot-check manifests, annotate guided-build screens | Fully |
| Agent 2 | Architecture + foundation + CLAUDE.md + token enforcement + complexity routing | 1 day | ▌GATE 1 review | Fully |
| Agent 3 | Parallel screen conversion (5–10 sessions) + E2E test generation | 2–3 days | Input on guided-build screens only | Fully |
| Agent 4+5 | Validation (all layers) + autonomous fix cycles | 1–2 days | None | Fully |
| Human | Review queue (5–8 complex screens) | 2–3 days | ▌GATE 2 review | Manual |
| Polish | Integration testing, edge cases, final polish | 2–3 days | Active testing | Supported |

**Total: 2–3 weeks end-to-end** (vs. 3–6 months traditional)
**Human effort: ~20–30%** of total calendar time (concentrated at gates and review queue)

---

## Risks & Mitigations

| Risk | Impact | Mitigation | Detection |
|------|--------|-----------|-----------|
| Silent business logic loss | **High** — functionality appears correct but validation rules or conditional logic are missing | Agent 1 captures interactiveContracts explicitly; Agent 3 generates E2E tests per contract; Agent 4 runs E2E behavioral assertions; confidence tiers flag uncertain rules | E2E test failures; conversion-notes.md LOW confidence flags |
| Silent functional loss ("button does nothing") | **High** — visual fidelity is perfect but interactions are broken | E2E behavioral assertions verify every interactive contract; network assertions verify correct API calls; navigation assertions verify correct routes | E2E test failures; Playwright network interception logs |
| Non-deterministic baselines flooding review queue | **Medium** — dynamic content generates pixel noise | Stabilize-page utility freezes time, disables animations, seeds data, waits for fonts; run baseline capture twice and verify < 0.5% self-diff | Self-diff check; monitor "needs review" volume |
| Premature abstraction in shared components | **Medium** — wrong shared component design cascades | Frequency analysis ensures 3+ real usages; Human Gate 1 reviews before factory starts | Agent 2 outputs usage count per component |
| Visual false positives overwhelming review | **Medium** — font rendering differences trigger unnecessary reviews | Three-layer strategy; Claude Vision filters false positives; deterministic baselines reduce noise | Track false positive rate; tune pixel threshold |
| Parallel Builder sessions producing inconsistent code | **Medium** — different sessions make different architectural choices | CLAUDE.md enforces conventions; conversion-config constrains resources; design token ESLint rule prevents CSS drift; post-merge lint/type checks | ESLint violations; TypeScript mismatches |
| High-complexity screens churning in fix loop | **Medium** — top 10% screens waste Agent 5 retries before hitting human queue anyway | Complexity routing sends guided-build screens through enhanced path with human input upfront | Monitor Agent 5 effectiveness rate by complexity tier |
| API contract mismatch | **Low** — backend is unchanged; risk is in manifest accuracy | Keep backend unchanged; Agent 1 extracts contracts from code; E2E network assertions validate endpoint + payload shape against live backend | React Query type errors; E2E network assertion failures |

---

## Key Principles

### Separate "What" from "How"
The screen manifest (Agent 1) defines what each screen does. The React foundation (Agent 2) defines how things are built. The Builder agents operate in the space between — translating the "what" into the "how" using established patterns. This separation is what enables parallelism and consistency.

### Verify Behavior, Not Just Appearance
Visual fidelity is necessary but not sufficient. A screen that looks identical but has broken interactions, wrong API calls, or missing validations is not a successful conversion. Every interactive contract gets an E2E assertion.

### Humans Review Business Logic, AI Handles Boilerplate
The biggest risk in like-for-like conversion isn't getting the layout wrong — it's silently dropping a validation rule or conditional visibility check. Every piece of business logic is flagged with a confidence tier so humans can focus their review on the uncertain items.

### Shared Components Emerge, They Aren't Predicted
Agent 2's frequency analysis across all manifests ensures shared components are backed by real usage patterns. This avoids premature generalization and ensures every abstraction fits its actual use cases.

### Enforce Design Tokens, Don't Just Extract Them
Extracting tokens is step one. Enforcing them via ESLint rules and validating them via DOM metrics comparison is what actually prevents CSS drift across 50+ screens built by parallel agents.

### Keep the API Layer Unchanged Initially
If the .NET backend exposes REST APIs, keep them as-is and swap only the frontend. This massively reduces risk by limiting the change surface. Backend modernization can happen as a separate, subsequent workstream.

### Route Complexity Early, Not After Failure
Don't let high-complexity screens burn through 3 Agent 5 retries before reaching a human. Use manifest complexity data to route them to a guided build path with human input upfront, saving time and fix cycles.

### Visual Fidelity Is Verified, Not Assumed
Code that compiles and passes unit tests can still look completely wrong. The three-layer visual verification strategy (structural comparison, pixel diff, semantic vision analysis) ensures that "like-for-like" is objectively measured, not subjectively claimed.
