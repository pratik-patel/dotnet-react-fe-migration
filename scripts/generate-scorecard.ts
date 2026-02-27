import fs from 'node:fs';
import path from 'node:path';

type Overall = 'PASS' | 'NEEDS_REVIEW' | 'FAIL';
type DimStatus = 'PASS' | 'NEEDS_REVIEW' | 'FAIL';

const ROOT = process.cwd();
const manifestsDir = path.join(ROOT, 'artifacts', 'manifests');
const outDir = path.join(ROOT, 'artifacts', 'validation', 'scorecards');
const e2ePath = path.join(ROOT, 'artifacts', 'validation', 'e2e-results', 'summary.json');
const a11yPath = path.join(ROOT, 'artifacts', 'validation', 'a11y-results', 'summary.json');
const perfPath = path.join(ROOT, 'artifacts', 'validation', 'perf-results', 'summary.json');

function listScreenIds(): string[] {
  const summaryPath = path.join(manifestsDir, '_summary.json');
  if (fs.existsSync(summaryPath)) {
    const s = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    return s.map((x: any) => x.screenId);
  }
  return fs
    .readdirSync(manifestsDir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !f.includes('.states.'))
    .map((f) => path.basename(f, '.json'));
}

function readJson(p: string, fallback: any): any {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
}

function passFailOrReview(hasData: boolean, passCondition: boolean): DimStatus {
  if (!hasData) return 'NEEDS_REVIEW';
  return passCondition ? 'PASS' : 'FAIL';
}

function score(screenId: string, e2e: Record<string, any>, a11y: Record<string, any>, perf: Record<string, any>) {
  const pixel = readJson(path.join(outDir, `${screenId}.json`), { overall: 'PASS', maxDiffPercentage: 0 });
  const metricsDeltaDir = path.join(ROOT, 'artifacts', 'validation', 'metrics-deltas', screenId);
  let criticalDeltas = 0;

  if (fs.existsSync(metricsDeltaDir)) {
    const stack = [metricsDeltaDir];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const item of fs.readdirSync(cur)) {
        const full = path.join(cur, item);
        if (fs.statSync(full).isDirectory()) stack.push(full);
        if (item.endsWith('.json') && fs.statSync(full).isFile()) {
          const deltas = readJson(full, []);
          criticalDeltas += Array.isArray(deltas)
            ? deltas.filter((d) => d.severity === 'critical').length
            : 0;
        }
      }
    }
  }

  const manifest = readJson(path.join(manifestsDir, `${screenId}.json`), {});
  const expectedStates = Array.isArray(manifest.uiStates) ? manifest.uiStates.length : 0;
  const capturedStatesDir = path.join(ROOT, 'artifacts', 'validation', 'screenshots', screenId, '1920');
  const capturedStates = fs.existsSync(capturedStatesDir)
    ? fs.readdirSync(capturedStatesDir).filter((f) => f.endsWith('.png')).length
    : 0;

  const e = e2e[screenId] || { passed: 0, failed: 0 };
  const a = a11y[screenId];
  const p = perf[screenId];

  const dims = {
    visualFidelity: (pixel.overall === 'FAIL' ? 'FAIL' : pixel.overall === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'PASS') as DimStatus,
    structuralParity: passFailOrReview(fs.existsSync(metricsDeltaDir), criticalDeltas === 0),
    functionalParity: passFailOrReview(!!e2e[screenId], e.failed === 0),
    uiStateCoverage: passFailOrReview(expectedStates > 0, capturedStates >= expectedStates),
    accessibilityBaseline: passFailOrReview(!!a, (a?.criticalViolations || 0) === 0),
    performanceGuardrail: passFailOrReview(
      !!p,
      (p?.loadTimeMs || Number.MAX_SAFE_INTEGER) <= 3000 &&
        (p?.maxBundleKb || Number.MAX_SAFE_INTEGER) <= 250
    ),
  };

  const statuses = Object.values(dims);
  const overall: Overall = statuses.includes('FAIL') ? 'FAIL' : statuses.includes('NEEDS_REVIEW') ? 'NEEDS_REVIEW' : 'PASS';

  return {
    screenId,
    overall,
    dimensions: {
      visualFidelity: { status: dims.visualFidelity, maxDiffPercent: pixel.maxDiffPercentage || 0 },
      structuralParity: { status: dims.structuralParity, criticalDeltas },
      functionalParity: { status: dims.functionalParity, e2ePassed: e.passed || 0, e2eFailed: e.failed || 0 },
      uiStateCoverage: { status: dims.uiStateCoverage, statesCovered: capturedStates, statesTotal: expectedStates },
      accessibilityBaseline: {
        status: dims.accessibilityBaseline,
        criticalViolations: a?.criticalViolations ?? null,
      },
      performanceGuardrail: {
        status: dims.performanceGuardrail,
        loadTimeMs: p?.loadTimeMs ?? null,
        maxBundleKb: p?.maxBundleKb ?? null,
      },
    },
  };
}

function main(): void {
  fs.mkdirSync(outDir, { recursive: true });
  const ids = listScreenIds();
  const e2e = readJson(e2ePath, {});
  const a11y = readJson(a11yPath, {});
  const perf = readJson(perfPath, {});

  const cards = ids.map((id) => score(id, e2e, a11y, perf));
  cards.forEach((c) => fs.writeFileSync(path.join(outDir, `${c.screenId}-composite.json`), JSON.stringify(c, null, 2)));

  const summary = {
    total: cards.length,
    pass: cards.filter((c) => c.overall === 'PASS').length,
    needsReview: cards.filter((c) => c.overall === 'NEEDS_REVIEW').length,
    fail: cards.filter((c) => c.overall === 'FAIL').length,
    criticalFailures: cards.filter(
      (c) =>
        c.overall === 'FAIL' ||
        c.dimensions.structuralParity.status === 'FAIL' ||
        c.dimensions.functionalParity.status === 'FAIL' ||
        c.dimensions.accessibilityBaseline.status === 'FAIL' ||
        c.dimensions.performanceGuardrail.status === 'FAIL'
    ).length,
  };

  fs.writeFileSync(path.join(outDir, '_composite-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
}

main();
