# Autonomous .NET to React Migration — Implementation Runbook (v2)

> **Purpose:** This is the executable companion to the Approach document. Feed this to Claude Code to generate and run each agent in the pipeline. Every section contains the actual prompts, scripts, configurations, and commands needed to execute the migration.

> **Changelog v2:** Added baseline determinism setup, E2E behavioral test generation, formal scorecard checks, complexity routing, design token enforcement, accessibility/performance gates, orchestrator dashboard, interactive contract capture in Agent 1 prompt.
>
> **v3 updates applied:** Render-complete manifest requirements, strict manifest validation + completeness gate, Agent 2 normalization outputs, Agent 3 non-inference constraints, and Agent 5 manifest patch capability.

---

## Prerequisites

### Environment Setup

```bash
# Node.js 18+ and npm
node --version  # >= 18.x

# Project dependencies
npm create vite@latest react-app -- --template react-ts
cd react-app
npm install
npm install @tanstack/react-query react-router-dom react-hook-form zod @hookform/resolvers
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D playwright @playwright/test pixelmatch pngjs
npm install -D @axe-core/playwright  # accessibility
npm install -D msw                   # API mocking for E2E tests

# Initialize Playwright
npx playwright install chromium

# ESLint for token enforcement (Agent 2 will generate the rule)
npm install -D eslint @typescript-eslint/eslint-plugin
```

### Directory Structure

```
project-root/
├── dotnet-source/              # Original .NET application source
├── manifests/                  # Agent 1 output: JSON per screen
│   ├── {screenId}.json         # Screen manifest
│   ├── {screenId}.states.json  # State transition scripts
│   ├── _summary.json           # All screens overview
│   ├── _api-catalog.json       # Deduplicated API endpoints
│   ├── _component-frequency.json
│   ├── _business-rules-audit.json  # LOW confidence rules
│   ├── _complexity-routing.json    # Standard vs guided-build
│   ├── _render-model-catalog.json       # NEW
│   └── _manifest-validation-report.json # NEW
├── baseline/                   # Phase 0 output
│   ├── screenshots/            # Organized: screen/viewport/state.png
│   ├── metrics/                # DOM layout metrics: screen/viewport/state.json
│   └── behaviors/              # Behavioral baseline Playwright scripts
├── react-app/                  # Agent 2 foundation + Agent 3 screens
│   ├── src/
│   │   ├── components/shared/  # Shared components (Agent 2)
│   │   ├── hooks/api/          # API hooks (Agent 2)
│   │   ├── hooks/utils/        # Utility hooks (Agent 2)
│   │   ├── pages/              # Screen implementations (Agent 3)
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── types/              # TypeScript interfaces
│   │   └── styles/
│   │       ├── tokens.ts       # Design tokens (TypeScript)
│   │       └── tokens.css      # Design tokens (CSS custom properties)
│   ├── e2e/                    # E2E behavioral tests (Agent 3)
│   │   └── {screenId}.spec.ts
│   ├── CLAUDE.md               # Consistency contract (Agent 2)
│   └── conversion-config.json
├── validation/                 # Agent 4 output
│   ├── screenshots/            # React app captures
│   ├── diffs/                  # Pixel diff images
│   ├── metrics/                # React DOM metrics
│   ├── metrics-deltas/         # Comparison deltas
│   ├── e2e-results/            # E2E test results per screen
│   ├── a11y-results/           # Accessibility audit per screen
│   ├── perf-results/           # Performance checks per screen
│   ├── scorecards/             # Per-screen composite scorecards
│   └── dashboard.html          # Orchestrator dashboard
├── scripts/                    # Orchestrator scripts
│   ├── stabilize-page.ts       # Determinism utility
│   ├── capture-baseline.ts
│   ├── capture-baseline-behavior.ts
│   ├── capture-react.ts
│   ├── pixel-compare.ts
│   ├── compare-metrics.ts
│   ├── run-e2e-parity.sh
│   ├── run-a11y-checks.sh
│   ├── generate-scorecard.ts
│   ├── generate-dashboard.ts
│   ├── run-builders.sh
│   ├── orchestrate.sh
│   └── validate-manifests.ts          # NEW (completeness gate)
└── conversion-notes/           # Agent 3 output: per-screen notes
```

---

## Phase 0: Golden Baseline Capture

### Step 0.0 — Baseline Determinism Setup

> **This step is critical.** Without determinism, dynamic content generates noise that inflates pixel diffs and overwhelms the review band.

Create `scripts/stabilize-page.ts`:

```typescript
import { Page } from '@playwright/test';

/**
 * Stabilizes a page for deterministic screenshot capture.
 * Run this BEFORE every screenshot and metric extraction.
 */
export async function stabilizePage(page: Page): Promise<void> {
  // 1. Disable all animations and transitions
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        animation-duration: 0s !important;
        transition: none !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
      }
    `,
  });

  // 2. Wait for all fonts to load
  await page.evaluate(() => document.fonts.ready);

  // 3. Wait for network to settle
  await page.waitForLoadState('networkidle');

  // 4. Wait for spinners/loading indicators to disappear
  await page.waitForFunction(() => {
    const loadingSelectors = [
      '.spinner', '.loading', '.loader',
      '[aria-busy="true"]',
      '[data-loading="true"]',
      '.skeleton',
    ];
    return !loadingSelectors.some(sel => document.querySelector(sel));
  }, { timeout: 10000 }).catch(() => {
    console.warn('Warning: loading indicators still present after 10s');
  });

  // 5. Remove focus (prevents cursor blink, focus rings)
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
  });

  // 6. Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));

  // 7. Hide any toast notifications or ephemeral UI
  await page.addStyleTag({
    content: `
      .toast, .notification, .snackbar, [role="alert"],
      .Toastify, .react-toast, .notistack {
        display: none !important;
      }
    `,
  });

  // 8. Wait for everything to settle
  await page.waitForTimeout(500);
}

/**
 * Freeze time-dependent content for deterministic captures.
 * Call this ONCE at the start of a capture session.
 */
export async function freezeTime(page: Page, fixedDate: string = '2025-01-15T10:00:00Z'): Promise<void> {
  await page.addInitScript((date) => {
    // Override Date to return fixed time
    const FixedDate = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(date);
        } else {
          super(...args);
        }
      }
      static now() { return new Date(date).getTime(); }
    };
    // @ts-ignore
    window.Date = FixedDate;

    // Override relative time formatters if present
    if (window.Intl?.RelativeTimeFormat) {
      const origFormat = window.Intl.RelativeTimeFormat.prototype.format;
      window.Intl.RelativeTimeFormat.prototype.format = function (value, unit) {
        return origFormat.call(this, 0, unit); // Always show "now"
      };
    }
  }, fixedDate);
}

/**
 * Self-diff check: capture the same page twice and verify < 0.5% diff.
 * Run this once during Phase 0 setup to validate determinism.
 */
export async function selfDiffCheck(page: Page, url: string): Promise<number> {
  const PNG = require('pngjs').PNG;
  const pixelmatch = require('pixelmatch');

  await page.goto(url);
  await stabilizePage(page);
  const shot1 = await page.screenshot({ fullPage: true });

  await page.goto(url);
  await stabilizePage(page);
  const shot2 = await page.screenshot({ fullPage: true });

  const img1 = PNG.sync.read(shot1);
  const img2 = PNG.sync.read(shot2);
  const diff = new PNG({ width: img1.width, height: img1.height });

  const diffPixels = pixelmatch(
    img1.data, img2.data, diff.data,
    img1.width, img1.height,
    { threshold: 0.1 }
  );

  const diffPercent = (diffPixels / (img1.width * img1.height)) * 100;
  
  if (diffPercent > 0.5) {
    console.error(`DETERMINISM FAILURE: Self-diff is ${diffPercent.toFixed(2)}% (must be < 0.5%)`);
    console.error('Fix: Check for animated content, dynamic timestamps, or random elements');
  } else {
    console.log(`Determinism check passed: ${diffPercent.toFixed(4)}% self-diff`);
  }

  return diffPercent;
}
```

**Before proceeding, validate determinism:**

```bash
# Start .NET app, then run self-diff check on 3-5 representative screens
npx ts-node -e "
  const { chromium } = require('@playwright/test');
  const { selfDiffCheck, freezeTime, stabilizePage } = require('./scripts/stabilize-page');
  
  (async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await freezeTime(page);
    
    const urls = ['/Home', '/LoanApplications/List', '/LoanApplications/Detail/1'];
    for (const url of urls) {
      const diff = await selfDiffCheck(page, 'http://localhost:5000' + url);
      console.log(url + ': ' + diff.toFixed(4) + '%');
    }
    
    await browser.close();
  })();
"
```

If any screen exceeds 0.5% self-diff, fix the determinism issue before proceeding.

### Step 0.1 — Screenshot Capture Script

Create `scripts/capture-baseline.ts`:

```typescript
import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { stabilizePage, freezeTime } from './stabilize-page';

interface ScreenManifest {
  screenId: string;
  route: string;
  uiStates: Array<{ name: string; description: string }>;
}

interface StateTransition {
  name: string;
  actions: Array<{
    type: 'click' | 'fill' | 'select' | 'wait' | 'hover' | 'press';
    selector?: string;
    value?: string;
    timeout?: number;
    key?: string;
  }>;
}

const VIEWPORTS = [
  { width: 1920, height: 1080, label: '1920' },
  { width: 1440, height: 900, label: '1440' },
  { width: 1024, height: 768, label: '1024' },
  { width: 768, height: 1024, label: '768' },
];

const BASE_URL = process.env.DOTNET_APP_URL || 'http://localhost:5000';
const OUTPUT_DIR = path.resolve('./baseline');

async function captureLayoutMetrics(page: Page): Promise<object> {
  return page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    const metrics: any[] = [];
    
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      
      const styles = getComputedStyle(el);
      metrics.push({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        id: el.id || undefined,
        className: el.className?.toString().substring(0, 100) || undefined,
        text: el.textContent?.trim().substring(0, 50) || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
        styles: {
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          fontFamily: styles.fontFamily,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          display: styles.display,
          position: styles.position,
          margin: styles.margin,
          padding: styles.padding,
          border: styles.border,
          gap: styles.gap,
        },
        interactive: {
          disabled: (el as HTMLInputElement).disabled || false,
          readOnly: (el as HTMLInputElement).readOnly || false,
          tabIndex: el.tabIndex,
        },
      });
    });
    
    return {
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      elementCount: metrics.length,
      elements: metrics,
    };
  });
}

async function captureScreen(
  page: Page,
  screenId: string,
  viewport: typeof VIEWPORTS[0],
  stateName: string = 'default'
) {
  const screenshotDir = path.join(OUTPUT_DIR, 'screenshots', screenId, viewport.label);
  fs.mkdirSync(screenshotDir, { recursive: true });
  
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await stabilizePage(page);
  
  await page.screenshot({
    path: path.join(screenshotDir, `${stateName}.png`),
    fullPage: true,
  });
  
  const metrics = await captureLayoutMetrics(page);
  const metricsDir = path.join(OUTPUT_DIR, 'metrics', screenId, viewport.label);
  fs.mkdirSync(metricsDir, { recursive: true });
  fs.writeFileSync(
    path.join(metricsDir, `${stateName}.json`),
    JSON.stringify(metrics, null, 2)
  );
}

async function main() {
  const manifestDir = path.resolve('./manifests');
  const manifestFiles = fs.readdirSync(manifestDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'));
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Freeze time for deterministic captures
  await freezeTime(page);
  
  for (const file of manifestFiles) {
    if (file.includes('.states.')) continue; // skip state scripts
    
    const manifest: ScreenManifest = JSON.parse(
      fs.readFileSync(path.join(manifestDir, file), 'utf-8')
    );
    
    console.log(`Capturing: ${manifest.screenId} (${manifest.route})`);
    
    await page.goto(`${BASE_URL}${manifest.route}`);
    
    // Capture default state at all viewports
    for (const viewport of VIEWPORTS) {
      await captureScreen(page, manifest.screenId, viewport, 'default');
    }
    
    // Capture additional states
    const stateScriptPath = path.join(manifestDir, `${manifest.screenId}.states.json`);
    if (fs.existsSync(stateScriptPath)) {
      const states: StateTransition[] = JSON.parse(
        fs.readFileSync(stateScriptPath, 'utf-8')
      );
      
      for (const state of states) {
        await page.goto(`${BASE_URL}${manifest.route}`);
        await stabilizePage(page);
        
        for (const action of state.actions) {
          switch (action.type) {
            case 'click': await page.click(action.selector!); break;
            case 'fill': await page.fill(action.selector!, action.value!); break;
            case 'select': await page.selectOption(action.selector!, action.value!); break;
            case 'hover': await page.hover(action.selector!); break;
            case 'press': await page.press(action.selector!, action.key!); break;
            case 'wait': await page.waitForTimeout(action.timeout || 1000); break;
          }
          await page.waitForTimeout(200); // settle between actions
        }
        
        for (const viewport of VIEWPORTS) {
          await captureScreen(page, manifest.screenId, viewport, state.name);
        }
      }
    }
  }
  
  await browser.close();
  console.log(`Baseline capture complete: ${OUTPUT_DIR}`);
}

main().catch(console.error);
```

### Step 0.2 — Behavioral Baseline Capture

Create `scripts/capture-baseline-behavior.ts`:

```typescript
import { chromium, Page, Route } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Captures the behavioral contract of each screen:
 * - Which API endpoints are called on load
 * - Which API endpoints are called on each interaction
 * - What navigation occurs on each interaction
 * - What network payloads are sent
 */

interface BehaviorCapture {
  screenId: string;
  route: string;
  onLoad: {
    apiCalls: Array<{ method: string; url: string; status: number; responseShape: object }>;
  };
  interactions: Array<{
    name: string;
    trigger: string;
    apiCalls: Array<{ method: string; url: string; requestPayload?: object; status: number }>;
    navigationTo?: string;
    domChanges: string[];
  }>;
}

const BASE_URL = process.env.DOTNET_APP_URL || 'http://localhost:5000';
const OUTPUT_DIR = path.resolve('./baseline/behaviors');

async function captureOnLoadBehavior(page: Page, manifest: any): Promise<BehaviorCapture['onLoad']> {
  const apiCalls: any[] = [];
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      apiCalls.push({
        method: response.request().method(),
        url: new URL(url).pathname,
        status: response.status(),
      });
    }
  });
  
  await page.goto(`${BASE_URL}${manifest.route}`);
  await page.waitForLoadState('networkidle');
  
  // Capture response shapes for GET requests
  for (const call of apiCalls) {
    if (call.method === 'GET') {
      try {
        const response = await page.request.get(`${BASE_URL}${call.url}`);
        const body = await response.json();
        call.responseShape = extractShape(body);
      } catch (e) {
        call.responseShape = { error: 'could not capture' };
      }
    }
  }
  
  return { apiCalls };
}

function extractShape(obj: any): any {
  if (obj === null) return 'null';
  if (Array.isArray(obj)) return obj.length > 0 ? [extractShape(obj[0])] : '[]';
  if (typeof obj === 'object') {
    const shape: any = {};
    for (const key of Object.keys(obj)) {
      shape[key] = typeof obj[key];
    }
    return shape;
  }
  return typeof obj;
}

async function main() {
  const manifestDir = path.resolve('./manifests');
  const manifestFiles = fs.readdirSync(manifestDir)
    .filter(f => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'));
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  for (const file of manifestFiles) {
    const manifest = JSON.parse(fs.readFileSync(path.join(manifestDir, file), 'utf-8'));
    
    console.log(`Capturing behavior: ${manifest.screenId}`);
    
    const behavior: BehaviorCapture = {
      screenId: manifest.screenId,
      route: manifest.route,
      onLoad: await captureOnLoadBehavior(page, manifest),
      interactions: [],
    };
    
    // Capture interaction behaviors from state scripts if available
    const stateScriptPath = path.join(manifestDir, `${manifest.screenId}.states.json`);
    if (fs.existsSync(stateScriptPath)) {
      const states = JSON.parse(fs.readFileSync(stateScriptPath, 'utf-8'));
      
      for (const state of states) {
        const interaction: any = {
          name: state.name,
          trigger: JSON.stringify(state.actions[0]),
          apiCalls: [],
          domChanges: [],
        };
        
        // Fresh page for each interaction
        const interactionCalls: any[] = [];
        page.on('response', response => {
          if (response.url().includes('/api/')) {
            interactionCalls.push({
              method: response.request().method(),
              url: new URL(response.url()).pathname,
              status: response.status(),
            });
          }
        });
        
        await page.goto(`${BASE_URL}${manifest.route}`);
        await page.waitForLoadState('networkidle');
        interactionCalls.length = 0; // Clear load calls
        
        const beforeUrl = page.url();
        
        // Execute state transition
        for (const action of state.actions) {
          switch (action.type) {
            case 'click': await page.click(action.selector!); break;
            case 'fill': await page.fill(action.selector!, action.value!); break;
            case 'select': await page.selectOption(action.selector!, action.value!); break;
            default: break;
          }
          await page.waitForTimeout(500);
        }
        
        interaction.apiCalls = [...interactionCalls];
        
        const afterUrl = page.url();
        if (afterUrl !== beforeUrl) {
          interaction.navigationTo = new URL(afterUrl).pathname;
        }
        
        behavior.interactions.push(interaction);
        page.removeAllListeners('response');
      }
    }
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${manifest.screenId}.json`),
      JSON.stringify(behavior, null, 2)
    );
  }
  
  await browser.close();
  console.log(`Behavioral baseline complete: ${OUTPUT_DIR}`);
}

main().catch(console.error);
```

### Step 0.3 — Run All Baseline Captures

```bash
# Ensure .NET app is running with seeded test data
cd dotnet-source && dotnet run &

# 1. Validate determinism first
npx ts-node scripts/validate-determinism.ts

# 2. Capture visual baseline (run after Agent 1 has produced manifests)
npx ts-node scripts/capture-baseline.ts

# 3. Capture behavioral baseline
npx ts-node scripts/capture-baseline-behavior.ts
```

---

## Agent 1: Analyst — Claude Code Prompt

### System Prompt (feed to Claude Code)

```
You are the Analyst Agent in an autonomous .NET to React migration pipeline.

## YOUR TASK

Crawl the .NET application at /dotnet-source/ and produce a structured JSON 
manifest for EVERY screen/page. Output one JSON file per screen to /manifests/.

## CRAWL STRATEGY

1. Start with routing configuration:
   - Check RouteConfig.cs, Startup.cs, or attribute routing on controllers
   - Map every route to its controller action and view

2. For each route/screen, analyze:
   a. VIEW LAYER (Razor/CSHTML/ASPX):
      - Component hierarchy (what UI elements exist, their nesting)
      - Form fields with their types, labels, and bindings
      - Data grids/tables with column definitions
      - Navigation elements (tabs, breadcrumbs, links)
      - Modals and dialogs
      - Conditional rendering (@if, @switch, visibility toggles)
   
   b. DATA LAYER (ViewModel/Controller):
      - API endpoints called (HttpClient, Ajax, fetch calls)
      - Request/response shapes (DTOs, ViewModels)
      - Query parameters and route parameters
      - Data transformations in the controller
   
   c. INTERACTIVE CONTRACTS (NEW — capture these explicitly):
      For EVERY interactive element (buttons, links, form fields, dropdowns):
      - What is the trigger? (click, change, blur, submit, hover)
      - What preconditions must be met? (form valid, user role, field state)
      - What action occurs? (API call, navigation, modal open, field update)
      - What payload is sent? (request body shape)
      - What happens on success? (navigate, toast, refresh data)
      - What happens on failure? (error messages, retry)
      These are the most common "silent loss" areas in migration.
   
   d. BUSINESS LOGIC:
      - Validation rules (DataAnnotations, FluentValidation, jQuery Validate)
      - Computed/derived fields
      - Conditional visibility rules (show/hide based on state)
      - Status-based behavior changes
      - Permission/role-based UI changes
   
   e. ENABLE/DISABLE RULES:
      - Which fields become disabled/enabled based on what conditions
      - Which buttons become visible/hidden based on state
      - These are separate from visibility rules and need explicit capture
   
   f. UI STATES:
      - List every distinct visual state the screen can be in
      - For each state: name, description, trigger, visual changes

3. For each business rule AND interactive contract, assign a confidence tier:
   - HIGH: Directly extracted from code (explicit attributes, clear conditionals)
   - MEDIUM: Inferred from patterns (naming conventions, common patterns)
   - LOW: Ambiguous, needs human verification

4. Assign a complexity rating with explicit factors:
   - LOW: Simple display, < 5 components, no forms, < 2 API calls
   - MEDIUM: Forms with validation, data grids, 5-15 components
   - HIGH: Multi-tab, 15+ components, complex state machines, 
     role-based UI, 10+ interactive contracts, 3+ LOW confidence rules

## RENDER MODEL (REQUIRED)

In addition to all v2 requirements, you MUST produce a render-complete renderModel.

1) renderModel.layout (REQUIRED)
- layout.type: single-column | sidebar-detail | split-view | grid
- zones[]: ordered zones with name + children[]
- zone sizing: width/minWidth/maxWidth when applicable
- responsive behavior: stacking or reflow at 768/1024/1440

2) renderModel.components (REQUIRED)
For each component node, include its full render spec.
- forms: sections[] and fields[] fully specified (no placeholders)
- grids: columns[] fully specified (no placeholders) including render types and widths
- tabs: tabs[] include children[] per tab
- modals: content mapping and triggers
- styling: component-level variants + tokenRefs where applicable

3) dataSources.responseShape (REQUIRED)
responseShape may not be empty. Extract concrete shapes from DTOs, ViewModels, or API contracts.
If truly unknown, set confidence LOW and include a best-effort partial shape with unknown markers.

## OUTPUT FORMAT

For each screen, write a JSON file to /manifests/{screenId}.json.
See the manifest schema in the approach document for the exact structure.

Key sections that MUST be present:
- screenId, route, pageTitle
- complexity + complexityFactors (list of specific reasons)
- sourceFiles (exact paths for traceability)
- components.hierarchy
- dataSources (with concrete request/response shapes)
- interactiveContracts (EVERY interactive element)
- businessLogic (display logic, computed fields)
- enableDisableRules (field-level enable/disable conditions)
- uiStates (with triggers and visual changes)
- navigation (inbound and outbound routes)
- cssAnalysis (colors, fonts, spacing, breakpoints)
- renderModel (layout + components, render-complete)

Also generate STATE TRANSITION SCRIPTS for each screen:
/manifests/{screenId}.states.json — Playwright-compatible action sequences
to trigger each UI state for screenshot capture.

## ALSO GENERATE

1. /manifests/_summary.json — All screens with IDs, routes, complexity, 
   and complexity factors

2. /manifests/_api-catalog.json — Deduplicated list of all API endpoints 
   with request/response shapes

3. /manifests/_component-frequency.json — Count of how many screens use 
   each component type (for Agent 2's frequency analysis)

4. /manifests/_business-rules-audit.json — All LOW confidence business 
   rules AND interactive contracts in one file for human review

5. /manifests/_complexity-routing.json — Screens split into 
   "standardBuild" and "guidedBuild" based on complexity:
   guidedBuild criteria: complexity == "high" AND 
   (interactiveContracts with LOW confidence > 3 
    OR complexityFactors.length > 4
    OR total LOW confidence rules > 5)

## IMPORTANT

- Do NOT skip any screen, even simple ones
- Do NOT skip any interactive element — capture EVERY button, link, 
  form field's behavioral contract
- Do NOT guess at business logic — mark as LOW confidence
- Do NOT assume API response shapes — extract from code or mark unknown
- Do NOT use placeholders in renderModel (no `["..."]`)
- DO include exact source file paths for traceability
- DO capture CSS/styling information for design token extraction
- DO generate state transition scripts for screenshot capture
```

### Run Agent 1

```bash
# In Claude Code, from project root:
# Point it at the dotnet-source directory and paste the prompt above
# Claude Code will crawl and generate all manifest files

# After completion, verify:
ls manifests/*.json | wc -l          # Should match screen count
cat manifests/_summary.json | jq '. | length'
cat manifests/_complexity-routing.json | jq '.'
cat manifests/_business-rules-audit.json | jq '. | length'  # Review these
```

---

## Agent 2: Architect/Normalizer — Claude Code Prompt

### System Prompt (feed to Claude Code)

```
You are the Architect Agent in an autonomous .NET to React migration pipeline.

## YOUR TASK

Read ALL manifests in /manifests/ and generate the complete React project 
foundation in /react-app/. Your output must enable multiple parallel Builder 
agents to work independently and produce consistent, compatible code.

## STEP 0: MANIFEST VALIDATION + NORMALIZATION (REQUIRED)

Run a completeness review for every /manifests/{screenId}.json and produce:
- /manifests/_manifest-validation-report.json (pass/fail + missing sections)
- /manifests/_render-model-catalog.json (dedup common form/grid/tab/layout patterns)

Rules:
- Reject any manifest containing `["..."]` placeholders
- Ensure renderModel.layout.zones[] exists and each zone has children[]
- Ensure forms have sections[].fields[] and each field has name/label/inputType/binding
- Ensure grids have columns[] and each column has key/header/width/render
- Ensure tabs have children[] per tab
- Ensure each interactive contract references a real elementId or contractId
- Ensure each dataSource has a non-empty responseShape

If a screen fails, attempt safe normalization:
- normalize IDs (stable componentIds/fieldIds/contractIds)
- fill responseShape from DTOs or API catalog when possible
If failures remain, stop and mark the screen as guidedBuild.

## STEP 1: FREQUENCY ANALYSIS

Read /manifests/_component-frequency.json and all individual manifests.

For each component pattern, determine:
- How many screens use it (frequency count)
- What props/configurations vary across usages
- The minimal prop interface that covers all usages

Rules:
- 3+ usages → shared component in /src/components/shared/
- 2 usages → note as potential shared, implement inline for now
- 1 usage → screen-specific, Agent 3 handles it

## STEP 2: PROJECT SCAFFOLDING

Generate in /react-app/:

### Routing (/src/router.tsx)
- Create routes matching every screen in /manifests/_summary.json
- Mirror the .NET app's URL structure exactly
- Include lazy loading for each page module

### TypeScript Interfaces (/src/types/)
- From /manifests/_api-catalog.json
- One file per domain

### API Hooks (/src/hooks/api/)
- One hook per endpoint using React Query
- Naming: use{Entity}{Action}
- Full TypeScript types on all hooks
- Error handling pattern

### API Client (/src/lib/api-client.ts)
- Fetch wrapper with base URL config
- Auth token injection
- Error interceptor
- Response type parsing

### Shared Components (/src/components/shared/)
- Full TypeScript prop interfaces with JSDoc
- Compound component pattern for complex components
- Each component gets: index.tsx, {Name}.test.tsx, {Name}.types.ts

### Design Tokens — ENFORCED (/src/styles/)

/src/styles/tokens.ts:
```typescript
export const colors = {
  primary: '#2563eb',
  // ... extracted from cssAnalysis across all manifests
} as const;

export const spacing = {
  xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px',
} as const;

export const typography = {
  fontFamily: { primary: "'Segoe UI', Arial, sans-serif" },
  fontSize: { sm: '12px', base: '14px', lg: '16px', xl: '18px', '2xl': '24px' },
} as const;
```

/src/styles/tokens.css:
```css
:root {
  --color-primary: #2563eb;
  /* ... matching tokens.ts */
}
```

ALSO GENERATE an ESLint rule to enforce token usage:

/eslint-rules/no-hardcoded-styles.js:
```javascript
// Flags any inline hex color (#xxx, #xxxxxx), pixel values not from 
// token scale, or font-family declarations that don't use tokens.
// Provides autofix suggestions pointing to the correct token.
```

Add to .eslintrc:
```json
{
  "rules": {
    "local/no-hardcoded-styles": "error"
  }
}
```

### Validation Patterns (/src/schemas/)
- Zod patterns mapping from .NET DataAnnotation patterns
- Reusable validators: required, email, phone, dateRange, etc.

### Utility Hooks (/src/hooks/utils/)
- useVisibility(rules) — conditional visibility based on state
- useFormValidation(schema) — wraps React Hook Form + Zod
- useConfirmation() — modal confirmation pattern
- usePermission(role) — role-based UI gating

### E2E Test Utilities (/e2e/utils/)
- Common assertions: assertNavigatedTo, assertApiCalled, assertFieldDisabled
- Setup helpers: seedTestData, loginAs
- Network helpers: interceptApi, assertPayloadShape

## STEP 3: GENERATE CLAUDE.md

Create /react-app/CLAUDE.md with ALL conventions including:
- Shared components and usage patterns
- API conventions and hook naming
- Design token rules (ENFORCED — no hardcoded values)
- File naming and organization
- Business logic implementation patterns
- Interactive contract implementation patterns
- E2E test generation requirements
- Testing conventions

## STEP 4: GENERATE conversion-config.json

List every available shared resource with import paths, prop interfaces, 
and return types.

## STEP 5: VERIFY

- Run `npm run build` — must compile
- Run `npx eslint src/ --ext .ts,.tsx` — must pass
- Confirm `/manifests/_manifest-validation-report.json` shows no blocking gaps
- Verify CLAUDE.md is comprehensive enough for an independent Claude Code 
  session to follow without seeing your reasoning

## IMPORTANT

- Every decision multiplies across all screens
- Prefer simple, obvious patterns over clever ones
- Design tokens are ENFORCED, not just available
- CLAUDE.md must include E2E test generation requirements
```

### Manifest Completeness Gate (NEW)

Create `scripts/validate-manifests.ts` and run it after Agent 2 outputs:

- Reject placeholders like `["..."]`
- Validate `renderModel.layout.zones[]`
- Validate form fields and grid columns are fully specified
- Validate tab children mappings
- Validate non-empty responseShape
- Validate contract references to real element or contract IDs

The script must write:
- `/manifests/_manifest-validation-report.json`
- `/manifests/_render-model-catalog.json`

If failures exist, stop and route those screens to guidedBuild.

### Run Agent 2

```bash
# In Claude Code, from react-app directory:
# Paste the prompt above

# After completion — HUMAN GATE 1:
# Review these files:
cat react-app/CLAUDE.md
cat react-app/conversion-config.json
cat manifests/_manifest-validation-report.json
cat manifests/_render-model-catalog.json
ls react-app/src/components/shared/
ls react-app/src/hooks/api/
ls react-app/src/types/
cat react-app/src/styles/tokens.ts
cat manifests/_complexity-routing.json  # Review guided-build list

# Verify build
cd react-app && npm run build && npx eslint src/ --ext .ts,.tsx && cd ..

# Run manifest completeness gate
npx ts-node scripts/validate-manifests.ts
```

---

## Agent 3: Builder — Claude Code Prompt Template

### System Prompt (one per screen or batch)

```
You are a Builder Agent in an autonomous .NET to React migration pipeline.

## YOUR TASK

Convert the .NET screen described in the manifest to a fully functional React 
implementation. You MUST follow the conventions in CLAUDE.md exactly.

## INPUTS

- Screen manifest: /manifests/{SCREEN_ID}.json
- React foundation: /react-app/src/
- Conventions: /react-app/CLAUDE.md
- Available resources: /react-app/conversion-config.json
- Behavioral baseline: /baseline/behaviors/{SCREEN_ID}.json (reference for E2E tests)

## NON-INFERENCE RULE (CRITICAL)

You MUST generate the React component tree strictly from manifest.renderModel.
- Do not guess missing fields/columns/layout.
- Do not reorder nodes.
- If the manifest is incomplete, stop and write conversion-notes explaining the missing pieces.

## CONVERSION PROTOCOL

1. READ the manifest completely before writing any code

2. VERIFY renderModel is complete (layout, components, bindings)

3. IDENTIFY shared components from conversion-config.json for each hierarchy element

4. GENERATE these files:

   /src/pages/{Module}/{ScreenName}/index.tsx
   - Main page component matching manifest hierarchy
   - ALL interactive contracts implemented
   - ALL enable/disable rules implemented
   - ALL UI states handled
   - Uses ONLY design tokens for styling (no hardcoded hex/px)

   /src/pages/{Module}/{ScreenName}/{ScreenName}.test.tsx
   - Unit tests for every business rule
   - Unit tests for every enable/disable rule
   - Unit tests for every UI state

   /src/pages/{Module}/{ScreenName}/hooks.ts (if needed)
   /src/pages/{Module}/{ScreenName}/schemas.ts (if needed)

   /e2e/{SCREEN_ID}.spec.ts — E2E BEHAVIORAL TESTS
   - For EVERY interactive contract in the manifest:
     - Test the trigger (click, change, blur, submit)
     - Assert the outcome (API call, navigation, UI change)
     - Verify the payload shape if API call
     - Test success AND failure paths
   - For EVERY navigation link:
     - Assert correct route change
   - For EVERY form:
     - Assert validation timing (onBlur vs onSubmit)
     - Assert error message placement
     - Assert field enable/disable based on state
   - Reference /baseline/behaviors/{SCREEN_ID}.json for expected behavior

   /conversion-notes/{SCREEN_ID}.md
   - Every decision and why
   - ALL LOW confidence items flagged prominently
   - Shared vs. screen-specific components used

4. VERIFY your implementation covers the manifest:
   - [ ] Every component in hierarchy rendered
   - [ ] Every data source has API hook
   - [ ] Every interactive contract implemented
   - [ ] Every enable/disable rule implemented
   - [ ] Every business rule implemented
   - [ ] Every UI state handled
   - [ ] E2E test for every interactive contract
   - [ ] No hardcoded style values (tokens only)

## CONSTRAINTS

- Use ONLY shared components from conversion-config.json
- Use ONLY design tokens (colors, spacing, fonts)
- Follow ALL conventions in CLAUDE.md
- Do NOT create new shared components
- Do NOT introduce patterns not in CLAUDE.md
- If ambiguous, implement best interpretation AND flag as LOW confidence

## SCREEN TO CONVERT

Screen ID: {SCREEN_ID}
```

### Parallel Execution Script

Create `scripts/run-builders.sh`:

```bash
#!/bin/bash
# Run multiple Builder agents in parallel

MANIFEST_DIR="./manifests"
ROUTING=$(cat ${MANIFEST_DIR}/_complexity-routing.json)

STANDARD_SCREENS=$(echo $ROUTING | jq -r '.standardBuild[]')
GUIDED_SCREENS=$(echo $ROUTING | jq -r '.guidedBuild[]')

STANDARD_COUNT=$(echo "$STANDARD_SCREENS" | wc -l)
GUIDED_COUNT=$(echo "$GUIDED_SCREENS" | wc -l)

echo "=========================================="
echo "  BUILDER EXECUTION PLAN"
echo "=========================================="
echo "Standard build: ${STANDARD_COUNT} screens (parallel)"
echo "Guided build:   ${GUIDED_COUNT} screens (with human input)"
echo ""

# Split standard screens into parallel batches
MAX_PARALLEL=${MAX_PARALLEL:-5}
BATCH_SIZE=$(( STANDARD_COUNT / MAX_PARALLEL + 1 ))

echo "--- STANDARD BUILD BATCHES ---"
BATCH_NUM=0
echo "$STANDARD_SCREENS" | xargs -n $BATCH_SIZE | while read batch; do
  BATCH_NUM=$((BATCH_NUM + 1))
  echo "Batch ${BATCH_NUM}: ${batch}"
done

echo ""
echo "--- GUIDED BUILD SCREENS ---"
echo "(These need human annotation before Builder runs)"
echo "$GUIDED_SCREENS" | while read screen; do
  echo "  - ${screen}"
  echo "    Review: manifests/${screen}.json"
  echo "    Annotate: LOW confidence interactive contracts"
done

echo ""
echo "INSTRUCTIONS:"
echo "1. For GUIDED screens: review manifests, add clarifying notes"
echo "2. Launch ${MAX_PARALLEL} Claude Code sessions for standard batches"
echo "3. Launch 1-2 Claude Code sessions for guided screens"
echo "4. All sessions use the Builder prompt template"
echo "5. Wait for ALL sessions to complete before proceeding"
```

---

## Agent 4: Validator — Complete Pipeline

### Step 4.1 — React Screenshot Capture

Same as baseline capture but targeting the React app:

```bash
# capture-react.ts is identical to capture-baseline.ts
# except: BASE_URL = 'http://localhost:5173'
# and: OUTPUT_DIR = './validation/screenshots'
# (Also captures metrics to ./validation/metrics/)
```

### Step 4.2 — Pixel Comparison

`scripts/pixel-compare.ts` — same as v1 (see v1 implementation doc).

### Step 4.3 — DOM Metrics Comparison

`scripts/compare-metrics.ts` — same as v1 (see v1 implementation doc).

### Step 4.4 — E2E Functional Parity Tests (NEW in v2)

```bash
#!/bin/bash
# scripts/run-e2e-parity.sh
# Runs E2E behavioral tests against the React app

echo "Running E2E functional parity tests..."

# Run all E2E specs generated by Agent 3
npx playwright test e2e/ \
  --reporter=json \
  --output=validation/e2e-results/ \
  2>&1 | tee validation/e2e-results/output.log

# Parse results per screen
npx ts-node -e "
const fs = require('fs');
const results = JSON.parse(fs.readFileSync('validation/e2e-results/results.json', 'utf-8'));

const byScreen = {};
for (const suite of results.suites) {
  const screenId = suite.title; // E2E files are named {screenId}.spec.ts
  byScreen[screenId] = {
    total: suite.specs.length,
    passed: suite.specs.filter(s => s.ok).length,
    failed: suite.specs.filter(s => !s.ok).length,
    failures: suite.specs
      .filter(s => !s.ok)
      .map(s => ({ test: s.title, error: s.tests[0]?.results[0]?.error?.message })),
  };
}

fs.writeFileSync(
  'validation/e2e-results/summary.json',
  JSON.stringify(byScreen, null, 2)
);

const totalPassed = Object.values(byScreen).reduce((s, v) => s + v.passed, 0);
const totalFailed = Object.values(byScreen).reduce((s, v) => s + v.failed, 0);
console.log('E2E Results: ' + totalPassed + ' passed, ' + totalFailed + ' failed');
"
```

### Step 4.5 — Accessibility Checks (NEW in v2)

```bash
#!/bin/bash
# scripts/run-a11y-checks.sh

echo "Running accessibility checks..."

npx playwright test e2e/a11y-baseline.spec.ts \
  --reporter=json \
  --output=validation/a11y-results/

# a11y-baseline.spec.ts is generated by Agent 2 and runs axe-core
# against every screen route, checking:
# - All form inputs have labels
# - Focus order follows visual order
# - No critical axe-core violations
# - Keyboard navigation works for primary flows
```

### Step 4.6 — Generate Composite Scorecard (NEW in v2)

Create `scripts/generate-scorecard.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface ScreenScorecard {
  screenId: string;
  overall: 'PASS' | 'NEEDS_REVIEW' | 'FAIL';
  dimensions: {
    visualFidelity: { status: string; maxDiffPercent: number };
    structuralParity: { status: string; criticalDeltas: number };
    functionalParity: { status: string; e2ePassed: number; e2eFailed: number };
    uiStateCoverage: { status: string; statesCovered: number; statesTotal: number };
    accessibility: { status: string; criticalViolations: number };
    performance: { status: string; loadTimeMs: number; maxBundleKb: number };
  };
  failureReasons: string[];
}

function generateScorecard(screenId: string): ScreenScorecard {
  const scorecard: ScreenScorecard = {
    screenId,
    overall: 'PASS',
    dimensions: {} as any,
    failureReasons: [],
  };

  // Visual fidelity (from pixel comparison)
  const pixelPath = `validation/scorecards/${screenId}.json`;
  if (fs.existsSync(pixelPath)) {
    const pixel = JSON.parse(fs.readFileSync(pixelPath, 'utf-8'));
    scorecard.dimensions.visualFidelity = {
      status: pixel.overall,
      maxDiffPercent: pixel.maxDiffPercentage,
    };
    if (pixel.overall !== 'PASS') {
      scorecard.failureReasons.push(`Visual diff: ${pixel.maxDiffPercentage}%`);
    }
  }

  // Structural parity (from metrics comparison)
  const metricsDir = `validation/metrics-deltas/${screenId}`;
  if (fs.existsSync(metricsDir)) {
    let criticalCount = 0;
    // Count critical deltas across all viewports/states
    const walkDir = (dir: string) => {
      for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walkDir(fullPath);
        } else if (file.endsWith('.json')) {
          const deltas = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          criticalCount += deltas.filter((d: any) => d.severity === 'critical').length;
        }
      }
    };
    walkDir(metricsDir);

    scorecard.dimensions.structuralParity = {
      status: criticalCount === 0 ? 'PASS' : 'FAIL',
      criticalDeltas: criticalCount,
    };
    if (criticalCount > 0) {
      scorecard.failureReasons.push(`${criticalCount} critical structural deltas`);
    }
  }

  // Functional parity (from E2E tests)
  const e2ePath = 'validation/e2e-results/summary.json';
  if (fs.existsSync(e2ePath)) {
    const e2e = JSON.parse(fs.readFileSync(e2ePath, 'utf-8'));
    const screenE2e = e2e[screenId];
    if (screenE2e) {
      scorecard.dimensions.functionalParity = {
        status: screenE2e.failed === 0 ? 'PASS' : 'FAIL',
        e2ePassed: screenE2e.passed,
        e2eFailed: screenE2e.failed,
      };
      if (screenE2e.failed > 0) {
        scorecard.failureReasons.push(
          `${screenE2e.failed} E2E failures: ${screenE2e.failures.map((f: any) => f.test).join(', ')}`
        );
      }
    }
  }

  // UI state coverage
  const manifestPath = `manifests/${screenId}.json`;
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const expectedStates = manifest.uiStates?.length || 0;
    const capturedDir = `validation/screenshots/${screenId}/1920`;
    const capturedStates = fs.existsSync(capturedDir)
      ? fs.readdirSync(capturedDir).filter(f => f.endsWith('.png')).length
      : 0;

    scorecard.dimensions.uiStateCoverage = {
      status: capturedStates >= expectedStates ? 'PASS' : 'FAIL',
      statesCovered: capturedStates,
      statesTotal: expectedStates,
    };
    if (capturedStates < expectedStates) {
      scorecard.failureReasons.push(
        `Missing states: ${capturedStates}/${expectedStates} captured`
      );
    }
  }

  // Overall: FAIL if ANY dimension fails
  const statuses = Object.values(scorecard.dimensions).map((d: any) => d.status);
  if (statuses.includes('FAIL')) {
    scorecard.overall = 'FAIL';
  } else if (statuses.includes('NEEDS_REVIEW')) {
    scorecard.overall = 'NEEDS_REVIEW';
  } else {
    scorecard.overall = 'PASS';
  }

  return scorecard;
}

// Generate for all screens
const summary = JSON.parse(fs.readFileSync('manifests/_summary.json', 'utf-8'));
const allScorecards: ScreenScorecard[] = [];

for (const screen of summary) {
  const scorecard = generateScorecard(screen.screenId);
  allScorecards.push(scorecard);
  
  fs.mkdirSync('validation/scorecards', { recursive: true });
  fs.writeFileSync(
    `validation/scorecards/${screen.screenId}-composite.json`,
    JSON.stringify(scorecard, null, 2)
  );
}

// Write composite summary
const compositeSummary = {
  total: allScorecards.length,
  pass: allScorecards.filter(s => s.overall === 'PASS').length,
  needsReview: allScorecards.filter(s => s.overall === 'NEEDS_REVIEW').length,
  fail: allScorecards.filter(s => s.overall === 'FAIL').length,
  topFailureReasons: getTopFailureReasons(allScorecards),
  screens: allScorecards.map(s => ({
    screenId: s.screenId,
    overall: s.overall,
    failureReasons: s.failureReasons,
  })),
};

function getTopFailureReasons(scorecards: ScreenScorecard[]): Record<string, number> {
  const reasons: Record<string, number> = {};
  for (const sc of scorecards) {
    for (const reason of sc.failureReasons) {
      // Normalize reason to category
      const category = reason.includes('Visual diff') ? 'Visual drift'
        : reason.includes('structural') ? 'Structural delta'
        : reason.includes('E2E') ? 'Functional parity'
        : reason.includes('states') ? 'Missing UI states'
        : reason.includes('a11y') ? 'Accessibility'
        : 'Other';
      reasons[category] = (reasons[category] || 0) + 1;
    }
  }
  return reasons;
}

fs.writeFileSync(
  'validation/scorecards/_composite-summary.json',
  JSON.stringify(compositeSummary, null, 2)
);

console.log('\n=== COMPOSITE VALIDATION SUMMARY ===');
console.log(`PASS:         ${compositeSummary.pass}/${compositeSummary.total}`);
console.log(`NEEDS REVIEW: ${compositeSummary.needsReview}/${compositeSummary.total}`);
console.log(`FAIL:         ${compositeSummary.fail}/${compositeSummary.total}`);
console.log('\nTop Failure Reasons:');
for (const [reason, count] of Object.entries(compositeSummary.topFailureReasons)) {
  console.log(`  ${reason}: ${count} screens`);
}
```

### Step 4.7 — Claude Vision Semantic Comparison Prompt

Same as v1 (for screens in NEEDS_REVIEW band). See v1 implementation doc.

---

## Agent 5: Fixer — Claude Code Prompt (Updated with Manifest Patching)

```
You are the Fixer Agent in an autonomous .NET to React migration pipeline.

## YOUR TASK

Fix the converted React screen that failed validation. You have specific 
feedback about what's wrong across MULTIPLE validation dimensions.

## INPUTS

- Converted screen: /src/pages/{Module}/{ScreenName}/
- Composite scorecard: /validation/scorecards/{SCREEN_ID}-composite.json
- Pixel diff images: /validation/diffs/{SCREEN_ID}/ (if visual failure)
- DOM metric deltas: /validation/metrics-deltas/{SCREEN_ID}/ (if structural failure)
- E2E test failures: /validation/e2e-results/summary.json (if functional failure)
- Vision assessment: /validation/vision/{SCREEN_ID}.json (if available)
- Manifest: /manifests/{SCREEN_ID}.json
- Baseline screenshots: /baseline/screenshots/{SCREEN_ID}/
- Behavioral baseline: /baseline/behaviors/{SCREEN_ID}.json

## FIX STRATEGY

1. READ the composite scorecard — understand WHICH dimensions failed
2. PRIORITIZE:
   - Functional failures first (E2E) — these indicate broken behavior
   - Structural failures next (DOM deltas) — missing/misplaced elements
   - Visual failures last (pixel diff) — styling issues
3. For E2E failures:
   - Read the test name and error message
   - Check the interactive contract in the manifest
   - Fix the component logic (wrong endpoint, missing handler, wrong validation timing)
   - Fix the E2E test only if the test itself has a bug (not the component)
4. For structural/visual failures:
   - Use DOM metric deltas for precise CSS corrections
   - Ensure all style values use design tokens
5. If the root cause is incomplete or incorrect manifest data:
   - Emit a manifest patch (do NOT guess in code)
   - Mark the screen for Agent 2 normalization re-run
6. APPLY targeted fixes — change only what's needed
6. Do NOT refactor or restructure

## DOCUMENT

/conversion-notes/{SCREEN_ID}-fix-{ATTEMPT}.md:
- Which dimension(s) failed and why
- What specific changes were made
- Why these changes address the failures

## CONSTRAINTS

- Follow CLAUDE.md conventions
- Do NOT change shared components
- Do NOT change API hooks
- Use design tokens only (no hardcoded styles)
- Make minimal, targeted changes
- Prefer manifest patch over code changes when renderModel is incomplete
```

---

## Orchestrator Script (Updated for v2)

Create `scripts/orchestrate.sh`:

```bash
#!/bin/bash
set -e

MAX_FIX_RETRIES=3

echo "=========================================="
echo "  AUTONOMOUS .NET TO REACT MIGRATION v2"
echo "=========================================="

# ----------------------------------------
# Phase 0: Baseline Capture
# ----------------------------------------
echo ""
echo "[Phase 0] Setting up deterministic baseline..."
echo "Ensure .NET app is running with seeded test data"
read -p "Press Enter when ready..."

echo "Validating determinism..."
npx ts-node scripts/validate-determinism.ts
echo ""

echo "Capturing visual baseline..."
npx ts-node scripts/capture-baseline.ts
echo ""

echo "Capturing behavioral baseline..."
npx ts-node scripts/capture-baseline-behavior.ts
echo ""

# ----------------------------------------
# Agent 1: Analyst
# ----------------------------------------
echo "[Agent 1] Run Analyst in Claude Code (paste Agent 1 prompt)"
read -p "Press Enter when complete..."
MANIFEST_COUNT=$(ls manifests/*.json 2>/dev/null | grep -v '_' | grep -v '.states.' | wc -l)
echo "Found ${MANIFEST_COUNT} screen manifests"

LOW_CONFIDENCE=$(cat manifests/_business-rules-audit.json | jq '. | length')
echo "LOW confidence items to review: ${LOW_CONFIDENCE}"
echo ""

# ----------------------------------------
# Agent 2: Architect/Normalizer
# ----------------------------------------
echo "[Agent 2] Run Architect/Normalizer in Claude Code (paste Agent 2 prompt)"
read -p "Press Enter when complete..."
cd react-app && npm run build && npx eslint src/ --ext .ts,.tsx && cd ..
echo "Build and lint passed."
echo ""

echo "Validating manifest completeness..."
npx ts-node scripts/validate-manifests.ts
echo ""

# ----------------------------------------
# HUMAN GATE 1
# ----------------------------------------
echo "=========================================="
echo "  ▌ HUMAN GATE 1: ARCHITECTURE REVIEW ▌"
echo "=========================================="
echo "Review: CLAUDE.md, conversion-config.json, shared components,"
echo "        design tokens, complexity routing plan,"
echo "        manifest validation report and render-model catalog"
echo ""

GUIDED=$(cat manifests/_complexity-routing.json | jq '.guidedBuild | length')
echo "Guided-build screens needing human annotation: ${GUIDED}"
echo ""
read -p "Approve architecture? (y/n): " APPROVE
[ "$APPROVE" != "y" ] && echo "Rejected. Fix and re-run Agent 2." && exit 1

if [ "$GUIDED" -gt 0 ]; then
  echo "Annotate guided-build screen manifests now."
  read -p "Press Enter when annotations complete..."
fi
echo ""

# ----------------------------------------
# Agent 3: Builder
# ----------------------------------------
echo "[Agent 3] Running parallel Builder sessions..."
bash scripts/run-builders.sh
read -p "Press Enter when ALL Builder sessions complete..."
cd react-app && npm run build && npx eslint src/ --ext .ts,.tsx && cd ..
echo "Build and lint passed."
echo ""

# ----------------------------------------
# Agent 4 + 5: Validate and Fix Loop
# ----------------------------------------
echo "[Agent 4+5] Starting validation pipeline..."
echo "Ensure React app is running at ${REACT_APP_URL:-http://localhost:5173}"
read -p "Press Enter when ready..."

for ATTEMPT in $(seq 1 $MAX_FIX_RETRIES); do
  echo ""
  echo "--- Validation Attempt ${ATTEMPT}/${MAX_FIX_RETRIES} ---"
  
  # Visual validation
  npx ts-node scripts/capture-react.ts
  npx ts-node scripts/pixel-compare.ts
  npx ts-node scripts/compare-metrics.ts
  
  # Functional validation
  bash scripts/run-e2e-parity.sh
  
  # Accessibility validation
  bash scripts/run-a11y-checks.sh
  
  # Composite scorecard
  npx ts-node scripts/generate-scorecard.ts
  
  # Generate dashboard
  npx ts-node scripts/generate-dashboard.ts
  
  SUMMARY=$(cat validation/scorecards/_composite-summary.json)
  PASS=$(echo $SUMMARY | jq '.pass')
  REVIEW=$(echo $SUMMARY | jq '.needsReview')
  FAIL=$(echo $SUMMARY | jq '.fail')
  TOTAL=$(echo $SUMMARY | jq '.total')
  
  echo ""
  echo "Results: PASS=${PASS} REVIEW=${REVIEW} FAIL=${FAIL} / ${TOTAL}"
  echo "Top failures:"
  echo $SUMMARY | jq '.topFailureReasons'
  echo ""
  echo "Dashboard: validation/dashboard.html"
  
  if [ "$FAIL" -eq 0 ] && [ "$REVIEW" -eq 0 ]; then
    echo "All screens passed all dimensions!"
    break
  fi
  
  if [ "$ATTEMPT" -lt "$MAX_FIX_RETRIES" ]; then
    echo "[Agent 5] Fix failed screens (feed composite scorecards to Agent 5 prompt)"
    read -p "Press Enter when fixes complete..."
  fi
done

# ----------------------------------------
# Final Summary
# ----------------------------------------
echo ""
echo "=========================================="
echo "  MIGRATION COMPLETE"
echo "=========================================="

FINAL=$(cat validation/scorecards/_composite-summary.json)
echo "PASS:         $(echo $FINAL | jq '.pass') screens"
echo "NEEDS REVIEW: $(echo $FINAL | jq '.needsReview') screens"
echo "FAIL:         $(echo $FINAL | jq '.fail') screens"
echo ""
echo "Dashboard: validation/dashboard.html"

HUMAN_QUEUE=$(($(echo $FINAL | jq '.needsReview') + $(echo $FINAL | jq '.fail')))
if [ "$HUMAN_QUEUE" -gt 0 ]; then
  echo ""
  echo "▌ HUMAN GATE 2: ${HUMAN_QUEUE} screens need manual review ▌"
  echo "See validation/scorecards/ for per-screen details"
fi
```

---

## Quick Reference: Running the Pipeline

```bash
# 1. Setup
npm install && npx playwright install chromium

# 2. Agent 1: Analyst → manifests/*.json
# 3. Validate determinism → fix any > 0.5% self-diff
# 4. Phase 0: Baseline → baseline/screenshots, baseline/behaviors
# 5. Agent 2: Architect/Normalizer → react-app foundation + manifest validation
#    ▌ HUMAN GATE 1: review CLAUDE.md, tokens, complexity routing, manifest validation report
# 6. Annotate guided-build screens (if any)
# 7. Agent 3: Builder (parallel) → screens + E2E tests
# 8. Agent 4: Validate (visual + functional + a11y + perf)
# 9. Agent 5: Fix failures (up to 3x)
#    ▌ HUMAN GATE 2: remaining failures
# 10. Done → dashboard at validation/dashboard.html
```
