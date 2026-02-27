#!/usr/bin/env bash
set -euo pipefail

export TS_NODE_TRANSPILE_ONLY=1
export TS_NODE_COMPILER_OPTIONS='{"moduleResolution":"NodeNext"}'

mkdir -p artifacts/validation/e2e-results

if [ -d "artifacts/manifests" ]; then
  npx ts-node scripts/generate-e2e-from-manifests.ts
fi

if [ -d "react-app/e2e" ] || [ -d "react-app/e2e-generated" ]; then
  (
    cd react-app
    npx playwright test e2e e2e-generated --reporter=json > ../artifacts/validation/e2e-results/results.json
  ) || true
else
  echo '{"suites":[]}' > artifacts/validation/e2e-results/results.json
fi

node -e '
const fs = require("fs");
const p = "artifacts/validation/e2e-results/results.json";
const r = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { suites: [] };
const byScreen = {};

function addFailure(screenId) {
  if (!byScreen[screenId]) byScreen[screenId] = { total: 0, passed: 0, failed: 0, errors: [] };
  byScreen[screenId].total += 1;
  byScreen[screenId].failed += 1;
}

function walkSuite(suite) {
  const specs = suite.specs || [];
  for (const spec of specs) {
    const file = (spec.file || "").split("/").pop() || "unknown.spec.ts";
    const id = file.replace(/\.spec\.ts$/, "");
    const specPassed = !!spec.ok;
    if (!byScreen[id]) byScreen[id] = { total: 0, passed: 0, failed: 0, errors: [] };
    byScreen[id].total += 1;
    if (specPassed) byScreen[id].passed += 1;
    else byScreen[id].failed += 1;
  }
  for (const child of (suite.suites || [])) walkSuite(child);
}
for (const s of (r.suites || [])) walkSuite(s);

for (const err of (r.errors || [])) {
  const file = err?.location?.file || "";
  const base = file.split("/").pop() || "unknown.spec.ts";
  const id = base.replace(/\.spec\.ts$/, "") || "unknown";
  addFailure(id);
  if (!byScreen[id].errors) byScreen[id].errors = [];
  byScreen[id].errors.push(err.message || "Unknown Playwright error");
}

fs.writeFileSync("artifacts/validation/e2e-results/summary.json", JSON.stringify(byScreen, null, 2));
console.log("E2E summary written");
'
