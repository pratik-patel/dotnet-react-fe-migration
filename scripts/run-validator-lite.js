const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const manifestsDir = path.join(ROOT, 'artifacts', 'manifests');
const pagesDir = path.join(ROOT, 'react-app', 'src', 'pages');
const e2eDir = path.join(ROOT, 'react-app', 'e2e');
const scoreDir = path.join(ROOT, 'artifacts', 'validation', 'scorecards');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function exists(p) { return fs.existsSync(p); }

function dim(pass, detail) { return { pass, detail }; }

function main() {
  if (!exists(manifestsDir)) {
    console.error('Missing manifests');
    process.exit(1);
  }
  const summaryPath = path.join(manifestsDir, '_summary.json');
  if (!exists(summaryPath)) {
    console.error('Missing _summary.json');
    process.exit(1);
  }

  const summary = readJson(summaryPath);
  const totals = { total: 0, pass: 0, needsReview: 0, fail: 0, criticalFailures: 0 };

  for (const s of summary) {
    const id = s.screenId;
    const manifestPath = path.join(manifestsDir, `${id}.json`);
    const pagePath = path.join(pagesDir, `${id}.tsx`);
    const e2ePath = path.join(e2eDir, `${id}.spec.ts`);

    const manifest = exists(manifestPath) ? readJson(manifestPath) : null;
    const pageText = exists(pagePath) ? fs.readFileSync(pagePath, 'utf8') : '';

    const visual = dim(false, 'Requires browser baseline/react screenshots; not executed in lite mode.');
    const structural = dim(!!manifest && exists(pagePath), exists(pagePath) ? 'Page file exists for manifest.' : 'Missing generated page file.');
    const functional = dim(!!manifest && exists(e2ePath), exists(e2ePath) ? 'E2E spec generated.' : 'Missing E2E spec.');

    const stateCount = Array.isArray(manifest?.uiStates) ? manifest.uiStates.length : 0;
    const stateCoverage = dim(stateCount === 0 || pageText.includes('UI_STATES'), stateCount === 0 ? 'No uiStates declared.' : 'UI_STATES constant generated from manifest.');

    const a11y = dim(pageText.includes('data-testid="screen-'), pageText.includes('data-testid="screen-') ? 'Screen root testid present.' : 'Missing screen testid.');
    const performance = dim(true, 'No heavy runtime logic added in generated screen shell.');

    const dimensions = { visual, structural, functional, stateCoverage, a11y, performance };
    const requiredDims = ['visual', 'structural', 'functional', 'stateCoverage', 'a11y', 'performance'];
    const failedDims = requiredDims.filter((d) => !dimensions[d].pass);

    let status = 'PASS';
    if (failedDims.includes('structural') || failedDims.includes('functional')) status = 'FAIL';
    else if (failedDims.length > 0) status = 'NEEDS_REVIEW';

    const scorecard = {
      screenId: id,
      route: s.route,
      status,
      dimensions,
      failedDimensions: failedDims,
      mode: 'lite',
      note: 'Lite validator used because full TS/Playwright toolchain was unavailable in this environment.'
    };

    fs.writeFileSync(path.join(scoreDir, `${id}-composite.json`), JSON.stringify(scorecard, null, 2));

    totals.total += 1;
    if (status === 'PASS') totals.pass += 1;
    else if (status === 'NEEDS_REVIEW') totals.needsReview += 1;
    else totals.fail += 1;
    if (status === 'FAIL') totals.criticalFailures += 1;
  }

  fs.writeFileSync(
    path.join(scoreDir, '_composite-summary.json'),
    JSON.stringify({ ...totals, mode: 'lite' }, null, 2),
  );

  console.log(`Lite validation complete: ${totals.total} screens`);
}

main();
